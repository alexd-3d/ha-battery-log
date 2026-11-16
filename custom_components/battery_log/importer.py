"""Read Battery Notes data so it can be taken over once (never writes to Battery Notes)."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from .const import BATTERY_NOTES_DOMAIN
from .logic import parse_iso


def battery_notes_installed(hass: HomeAssistant) -> bool:
    """True when Battery Notes has a config entry in this Home Assistant."""
    return bool(hass.config_entries.async_entries(BATTERY_NOTES_DOMAIN))


def collect_battery_notes(hass: HomeAssistant) -> dict[str, dict[str, Any]]:
    """Return {device_id: {type, last_replaced, note}} from Battery Notes entities.

    Entities are found by registry platform and translation key, which is how
    Battery Notes 3.x names them (battery_type, battery_last_replaced).
    """
    registry = er.async_get(hass)
    found: dict[str, dict[str, Any]] = {}
    for entry in registry.entities.values():
        if entry.platform != BATTERY_NOTES_DOMAIN or not entry.device_id or entry.disabled_by:
            continue
        state = hass.states.get(entry.entity_id)
        if state is None:
            continue
        info = found.setdefault(entry.device_id, {"type": None, "last_replaced": None, "note": ""})
        if entry.translation_key == "battery_type":
            info["type"] = state.state
        elif entry.translation_key == "battery_last_replaced":
            info["last_replaced"] = parse_iso(state.state)
        if not info["note"] and (note := state.attributes.get("note")):
            info["note"] = str(note).strip()
    return found
