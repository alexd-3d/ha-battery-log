"""Battery Log: battery type, change history and a table panel for battery devices."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import (
    CONF_SHOW_IN_SIDEBAR,
    DEFAULT_SHOW_IN_SIDEBAR,
    DOMAIN,
    PANEL_ELEMENT,
    PANEL_ICON,
    PANEL_JS,
    PANEL_TITLE,
    PANEL_TITLES,
    PANEL_URL_PATH,
    PLATFORMS,
    STATIC_URL,
)
from .manager import BatteryLogManager
from .services import async_setup_services
from .store import BatteryLogStore
from .websocket_api import async_setup_websocket

_LOGGER = logging.getLogger(__name__)

type BatteryLogConfigEntry = ConfigEntry[BatteryLogManager]

_STATIC_REGISTERED = f"{DOMAIN}_static_registered"
_FRONTEND_DIR = Path(__file__).parent / "frontend"


def _file_digest(path: Path) -> str:
    """Short content hash used as the cache-busting query string."""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register services and websocket commands once per HA run."""
    async_setup_services(hass)
    async_setup_websocket(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: BatteryLogConfigEntry) -> bool:
    store = BatteryLogStore(hass)
    await store.async_load()
    manager = BatteryLogManager(hass, entry, store)
    entry.runtime_data = manager
    manager.async_start()

    await _async_register_panel(hass, entry)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: BatteryLogConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        entry.runtime_data.async_stop()
        frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
    return unloaded


async def _async_register_panel(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Serve the panel JS and add the panel (sidebar entry is optional)."""
    if not hass.data.get(_STATIC_REGISTERED):
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(STATIC_URL, str(_FRONTEND_DIR), cache_headers=False)
            ]
        )
        hass.data[_STATIC_REGISTERED] = True

    # Cache-bust by content so a new panel file is picked up after an update.
    digest = await hass.async_add_executor_job(_file_digest, _FRONTEND_DIR / PANEL_JS)
    show = entry.options.get(CONF_SHOW_IN_SIDEBAR, DEFAULT_SHOW_IN_SIDEBAR)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=PANEL_TITLES.get(hass.config.language, PANEL_TITLE) if show else None,
        sidebar_icon=PANEL_ICON if show else None,
        module_url=f"{STATIC_URL}/{PANEL_JS}?v={digest}",
        require_admin=True,
        config_panel_domain=DOMAIN,
    )
