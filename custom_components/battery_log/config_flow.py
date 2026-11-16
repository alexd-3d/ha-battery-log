"""Single-click setup and a small options form."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult, OptionsFlowWithReload
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_LOW_THRESHOLD,
    CONF_REPLACEMENT_JUMP,
    CONF_SHOW_IN_SIDEBAR,
    DEFAULT_LOW_THRESHOLD,
    DEFAULT_REPLACEMENT_JUMP,
    DEFAULT_SHOW_IN_SIDEBAR,
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
    """Sidebar toggle and two thresholds."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        options = self.config_entry.options
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
                    CONF_REPLACEMENT_JUMP,
                    default=options.get(CONF_REPLACEMENT_JUMP, DEFAULT_REPLACEMENT_JUMP),
                ): _percent(DEFAULT_REPLACEMENT_JUMP, 5, 100),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
