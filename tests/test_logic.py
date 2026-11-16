"""Unit tests for the pure helpers (run without Home Assistant)."""

import importlib.util
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "battery_log_logic",
    Path(__file__).parent.parent / "custom_components" / "battery_log" / "logic.py",
)
logic = importlib.util.module_from_spec(_spec)
sys.modules["battery_log_logic"] = logic
_spec.loader.exec_module(logic)


def entry(at, note=""):
    return {"id": at, "at": at, "note": note}


def test_to_float():
    assert logic.to_float("74") == 74.0
    assert logic.to_float("74.5") == 74.5
    for bad in (None, "unknown", "unavailable", "", "abc"):
        assert logic.to_float(bad) is None


def test_parse_iso_variants():
    assert logic.parse_iso("2026-04-25T09:46:12+00:00").hour == 9
    assert logic.parse_iso("2026-04-25T09:46:12Z").hour == 9
    assert logic.parse_iso("2026-04-25T12:46:12+03:00").hour == 9
    assert logic.parse_iso("2026-04-25T09:46:12").tzinfo is not None
    assert logic.parse_iso("nope") is None
    assert logic.parse_iso(None) is None


def test_last_changed_and_sorting():
    history = [entry("2026-03-01T00:00:00+00:00"), entry("2026-07-01T00:00:00+00:00"), entry("2026-01-01T00:00:00+00:00")]
    assert logic.last_changed(history) == "2026-07-01T00:00:00+00:00"
    assert [e["at"][:7] for e in logic.sorted_history(history)] == ["2026-01", "2026-03", "2026-07"]
    assert logic.last_changed([]) is None


def test_invalid_dates_are_dropped():
    history = [entry("garbage"), entry("2026-01-01T00:00:00+00:00")]
    assert len(logic.sorted_history(history)) == 1


def test_average_lifetime():
    assert logic.average_lifetime_days([]) is None
    assert logic.average_lifetime_days([entry("2026-01-01T00:00:00+00:00")]) is None
    history = [
        entry("2026-01-01T00:00:00+00:00"),
        entry("2026-01-11T00:00:00+00:00"),  # 10 days
        entry("2026-02-10T00:00:00+00:00"),  # 30 days
    ]
    assert logic.average_lifetime_days(history) == 20.0


def test_level_jump():
    assert logic.detect_level_jump(20, 100, 25)
    assert logic.detect_level_jump(50, 75, 25)
    assert not logic.detect_level_jump(50, 74, 25)
    assert not logic.detect_level_jump(None, 100, 25)  # unavailable -> value
    assert not logic.detect_level_jump(100, 20, 25)  # drop


def test_low_cleared():
    assert logic.detect_low_cleared("on", "off")
    assert not logic.detect_low_cleared("off", "on")
    assert not logic.detect_low_cleared("unavailable", "off")
