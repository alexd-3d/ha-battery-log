"""Pure helpers without Home Assistant imports (unit-testable)."""

from __future__ import annotations

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
