"""Tests for the Battery Notes import planning (pure logic)."""

import importlib.util
import sys
from datetime import datetime, timezone
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "battery_log_logic_import",
    Path(__file__).parent.parent / "custom_components" / "battery_log" / "logic.py",
)
logic = importlib.util.module_from_spec(_spec)
sys.modules["battery_log_logic_import"] = logic
_spec.loader.exec_module(logic)

TYPES = ["CR2032", "CR2450", "AAA", "Built-in rechargeable"]


def dt(day):
    return datetime(2026, 4, day, 12, 0, tzinfo=timezone.utc)


def test_parse_battery_type():
    assert logic.parse_battery_type("CR2032") == (1, "CR2032")
    assert logic.parse_battery_type("2× AAA") == (2, "AAA")
    assert logic.parse_battery_type("4x AA") == (4, "AA")
    assert logic.parse_battery_type(" 2 × CR2450 ") == (2, "CR2450")
    for bad in (None, "", "unknown", "unavailable"):
        assert logic.parse_battery_type(bad) == (1, None)


def test_match_type_ignores_case_and_spaces():
    assert logic.match_type("cr2032", TYPES) == "CR2032"
    assert logic.match_type("Built-in  Rechargeable", TYPES) == "Built-in rechargeable"
    assert logic.match_type("LR44", TYPES) is None
    assert logic.match_type(None, TYPES) is None


def plan(collected, records=None, tracked=("d1",), **kw):
    return logic.plan_import(collected, TYPES, records or {}, set(tracked), **kw)


def test_adds_type_and_date_for_new_device():
    result = plan({"d1": {"type": "CR2032", "last_replaced": dt(10), "note": ""}})
    assert result["set_types"] == [("d1", "CR2032")]
    assert result["adds"] == [("d1", dt(10), "Imported from Battery Notes")]


def test_existing_type_is_not_overwritten():
    result = plan({"d1": {"type": "CR2032", "last_replaced": None, "note": ""}}, {"d1": {"type": "AAA", "history": []}})
    assert result["set_types"] == []


def test_duplicate_date_is_skipped_and_counted():
    records = {"d1": {"type": "CR2032", "history": [{"at": dt(10).isoformat()}]}}
    result = plan({"d1": {"type": "CR2032", "last_replaced": dt(10), "note": ""}}, records)
    assert result["adds"] == [] and result["already"] == 1


def test_unknown_type_is_reported_and_kept_in_note():
    result = plan({"d1": {"type": "LR44", "last_replaced": dt(11), "note": ""}})
    assert result["set_types"] == []
    assert result["unknown_types"] == ["LR44"]
    assert "(type was LR44)" in result["adds"][0][2]


def test_quantity_and_battery_notes_note_are_kept():
    result = plan({"d1": {"type": "2× AAA", "last_replaced": dt(12), "note": "Duracell"}})
    note = result["adds"][0][2]
    assert "(2x)" in note and note.endswith(": Duracell")
    assert result["set_types"] == [("d1", "AAA")]


def test_untracked_devices_are_counted_not_imported():
    result = plan({"x": {"type": "CR2032", "last_replaced": dt(10), "note": ""}}, tracked=("d1",))
    assert result["not_tracked"] == 1 and result["adds"] == [] and result["set_types"] == []


def test_toggles():
    info = {"d1": {"type": "CR2032", "last_replaced": dt(10), "note": ""}}
    only_dates = plan(info, import_types=False)
    assert only_dates["set_types"] == [] and len(only_dates["adds"]) == 1
    only_types = plan(info, import_dates=False)
    assert only_types["adds"] == [] and len(only_types["set_types"]) == 1


def test_note_is_limited_to_500_characters():
    result = plan({"d1": {"type": "CR2032", "last_replaced": dt(10), "note": "x" * 900}})
    assert len(result["adds"][0][2]) == 500
