# Changelog

## 0.3.0

- New: **Import from Battery Notes** in the Configure menu (types and last-replaced
  dates). The entry only appears when Battery Notes is installed; it never changes
  Battery Notes and is safe to repeat.
- Configure now opens a small menu (Settings, Import) when Battery Notes is
  present; otherwise it goes straight to Settings as before.

## 0.2.1

- Fixed: the text "null" appeared above the fields in the Change battery dialog.

## 0.2.0

First public release.

- Automatic discovery of every device with a battery sensor or battery-low
  flag (no per-device setup).
- Per device: battery type dropdown, "Battery changed" button, "Battery last
  changed" timestamp sensor.
- Full replacement history with date, type and notes. Add, edit and delete from
  the panel; interval since the previous change on every row.
- Panel with search, sorting, filters, shopping summary ("to buy" by type),
  average battery life, and a mobile card layout.
- "Replaced?" hint when the level jumps up, with a confirmation dialog
  (editable date and notes). Nothing is logged automatically.
- Tracked devices screen with confirmation before ignoring, and a list of
  ignored devices that can be restored.
- Configurable low level (red), warning level (yellow) and replacement jump.
- Services `battery_log.change`, `battery_log.set_type`, `battery_log.add_type`;
  events `battery_log_changed` and `battery_log_replacement_suspected`.
- English and Ukrainian (integration and panel).
- Dates and times follow the device format.
