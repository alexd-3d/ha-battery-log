"""Persistent storage for Battery Log (types list and replacement history)."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import DEFAULT_TYPES, STORAGE_KEY, STORAGE_VERSION


def _new_device() -> dict[str, Any]:
    return {"type": None, "type_auto": False, "type_locked": False, "ignored": False, "history": [], "suspected": None}


class BatteryLogStore:
    """Holds the data and saves it (delayed) to .storage/battery_log."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.types: list[str] = list(DEFAULT_TYPES)
        self.devices: dict[str, dict[str, Any]] = {}
        self.candidates: list[dict[str, Any]] = []
        self.meta: dict[str, Any] = {}

    async def async_load(self) -> None:
        """Load data from disk; first run starts with the predefined types."""
        data = await self._store.async_load()
        if not data:
            return
        types = data.get("types")
        if isinstance(types, list) and all(isinstance(t, str) for t in types):
            self.types = types
        candidates = data.get("candidates")
        if isinstance(candidates, list):
            self.candidates = [c for c in candidates if isinstance(c, dict)]
        meta = data.get("meta")
        if isinstance(meta, dict):
            self.meta = meta
        devices = data.get("devices")
        if isinstance(devices, dict):
            self.devices = {
                device_id: {**_new_device(), **record}
                for device_id, record in devices.items()
                if isinstance(record, dict)
            }

    @callback
    def async_schedule_save(self) -> None:
        """Save shortly after the last change."""
        self._store.async_delay_save(self._data, 1)

    def _data(self) -> dict[str, Any]:
        return {"types": self.types, "devices": self.devices, "candidates": self.candidates, "meta": self.meta}

    def device(self, device_id: str) -> dict[str, Any]:
        """Return (creating if needed) the record of a device."""
        record = self.devices.get(device_id)
        if record is None:
            record = self.devices[device_id] = _new_device()
        return record

    def get_device(self, device_id: str) -> dict[str, Any] | None:
        """Return the record of a device without creating it."""
        return self.devices.get(device_id)
