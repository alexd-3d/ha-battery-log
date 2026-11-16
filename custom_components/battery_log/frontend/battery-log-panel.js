/* Battery Log panel. Plain web component, no dependencies and no HA-internal
 * elements except <ha-icon> (optional, with a text fallback). All data coming
 * from Home Assistant (device names, notes, ...) is inserted with textContent. */

const NEW_TYPE = "__new__";
const NONE = "";
const COMPACT_BELOW = 720; // px: card list below, table above

const I18N = {
  en: {
    title: "Battery Log", menu: "Menu", back: "Back", manage_btn: "Choose tracked devices", manage_title: "Tracked devices",
    search: "Search…", sort_by: "Sort by", sort_dir: "Sort direction",
    sort_name: "Name", sort_level: "Level", sort_last: "Last changed", sort_type: "Type",
    all_types: "All types", all_areas: "All areas", not_set_filter: "(not set)",
    any_status: "Any status", st_low: "Low battery", st_suspected: "Replaced?", st_offline: "Offline", st_never: "No change logged",
    col_device: "Device", col_type: "Type", col_level: "Level", col_last: "Last changed", col_changes: "Changes", col_avg: "Avg life",
    stat_devices: " devices", stat_low: " low (≤ {x}%)", stat_confirm: " to confirm", buy: "To buy: ", type_unset: "type not set",
    ignored_n_one: "{n} ignored device.", ignored_n_other: "{n} ignored devices.", show_restore: "Show or restore",
    no_match: "No devices match the filters.", none_tracked: "No tracked battery devices.", loading: "Loading…", unavailable_err: "Battery Log is unavailable: {m}",
    never: "never", never_changed: "never changed", no_changes: "no changes logged",
    changes_n_one: "{n} change", changes_n_other: "{n} changes", avg: "avg {v}",
    today: "today", days_ago: "{n} d ago", days_short: "{n} d", months_short: "{v} mo", span_title: "{v} since the previous change",
    pill_low: "Low", pill_offline: "offline", type_ph: "— type —", none_opt: "— not set —", add_type_opt: "＋ Add new type…",
    replaced_q: "Replaced?", confirm_title: "Confirm date and note", replaced_tap: "Replaced? Tap to confirm date and note",
    btn_change: "Change battery", btn_history: "History", btn_edit: "Edit", btn_delete: "Delete",
    manage_hint: "Every device with a battery sensor is found automatically. Switch a device off to stop tracking it: it loses its Battery Log entities and disappears from the table. History is kept.",
    manage_search: "Search devices…", sect_tracked: "Tracked", sect_ignored: "Ignored", none_tracked2: "No tracked devices.", none_ignored: "Nothing is ignored.",
    start_track: "Start tracking", stop_track: "Stop tracking",
    dlg_stop_title: "Stop tracking {name}?", dlg_stop_hint: "Its Battery Log entities are removed and it disappears from the table. The history is kept, and you can switch it back on in the Ignored list.", btn_ignore: "Ignore",
    dlg_cancel: "Cancel", dlg_close: "Close", dlg_save: "Save", dlg_error: "Error",
    f_when: "Date and time", f_type: "Battery type", f_note: "Notes", note_ph: "e.g. Panasonic, bought at a local shop",
    dlg_change_title: "Change battery: {name}", dlg_rose: "Level rose from {a}% to {b}% on {when}. Confirm the real date and add a note.", dlg_rose_plain: "Level rose on {when}. Confirm the real date and add a note.",
    save_change: "Save change", not_replaced: "Not replaced", dlg_edit_title: "Edit change: {name}", bad_date: "Enter a valid date.",
    dlg_del_title: "Delete this change?", dlg_del_hint: "{name}: {when}{note}. This cannot be undone.",
    dlg_newtype_title: "Add battery type", dlg_newtype_hint: "It will be added to the shared list and set for {name}.", type_name: "Type name", type_name_ph: "e.g. LR44", enter_name: "Enter a name.",
  },
  uk: {
    title: "Журнал батарей", menu: "Меню", back: "Назад", manage_btn: "Вибір відстежуваних пристроїв", manage_title: "Відстежувані пристрої",
    search: "Пошук…", sort_by: "Сортування", sort_dir: "Напрям сортування",
    sort_name: "Назва", sort_level: "Рівень", sort_last: "Остання заміна", sort_type: "Тип",
    all_types: "Усі типи", all_areas: "Усі зони", not_set_filter: "(не вказано)",
    any_status: "Усі стани", st_low: "Розряджені", st_suspected: "Замінено?", st_offline: "Не в мережі", st_never: "Без записів замін",
    col_device: "Пристрій", col_type: "Тип", col_level: "Рівень", col_last: "Остання заміна", col_changes: "Заміни", col_avg: "Сер. термін",
    stat_devices: " пристроїв", stat_low: " з низьким рівнем (≤ {x}%)", stat_confirm: " до підтвердження", buy: "Купити: ", type_unset: "тип не вказано",
    ignored_n_one: "{n} ігнорований пристрій.", ignored_n_few: "{n} ігноровані пристрої.", ignored_n_many: "{n} ігнорованих пристроїв.", ignored_n_other: "{n} ігнорованих пристроїв.",
    show_restore: "Показати або повернути",
    no_match: "Немає пристроїв за цими фільтрами.", none_tracked: "Немає відстежуваних пристроїв.", loading: "Завантаження…", unavailable_err: "Журнал батарей недоступний: {m}",
    never: "ніколи", never_changed: "не змінювалась", no_changes: "замін не записано",
    changes_n_one: "{n} заміна", changes_n_few: "{n} заміни", changes_n_many: "{n} замін", changes_n_other: "{n} замін", avg: "сер. {v}",
    today: "сьогодні", days_ago: "{n} дн. тому", days_short: "{n} дн.", months_short: "{v} міс.", span_title: "{v} від попередньої заміни",
    pill_low: "Низький", pill_offline: "не в мережі", type_ph: "— тип —", none_opt: "— не вказано —", add_type_opt: "＋ Додати новий тип…",
    replaced_q: "Замінено?", confirm_title: "Підтвердіть дату й нотатку", replaced_tap: "Замінено? Торкніться, щоб підтвердити дату й нотатку",
    btn_change: "Замінити батарею", btn_history: "Історія", btn_edit: "Змінити", btn_delete: "Видалити",
    manage_hint: "Усі пристрої з датчиком батареї знаходяться автоматично. Вимкніть пристрій, щоб припинити його відстеження: його сутності Battery Log буде видалено, а з таблиці він зникне. Історію буде збережено.",
    manage_search: "Пошук пристроїв…", sect_tracked: "Відстежуються", sect_ignored: "Ігноруються", none_tracked2: "Немає відстежуваних пристроїв.", none_ignored: "Нічого не ігнорується.",
    start_track: "Почати відстеження", stop_track: "Припинити відстеження",
    dlg_stop_title: "Припинити відстеження «{name}»?", dlg_stop_hint: "Його сутності Battery Log буде видалено, а з таблиці він зникне. Історію збережено, повернути пристрій можна у списку «Ігноруються».", btn_ignore: "Ігнорувати",
    dlg_cancel: "Скасувати", dlg_close: "Закрити", dlg_save: "Зберегти", dlg_error: "Помилка",
    f_when: "Дата й час", f_type: "Тип батареї", f_note: "Нотатки", note_ph: "напр. Panasonic, куплено в місцевому магазині",
    dlg_change_title: "Заміна батареї: {name}", dlg_rose: "Рівень зріс з {a}% до {b}% — {when}. Підтвердіть реальну дату й додайте нотатку.", dlg_rose_plain: "Рівень зріс — {when}. Підтвердіть реальну дату й додайте нотатку.",
    save_change: "Зберегти заміну", not_replaced: "Не замінювали", dlg_edit_title: "Редагування заміни: {name}", bad_date: "Вкажіть коректну дату.",
    dlg_del_title: "Видалити цей запис заміни?", dlg_del_hint: "{name}: {when}{note}. Скасувати це неможливо.",
    dlg_newtype_title: "Додати тип батареї", dlg_newtype_hint: "Його буде додано до спільного списку й призначено для «{name}».", type_name: "Назва типу", type_name_ph: "напр. LR44", enter_name: "Вкажіть назву.",
  },
};

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  const props = {};
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (["value", "checked", "selected", "disabled"].includes(k)) props[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  const add = (kid) => {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) kid.forEach(add);
    else el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  };
  kids.forEach(add);
  Object.assign(el, props);
  return el;
};

