"""Services: log a change, set a type, add a type."""

from __future__ import annotations

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, MAX_NOTE_LENGTH, MAX_TYPE_LENGTH, SOURCE_SERVICE
from .manager import BatteryLogManager

_TYPE = vol.All(cv.string, vol.Length(min=1, max=MAX_TYPE_LENGTH))

CHANGE_SCHEMA = vol.Schema(
    {
        vol.Required("device_id"): cv.string,
        vol.Optional("date"): cv.datetime,
        vol.Optional("note", default=""): vol.All(cv.string, vol.Length(max=MAX_NOTE_LENGTH)),
        vol.Optional("battery_type"): _TYPE,
    }
)
SET_TYPE_SCHEMA = vol.Schema(
    {vol.Required("device_id"): cv.string, vol.Required("battery_type"): vol.Any(None, _TYPE)}
)
ADD_TYPE_SCHEMA = vol.Schema({vol.Required("battery_type"): _TYPE})


def _manager(hass: HomeAssistant) -> BatteryLogManager:
    for entry in hass.config_entries.async_entries(DOMAIN):
        manager = getattr(entry, "runtime_data", None)
        if manager is not None:
            return manager
    raise HomeAssistantError("Battery Log is not loaded")


@callback
def async_setup_services(hass: HomeAssistant) -> None:
    """Register the services."""

    async def change(call: ServiceCall) -> None:
        _manager(hass).async_log_change(
            call.data["device_id"],
            at=call.data.get("date"),
            note=call.data["note"],
            type_=call.data.get("battery_type"),
            source=SOURCE_SERVICE,
        )

    async def set_type(call: ServiceCall) -> None:
        _manager(hass).async_set_type(call.data["device_id"], call.data["battery_type"])

    async def add_type(call: ServiceCall) -> None:
        _manager(hass).async_add_type(call.data["battery_type"])

    hass.services.async_register(DOMAIN, "change", change, schema=CHANGE_SCHEMA)
    hass.services.async_register(DOMAIN, "set_type", set_type, schema=SET_TYPE_SCHEMA)
    hass.services.async_register(DOMAIN, "add_type", add_type, schema=ADD_TYPE_SCHEMA)
