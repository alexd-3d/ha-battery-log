"""Battery type dropdown, one per battery device."""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import SIGNAL_TYPES_CHANGED
from .entity import BatteryLogEntity


async def async_setup_entry(
    hass: HomeAssistant, entry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    entry.runtime_data.register_platform("select", async_add_entities, BatteryTypeSelect)


class BatteryTypeSelect(BatteryLogEntity, SelectEntity):
    """Choose the battery type from the shared list."""

    KEY = "battery_type"
    _attr_translation_key = "battery_type"
    _attr_entity_category = EntityCategory.CONFIG

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_TYPES_CHANGED, self._handle_update)
        )

    @property
    def options(self) -> list[str]:
        return list(self.manager.store.types)

    @property
    def current_option(self) -> str | None:
        record = self.manager.store.get_device(self.device_id) or {}
        current = record.get("type")
        return current if current in self.manager.store.types else None

    async def async_select_option(self, option: str) -> None:
        self.manager.async_set_type(self.device_id, option)