const pad = (n) => String(n).padStart(2, "0");
const toLocalInput = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const STYLE = `
:host { display:block; min-height:100%; background:var(--primary-background-color); color:var(--primary-text-color); font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif); --gap:16px; }
:host([compact]) { --gap:12px; }
* { box-sizing:border-box; }
[hidden] { display:none !important; }
.bar { display:flex; align-items:center; gap:4px; height:56px; padding:0 8px 0 4px; background:var(--app-header-background-color, var(--primary-color)); color:var(--app-header-text-color, #fff); position:sticky; top:0; z-index:3; }
.bar h1 { font-size:20px; font-weight:400; margin:0 0 0 8px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar .ibtn { color:inherit; border-color:transparent; }
.bar .menu { display:none; }
:host([narrow]) .bar .menu { display:inline-flex; }
.wrap { padding:var(--gap); max-width:1500px; margin:0 auto; display:grid; gap:var(--gap); }
.stats { display:flex; flex-wrap:wrap; gap:8px var(--gap); font-size:14px; color:var(--secondary-text-color); }
.stats b { color:var(--primary-text-color); font-size:16px; }
.buy { font-size:14px; color:var(--secondary-text-color); }
.buy b { color:var(--primary-text-color); }
.filters { display:grid; gap:10px; }
.row1 { display:flex; gap:10px; }
.row1 input[type=search] { flex:1; min-width:0; }
.row3 { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; }
:host(:not([compact])) .filters { grid-template-columns:minmax(220px, 320px) repeat(3, minmax(0, 200px)); align-items:center; }
:host(:not([compact])) .row1, :host(:not([compact])) .row3 { display:contents; }
:host(:not([compact])) .sortctl { display:none; }
input, select, textarea { font:inherit; font-size:15px; color:var(--primary-text-color); background:var(--card-background-color, #fff); border:1px solid var(--divider-color); border-radius:10px; padding:0 10px; height:42px; min-width:0; width:100%; text-overflow:ellipsis; }
textarea { height:auto; min-height:90px; padding:10px; resize:vertical; }
.sortctl { display:flex; gap:6px; flex:0 0 auto; }
.sortctl select { width:auto; max-width:120px; }
.card { background:var(--card-background-color, #fff); border-radius:var(--ha-card-border-radius, 12px); border:1px solid var(--divider-color); overflow:hidden; }
table { border-collapse:collapse; width:100%; }
th, td { text-align:left; padding:12px 14px; border-bottom:1px solid var(--divider-color); vertical-align:middle; font-size:14px; }
th { font-weight:500; color:var(--secondary-text-color); cursor:pointer; user-select:none; white-space:nowrap; }
th.nosort { cursor:default; }
tr:last-child td { border-bottom:0; }
td select { min-width:130px; height:38px; }
.name { font-weight:500; overflow-wrap:anywhere; }
.sub { color:var(--secondary-text-color); font-size:12px; margin-top:2px; overflow-wrap:anywhere; }
.muted { color:var(--secondary-text-color); }
.pill { display:inline-block; font-size:13px; padding:2px 10px; border-radius:12px; background:var(--secondary-background-color, rgba(127,127,127,.2)); font-variant-numeric:tabular-nums; white-space:nowrap; }
.pill.low { background:var(--error-color, #db4437); color:#fff; }
.pill.mid { background:var(--warning-color, #ffa600); color:#000; }
.pill.ok { background:var(--success-color, #43a047); color:#fff; }
.pill.off { opacity:.7; }
.ibtn { display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; padding:0; border-radius:50%; border:1px solid var(--divider-color); background:transparent; color:var(--primary-text-color); cursor:pointer; --mdc-icon-size:22px; flex:0 0 auto; }
.ibtn.on { background:color-mix(in srgb, var(--primary-text-color) 16%, transparent); }
.ibtn:hover { filter:brightness(1.15); }
.btn { font:inherit; font-size:14px; cursor:pointer; border-radius:10px; padding:0 14px; height:38px; border:1px solid var(--divider-color); background:transparent; color:var(--primary-text-color); display:inline-flex; align-items:center; gap:6px; --mdc-icon-size:20px; }
.btn.primary { background:var(--primary-color); color:var(--text-primary-color, #fff); border-color:var(--primary-color); }
.warnbtn { font:inherit; font-size:13px; cursor:pointer; border:0; border-radius:10px; padding:8px 12px; background:var(--warning-color, #ffa600); color:#000; text-align:left; }
.warnbtn.small { padding:2px 10px; margin-left:8px; border-radius:12px; }
.actions { display:flex; gap:8px; align-items:center; }
.hist { margin:0; padding:0; list-style:none; display:grid; gap:12px; max-width:760px; }
.hist li { display:grid; grid-template-columns:1fr auto; gap:0 8px; align-items:center; font-size:13px; }
.hist .head { display:flex; align-items:baseline; flex-wrap:wrap; gap:2px 10px; min-width:0; font-variant-numeric:tabular-nums; }
.hist .d { font-weight:600; color:var(--primary-text-color); }
.hist .t { color:var(--secondary-text-color); font-weight:400; margin-left:6px; }
.hist .span { font-size:12px; padding:0 8px; border-radius:10px; border:1px solid var(--divider-color); color:var(--secondary-text-color); white-space:nowrap; }
.hist .meta { grid-column:1 / -1; margin-top:2px; color:var(--secondary-text-color); overflow-wrap:anywhere; line-height:1.35; }
.hist .acts { display:flex; gap:0; }
.hist .ibtn { width:30px; height:30px; border:0; border-radius:8px; background:transparent; color:var(--secondary-text-color); --mdc-icon-size:18px; }
.hist .ibtn:hover { color:var(--primary-text-color); }
tr.histrow td { background:color-mix(in srgb, var(--primary-text-color) 9%, transparent); color:var(--secondary-text-color); box-shadow:inset 3px 0 0 var(--primary-color); }
tr.open td:first-child { box-shadow:inset 3px 0 0 var(--primary-color); }
.dev { padding:14px; display:grid; gap:12px; border-bottom:1px solid var(--divider-color); }
.dev:last-child { border-bottom:0; }
.dev.open { box-shadow:inset 3px 0 0 var(--primary-color); background:color-mix(in srgb, var(--primary-text-color) 4%, transparent); }
.dev-top { display:flex; gap:10px; align-items:flex-start; justify-content:space-between; }
.dev-top > :first-child { min-width:0; }
.dev-mid { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:12px; align-items:center; font-size:13px; }
.dev-foot { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.dev .histbox { padding:10px 12px; border-radius:10px; background:color-mix(in srgb, var(--primary-text-color) 9%, transparent); color:var(--secondary-text-color); }
.sect { font-size:13px; font-weight:500; color:var(--secondary-text-color); text-transform:uppercase; letter-spacing:.04em; margin:4px 2px -4px; }
.foot { font-size:13px; color:var(--secondary-text-color); display:flex; gap:8px; align-items:center; }
.linkbtn { font:inherit; font-size:13px; background:none; border:0; padding:0; color:var(--primary-color); cursor:pointer; text-decoration:underline; }
.empty { padding:28px; text-align:center; color:var(--secondary-text-color); }
.mrow { display:flex; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid var(--divider-color); }
.mrow:last-child { border-bottom:0; }
.mrow .grow { flex:1; min-width:0; }
.mrow.off .name { opacity:.55; }
.hint { font-size:13px; color:var(--secondary-text-color); line-height:1.4; }
input.switch { appearance:none; -webkit-appearance:none; width:46px; height:26px; padding:0; border-radius:13px; background:var(--disabled-text-color, #888); position:relative; cursor:pointer; flex:0 0 auto; border:0; transition:background .15s; }
input.switch::after { content:""; position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%; background:#fff; transition:left .15s; }
input.switch:checked { background:var(--primary-color); }
input.switch:checked::after { left:23px; }
dialog { border:0; border-radius:14px; padding:20px; background:var(--card-background-color, #fff); color:var(--primary-text-color); width:min(440px, 92vw); box-shadow:0 8px 32px rgba(0,0,0,.4); }
dialog::backdrop { background:rgba(0,0,0,.5); }
dialog h2 { margin:0 0 12px; font-size:18px; font-weight:500; }
dialog .field { display:grid; gap:6px; margin-bottom:14px; font-size:14px; }
dialog .hint { margin-bottom:14px; }
dialog .err { color:var(--error-color, #db4437); font-size:13px; min-height:1em; margin-bottom:8px; }
dialog .btns { display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
.fb { font-size:16px; line-height:1; }
`;

