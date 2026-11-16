"""Single-click setup and a small options form."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult, OptionsFlowWithReload
from homeassistant.core import callback
from homeassistant.helpers import selector

from .importer import battery_notes_installed
from .const import (
    CONF_AUTOFILL_TYPES,
    CONF_LOW_THRESHOLD,
    CONF_REPLACEMENT_JUMP,
    CONF_SHOW_IN_SIDEBAR,
    CONF_WARN_THRESHOLD,
    DEFAULT_AUTOFILL_TYPES,
    DEFAULT_LOW_THRESHOLD,
    DEFAULT_REPLACEMENT_JUMP,
    DEFAULT_SHOW_IN_SIDEBAR,
    DEFAULT_WARN_THRESHOLD,
    DOMAIN,
)


def _percent(default: int, minimum: int, maximum: int) -> Any:
    return selector.NumberSelector(
        selector.NumberSelectorConfig(
            min=minimum,
            max=maximum,
            step=1,
            unit_of_measurement="%",
            mode=selector.NumberSelectorMode.BOX,
        )
    )


class BatteryLogConfigFlow(ConfigFlow, domain=DOMAIN):
    """No settings are needed to start: devices are found automatically."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title="Battery Log", data={})
        return self.async_show_form(step_id="user")

    @staticmethod
    @callback
    def async_get_options_flow(config_entry) -> BatteryLogOptionsFlow:
        return BatteryLogOptionsFlow()


class BatteryLogOptionsFlow(OptionsFlowWithReload):
    """Settings, plus a one-time import that only appears when Battery Notes is installed."""

    def _manager(self):
        return getattr(self.config_entry, "runtime_data", None)

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if self._manager() is not None and battery_notes_installed(self.hass):
            return self.async_show_menu(step_id="init", menu_options=["settings", "import_battery_notes"])
        return await self.async_step_settings()

    async def async_step_settings(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            if user_input[CONF_WARN_THRESHOLD] <= user_input[CONF_LOW_THRESHOLD]:
                errors["base"] = "warn_not_above_low"
            else:
                return self.async_create_entry(data=user_input)
        options = user_input or self.config_entry.options
        schema = vol.Schema(
            {
                vol.Required(
                    CONF_SHOW_IN_SIDEBAR,
                    default=options.get(CONF_SHOW_IN_SIDEBAR, DEFAULT_SHOW_IN_SIDEBAR),
                ): bool,
                vol.Required(
                    CONF_LOW_THRESHOLD,
                    default=options.get(CONF_LOW_THRESHOLD, DEFAULT_LOW_THRESHOLD),
                ): _percent(DEFAULT_LOW_THRESHOLD, 1, 100),
                vol.Required(
                    CONF_WARN_THRESHOLD,
                    default=options.get(CONF_WARN_THRESHOLD, DEFAULT_WARN_THRESHOLD),
                ): _percent(DEFAULT_WARN_THRESHOLD, 2, 100),
                vol.Required(
                    CONF_AUTOFILL_TYPES,
                    default=options.get(CONF_AUTOFILL_TYPES, DEFAULT_AUTOFILL_TYPES),
                ): bool,
                vol.Required(
                    CONF_REPLACEMENT_JUMP,
                    default=options.get(CONF_REPLACEMENT_JUMP, DEFAULT_REPLACEMENT_JUMP),
                ): _percent(DEFAULT_REPLACEMENT_JUMP, 5, 100),
            }
        )
        return self.async_show_form(step_id="settings", data_schema=schema, errors=errors)

    @staticmethod
    def _placeholders(plan: dict[str, Any]) -> dict[str, str]:
        return {
            "devices": str(plan["devices"]),
            "new_entries": str(len(plan["adds"])),
            "type_updates": str(len(plan["set_types"])),
            "already": str(plan["already"]),
            "not_tracked": str(plan["not_tracked"]),
            "unknown_types": ", ".join(plan["unknown_types"]) or "-",
        }

    async def async_step_import_battery_notes(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        manager = self._manager()
        if manager is None:
            return self.async_abort(reason="nothing_to_import", description_placeholders=self._placeholders(
                {"devices": 0, "adds": [], "set_types": [], "already": 0, "not_tracked": 0, "unknown_types": []}
            ))
        if user_input is not None:
            plan = manager.async_import_battery_notes(
                import_types=user_input["import_types"], import_dates=user_input["import_dates"]
            )
            reason = "imported" if plan["adds"] or plan["set_types"] else "nothing_to_import"
            return self.async_abort(reason=reason, description_placeholders=self._placeholders(plan))
        plan = manager.preview_battery_notes()
        schema = vol.Schema(
            {
                vol.Required("import_types", default=True): bool,
                vol.Required("import_dates", default=True): bool,
            }
        )
        return self.async_show_form(
            step_id="import_battery_notes",
            data_schema=schema,
            description_placeholders=self._placeholders(plan),
        )
