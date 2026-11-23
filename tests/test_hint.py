"""Tests for the live 'Replaced?' hint rules (pure logic)."""

import importlib.util
import random
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "battery_log_logic_hint",
    Path(__file__).parent.parent / "custom_components" / "battery_log" / "logic.py",
)
logic = importlib.util.module_from_spec(_spec)
sys.modules["battery_log_logic_hint"] = logic
_spec.loader.exec_module(logic)

DAY = 86400
HOUR = 3600
T0 = 1_800_000_000.0


def test_peak_tracks_the_highest_recent_level():
    peak, before = logic.update_peak(None, 50, T0)
    assert before is None and peak == {"level": 50, "at": T0}
    peak, before = logic.update_peak(peak, 100, T0 + HOUR)
    assert before == 50 and peak["level"] == 100
    peak2, before = logic.update_peak(peak, 75, T0 + 2 * HOUR)
    assert before == 100 and peak2 is peak  # a lower reading changes nothing


def test_peak_expires_after_two_weeks():
    peak, _ = logic.update_peak(None, 100, T0)
    new, before = logic.update_peak(peak, 60, T0 + 15 * DAY)
    assert before is None and new["level"] == 60


def test_hint_needs_a_learning_period_and_respects_the_snooze():
    assert not logic.hint_allowed(T0, T0 + DAY, None, 100, 50)  # still learning
    assert logic.hint_allowed(T0, T0 + 4 * DAY, None, 100, 50)
    assert not logic.hint_allowed(T0, T0 + 4 * DAY, T0 + 10 * DAY, 100, 50)  # snoozed
    assert logic.hint_allowed(T0, T0 + 11 * DAY, T0 + 10 * DAY, 100, 50)  # snooze over
    assert not logic.hint_allowed(None, T0 + 9 * DAY, None, 100, 50)  # never observed


def test_a_level_seen_recently_is_not_a_replacement():
    assert not logic.hint_allowed(T0, T0 + 5 * DAY, None, 100, 100)
    assert not logic.hint_allowed(T0, T0 + 5 * DAY, None, 75, 100)
    assert logic.hint_allowed(T0, T0 + 5 * DAY, None, 100, 75)


def test_binary_low_flag_ignores_the_peak_rule():
    assert logic.hint_allowed(T0, T0 + 5 * DAY, None, None, None)


def test_pending_hint_goes_away_when_the_level_falls_back():
    pending = {"from": 50, "to": 100}
    assert logic.hint_returned(pending, 50)
    assert logic.hint_returned(pending, 45)
    assert logic.hint_returned(pending, 55)
    assert not logic.hint_returned(pending, 96)
    assert not logic.hint_returned(pending, None)
    assert not logic.hint_returned(None, 50)
    assert not logic.hint_returned({"from": None}, 50)


def test_a_flapping_sensor_never_raises_a_hint_after_learning():
    """Replays the real behaviour: the level hops between 50, 75 and 100 every few hours."""
    rng = random.Random(7)
    peak, observed, flags, last = None, T0, 0, 50.0
    for hour in range(14 * 24):
        now = T0 + hour * HOUR
        level = float(rng.choice([50, 75, 100]))
        jump = level - last >= 25
        peak, before = logic.update_peak(peak, level, now)
        if jump and logic.hint_allowed(observed, now, None, level, before):
            flags += 1
        last = level
    assert flags == 0


def test_a_real_replacement_after_weeks_of_decline_is_flagged():
    peak, observed, flags = None, T0, 0
    level_by_day = [100 - d for d in range(0, 60)]  # slow decline over two months
    now = T0
    for level in level_by_day:
        now += DAY
        peak, _ = logic.update_peak(peak, float(level), now)
    now += DAY
    peak, before = logic.update_peak(peak, 100.0, now)  # fresh battery
    assert logic.hint_allowed(observed, now, None, 100.0, before)
