"""Tests for the same-model battery type auto-fill (pure logic)."""

import importlib.util
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "battery_log_logic_autofill",
    Path(__file__).parent.parent / "custom_components" / "battery_log" / "logic.py",
)
logic = importlib.util.module_from_spec(_spec)
sys.modules["battery_log_logic_autofill"] = logic
_spec.loader.exec_module(logic)

PIR = ("HOBEIAN", "Motion sensor", "")
LUX = ("HOBEIAN", "Luminance motion sensor", "")


def dev(model_key, type_=None, locked=False):
    return {"model_key": model_key, "type": type_, "locked": locked}


def test_untyped_device_gets_the_type_of_its_siblings():
    fills = logic.plan_type_autofill({"a": dev(PIR, "CR2450"), "b": dev(PIR), "c": dev(PIR)})
    assert fills == {"b": "CR2450", "c": "CR2450"}


def test_different_models_are_not_mixed():
    fills = logic.plan_type_autofill({"a": dev(PIR, "CR2450"), "b": dev(LUX)})
    assert fills == {}


def test_conflicting_sibling_types_fill_nothing():
    fills = logic.plan_type_autofill({"a": dev(PIR, "CR2450"), "b": dev(PIR, "AAA"), "c": dev(PIR)})
    assert fills == {}


def test_typed_devices_are_never_overwritten():
    fills = logic.plan_type_autofill({"a": dev(PIR, "CR2450"), "b": dev(PIR, "CR2450")})
    assert fills == {}


def test_a_type_cleared_on_purpose_stays_empty():
    fills = logic.plan_type_autofill({"a": dev(PIR, "CR2450"), "b": dev(PIR, None, locked=True), "c": dev(PIR)})
    assert fills == {"c": "CR2450"}


def test_devices_without_a_model_are_ignored():
    fills = logic.plan_type_autofill({"a": dev(None, "CR2450"), "b": dev(None)})
    assert fills == {}


def test_nobody_has_a_type_yet():
    assert logic.plan_type_autofill({"a": dev(PIR), "b": dev(PIR)}) == {}
