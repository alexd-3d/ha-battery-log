"""Pure helpers without Home Assistant imports (unit-testable)."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

SECONDS_PER_DAY = 86400


def parse_iso(value: str | None) -> datetime | None:
    """Parse an ISO timestamp into an aware UTC datetime."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def to_float(state: str | None) -> float | None:
    """Convert a state string to a number, None when it is not numeric."""
    if state is None or state in ("unknown", "unavailable", ""):
        return None
    try:
        return float(state)
    except ValueError:
        return None


def sorted_history(history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return history entries oldest first (invalid dates are dropped)."""
    entries = [e for e in history if parse_iso(e.get("at")) is not None]
    return sorted(entries, key=lambda e: parse_iso(e["at"]))  # type: ignore[arg-type,return-value]


def last_changed(history: list[dict[str, Any]]) -> str | None:
    """ISO timestamp of the newest change, or None."""
    entries = sorted_history(history)
    return entries[-1]["at"] if entries else None


def average_lifetime_days(history: list[dict[str, Any]]) -> float | None:
    """Mean number of days between consecutive changes (needs 2 or more)."""
    entries = sorted_history(history)
    if len(entries) < 2:
        return None
    times = [parse_iso(e["at"]) for e in entries]
    deltas = [
        (b - a).total_seconds() / SECONDS_PER_DAY  # type: ignore[operator]
        for a, b in zip(times, times[1:])
    ]
    return round(sum(deltas) / len(deltas), 1)


def detect_level_jump(previous: float | None, current: float | None, jump: float) -> bool:
    """True when a numeric battery level rose by at least `jump` points."""
    if previous is None or current is None:
        return False
    return current - previous >= jump


def detect_low_cleared(previous_state: str | None, current_state: str | None) -> bool:
    """True when a binary 'battery low' flag went from on to off."""
    return previous_state == "on" and current_state == "off"


_QUANTITY = re.compile(r"^\s*(\d+)\s*[×xX]\s*(.+?)\s*$")
IMPORT_NOTE = "Imported from Battery Notes"
DUPLICATE_WINDOW_SECONDS = 60


def parse_battery_type(text: str | None) -> tuple[int, str | None]:
    """'2× AAA' -> (2, 'AAA'); 'CR2032' -> (1, 'CR2032'); unusable -> (1, None)."""
    if not text or text in ("unknown", "unavailable"):
        return 1, None
    match = _QUANTITY.match(text)
    quantity, name = (int(match.group(1)), match.group(2)) if match else (1, text.strip())
    return quantity, (name or None)


def match_type(name: str | None, known: list[str]) -> str | None:
    """Return the entry of `known` equal to `name` ignoring case and spaces."""
    if not name:
        return None
    wanted = name.replace(" ", "").casefold()
    for candidate in known:
        if candidate.replace(" ", "").casefold() == wanted:
            return candidate
    return None


def has_active_entry(sources: list[str]) -> bool:
    """True when at least one config entry is a real one (not an ignored discovery)."""
    return any(source != "ignore" for source in sources)


def plan_import(
    collected: dict[str, dict[str, Any]],
    known_types: list[str],
    records: dict[str, dict[str, Any]],
    tracked: set[str],
    *,
    import_types: bool = True,
    import_dates: bool = True,
) -> dict[str, Any]:
    """Decide what to take over from Battery Notes without touching anything.

    `collected` maps device id -> {"type": str|None, "last_replaced": datetime|None, "note": str}.
    Types are only set where the device has none yet, and only when they exist in
    `known_types`. A date is skipped when the history already has an entry within a minute.
    """
    plan: dict[str, Any] = {
        "devices": len(collected),
        "set_types": [],
        "adds": [],
        "already": 0,
        "not_tracked": 0,
        "unknown_types": [],
    }
    unknown: set[str] = set()
    for device_id, info in collected.items():
        if device_id not in tracked:
            plan["not_tracked"] += 1
            continue
        record = records.get(device_id) or {}
        quantity, name = parse_battery_type(info.get("type"))
        matched = match_type(name, known_types)
        if name and not matched:
            unknown.add(name)
        if import_types and matched and not record.get("type"):
            plan["set_types"].append((device_id, matched))
        at = info.get("last_replaced")
        if import_dates and at is not None:
            existing = [parse_iso(e.get("at")) for e in record.get("history", [])]
            if any(t and abs((t - at).total_seconds()) < DUPLICATE_WINDOW_SECONDS for t in existing):
                plan["already"] += 1
                continue
            note = IMPORT_NOTE
            if quantity > 1:
                note += f" ({quantity}x)"
            if name and not matched:
                note += f" (type was {name})"
            if info.get("note"):
                note += f": {info['note']}"
            plan["adds"].append((device_id, at, note[:500]))
    plan["unknown_types"] = sorted(unknown)
    return plan
