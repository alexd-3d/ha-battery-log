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


def plan_type_autofill(devices: dict[str, dict[str, Any]]) -> dict[str, str]:
    """Which devices should get a battery type because same-model devices already have one.

    `devices` maps device id -> {"model_key": hashable|None, "type": str|None, "locked": bool}.
    A device is filled only when it has no type, was not cleared on purpose (`locked`),
    and every typed device of the same model agrees on one type.
    """
    groups: dict[Any, list[str]] = {}
    for device_id, info in devices.items():
        if info.get("model_key"):
            groups.setdefault(info["model_key"], []).append(device_id)
    fills: dict[str, str] = {}
    for members in groups.values():
        types = {devices[d]["type"] for d in members if devices[d].get("type")}
        if len(types) != 1:
            continue
        chosen = next(iter(types))
        for device_id in members:
            info = devices[device_id]
            if not info.get("type") and not info.get("locked"):
                fills[device_id] = chosen
    return fills


# ---------------------------------------------------------------------------
# Past replacement detection from long-term statistics
# ---------------------------------------------------------------------------
BEFORE_POINTS = 48  # hourly samples looked at before a candidate
AFTER_POINTS = 72  # and after it
MIN_BEFORE_POINTS = 6
MIN_AFTER_POINTS = 12
STEADY_POINTS = 24  # the first day after the jump must stay high
COOLDOWN_POINTS = 72  # one event per three days
GAP_SECONDS = 7 * SECONDS_PER_DAY  # silence this long before the jump points to a dead battery
DUPLICATE_SECONDS = 3 * SECONDS_PER_DAY  # skip a candidate near an existing history entry


def _median(values: list[float]) -> float:
    ordered = sorted(values)
    mid = len(ordered) // 2
    return ordered[mid] if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2


def detect_replacements(
    rows: list[tuple[float, float]],
    existing: list[float] | None = None,
) -> list[dict[str, Any]]:
    """Find likely battery replacements in an hourly level series.

    `rows` are (timestamp, level %) in ascending order, one per hour with data.
    A candidate is a sustained jump: the level before (median of 48 samples) is clearly
    lower than the level after (median of 72), and the first day after the jump stays high,
    so single-hour blips are ignored. `existing` holds timestamps already in the history;
    candidates within three days of one are dropped.

    confidence "high": rise of 30 points or more to at least 85%, or a medium one that
    follows at least a week without data (the battery died). "medium": a rise of 15 to 29
    points to 90% or more after a low period (typical for noisy sensors).
    """
    existing = existing or []
    found: list[dict[str, Any]] = []
    n = len(rows)
    levels = [level for _, level in rows]
    i = MIN_BEFORE_POINTS
    while i <= n - MIN_AFTER_POINTS:
        before = levels[max(0, i - BEFORE_POINTS) : i]
        after = levels[i : i + AFTER_POINTS]
        median_before, median_after = _median(before), _median(after)
        rise = median_after - median_before
        steady = min(after[:STEADY_POINTS])
        confidence = None
        if rise >= 30 and median_after >= 85 and steady >= 80:
            confidence = "high"
        elif 15 <= rise < 30 and median_after >= 90 and steady >= 90 and min(before) <= 50:
            confidence = "medium"
        if confidence is None:
            i += 1
            continue
        at = rows[i][0]
        gap = at - rows[i - 1][0]
        if confidence == "medium" and gap >= GAP_SECONDS:
            confidence = "high"
        if not any(abs(at - t) < DUPLICATE_SECONDS for t in existing):
            found.append(
                {
                    "at": at,
                    "before": round(median_before),
                    "after": round(median_after),
                    "confidence": confidence,
                    "gap_days": round(gap / SECONDS_PER_DAY) if gap >= GAP_SECONDS else 0,
                }
            )
        i += COOLDOWN_POINTS
    return found


def candidate_note(item: dict[str, Any]) -> str:
    """History note for a detected replacement."""
    note = f"Detected from battery history: {item['before']}% to {item['after']}%"
    if item.get("gap_days"):
        note += f" (after {item['gap_days']} days without data)"
    return note


MAX_ERRORS_SHOWN = 4


