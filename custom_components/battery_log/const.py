"""Constants for Battery Log."""

from __future__ import annotations

from homeassistant.const import Platform

DOMAIN = "battery_log"
PLATFORMS = [Platform.SELECT, Platform.BUTTON, Platform.SENSOR]

STORAGE_KEY = DOMAIN
STORAGE_VERSION = 1

PANEL_URL_PATH = "battery-log"
PANEL_ELEMENT = "battery-log-panel"
PANEL_TITLE = "Battery Log"
PANEL_ICON = "mdi:battery-heart-variant"
STATIC_URL = "/battery_log_static"
PANEL_JS = "battery-log-panel.js"

# Predefined battery types; the user can add more from the panel.
DEFAULT_TYPES = [
    "CR2032",
    "CR2450",
    "CR123A",
    "CR2",
    "AAA",
    "AA",
    "9V",
    "Built-in rechargeable",
    "Other",
]

CONF_SHOW_IN_SIDEBAR = "show_in_sidebar"
CONF_LOW_THRESHOLD = "low_threshold"
CONF_REPLACEMENT_JUMP = "replacement_jump"

DEFAULT_SHOW_IN_SIDEBAR = True
DEFAULT_LOW_THRESHOLD = 20
DEFAULT_REPLACEMENT_JUMP = 25

EVENT_CHANGED = f"{DOMAIN}_changed"
EVENT_REPLACEMENT_SUSPECTED = f"{DOMAIN}_replacement_suspected"

MAX_NOTE_LENGTH = 500
MAX_TYPE_LENGTH = 40

SOURCE_BUTTON = "button"
SOURCE_PANEL = "panel"
SOURCE_SERVICE = "service"


def signal_device(device_id: str) -> str:
    """Dispatcher signal fired when one device's data changes."""
    return f"{DOMAIN}_device_{device_id}"


SIGNAL_TYPES_CHANGED = f"{DOMAIN}_types_changed"
