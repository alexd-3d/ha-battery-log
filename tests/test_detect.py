"""Tests for the past-replacement detection (pure logic, synthetic hourly series)."""

import importlib.util
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "battery_log_logic_detect",
    Path(__file__).parent.parent / "custom_components" / "battery_log" / "logic.py",
)
logic = importlib.util.module_from_spec(_spec)
sys.modules["battery_log_logic_detect"] = logic
_spec.loader.exec_module(logic)

HOUR = 3600
DAY = 86400


def series(*parts, start=1_700_000_000.0):
    """parts: ("level", hours) or ("gap", days). Returns hourly (ts, level) rows."""
    rows, t = [], start
    for kind, amount in parts:
        if kind == "gap":
            t += amount * DAY
            continue
        for _ in range(amount):
            rows.append((t, float(kind)))
            t += HOUR
    return rows


def test_clean_jump_is_found_at_the_first_high_hour():
    rows = series((20, 200), (100, 200))
    found = logic.detect_replacements(rows)
    assert len(found) == 1
    assert found[0]["at"] == rows[200][0]
    assert found[0]["confidence"] == "high"
    assert (found[0]["before"], found[0]["after"]) == (20, 100)


def test_single_hour_blip_is_ignored():
    assert logic.detect_replacements(series((20, 200), (100, 1), (20, 200))) == []


def test_decline_and_flat_series_find_nothing():
    assert logic.detect_replacements(series((100, 100), (80, 100), (50, 100), (20, 100))) == []
    assert logic.detect_replacements(series((100, 400))) == []


def test_long_silence_before_the_jump_is_reported():
    rows = series((48, 100), ("gap", 54), (100, 200))
    found = logic.detect_replacements(rows)
    assert len(found) == 1 and found[0]["confidence"] == "high"
    assert found[0]["gap_days"] >= 50


def test_noisy_sensor_that_turns_steady_is_a_medium_candidate():
    noisy = [(50, 1), (100, 1), (75, 1), (100, 1), (20, 1)] * 40  # 200 hours of flapping
    parts = [(level, hours) for level, hours in noisy] + [(100, 150)]
    found = logic.detect_replacements(series(*parts))
    assert len(found) == 1 and found[0]["confidence"] == "medium"


def test_jump_with_too_little_data_after_it_is_ignored():
    assert logic.detect_replacements(series((20, 200), (100, 5))) == []


def test_candidate_near_an_existing_entry_is_dropped():
    rows = series((20, 200), (100, 200))
    existing = [rows[200][0] + DAY]  # a manual entry one day later
    assert logic.detect_replacements(rows, existing) == []


def test_two_replacements_are_both_found():
    rows = series((100, 100), (15, 300), (100, 300), (18, 300), (100, 200))
    found = logic.detect_replacements(rows)
    assert [round((f["at"] - rows[0][0]) / HOUR) for f in found] == [400, 1000]


def test_empty_and_short_series():
    assert logic.detect_replacements([]) == []
    assert logic.detect_replacements(series((20, 10))) == []


def test_error_text_is_compact_and_readable():
    assert logic.format_errors([]) == "-"
    one = [{"code": "BL-D02", "device": "Garage motion", "type": "ValueError", "detail": "bad row"}]
    assert logic.format_errors(one) == "BL-D02 Garage motion: ValueError: bad row"
    nodev = [{"code": "BL-D01", "device": "", "type": "KeyError", "detail": "recorder"}]
    assert logic.format_errors(nodev) == "BL-D01 -: KeyError: recorder"
    many = [{"code": "BL-D02", "device": f"d{i}", "type": "E", "detail": "x"} for i in range(7)]
    text = logic.format_errors(many)
    assert text.count("BL-D02") == 4 and text.endswith("(+3 more, see the Home Assistant log)")
