"""Base entity: attaches to the existing device of the battery sensor."""

from __future__ import annotations

from homeassistant.core import callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity

from .const import signal_device
from .manager import BatteryLogManager


class BatteryLogEntity(Entity):
    """One entity of one battery device, grouped under that device's page."""

    _attr_has_entity_name = True
    _attr_should_poll = False
    KEY: str = ""

    def __init__(self, manager: BatteryLogManager, device_id: str) -> None:
        self.manager = manager
        self.device_id = device_id
        self._attr_unique_id = self.unique_id_for(device_id)
        # Attach to the device owned by another integration (Zigbee etc.).
        self.device_entry = dr.async_get(manager.hass).async_get(device_id)

    @classmethod
    def unique_id_for(cls, device_id: str) -> str:
        return f"{device_id}_{cls.KEY}"

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, signal_device(self.device_id), self._handle_update
            )
        )

    @callback
    def _handle_update(self) -> None:
        self.async_write_ha_state()
