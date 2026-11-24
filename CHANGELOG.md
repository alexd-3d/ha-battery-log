# Changelog

## 0.6.2

- Fixed: the tooltip of the level chart no longer blinks when the pointer moves, and the values on
  the right part of the chart can be read (nothing drawn over the chart takes the pointer any more).
- Changed: the level history dialog follows the default Home Assistant dialog: a close button at the
  top left, the area and device above the title, no bottom button, and a tooltip in the theme style.
- Changed: the dates on the chart axis and in its tooltip are numeric (day first gives DD.MM.YY) and follow
  the date format of your Home Assistant profile.
- Changed: opening a list of replacements closes the one that was open.

## 0.6.1

- Changed: every icon in the panel is an mdi icon of Home Assistant. The sort marker in the table
  header is an icon too, and the text-glyph fallbacks (list, pencil, trash, arrows) are gone.

## 0.6.0

- New: click a level badge to see the battery level over time (long-term statistics, at most
  the last 2 years; hourly for the last 60 days, daily before) with the low and warning levels
  and the replacements marked.
- New: click anywhere on a row to open or close its replacement list.
- New: the numbers above the table are filters. Click **low**, **to confirm** or a battery type
  under **To buy**; click again to clear, the first number clears all filters.
- Changed: a level badge is coloured by its level only. A device that reports a low battery by
  itself while its level is above the low level gets a red border and still counts as low. The
  label of the counter no longer says "(<= 20%)".
- Fixed: the "Replaced?" badge kept coming back on sensors that flap between a few levels
  (for example 50, 75 and 100) even after "Not replaced". A hint now needs a level higher
  than anything seen in the last 14 days, is not raised during a device's first 3 days of
  watching, "Not replaced" silences the device for 14 days, and a pending hint goes away
  when the level falls back to where it started.
- Documentation: README and comparison table brought up to date (Home Assistant 2026.11
  Marketplace, versions, tested versions, past replacements from history).

## 0.5.0

- New: **Detect past replacements** in the Configure menu. It reads the long-term
  statistics, adds confident replacements and first-seen dates, keeps uncertain ones in
  the panel with an Add button, skips devices with entries you made yourself, has a
  preview mode and always ends with a report with counts and an error code if
  something went wrong. Can be used once.

## 0.4.0

- New: battery type is auto-filled for devices of the same manufacturer and model
  (when you set a type, and for newly found devices). Never overwrites a type,
  skips conflicting types and types you cleared on purpose, marked in the panel,
  can be switched off in the options.
- Documentation: new comparison table, minimum Home Assistant 2025.8.

## 0.3.2

- Added GitHub Actions: Hassfest, HACS validation and tests (no functional change).

## 0.3.1

- Fixed: the Import from Battery Notes entry was offered when Battery Notes only had ignored discovery entries. It now appears only when Battery Notes is really set up.

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
