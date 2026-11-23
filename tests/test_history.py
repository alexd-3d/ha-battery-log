"""Tests for the level-history helpers (pure logic)."""

import importlib.util
import sys
from datetime import datetime, timezone
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "battery_log_logic_history",
    Path(__file__).parent.parent / "custom_components" / "battery_log" / "logic.py",
)
logic = importlib.util.module_from_spec(_spec)
sys.modules["battery_log_logic_history"] = logic
_spec.loader.exec_module(logic)

DAY = 86400
NOW = 1_800_000_000.0


def test_windows_cap_at_two_years_and_split_at_sixty_days():
    start, split = logic.history_windows(NOW)
    assert NOW - start == 730 * DAY
    assert NOW - split == 60 * DAY


def test_normalize_rows_handles_datetime_seconds_and_milliseconds():
    rows = logic.normalize_rows(
        [
            {"start": datetime(2026, 1, 1, tzinfo=timezone.utc), "mean": 80},
            {"start": 1_700_000_000.0, "mean": 90.5},
            {"start": 1_750_000_000_000, "mean": None, "max": 70},  # ms, falls back to max
            {"start": None, "mean": 50},  # no time: dropped
            {"start": 1_760_000_000.0, "mean": None, "max": None},  # no level: dropped
        ]
    )
    assert [r[1] for r in rows] == [90.5, 70.0, 80.0]
    assert rows == sorted(rows)
    assert rows[1][0] == 1_750_000_000.0


def test_normalize_rows_of_nothing_is_empty():
    assert logic.normalize_rows([]) == []


def test_merge_uses_daily_rows_only_before_the_split():
    split = NOW - 60 * DAY
    old = [(split - 3 * DAY, 80.0), (split - DAY, 78.04), (split + 0.0, 77.0)]  # last one is not before the split
    recent = [(split + 3600, 76.0), (split + 7200, 75.55)]
    points = logic.merge_history(old, recent, split)
    assert [p[1] for p in points] == [80.0, 78.0, 76.0, 75.5]
    assert [p[0] for p in points] == sorted(p[0] for p in points)
    assert all(isinstance(p[0], int) for p in points)


def test_merge_of_empty_inputs_is_empty():
    assert logic.merge_history([], [], NOW) == []
