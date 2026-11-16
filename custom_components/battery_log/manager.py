"""Core logic: scans battery devices, owns the data and notifies listeners."""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import (
    area_registry as ar,
    device_registry as dr,
    entity_registry as er,
)
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_call_later, async_track_state_change_event
from homeassistant.util import dt as dt_util

from .const import (
    CONF_LOW_THRESHOLD,
    CONF_REPLACEMENT_JUMP,
    DEFAULT_LOW_THRESHOLD,
    DEFAULT_REPLACEMENT_JUMP,
    DOMAIN,
    EVENT_CHANGED,
    EVENT_REPLACEMENT_SUSPECTED,
    MAX_NOTE_LENGTH,
    MAX_TYPE_LENGTH,
    SIGNAL_TYPES_CHANGED,
    signal_device,
)
from .logic import (
    average_lifetime_days,
    detect_level_jump,
    detect_low_cleared,
    last_changed,
    parse_iso,
    sorted_history,
    to_float,
)
from .store import BatteryLogStore

_LOGGER = logging.getLogger(__name__)

# Entities of these integrations are never treated as the battery source.
_SKIP_PLATFORMS = {DOMAIN, "battery_notes"}
RESCAN_DELAY = 3
PUSH_DELAY = 1
RECENT_CHANGE_GUARD = timedelta(hours=24)


@dataclass
class DeviceSource:
    """Where the battery level of a device comes from."""

    device_id: str
    level_entity: str | None = None  # sensor with device_class battery
    low_entity: str | None = None  # binary_sensor with device_class battery


