"""Websocket commands used by the panel (admin only)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, MAX_NOTE_LENGTH, MAX_TYPE_LENGTH, SOURCE_PANEL
from .manager import BatteryLogManager


def _manager(hass: HomeAssistant) -> BatteryLogManager:
    for entry in hass.config_entries.async_entries(DOMAIN):
        manager = getattr(entry, "runtime_data", None)
        if manager is not None:
            return manager
    raise HomeAssistantError("Battery Log is not loaded")


def _command(schema: dict, action: Callable[[BatteryLogManager, dict[str, Any]], None]):
    """Build a write command from a schema and an action on the manager."""

    @websocket_api.websocket_command({**schema})
    @websocket_api.require_admin
    @callback
    def handler(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
        try:
            action(_manager(hass), msg)
        except HomeAssistantError as err:
            connection.send_error(msg["id"], "battery_log_error", str(err))
            return
        connection.send_result(msg["id"])

    return handler


_DEVICE = {vol.Required("device_id"): cv.string}
_NOTE = vol.All(cv.string, vol.Length(max=MAX_NOTE_LENGTH))
_TYPE = vol.All(cv.string, vol.Length(min=1, max=MAX_TYPE_LENGTH))


@callback
def async_setup_websocket(hass: HomeAssistant) -> None:
    """Register all commands."""
    websocket_api.async_register_command(hass, ws_subscribe)
    for handler in (
        _command(
            {
                vol.Required("type"): "battery_log/change",
                **_DEVICE,
                vol.Required("at"): cv.datetime,
                vol.Optional("note", default=""): _NOTE,
                vol.Optional("battery_type"): vol.Any(None, _TYPE),
            },
            lambda m, msg: m.async_log_change(
                msg["device_id"],
                at=msg["at"],
                note=msg["note"],
                type_=msg.get("battery_type"),
                source=SOURCE_PANEL,
            ),
        ),
        _command(
            {
                vol.Required("type"): "battery_log/update_change",
                **_DEVICE,
                vol.Required("change_id"): cv.string,
                vol.Required("at"): cv.datetime,
                vol.Optional("note", default=""): _NOTE,
                vol.Optional("battery_type"): vol.Any(None, _TYPE),
            },
            lambda m, msg: m.async_update_change(
                msg["device_id"],
                msg["change_id"],
                at=msg["at"],
                note=msg["note"],
                type_=msg.get("battery_type"),
            ),
        ),
        _command(
            {vol.Required("type"): "battery_log/delete_change", **_DEVICE, vol.Required("change_id"): cv.string},
            lambda m, msg: m.async_delete_change(msg["device_id"], msg["change_id"]),
        ),
        _command(
            {
                vol.Required("type"): "battery_log/set_type",
                **_DEVICE,
                vol.Required("battery_type"): vol.Any(None, _TYPE),
            },
            lambda m, msg: m.async_set_type(msg["device_id"], msg["battery_type"]),
        ),
        _command(
            {vol.Required("type"): "battery_log/add_type", vol.Required("battery_type"): _TYPE},
            lambda m, msg: m.async_add_type(msg["battery_type"]),
        ),
        _command(
            {vol.Required("type"): "battery_log/remove_type", vol.Required("battery_type"): _TYPE},
            lambda m, msg: m.async_remove_type(msg["battery_type"]),
        ),
        _command(
            {vol.Required("type"): "battery_log/set_ignored", **_DEVICE, vol.Required("ignored"): cv.boolean},
            lambda m, msg: m.async_set_ignored(msg["device_id"], msg["ignored"]),
        ),
        _command(
            {vol.Required("type"): "battery_log/dismiss_suspected", **_DEVICE},
            lambda m, msg: m.async_dismiss_suspected(msg["device_id"]),
        ),
    ):
        websocket_api.async_register_command(hass, handler)


@websocket_api.websocket_command({vol.Required("type"): "battery_log/subscribe"})
@websocket_api.require_admin
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Send the full snapshot now and again whenever it changes."""
    try:
        manager = _manager(hass)
    except HomeAssistantError as err:
        connection.send_error(msg["id"], "battery_log_error", str(err))
        return

    @callback
    def forward() -> None:
        connection.send_message(websocket_api.event_message(msg["id"], manager.snapshot()))

    connection.subscriptions[msg["id"]] = manager.async_add_listener(forward)
    connection.send_result(msg["id"])
    forward()
