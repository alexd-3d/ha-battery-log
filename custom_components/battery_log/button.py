"""'Battery changed' button, one per battery device."""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import SOURCE_BUTTON
from .entity import BatteryLogEntity


async def async_setup_entry(
    hass: HomeAssistant, entry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    entry.runtime_data.register_platform("button", async_add_entities, BatteryChangedButton)


class BatteryChangedButton(BatteryLogEntity, ButtonEntity):
    """Logs a battery change right now (use the panel to add a note or edit the date)."""

    KEY = "battery_changed"
    _attr_translation_key = "battery_changed"

    async def async_press(self) -> None:
        self.manager.async_log_change(self.device_id, source=SOURCE_BUTTON)
