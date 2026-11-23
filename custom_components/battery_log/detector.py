"""Detect past battery replacements from long-term statistics.

Design rule: this module never raises. Every step is wrapped, problems are collected
with a short code, the device, the exception type and message, and the counters of what
was added or skipped are always returned, so a screenshot of the result is enough to
see what went wrong.

Error codes
  BL-D01  the recorder is not available (nothing was checked)
  BL-D02  reading the statistics of one device failed (that device was skipped)
  BL-D03  analysing the readings of one device failed (that device was skipped)
  BL-D04  storing a result for one device failed (others were still stored)
  BL-D05  saving the "scan done" mark failed
  BL-D00  anything unexpected (the run stopped, counters show what was done before)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from homeassistant.core import HomeAssistant

from .const import MANUAL_SOURCES, SOURCE_DETECT
from .logic import (
    candidate_note,
    detect_replacements,
    format_errors,
    history_windows,
    merge_history,
    normalize_rows,
    parse_iso,
)

_LOGGER = logging.getLogger(__name__)

FIRST_SEEN_NOTE = "First seen on the network (first recorded level)"


def _error(code: str, device: str, exc: Exception) -> dict[str, str]:
    return {"code": code, "device": device, "type": type(exc).__name__, "detail": str(exc)[:140]}


async def _read_rows(
    hass: HomeAssistant,
    entity_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
    period: str = "hour",
) -> list[tuple[float, float]]:
    """(timestamp, level) rows of one sensor from the long-term statistics."""
    from homeassistant.components.recorder import get_instance
    from homeassistant.components.recorder.statistics import statistics_during_period

    if start is None:
        start = datetime(2000, 1, 1, tzinfo=timezone.utc)
    data = await get_instance(hass).async_add_executor_job(
        statistics_during_period, hass, start, end, {entity_id}, period, None, {"mean", "min", "max"}
    )
    return normalize_rows(data.get(entity_id, []))


async def read_level_history(hass: HomeAssistant, entity_id: str, now: float) -> list[list[float]]:
    """Level history for the popup: daily points for the older part, hourly for the last 60 days."""
    start, split = history_windows(now)
    to_dt = lambda ts: datetime.fromtimestamp(ts, tz=timezone.utc)  # noqa: E731
    old = await _read_rows(hass, entity_id, to_dt(start), to_dt(split), "day")
    recent = await _read_rows(hass, entity_id, to_dt(split), None, "hour")
    return merge_history(old, recent, split)


async def async_detect_history(
    manager: Any,
    *,
    dry_run: bool = False,
    add_confident: bool = True,
    add_first_seen: bool = True,
) -> dict[str, Any]:
    """Run the scan; always returns a result dict, never raises."""
    result: dict[str, Any] = {
        "dry_run": dry_run,
        "checked": 0,
        "no_stats": 0,
        "skipped_manual": 0,
        "added": 0,
        "first_seen": 0,
        "review": 0,
        "already": 0,
        "errors": [],
        "fatal": False,
    }
    try:
        await _run(manager, result, dry_run, add_confident, add_first_seen)
    except Exception as exc:  # noqa: BLE001 - report instead of failing the flow
        _LOGGER.exception("Past replacement detection stopped unexpectedly")
        result["errors"].append(_error("BL-D00", "", exc))
        result["fatal"] = True
    return result


async def _run(manager: Any, result: dict[str, Any], dry_run: bool, add_confident: bool, add_first_seen: bool) -> None:
    hass = manager.hass
    try:
        from homeassistant.components.recorder import get_instance

        get_instance(hass)
    except Exception as exc:  # noqa: BLE001
        _LOGGER.warning("Past replacement detection: recorder not available: %r", exc)
        result["errors"].append(_error("BL-D01", "", exc))
        result["fatal"] = True
        return

    device_ids = sorted(manager.active_ids, key=lambda d: manager.device_name(d).casefold())
    for device_id in device_ids:
        name = manager.device_name(device_id)
        result["checked"] += 1
        try:
            await _one_device(manager, result, device_id, name, dry_run, add_confident, add_first_seen)
        except Exception as exc:  # noqa: BLE001 - one device must not stop the others
            _LOGGER.exception("Past replacement detection failed for %s", name)
            result["errors"].append(_error("BL-D00", name, exc))

    if not dry_run:
        try:
            manager.store.meta["history_scan_done"] = True
            manager.store.async_schedule_save()
            manager.async_refresh_panel()
        except Exception as exc:  # noqa: BLE001
            _LOGGER.exception("Could not store the scan-done mark")
            result["errors"].append(_error("BL-D05", "", exc))


async def _one_device(
    manager: Any, result: dict[str, Any], device_id: str, name: str, dry_run: bool, add_confident: bool, add_first_seen: bool
) -> None:
    record = manager.store.get_device(device_id) or {}
    history = record.get("history", [])
    if any(entry.get("source") in MANUAL_SOURCES for entry in history):
        result["skipped_manual"] += 1  # keep what a person wrote
        return

    source = manager.scanned.get(device_id)
    if source is None or not source.level_entity:
        result["no_stats"] += 1
        return

    try:
        rows = await _read_rows(manager.hass, source.level_entity)
    except Exception as exc:  # noqa: BLE001
        _LOGGER.warning("Reading statistics of %s failed: %r", source.level_entity, exc)
        result["errors"].append(_error("BL-D02", name, exc))
        return
    if not rows:
        result["no_stats"] += 1
        return

    try:
        existing = [t.timestamp() for t in (parse_iso(e.get("at")) for e in history) if t]
        found = detect_replacements(rows, existing)
    except Exception as exc:  # noqa: BLE001
        _LOGGER.warning("Analysing %s failed: %r", name, exc)
        result["errors"].append(_error("BL-D03", name, exc))
        return

    pending = [c for c in manager.store.candidates if c.get("device_id") == device_id]

    # 1) first appearance: only for a device that has no entries at all
    if add_first_seen and not history:
        try:
            if not dry_run:
                manager.add_detected_entry(device_id, rows[0][0], FIRST_SEEN_NOTE)
            result["first_seen"] += 1
        except Exception as exc:  # noqa: BLE001
            _LOGGER.warning("Storing first-seen date of %s failed: %r", name, exc)
            result["errors"].append(_error("BL-D04", name, exc))

    # 2) detected jumps: confident ones are added, the rest waits for a decision in the panel
    for item in found:
        if any(abs(c.get("at", 0) - item["at"]) < 3 * 86400 for c in pending):
            result["already"] += 1
            continue
        try:
            if item["confidence"] == "high" and add_confident:
                if not dry_run:
                    manager.add_detected_entry(device_id, item["at"], candidate_note(item))
                result["added"] += 1
            else:
                if not dry_run:
                    manager.add_candidate(device_id, item)
                result["review"] += 1
        except Exception as exc:  # noqa: BLE001
            _LOGGER.warning("Storing a result for %s failed: %r", name, exc)
            result["errors"].append(_error("BL-D04", name, exc))
