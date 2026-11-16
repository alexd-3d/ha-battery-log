# Battery Log

A small, local-only Home Assistant integration that remembers, per battery
device: the battery **type**, every **change** (date + note), and shows all of
them in one table.

- **Automatic**: every device with a battery sensor (`device_class: battery`,
  sensor or binary sensor) is found by scanning the registries. No per-device
  "add" step, no external database, no cloud.
- **Per device (3 entities, on the device's own page):**
  `select` battery type, `button` "Battery changed", `sensor` "Battery last changed"
  (attributes: `changes_count`, `average_lifetime_days`, `last_note`, ...).
- **Panel** (sidebar entry is optional; the panel is also linked from the
  integration page): sortable/filterable table, "Change battery" popup with
  date and notes, history per device with edit/delete, type dropdown with
  "Add new type…", shopping summary by type for low batteries, average life.
- **Possible replacement**: when the level jumps up by the configured amount
  (or a "battery low" flag clears), the row gets a "Replaced? Confirm" badge.
  Nothing is logged automatically. The popup is pre-filled with the detected
  date, which you can edit, plus a note.
- **Automation hooks**: events `battery_log_changed` and
  `battery_log_replacement_suspected`; services `battery_log.change`,
  `battery_log.set_type`, `battery_log.add_type`.

Data lives in `.storage/battery_log`.

## Install

HACS → three dots → Custom repositories → `alexd-3d/ha-battery-log`, category
Integration. Restart Home Assistant, then Settings → Devices & services →
Add integration → Battery Log.

Requires Home Assistant 2026.10 or newer.

## Development

```bash
python -m pytest tests
node --check custom_components/battery_log/frontend/battery-log-panel.js
```
