"""'Battery last changed' timestamp sensor, one per battery device."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import BatteryLogEntity
from .logic import parse_iso, sorted_history

RECENT = 5


async def async_setup_entry(
    hass: HomeAssistant, entry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    entry.runtime_data.register_platform("sensor", async_add_entities, BatteryLastChangedSensor)


class BatteryLastChangedSensor(BatteryLogEntity, SensorEntity):
    """When the battery was last changed, with a few useful attributes."""

    KEY = "battery_last_changed"
    _attr_translation_key = "battery_last_changed"
    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _unrecorded_attributes = frozenset({"recent_changes", "last_note"})

    @property
    def native_value(self) -> datetime | None:
        return parse_iso(self.manager.device_stats(self.device_id)["last_changed"])

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        stats = self.manager.device_stats(self.device_id)
        record = self.manager.store.get_device(self.device_id) or {}
        recent = list(reversed(sorted_history(record.get("history", []))))[:RECENT]
        return {
            "changes_count": stats["changes"],
            "average_lifetime_days": stats["avg_lifetime_days"],
            "battery_type": record.get("type"),
            "last_note": stats["last_note"],
            "replacement_suspected": bool(record.get("suspected")),
            "recent_changes": [{"at": e["at"], "note": e.get("note", "")} for e in recent],
        }