class BatteryLogManager:
    """Owns the data model; entities, websocket and services talk to it."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, store: BatteryLogStore) -> None:
        self.hass = hass
        self.entry = entry
        self.store = store
        self.scanned: dict[str, DeviceSource] = {}
        self._entity_to_device: dict[str, str] = {}
        self._listeners: set[CALLBACK_TYPE] = set()
        self._unsubs: list[CALLBACK_TYPE] = []
        self._unsub_states: CALLBACK_TYPE | None = None
        self._rescan_cancel: CALLBACK_TYPE | None = None
        self._push_cancel: CALLBACK_TYPE | None = None
        # platform -> (add_entities callback, entity factory, device ids with entities)
        self._platforms: dict[str, tuple[Callable, Callable, set[str]]] = {}

    # ------------------------------------------------------------------ options

    @property
    def low_threshold(self) -> int:
        return int(self.entry.options.get(CONF_LOW_THRESHOLD, DEFAULT_LOW_THRESHOLD))

    @property
    def replacement_jump(self) -> int:
        return int(self.entry.options.get(CONF_REPLACEMENT_JUMP, DEFAULT_REPLACEMENT_JUMP))

    # ---------------------------------------------------------------- lifecycle

    @callback
    def async_start(self) -> None:
        """Initial scan and start watching the registries."""
        self._scan()
        self._unsubs.append(
            self.hass.bus.async_listen(er.EVENT_ENTITY_REGISTRY_UPDATED, self._registry_event)
        )
        self._unsubs.append(
            self.hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, self._registry_event)
        )

    @callback
    def async_stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        if self._unsub_states:
            self._unsub_states()
            self._unsub_states = None
        for cancel in (self._rescan_cancel, self._push_cancel):
            if cancel:
                cancel()
        self._rescan_cancel = self._push_cancel = None
        self._listeners.clear()

    # ----------------------------------------------------------------- scanning

    @callback
    def _registry_event(self, _event: Event) -> None:
        if self._rescan_cancel is None:
            self._rescan_cancel = async_call_later(self.hass, RESCAN_DELAY, self._rescan)

    @callback
    def _rescan(self, _now: datetime | None = None) -> None:
        self._rescan_cancel = None
        self._scan()
        self._sync_entities()
        self._schedule_push()

    @callback
    def _scan(self) -> None:
        """Find every device that has a battery-class sensor or binary sensor."""
        ent_reg = er.async_get(self.hass)
        dev_reg = dr.async_get(self.hass)
        found: dict[str, DeviceSource] = {}
        for entry in ent_reg.entities.values():
            if entry.disabled_by or not entry.device_id:
                continue
            if entry.platform in _SKIP_PLATFORMS:
                continue
            if entry.domain not in ("sensor", "binary_sensor"):
                continue
            if (entry.device_class or entry.original_device_class) != "battery":
                continue
            if dev_reg.async_get(entry.device_id) is None:
                continue
            source = found.setdefault(entry.device_id, DeviceSource(entry.device_id))
            if entry.domain == "sensor" and source.level_entity is None:
                source.level_entity = entry.entity_id
            elif entry.domain == "binary_sensor" and source.low_entity is None:
                source.low_entity = entry.entity_id
        self.scanned = found
        self._entity_to_device = {}
        for source in found.values():
            for entity_id in (source.level_entity, source.low_entity):
                if entity_id:
                    self._entity_to_device[entity_id] = source.device_id
        self._resubscribe_states()

    @callback
    def _resubscribe_states(self) -> None:
        if self._unsub_states:
            self._unsub_states()
            self._unsub_states = None
        if self._entity_to_device:
            self._unsub_states = async_track_state_change_event(
                self.hass, list(self._entity_to_device), self._state_event
            )

    @property
    def active_ids(self) -> set[str]:
        """Devices that get entities: scanned and not ignored."""
        return {
            device_id
            for device_id in self.scanned
            if not (self.store.get_device(device_id) or {}).get("ignored")
        }

    # ------------------------------------------------------- entity bookkeeping

    @callback
    def register_platform(self, domain: str, add_entities: Callable, factory: Callable) -> None:
        """Called by a platform's async_setup_entry; adds the entities that exist now."""
        known: set[str] = set()
        self._platforms[domain] = (add_entities, factory, known)
        self._add_for(domain, self.active_ids)

    @callback
    def _add_for(self, domain: str, device_ids: set[str]) -> None:
        add_entities, factory, known = self._platforms[domain]
        dev_reg = dr.async_get(self.hass)
        new = [d for d in sorted(device_ids) if d not in known and dev_reg.async_get(d)]
        if new:
            add_entities([factory(self, device_id) for device_id in new])
            known.update(new)

    @callback
    def _sync_entities(self) -> None:
        """Add entities for new devices, drop them for devices that went away."""
        active = self.active_ids
        ent_reg = er.async_get(self.hass)
        for domain, (_add, factory, known) in self._platforms.items():
            self._add_for(domain, active)
            for device_id in list(known - active):
                entity_id = ent_reg.async_get_entity_id(
                    domain, DOMAIN, factory.unique_id_for(device_id)
                )
                if entity_id:
                    ent_reg.async_remove(entity_id)
                known.discard(device_id)

    # ------------------------------------------------------------- state events

    @callback
    def _state_event(self, event: Event) -> None:
        entity_id = event.data["entity_id"]
        device_id = self._entity_to_device.get(entity_id)
        new = event.data["new_state"]
        old = event.data["old_state"]
        if device_id is None or new is None or old is None:
            return
        self._schedule_push()
        if device_id not in self.active_ids:
            return
        if entity_id.startswith("binary_sensor."):
            triggered = detect_low_cleared(old.state, new.state)
            previous = current = None
        else:
            previous, current = to_float(old.state), to_float(new.state)
            triggered = detect_level_jump(previous, current, self.replacement_jump)
        if triggered:
            self._mark_suspected(device_id, previous, current)

    @callback
    def _mark_suspected(self, device_id: str, previous: float | None, current: float | None) -> None:
        record = self.store.device(device_id)
        if record.get("suspected"):
            return
        last = parse_iso(last_changed(record["history"]))
        if last and dt_util.utcnow() - last < RECENT_CHANGE_GUARD:
            return
        record["suspected"] = {
            "detected_at": dt_util.utcnow().isoformat(),
            "from": previous,
            "to": current,
        }
        self.store.async_schedule_save()
        self.hass.bus.async_fire(
            EVENT_REPLACEMENT_SUSPECTED,
            {
                "device_id": device_id,
                "device_name": self._device_name(device_id),
                "from_level": previous,
                "to_level": current,
            },
        )
        self._notify_device(device_id)

    # ----------------------------------------------------------------- listeners

    @callback
    def async_add_listener(self, listener: CALLBACK_TYPE) -> CALLBACK_TYPE:
        """Register a callback invoked (debounced) when panel data changes."""
        self._listeners.add(listener)
        return lambda: self._listeners.discard(listener)

    @callback
    def _schedule_push(self) -> None:
        if self._push_cancel is None and self._listeners:
            self._push_cancel = async_call_later(self.hass, PUSH_DELAY, self._push)

    @callback
    def _push(self, _now: datetime | None = None) -> None:
        self._push_cancel = None
        for listener in list(self._listeners):
            listener()

    @callback
    def _notify_device(self, device_id: str) -> None:
        async_dispatcher_send(self.hass, signal_device(device_id))
        self._schedule_push()

    # ------------------------------------------------------------------ actions

    def _require_device(self, device_id: str) -> None:
        if device_id not in self.scanned:
            raise HomeAssistantError(f"{device_id} is not a known battery device")

    def _check_type(self, type_: str | None) -> None:
        if type_ is not None and type_ not in self.store.types:
            raise HomeAssistantError(f"Unknown battery type: {type_}")

    @staticmethod
    def _clean_note(note: str | None) -> str:
        note = (note or "").strip()
        if len(note) > MAX_NOTE_LENGTH:
            raise HomeAssistantError(f"Note is longer than {MAX_NOTE_LENGTH} characters")
        return note

    @staticmethod
    def _check_date(at: datetime) -> datetime:
        at = dt_util.as_utc(at)
        if at > dt_util.utcnow() + timedelta(days=1):
            raise HomeAssistantError("The change date cannot be in the future")
        return at

    @callback
    def async_log_change(
        self,
        device_id: str,
        *,
        at: datetime | None = None,
        note: str | None = None,
        type_: str | None = None,
        source: str,
    ) -> dict[str, Any]:
        """Record a battery change (now when `at` is omitted)."""
        self._require_device(device_id)
        self._check_type(type_)
        note = self._clean_note(note)
        at = self._check_date(at) if at else dt_util.utcnow()
        record = self.store.device(device_id)
        if type_ is not None:
            record["type"] = type_
        entry = {
            "id": uuid4().hex[:12],
            "at": at.isoformat(),
            "note": note,
            "type": record["type"],
            "source": source,
        }
        record["history"].append(entry)
        record["suspected"] = None
        self.store.async_schedule_save()
        self.hass.bus.async_fire(
            EVENT_CHANGED,
            {
                "device_id": device_id,
                "device_name": self._device_name(device_id),
                "changed_at": entry["at"],
                "note": note,
                "battery_type": entry["type"],
                "source": source,
            },
        )
        self._notify_device(device_id)
        return entry

    @callback
    def async_update_change(
        self,
        device_id: str,
        change_id: str,
        *,
        at: datetime | None = None,
        note: str | None = None,
        type_: str | None = None,
    ) -> None:
        self._require_device(device_id)
        record = self.store.device(device_id)
        entry = next((e for e in record["history"] if e["id"] == change_id), None)
        if entry is None:
            raise HomeAssistantError("Change not found")
        if at is not None:
            entry["at"] = self._check_date(at).isoformat()
        if note is not None:
            entry["note"] = self._clean_note(note)
        if type_ is not None:
            self._check_type(type_)
            entry["type"] = type_
        self.store.async_schedule_save()
        self._notify_device(device_id)

    @callback
    def async_delete_change(self, device_id: str, change_id: str) -> None:
        self._require_device(device_id)
        record = self.store.device(device_id)
        before = len(record["history"])
        record["history"] = [e for e in record["history"] if e["id"] != change_id]
        if len(record["history"]) == before:
            raise HomeAssistantError("Change not found")
        self.store.async_schedule_save()
        self._notify_device(device_id)

    @callback
    def async_set_type(self, device_id: str, type_: str | None) -> None:
        self._require_device(device_id)
        self._check_type(type_)
        self.store.device(device_id)["type"] = type_
        self.store.async_schedule_save()
        self._notify_device(device_id)

    @callback
    def async_add_type(self, name: str) -> None:
        name = name.strip()
        if not name or len(name) > MAX_TYPE_LENGTH:
            raise HomeAssistantError(f"Type must be 1-{MAX_TYPE_LENGTH} characters")
        if name.casefold() in (t.casefold() for t in self.store.types):
            raise HomeAssistantError(f"Type {name} already exists")
        self.store.types.append(name)
        self.store.async_schedule_save()
        self._types_changed()

    @callback
    def async_remove_type(self, name: str) -> None:
        if name not in self.store.types:
            raise HomeAssistantError(f"Unknown battery type: {name}")
        used = [d for d, r in self.store.devices.items() if r.get("type") == name]
        if used:
            raise HomeAssistantError(f"Type {name} is still assigned to {len(used)} device(s)")
        self.store.types.remove(name)
        self.store.async_schedule_save()
        self._types_changed()

    @callback
    def _types_changed(self) -> None:
        async_dispatcher_send(self.hass, SIGNAL_TYPES_CHANGED)
        self._schedule_push()

    @callback
    def async_set_ignored(self, device_id: str, ignored: bool) -> None:
        self._require_device(device_id)
        self.store.device(device_id)["ignored"] = ignored
        self.store.async_schedule_save()
        self._sync_entities()
        self._schedule_push()

    @callback
    def async_dismiss_suspected(self, device_id: str) -> None:
        self._require_device(device_id)
        self.store.device(device_id)["suspected"] = None
        self.store.async_schedule_save()
        self._notify_device(device_id)

    # ---------------------------------------------------------------- read side

    def _device_name(self, device_id: str) -> str:
        device = dr.async_get(self.hass).async_get(device_id)
        if device is None:
            return device_id
        return device.name_by_user or device.name or device_id

    def device_stats(self, device_id: str) -> dict[str, Any]:
        """Derived numbers for one device (used by entities and the panel)."""
        record = self.store.get_device(device_id) or {"history": []}
        history = sorted_history(record["history"])
        return {
            "last_changed": last_changed(history),
            "changes": len(history),
            "avg_lifetime_days": average_lifetime_days(history),
            "last_note": history[-1].get("note", "") if history else "",
        }

    def snapshot(self) -> dict[str, Any]:
        """Everything the panel needs, in one JSON-serialisable dict."""
        dev_reg = dr.async_get(self.hass)
        area_reg = ar.async_get(self.hass)
        devices: list[dict[str, Any]] = []
        for device_id, source in self.scanned.items():
            device = dev_reg.async_get(device_id)
            if device is None:
                continue
            record = self.store.get_device(device_id) or {}
            level, low, unavailable = self._level(source)
            area = area_reg.async_get_area(device.area_id) if device.area_id else None
            history = sorted_history(record.get("history", []))
            devices.append(
                {
                    "device_id": device_id,
                    "name": device.name_by_user or device.name or device_id,
                    "area": area.name if area else None,
                    "manufacturer": device.manufacturer,
                    "model": device.model,
                    "level": level,
                    "low": low,
                    "unavailable": unavailable,
                    "type": record.get("type"),
                    "ignored": bool(record.get("ignored")),
                    "suspected": record.get("suspected"),
                    **{k: v for k, v in self.device_stats(device_id).items() if k != "last_note"},
                    "history": list(reversed(history)),
                }
            )
        return {
            "types": list(self.store.types),
            "low_threshold": self.low_threshold,
            "devices": devices,
        }

    def _level(self, source: DeviceSource) -> tuple[float | None, bool | None, bool]:
        """Return (level %, is_low, unavailable) from the source entities."""
        level: float | None = None
        low: bool | None = None
        unavailable = True
        if source.level_entity and (state := self.hass.states.get(source.level_entity)):
            unavailable = state.state in ("unavailable", "unknown")
            level = to_float(state.state)
            if level is not None:
                low = level <= self.low_threshold
        if source.low_entity and (state := self.hass.states.get(source.low_entity)):
            if state.state in ("on", "off"):
                unavailable = False if level is None else unavailable
                low = (low or False) or state.state == "on"
        return level, low, unavailable