def format_errors(errors: list[dict[str, str]]) -> str:
    """Compact text for the result screen (and for a screenshot)."""
    if not errors:
        return "-"
    shown = [
        f"{e['code']} {e['device'] or '-'}: {e['type']}: {e['detail']}".rstrip(": ")
        for e in errors[:MAX_ERRORS_SHOWN]
    ]
    more = len(errors) - MAX_ERRORS_SHOWN
    return " | ".join(shown) + (f" | (+{more} more, see the Home Assistant log)" if more > 0 else "")


# ---------------------------------------------------------------------------
# Live "Replaced?" hint: do not raise it for sensors that just flap
# ---------------------------------------------------------------------------
PEAK_WINDOW_SECONDS = 14 * SECONDS_PER_DAY  # a level seen in the last two weeks is not "new"
LEARNING_SECONDS = 3 * SECONDS_PER_DAY  # no hints until a device has been watched this long
SNOOZE_SECONDS = 14 * SECONDS_PER_DAY  # quiet period after "Not replaced"
RETURN_TOLERANCE = 5  # a hint is dropped when the level is back within this of where it started
HIGH_TOLERANCE = 1.0


def update_peak(peak: dict[str, float] | None, level: float, now: float) -> tuple[dict[str, float], float | None]:
    """Track the highest level seen in the last 14 days.

    Returns (new_peak, peak_before): `peak_before` is the highest level seen in that window
    before this reading, or None when there is none (nothing stored, or it has expired).
    """
    before = peak["level"] if peak and now - peak["at"] <= PEAK_WINDOW_SECONDS else None
    if before is None or level >= before:
        return {"level": level, "at": now}, before
    return peak, before  # type: ignore[return-value]


def hint_allowed(
    observed_since: float | None,
    now: float,
    snooze_until: float | None,
    level: float | None,
    peak_before: float | None,
) -> bool:
    """May a replacement hint be raised now?

    Not while the device is still being learned, not while the hint is snoozed after a
    dismissal, and (for numeric levels) only when the level is higher than anything seen in
    the last two weeks. A flapping sensor keeps touching its top value, so it never counts.
    """
    if observed_since is None or now - observed_since < LEARNING_SECONDS:
        return False
    if snooze_until is not None and now < snooze_until:
        return False
    if level is None or peak_before is None:
        return True
    return level > peak_before + HIGH_TOLERANCE


def hint_returned(suspected: dict[str, Any] | None, level: float | None) -> bool:
    """True when a pending hint was only a blip: the level is back where it started."""
    start = (suspected or {}).get("from")
    return start is not None and level is not None and level <= start + RETURN_TOLERANCE


# ---------------------------------------------------------------------------
# Level history popup: rows from the long-term statistics, at most two years back
# ---------------------------------------------------------------------------
HISTORY_DAYS = 730  # never look further back than two years
HISTORY_HOURLY_DAYS = 60  # hourly points for the recent part, daily points before it


def history_windows(now: float) -> tuple[float, float]:
    """(start, split) timestamps: daily rows from `start` to `split`, hourly rows after it."""
    return now - HISTORY_DAYS * SECONDS_PER_DAY, now - HISTORY_HOURLY_DAYS * SECONDS_PER_DAY


def normalize_rows(raw: list[dict[str, Any]]) -> list[tuple[float, float]]:
    """Statistics rows -> sorted (timestamp seconds, level) pairs; rows without a level are dropped."""
    rows: list[tuple[float, float]] = []
    for row in raw:
        level = row.get("mean")
        if level is None:
            level = row.get("max")
        stamp = row.get("start")
        if isinstance(stamp, datetime):
            stamp = stamp.timestamp()
        elif isinstance(stamp, (int, float)) and stamp > 1e11:
            stamp = stamp / 1000  # milliseconds
        if level is None or stamp is None:
            continue
        rows.append((float(stamp), float(level)))
    rows.sort()
    return rows


def merge_history(old_daily: list[tuple[float, float]], recent_hourly: list[tuple[float, float]], split: float) -> list[list[float]]:
    """One series for the chart: daily rows before `split`, then every hourly row, rounded."""
    points = [(t, v) for t, v in old_daily if t < split] + list(recent_hourly)
    points.sort()
    return [[int(t), round(v, 1)] for t, v in points]