const COLUMNS = [
  { key: "name", label: "col_device" },
  { key: "type", label: "col_type" },
  { key: "level", label: "col_level" },
  { key: "last_changed", label: "col_last" },
  { key: "changes", label: "col_changes" },
  { key: "avg_lifetime_days", label: "col_avg" },
  { key: null, label: "" },
];

const SORTS = [
  ["name", "sort_name"],
  ["level", "sort_level"],
  ["last_changed", "sort_last"],
  ["type", "sort_type"],
];

class BatteryLogPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._data = null;
    this._sort = { key: "name", dir: 1 };
    this._filter = { q: "", type: "", status: "", area: "" };
    this._view = "table";
    this._manageQ = "";
    this._expanded = new Set();
    this._unsub = null;
    this._built = false;
    this._compact = false;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (this._built && this._staticLang !== this._lang()) {
      this._renderStatic();
      if (this._data) this._renderAll();
    }
    if (first && this.isConnected) this._subscribe();
  }

  /** UI language: the user's HA language when we ship it, otherwise English. */
  _lang() {
    const code = String(this._hass?.language || this._hass?.locale?.language || "en").toLowerCase().slice(0, 2);
    return I18N[code] ? code : "en";
  }

  _t(key, vars = {}) {
    const dict = I18N[this._lang()];
    let text = dict[key] ?? I18N.en[key] ?? key;
    for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
    return text;
  }

  _plural(key, n, vars = {}) {
    const cat = new Intl.PluralRules(this._lang()).select(n);
    const dict = I18N[this._lang()];
    const k = dict[`${key}_${cat}`] !== undefined ? `${key}_${cat}` : `${key}_other`;
    return this._t(k, { n, ...vars });
  }
  set narrow(value) {
    this.toggleAttribute("narrow", !!value);
  }
  set panel(_) {}
  set route(_) {}

  connectedCallback() {
    this._build();
    if (this._hass && !this._unsub) this._subscribe();
    this._ro = new ResizeObserver(() => this._checkWidth());
    this._ro.observe(this);
  }

  disconnectedCallback() {
    const unsub = this._unsub;
    this._unsub = null;
    if (unsub) unsub.then((fn) => fn()).catch(() => {});
    this._ro?.disconnect();
  }

  _checkWidth() {
    const compact = this.clientWidth > 0 && this.clientWidth < COMPACT_BELOW;
    if (compact === this._compact) return;
    this._compact = compact;
    this.toggleAttribute("compact", compact);
    this._renderTable();
  }

  _subscribe() {
    this._unsub = this._hass.connection.subscribeMessage(
      (data) => {
        this._data = data;
        this._renderAll();
      },
      { type: "battery_log/subscribe" }
    );
    this._unsub.catch((err) => this._showFatal(err));
  }

  _showFatal(err) {
    this._tableHost.replaceChildren(h("div", { class: "empty" }, this._t("unavailable_err", { m: err?.message || err })));
  }

  _ws(msg) {
    return this._hass.callWS(msg);
  }

  // ----------------------------------------------------------- small widgets

  _icon(name, fallback) {
    return customElements.get("ha-icon") ? h("ha-icon", { icon: name }) : h("span", { class: "fb" }, fallback);
  }

  _ibtn(name, fallback, title, onclick, cls = "") {
    return h("button", { class: `ibtn ${cls}`.trim(), title, "aria-label": title, onclick }, this._icon(name, fallback));
  }

  _setTitle(el, text) {
    el.title = text;
    el.setAttribute("aria-label", text);
  }

  // ------------------------------------------------------------------ build

  _build() {
    if (this._built) return;
    this._built = true;
    const root = this.shadowRoot;

    this._menuBtn = this._ibtn("mdi:menu", "☰", "Menu", () => this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true })), "menu");
    this._backBtn = this._ibtn("mdi:arrow-left", "←", "Back", () => this._setView("table"));
    this._cogBtn = this._ibtn("mdi:tune-variant", "⚙", "Choose tracked devices", () => this._setView("manage"));
    this._title = h("h1", {}, "Battery Log");
    this._bar = h("div", { class: "bar" });

    this._search = h("input", { type: "search", oninput: (e) => this._setFilter("q", e.target.value) });
    this._sortSel = h("select", { onchange: (e) => this._setSort(e.target.value) }, SORTS.map(([k]) => h("option", { value: k })));
    this._sortDir = this._ibtn("mdi:arrow-up", "↑", "Sort direction", () => this._setSort(this._sort.key, true));
    this._typeSel = h("select", { onchange: (e) => this._setFilter("type", e.target.value) });
    this._areaSel = h("select", { onchange: (e) => this._setFilter("area", e.target.value) });
    this._statusSel = h(
      "select",
      { onchange: (e) => this._setFilter("status", e.target.value) },
      h("option", { value: "" }),
      h("option", { value: "low" }),
      h("option", { value: "suspected" }),
      h("option", { value: "unavailable" }),
      h("option", { value: "never" })
    );
    this._stats = h("div", { class: "stats" });
    this._buy = h("div", { class: "buy" });
    this._tableHost = h("div", { class: "card" }, h("div", { class: "empty" }));
    this._ignoredNote = h("div", { class: "foot", hidden: true });
    this._tableView = h(
      "div",
      { class: "wrap" },
      this._stats,
      this._buy,
      h("div", { class: "filters" }, h("div", { class: "row1" }, this._search, h("div", { class: "sortctl" }, this._sortSel, this._sortDir)), h("div", { class: "row3" }, this._typeSel, this._areaSel, this._statusSel)),
      this._tableHost,
      this._ignoredNote
    );

    this._manageSearch = h("input", { type: "search", oninput: (e) => { this._manageQ = e.target.value; this._renderManage(); } });
    this._manageList = h("div", { class: "wrap", style: "padding:0" });
    this._manageView = h(
      "div",
      { class: "wrap", hidden: true },
      (this._manageHint = h("div", { class: "hint" })),
      this._manageSearch,
      this._manageList
    );

    this._dialog = h("dialog");
    this._dialog.addEventListener("click", (e) => {
      if (e.target === this._dialog) this._dialog.close();
    });

    root.append(h("style", {}, STYLE), this._bar, this._tableView, this._manageView, this._dialog);
    this._renderStatic();
  }

  /** (Re)apply every static label; runs on build and whenever the language changes. */
  _renderStatic() {
    this._staticLang = this._lang();
    this._setTitle(this._menuBtn, this._t("menu"));
    this._setTitle(this._backBtn, this._t("back"));
    this._setTitle(this._cogBtn, this._t("manage_btn"));
    this._setTitle(this._sortDir, this._t("sort_dir"));
    this._search.placeholder = this._t("search");
    this._manageSearch.placeholder = this._t("manage_search");
    this._manageHint.textContent = this._t("manage_hint");
    this._sortSel.title = this._t("sort_by");
    [...this._sortSel.options].forEach((o, i) => (o.textContent = this._t(SORTS[i][1])));
    const status = ["any_status", "st_low", "st_suspected", "st_offline", "st_never"];
    [...this._statusSel.options].forEach((o, i) => (o.textContent = this._t(status[i])));
    if (!this._data) this._tableHost.replaceChildren(h("div", { class: "empty" }, this._t("loading")));
    this._renderBar();
  }

  _renderBar() {
    const manage = this._view === "manage";
    this._title.textContent = manage ? this._t("manage_title") : this._t("title");
    this._bar.replaceChildren(...[manage ? this._backBtn : this._menuBtn, this._title, manage ? null : this._cogBtn].filter(Boolean));
  }

  _setView(view) {
    this._view = view;
    this._tableView.hidden = view !== "table";
    this._manageView.hidden = view !== "manage";
    this._renderBar();
    window.scrollTo?.(0, 0);
    if (view === "manage") this._renderManage();
  }

  _setFilter(key, value) {
    this._filter[key] = value;
    this._renderTable();
  }

  _setSort(key, toggle = false) {
    this._sort = toggle ? { key, dir: -this._sort.dir } : { key, dir: key === this._sort.key ? this._sort.dir : 1 };
    this._renderTable();
  }

  // ----------------------------------------------------------------- render

  _renderAll() {
    if (!this._data) return;
    this._fillSelect(this._typeSel, this._t("all_types"), [...this._data.types, this._t("not_set_filter")], this._filter.type);
    const areas = [...new Set(this._data.devices.filter((d) => !d.ignored).map((d) => d.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    this._fillSelect(this._areaSel, this._t("all_areas"), areas, this._filter.area);
    this._renderTable();
    if (this._view === "manage") this._renderManage();
  }

  _fillSelect(sel, allLabel, values, current) {
    sel.replaceChildren(h("option", { value: "" }, allLabel), ...values.map((v) => h("option", { value: v, selected: v === current }, v)));
    sel.value = current;
  }

  _visible() {
    const f = this._filter;
    const q = f.q.trim().toLowerCase();
    return this._data.devices.filter((d) => {
      if (d.ignored) return false;
      if (f.type === this._t("not_set_filter") ? d.type : f.type && d.type !== f.type) return false;
      if (f.area && d.area !== f.area) return false;
      if (f.status === "low" && !d.low) return false;
      if (f.status === "suspected" && !d.suspected) return false;
      if (f.status === "unavailable" && !d.unavailable) return false;
      if (f.status === "never" && d.changes) return false;
      if (q && ![d.name, d.area, d.type, d.model, d.manufacturer].some((s) => s && s.toLowerCase().includes(q))) return false;
      return true;
    });
  }

  _sorted(list) {
    const { key, dir } = this._sort;
    const val = (d) => {
      const v = d[key];
      if (key === "last_changed") return v ? Date.parse(v) : null;
      return v === undefined || v === "" ? null : v;
    };
    return [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va === null && vb === null) return a.name.localeCompare(b.name);
      if (va === null) return 1;
      if (vb === null) return -1;
      const c = typeof va === "string" ? va.localeCompare(vb) : va - vb;
      return (c || a.name.localeCompare(b.name)) * dir;
    });
  }

  _renderTable() {
    if (!this._data) return;
    const all = this._data.devices.filter((d) => !d.ignored);
    const low = all.filter((d) => d.low);
    const suspected = all.filter((d) => d.suspected).length;
    const buy = {};
    low.forEach((d) => {
      const k = d.type || this._t("type_unset");
      buy[k] = (buy[k] || 0) + 1;
    });
    this._stats.replaceChildren(
      ...[
        h("span", {}, h("b", {}, all.length), this._t("stat_devices")),
        h("span", {}, h("b", {}, low.length), this._t("stat_low", { x: this._data.low_threshold })),
        suspected ? h("span", {}, h("b", {}, suspected), this._t("stat_confirm")) : null,
      ].filter(Boolean)
    );
    this._buy.hidden = !low.length;
    this._buy.replaceChildren(
      ...(low.length ? [this._t("buy"), h("b", {}, Object.entries(buy).sort().map(([t, n]) => `${t} ×${n}`).join(", "))] : [])
    );
    const ignoredCount = this._data.devices.length - all.length;
    this._ignoredNote.hidden = !ignoredCount;
    this._ignoredNote.replaceChildren(
      ...(ignoredCount ? [this._plural("ignored_n", ignoredCount), h("button", { class: "linkbtn", onclick: () => this._setView("manage") }, this._t("show_restore"))] : [])
    );
    this._sortSel.value = this._sort.key;
    this._sortDir.replaceChildren(this._icon(this._sort.dir > 0 ? "mdi:arrow-up" : "mdi:arrow-down", this._sort.dir > 0 ? "↑" : "↓"));

    const rows = this._sorted(this._visible());
    if (!rows.length) {
      this._tableHost.replaceChildren(h("div", { class: "empty" }, all.length ? this._t("no_match") : this._t("none_tracked")));
      return;
    }
    this._tableHost.replaceChildren(this._compact ? h("div", {}, rows.map((d) => this._card(d))) : this._table(rows));
  }

  // ---------------------------------------------------------------- formats

  /** Date/time in the device's own format; an explicit HA profile choice (DMY/MDY/YMD, 12/24 h) wins. */
  _fmtDate(iso, withTime = false) {
    const loc = this._hass?.locale || {};
    const system = navigator.languages?.[0] || navigator.language || undefined;
    const dateLocale = { DMY: "en-GB", MDY: "en-US", YMD: "sv-SE" }[loc.date_format] || system;
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
    return withTime ? `${date}, ${this._fmtTime(iso)}` : date;
  }

  _fmtTime(iso) {
    const loc = this._hass?.locale || {};
    const system = navigator.languages?.[0] || navigator.language || undefined;
    const hour12 = loc.time_format === "am_pm" ? true : loc.time_format === "twenty_four" ? false : undefined;
    return new Intl.DateTimeFormat(system, { hour: "2-digit", minute: "2-digit", hour12 }).format(new Date(iso));
  }

  _daysAgo(iso) {
    const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
    return days <= 0 ? this._t("today") : this._t("days_ago", { n: days });
  }

  _avg(d) {
    return d.avg_lifetime_days ? `≈ ${this._t("months_short", { v: (d.avg_lifetime_days / 30.44).toFixed(1) })}` : null;
  }

  _levelPill(d) {
    if (d.level !== null) {
      // red: low, yellow: up to the warning level, green: fine (levels come from the integration options)
      const tone = d.low ? "low" : d.level <= (this._data?.warn_threshold ?? 50) ? "mid" : "ok";
      return h("span", { class: `pill ${tone}` }, `${Math.round(d.level)} %`);
    }
    if (d.low) return h("span", { class: "pill low" }, this._t("pill_low"));
    return h("span", { class: "pill off" }, d.unavailable ? this._t("pill_offline") : "—");
  }

  _typeSelect(d) {
    return h(
      "select",
      { onchange: (e) => this._onTypeChange(d, e.target) },
      h("option", { value: NONE, selected: !d.type }, this._t("type_ph")),
      this._data.types.map((t) => h("option", { value: t, selected: t === d.type }, t)),
      h("option", { value: NEW_TYPE }, this._t("add_type_opt"))
    );
  }

  _subline(d) {
    return [d.area, d.model].filter(Boolean).join(" · ");
  }

  // ------------------------------------------------------------ wide: table

  _table(rows) {
    const head = h(
      "tr",
      {},
      COLUMNS.map((c) =>
        h(
          "th",
          { class: c.key ? "" : "nosort", onclick: c.key ? () => this._setSort(c.key, c.key === this._sort.key) : null },
          c.label ? this._t(c.label) : "",
          this._sort.key === c.key ? (this._sort.dir > 0 ? " ▲" : " ▼") : ""
        )
      )
    );
    return h("table", {}, h("thead", {}, head), h("tbody", {}, rows.flatMap((d) => this._tableRows(d))));
  }

  _tableRows(d) {
    const open = this._expanded.has(d.device_id);
    const tr = h(
      "tr",
      { class: open && d.history.length ? "open" : "" },
      h("td", {}, h("div", { class: "name" }, d.name, d.suspected ? h("button", { class: "warnbtn small", title: this._t("confirm_title"), onclick: () => this._openChange(d) }, this._t("replaced_q")) : null), h("div", { class: "sub" }, this._subline(d))),
      h("td", {}, this._typeSelect(d)),
      h("td", {}, this._levelPill(d)),
      h("td", {}, d.last_changed ? [this._fmtDate(d.last_changed), h("div", { class: "sub" }, this._daysAgo(d.last_changed))] : h("span", { class: "muted" }, this._t("never"))),
      h("td", {}, d.changes ? h("button", { class: "btn", onclick: () => this._toggleHistory(d.device_id) }, `${d.changes}`, this._icon("mdi:format-list-bulleted", "☰")) : h("span", { class: "muted" }, "0")),
      h("td", {}, this._avg(d) || h("span", { class: "muted" }, "—")),
      h("td", {}, h("button", { class: "btn", onclick: () => this._openChange(d) }, this._icon("mdi:battery-sync", "⟳"), this._t("btn_change")))
    );
    const out = [tr];
    if (open && d.history.length) out.push(h("tr", { class: "histrow" }, h("td", { colspan: COLUMNS.length }, this._historyList(d))));
    return out;
  }

  // ------------------------------------------------------ compact: card list

  _card(d) {
    const open = this._expanded.has(d.device_id);
    const stats = [d.changes ? this._plural("changes_n", d.changes) : this._t("no_changes"), this._avg(d) ? this._t("avg", { v: this._avg(d) }) : null].filter(Boolean).join(" · ");
    return h(
      "div",
      { class: open && d.history.length ? "dev open" : "dev" },
      h("div", { class: "dev-top" }, h("div", {}, h("div", { class: "name" }, d.name), h("div", { class: "sub" }, this._subline(d))), this._levelPill(d)),
      d.suspected ? h("button", { class: "warnbtn", onclick: () => this._openChange(d) }, this._t("replaced_tap")) : null,
      h("div", { class: "dev-mid" }, this._typeSelect(d), d.last_changed ? h("div", {}, h("div", {}, this._fmtDate(d.last_changed)), h("div", { class: "sub" }, this._daysAgo(d.last_changed))) : h("div", { class: "muted" }, this._t("never_changed"))),
      h(
        "div",
        { class: "dev-foot" },
        h("div", { class: "sub" }, stats),
        h("div", { class: "actions" }, d.changes ? this._ibtn("mdi:format-list-bulleted", "☰", this._t("btn_history"), () => this._toggleHistory(d.device_id), open ? "on" : "") : null, this._ibtn("mdi:battery-sync", "⟳", this._t("btn_change"), () => this._openChange(d)))
      ),
      open && d.history.length ? h("div", { class: "histbox" }, this._historyList(d)) : null
    );
  }

  // ------------------------------------------------------------- history

  _historyList(d) {
    return h(
      "ul",
      { class: "hist" },
      d.history.map((e, i) => {
        // history is newest first: the next item is the previous (older) change
        const prev = d.history[i + 1];
        const span = prev ? this._span(prev.at, e.at) : null;
        const meta = [e.type, e.note].filter(Boolean).join(" · ");
        return h(
          "li",
          {},
          h(
            "div",
            { class: "head" },
            h("span", {}, h("span", { class: "d" }, this._fmtDate(e.at)), h("span", { class: "t" }, this._fmtTime(e.at))),
            span ? h("span", { class: "span", title: this._t("span_title", { v: span.short }) }, span.short) : null
          ),
          h("div", { class: "acts" }, this._ibtn("mdi:pencil", "✎", this._t("btn_edit"), () => this._openEdit(d, e)), this._ibtn("mdi:delete", "🗑", this._t("btn_delete"), () => this._confirmDelete(d, e))),
          meta ? h("div", { class: "meta" }, meta) : null
        );
      })
    );
  }

  /** Distance between two ISO dates: days when short, months otherwise. */
  _span(fromIso, toIso) {
    const days = Math.max(0, (Date.parse(toIso) - Date.parse(fromIso)) / 86400000);
    if (days < 60) return { short: this._t("days_short", { n: Math.round(days) }) };
    return { short: this._t("months_short", { v: (days / 30.44).toFixed(1) }) };
  }

  _toggleHistory(id) {
    this._expanded.has(id) ? this._expanded.delete(id) : this._expanded.add(id);
    this._renderTable();
  }

  // --------------------------------------------------------- manage devices

  _renderManage() {
    if (!this._data) return;
    const q = this._manageQ.trim().toLowerCase();
    const list = [...this._data.devices]
      .filter((d) => !q || [d.name, d.area, d.model].some((s) => s && s.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
    const section = (title, items, emptyText) => [
      h("div", { class: "sect" }, `${title} (${items.length})`),
      h(
        "div",
        { class: "card" },
        items.length
          ? items.map((d) =>
              h(
                "label",
                { class: `mrow${d.ignored ? " off" : ""}` },
                h("div", { class: "grow" }, h("div", { class: "name" }, d.name), h("div", { class: "sub" }, this._subline(d))),
                this._levelPill(d),
                h("input", { class: "switch", type: "checkbox", title: d.ignored ? this._t("start_track") : this._t("stop_track"), checked: !d.ignored, onchange: (e) => this._toggleTrack(d, e.target) })
              )
            )
          : h("div", { class: "empty" }, emptyText)
      ),
    ];
    this._manageList.replaceChildren(
      ...section(this._t("sect_tracked"), list.filter((d) => !d.ignored), this._t("none_tracked2")),
      ...section(this._t("sect_ignored"), list.filter((d) => d.ignored), this._t("none_ignored"))
    );
  }

  async _toggleTrack(d, input) {
    if (input.checked) {
      // back to tracking: no confirmation needed
      const err = await this._run({ type: "battery_log/set_ignored", device_id: d.device_id, ignored: false });
      if (err) {
        input.checked = false;
        this._alert(err);
      }
      return;
    }
    let done = false;
    this._dialog.addEventListener("close", () => { if (!done) input.checked = true; }, { once: true });
    this._openDialog({
      title: this._t("dlg_stop_title", { name: d.name }),
      hint: this._t("dlg_stop_hint"),
      saveLabel: this._t("btn_ignore"),
      save: async () => {
        const err = await this._run({ type: "battery_log/set_ignored", device_id: d.device_id, ignored: true });
        if (!err) done = true;
        return err;
      },
    });
  }

  // ---------------------------------------------------------------- actions

  async _run(msg) {
    try {
      await this._ws(msg);
      return null;
    } catch (err) {
      return err?.message || String(err);
    }
  }

  async _onTypeChange(d, select) {
    if (select.value === NEW_TYPE) {
      select.value = d.type || NONE;
      this._openNewType(d);
      return;
    }
    const err = await this._run({ type: "battery_log/set_type", device_id: d.device_id, battery_type: select.value || null });
    if (err) this._alert(err);
  }

  // ---------------------------------------------------------------- dialogs

  _alert(text) {
    this._openDialog({ title: this._t("dlg_error"), hint: text, closeOnly: true });
  }

  /** Generic dialog. `fields` are DOM nodes, `save` returns an error string or null. */
  _openDialog({ title, hint, fields = [], save, saveLabel, extra = [], closeOnly = false }) {
    const err = h("div", { class: "err" });
    const cancel = h("button", { class: "btn", type: "button", onclick: () => this._dialog.close() }, closeOnly ? this._t("dlg_close") : this._t("dlg_cancel"));
    const saveBtn = save
      ? h("button", { class: "btn primary", type: "button", onclick: async () => {
          saveBtn.disabled = true;
          const msg = await save();
          if (msg) {
            err.textContent = msg;
            saveBtn.disabled = false;
          } else this._dialog.close();
        } }, saveLabel || this._t("dlg_save"))
      : null;
    // replaceChildren() turns null into the text "null", so only real nodes go in
    this._dialog.replaceChildren(
      ...[h("h2", {}, title), hint ? h("div", { class: "hint" }, hint) : null, ...fields, err, h("div", { class: "btns" }, ...extra, cancel, saveBtn)].filter(Boolean)
    );
    if (!this._dialog.open) this._dialog.showModal();
  }

  _fields(initial) {
    const when = h("input", { type: "datetime-local", value: toLocalInput(initial.at), max: toLocalInput(new Date(Date.now() + 86400000)) });
    const note = h("textarea", { maxlength: 500, placeholder: this._t("note_ph") });
    note.value = initial.note || "";
    const type = h("select", {}, h("option", { value: NONE, selected: !initial.type }, this._t("none_opt")), this._data.types.map((t) => h("option", { value: t, selected: t === initial.type }, t)));
    return {
      when, note, type,
      nodes: [h("label", { class: "field" }, this._t("f_when"), when), h("label", { class: "field" }, this._t("f_type"), type), h("label", { class: "field" }, this._t("f_note"), note)],
    };
  }

  _openChange(d) {
    const s = d.suspected;
    const f = this._fields({ at: s ? new Date(s.detected_at) : new Date(), type: d.type });
    const hint = s
      ? s.from !== null && s.to !== null
        ? this._t("dlg_rose", { a: Math.round(s.from), b: Math.round(s.to), when: this._fmtDate(s.detected_at, true) })
        : this._t("dlg_rose_plain", { when: this._fmtDate(s.detected_at, true) })
      : null;
    this._openDialog({
      title: this._t("dlg_change_title", { name: d.name }),
      hint,
      fields: f.nodes,
      saveLabel: this._t("save_change"),
      extra: s
        ? [h("button", { class: "btn", type: "button", onclick: async () => {
            const e = await this._run({ type: "battery_log/dismiss_suspected", device_id: d.device_id });
            e ? this._alert(e) : this._dialog.close();
          } }, this._t("not_replaced"))]
        : [],
      save: () => this._saveChange({ type: "battery_log/change", device_id: d.device_id }, f),
    });
  }

  _openEdit(d, entry) {
    const f = this._fields({ at: new Date(entry.at), type: entry.type, note: entry.note });
    this._openDialog({
      title: this._t("dlg_edit_title", { name: d.name }),
      fields: f.nodes,
      save: () => this._saveChange({ type: "battery_log/update_change", device_id: d.device_id, change_id: entry.id }, f),
    });
  }

  async _saveChange(base, f) {
    const date = new Date(f.when.value);
    if (!f.when.value || Number.isNaN(date.getTime())) return this._t("bad_date");
    return this._run({ ...base, at: date.toISOString(), note: f.note.value.trim(), battery_type: f.type.value || null });
  }

  _confirmDelete(d, entry) {
    this._openDialog({
      title: this._t("dlg_del_title"),
      hint: this._t("dlg_del_hint", { name: d.name, when: this._fmtDate(entry.at, true), note: entry.note ? ` — ${entry.note}` : "" }),
      saveLabel: this._t("btn_delete"),
      save: () => this._run({ type: "battery_log/delete_change", device_id: d.device_id, change_id: entry.id }),
    });
  }

  _openNewType(d) {
    const input = h("input", { type: "text", maxlength: 40, placeholder: this._t("type_name_ph") });
    this._openDialog({
      title: this._t("dlg_newtype_title"),
      hint: this._t("dlg_newtype_hint", { name: d.name }),
      fields: [h("label", { class: "field" }, this._t("type_name"), input)],
      save: async () => {
        const name = input.value.trim();
        if (!name) return this._t("enter_name");
        const e1 = await this._run({ type: "battery_log/add_type", battery_type: name });
        if (e1) return e1;
        return this._run({ type: "battery_log/set_type", device_id: d.device_id, battery_type: name });
      },
    });
  }
}

if (!customElements.get("battery-log-panel")) customElements.define("battery-log-panel", BatteryLogPanel);
