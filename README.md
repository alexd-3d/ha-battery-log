# Battery Log for Home Assistant

[Українська версія](README.uk.md)

A small, local-only Home Assistant integration that answers three questions
about every battery-powered device in your home:

- **What battery does it take?** A type you pick from a short list you control.
- **When did I last change it, and all the times before?** A full history with
  date and notes (brand, where you bought it, ...).
- **Which ones need attention?** One table with filters, sorting and a
  "what to buy" summary.

No cloud, no external database, no per-device setup. It finds your battery
devices by itself.

[![Add to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=alexd-3d&repository=ha-battery-log&category=integration)

<p>
  <img src="images/mobile-list.png" width="250" alt="Devices sorted by level: red, yellow and green">
  <img src="images/mobile-history.png" width="250" alt="Change history with the interval since the previous change">
  <img src="images/new-device.png" width="250" alt="Newly found devices waiting for a type and a first entry">
</p>

<p>
  <img src="images/dialog-confirm.png" width="250" alt="Confirming a possible replacement">
  <img src="images/tracked-devices.png" width="250" alt="Tracked and ignored devices">
</p>

![Table on a wide screen](images/desktop-table.png)

<sub>Screenshots use invented demo devices and are in English. The panel and the
integration are also available in Ukrainian and follow your Home Assistant
language. From left to right: sorting by level, history with intervals, newly
found devices (no type and no entries yet), confirming a possible replacement,
the tracked and ignored devices screen.</sub>

## Features

- **Automatic discovery.** Every device that has a battery sensor
  (`device_class: battery`, a `sensor` or a `binary_sensor`) is picked up from the
  Home Assistant registries. New devices appear on their own, nothing to add
  or ignore one by one.
- **Three entities per device**, on the device's own page: `select` battery
  type, `button` "Battery changed", `sensor` "Battery last changed".
- **Full replacement history.** Every change keeps its date, type and a free
  text note. Add, edit and delete entries; each row shows how long the
  previous battery lasted.
- **A panel instead of a card.** Sortable and filterable table (type, area,
  status), search, level colours, shopping summary by battery type,
  average battery life. On a phone it turns into a card list with icon buttons.
- **"Replaced?" hint.** When a battery level jumps up (default 25 points), or a
  "battery low" flag clears, the row gets a badge. Tap it to confirm: the date
  is pre-filled with when the jump was seen and you can edit it, add notes, or
  answer "Not replaced". Nothing is logged without your confirmation.
- **Your own battery types.** Nine predefined (CR2032, CR2450, CR123A, CR2, AAA,
  AA, 9V, Built-in rechargeable, Other) plus "Add new type..." from the panel.
- **Tracked devices screen.** Switch off devices that should not be tracked
  (an inverter battery bank, for example). Ignoring asks for confirmation, and
  ignored devices stay in a list from where you can restore them.
- **Import from Battery Notes** (types and last replaced dates) from the integration's
  Configure menu, shown only when Battery Notes is installed.
- **Automation friendly.** Services and events (see below).
- **Local only.** Data lives in `.storage/battery_log`; the integration makes
  no network requests.
- **English and Ukrainian**, for the integration and the panel. Dates and times
  follow your device's format.

## Install

### HACS (recommended)

1. HACS, three dots menu, **Custom repositories**.
2. Repository `https://github.com/alexd-3d/ha-battery-log`, category
   **Integration**, **Add**. (Or use the button at the top of this page.)
3. Find **Battery Log** in HACS, **Download**.
4. Restart Home Assistant.
5. **Settings, Devices & services, Add integration, Battery Log.** There is
   nothing to fill in.

### Manual

Copy the `custom_components/battery_log` folder into your Home Assistant
`config/custom_components/` folder, restart, then add the integration as above.

Requires **Home Assistant 2026.10** or newer. Developed and tested on 2026.10
with Zigbee2MQTT devices. Any integration that exposes a standard battery
sensor should work.

## Using it

- Open **Battery Log** from the sidebar, or from
  **Settings, Devices & services, Battery Log**. The sidebar entry is optional
  (integration options).
- **Change battery** opens a dialog: date and time (now by default), type and
  notes. The same dialog edits old entries.
- The list icon on a row opens its history.
- The "tune" icon in the header opens **Tracked devices**.
- The battery type can also be set from the device page or in automations.

### Options

Settings, Devices & services, Battery Log, **Configure**:

| Option | Default | Meaning |
|---|---|---|
| Show in sidebar | on | The panel stays reachable from the integration page when off. |
| Low level (red) | 20% | At or below: red, counted in "to buy". |
| Warning level (yellow) | 50% | Above low and up to this value: yellow, higher is green. |
| Possible replacement: level rise | 25 | A rise of at least this many points raises the "Replaced?" hint. |

Changing options reloads the integration; refresh an already open panel.

## Entities

For every tracked device:

| Entity | Notes |
|---|---|
| `select` Battery type | Options come from the shared type list. |
| `button` Battery changed | Logs a change right now. Use the panel for notes or another date. |
| `sensor` Battery last changed | Timestamp. Attributes: `changes_count`, `average_lifetime_days`, `battery_type`, `last_note`, `replacement_suspected`, `recent_changes`. |

## Services

| Service | Fields |
|---|---|
| `battery_log.change` | `device_id`, optional `date`, `note`, `battery_type` |
| `battery_log.set_type` | `device_id`, `battery_type` |
| `battery_log.add_type` | `battery_type` |

## Events

- `battery_log_changed`: `device_id`, `device_name`, `changed_at`, `note`,
  `battery_type`, `source` (`button`, `panel` or `service`).
- `battery_log_replacement_suspected`: `device_id`, `device_name`,
  `from_level`, `to_level`.

Example: ask on your phone when a replacement is suspected.

```yaml
automation:
  - alias: "Battery replaced? Confirm in Battery Log"
    triggers:
      - trigger: event
        event_type: battery_log_replacement_suspected
    actions:
      - action: notify.notify
        data:
          message: >-
            {{ trigger.event.data.device_name }}: battery level jumped
            to {{ trigger.event.data.to_level }}%. Confirm the change in Battery Log.
```

## Coming from Battery Notes

If Battery Notes is installed, **Settings, Devices & services, Battery Log,
Configure** offers **Import from Battery Notes** (the entry is not shown when
Battery Notes is not installed). It takes over, once:

- the battery **type** of each device, only where Battery Log has none yet and only
  for types that exist in your list (types that do not exist are listed in the
  result and kept in the note; add them to the list and run it again);
- the **last replaced** date of each device as one history entry with the note
  "Imported from Battery Notes". A battery quantity such as "2x" and the
  Battery Notes note are appended to that note.

Nothing is changed in Battery Notes, running the import again does not add
anything twice, and importing does not fire the `battery_log_changed` event.
Battery Notes keeps only one date per device, and it can be the day you started
tracking rather than a real replacement, so check the dates afterwards. Both
integrations can run side by side.

## How it compares

An overview of related projects as of November 2026. It is based only on their
public documentation and community posts, read by the author of Battery Log, so it
is not a test of the software. Projects change quickly: please check their pages,
and open an issue here if something is wrong or out of date.

"Not documented" means the pages I read did not say. It does not mean "no".

| | **Battery Log** | [Battery Notes](https://github.com/andrew-codechimp/HA-Battery-Notes) | [Device Sentinel](https://github.com/TheThinkingHome/device_sentinel) | [BatteryBrain](https://github.com/larsbaum/battery_brain) | [Battery Status Manager](https://github.com/OleSint/ha-battery-status-manager) |
|---|---|---|---|---|---|
| **Purpose** | Battery type and replacement log | Battery type, last replaced, low and not-reported tracking | Frozen devices, battery and signal health | Learns discharge behaviour per device | Low-battery and fast-drain notifications |
| **Finding devices** | From the registries, no per-device step | Library match, then each device is added from a discovery card (or manually) | Learns devices automatically | Automatic | All battery entities (scope chosen in setup) |
| **Battery type** | Your own list (9 predefined, add your own) | Community library plus manual entry | Not documented | Not documented | No |
| **Battery quantity** | No | Yes | Not documented | Not documented | No |
| **Last replaced date** | Yes | Yes | Yes (detected, you confirm) | Not documented | No |
| **Full replacement history** | Yes, with notes, edit and delete | No, last date only | Yes, with an archive | Not documented | No |
| **Note per replacement** | Yes | One note per device | Not documented | Not documented | No |
| **Replacement detection** | Hint on a level jump, you confirm (date editable) | Event on a level increase, does not set the date | Detects a swap, asks you to confirm | Not documented | No |
| **Lifetime between replacements** | Per entry and average, from your history | No | Not documented (has remaining-life estimates) | Not documented | No (has a depletion forecast for numeric sensors) |
| **Low battery** | Colour in the panel and a shopping summary, global thresholds, no entity or event | Yes: sensor, thresholds per device, events, triggers | Yes | Adaptive thresholds | Yes, with notifications |
| **"Not reported" detection** | No | Yes | Yes | Yes | Yes |
| **Notifications built in** | No | No | Yes | Not documented | Yes |
| **Events, triggers, services** | 2 events, 3 services | Events, triggers, actions | Fail and recover events | Not documented | Not documented |
| **Predictions or learning** | No | No (stated in its FAQ) | Yes | Yes | Drain alerts, forecast |
| **Own table with filters** | Yes (panel, phone layout) | No (integration page and your dashboards) | Yes (sidebar dashboard) | No (four summary sensors) | No |
| **Entities added per device** | 3 | 4 to 5 | Not documented | None per device | None |
| **Devices without a battery sensor in HA** | Not supported | Via a companion integration | Not documented | Not documented | Not documented |
| **Import from another project** | From Battery Notes | Not documented | Not documented | Not documented | Not documented |
| **Network use** | None | Downloads a device library | Author states none apart from your notifications | Not documented | Not documented |
| **Languages** | English, Ukrainian | Many (translation files in the repo) | Not documented | Not documented | Not documented |
| **Minimum Home Assistant** | 2026.10 | 2026.8 (3.8.x, release notes) | 2026.5 | Not documented | 2023.6 |
| **Distribution** | HACS custom repository | HACS default store | HACS custom repository (default-store submission mentioned) | HACS custom repository | HACS custom repository |
| **Maturity** | New: first public release in November 2026, used in one home, tested with Zigbee2MQTT devices | Established: about 29,000 HACS downloads and 1,200 stars (HACS data, November 2026), many releases | Beta, per its author | Beta, per its author | Beta, per its author |

### What Battery Log does not do

- No notifications, predictions or learning.
- No low-battery or not-reported entities, triggers or per-device thresholds.
- No battery library: types are the ones you pick, with no automatic suggestion by device model.
- No battery quantity, and no devices without a battery sensor in Home Assistant.
- Needs Home Assistant 2026.10 or newer, and an administrator account for the panel.
- Young project: one author, tested on one installation.

Sources: [Battery Notes docs](https://codechimp.org/HA-Battery-Notes/) and
[FAQ](https://codechimp.org/HA-Battery-Notes/faq/),
[Device Sentinel thread](https://community.home-assistant.io/t/device-sentinel-detect-frozen-hardware-with-device-learning/1029252),
[BatteryBrain thread](https://community.home-assistant.io/t/new-integration-batterybrain-learns-your-battery-behavior/1011604),
[Battery Status Manager thread](https://community.simon42.com/t/ha-battery-status-monitor-schwellwert-und-verlustrate-aller-battery-entitaeten-monitoren/85429).
They can be combined: Battery Log only needs a battery sensor from any integration.

## Good to know

- The panel requires an administrator account.
- Battery levels from some devices jump around (Zigbee sensors that report in
  coarse steps). Those can produce "Replaced?" hints that you can dismiss with
  **Not replaced**.
- A device without any battery sensor in Home Assistant is not discovered.
- Removing the integration leaves `.storage/battery_log` in place so your
  history survives a reinstall. Delete the file if you want it gone.

## Development

```bash
python -m pytest tests
node --check custom_components/battery_log/frontend/battery-log-panel.js
```

Issues and pull requests are welcome. Licensed under the [MIT License](LICENSE).
