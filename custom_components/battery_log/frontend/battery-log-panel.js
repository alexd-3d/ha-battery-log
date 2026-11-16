/* Battery Log panel. Plain web component, no dependencies and no HA-internal
 * elements, so it keeps working across frontend updates. All data coming from
 * Home Assistant (device names, notes, ...) is inserted with textContent only. */

const NEW_TYPE = "__new__";
const NONE = "";

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
:host { display:block; height:100%; background:var(--primary-background-color); color:var(--primary-text-color); font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
.bar { display:flex; align-items:center; gap:8px; height:56px; padding:0 16px; box-sizing:border-box; background:var(--app-header-background-color, var(--primary-color)); color:var(--app-header-text-color, #fff); position:sticky; top:0; z-index:2; }
.bar h1 { font-size:20px; font-weight:400; margin:0; flex:1; }
.menu { display:none; background:none; border:0; color:inherit; font-size:24px; cursor:pointer; padding:4px 8px; }
:host([narrow]) .menu { display:block; }
.wrap { padding:16px; max-width:1500px; margin:0 auto; box-sizing:border-box; }
.summary { display:flex; flex-wrap:wrap; gap:8px 24px; margin-bottom:12px; color:var(--secondary-text-color); font-size:14px; }
.summary b { color:var(--primary-text-color); }
.filters { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; align-items:center; }
input, select, textarea { font:inherit; color:var(--primary-text-color); background:var(--card-background-color, #fff); border:1px solid var(--divider-color); border-radius:6px; padding:6px 8px; box-sizing:border-box; }
input[type=search] { min-width:200px; flex:1; max-width:320px; }
label.chk { display:flex; align-items:center; gap:6px; font-size:14px; }
.card { background:var(--card-background-color, #fff); border-radius:var(--ha-card-border-radius, 12px); border:1px solid var(--divider-color); overflow-x:auto; }
table { border-collapse:collapse; width:100%; min-width:720px; }
th, td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--divider-color); vertical-align:middle; font-size:14px; }
th { font-weight:500; color:var(--secondary-text-color); cursor:pointer; user-select:none; white-space:nowrap; position:sticky; top:0; background:var(--card-background-color, #fff); }
th.nosort { cursor:default; }
tr:last-child td { border-bottom:0; }
.name { font-weight:500; }
.sub { color:var(--secondary-text-color); font-size:12px; }
.badge { display:inline-block; font-size:12px; padding:1px 8px; border-radius:10px; margin-left:6px; background:var(--divider-color); color:var(--primary-text-color); }
.badge.low { background:var(--error-color, #db4437); color:#fff; }
.badge.warn { background:var(--warning-color, #ffa600); color:#000; cursor:pointer; border:0; font:inherit; font-size:12px; }
.muted { color:var(--secondary-text-color); }
.lvl { font-variant-numeric:tabular-nums; }
.actions { display:flex; gap:6px; flex-wrap:wrap; }
button.btn { font:inherit; font-size:13px; cursor:pointer; border-radius:6px; padding:5px 10px; border:1px solid var(--divider-color); background:transparent; color:var(--primary-text-color); }
button.btn.primary { background:var(--primary-color); color:var(--text-primary-color, #fff); border-color:var(--primary-color); }
button.btn:hover { filter:brightness(1.1); }
.hist td { background:var(--secondary-background-color); font-size:13px; }
.hist ul { list-style:none; margin:0; padding:0; display:grid; gap:6px; }
.hist li { display:flex; gap:12px; align-items:baseline; flex-wrap:wrap; }
.hist .when { min-width:150px; font-variant-numeric:tabular-nums; }
.empty { padding:24px; text-align:center; color:var(--secondary-text-color); }
dialog { border:0; border-radius:12px; padding:20px; background:var(--card-background-color, #fff); color:var(--primary-text-color); width:min(440px, 92vw); box-shadow:0 8px 32px rgba(0,0,0,.4); }
dialog::backdrop { background:rgba(0,0,0,.5); }
dialog h2 { margin:0 0 12px; font-size:18px; font-weight:500; }
dialog .field { display:grid; gap:4px; margin-bottom:12px; font-size:14px; }
dialog .field input, dialog .field select, dialog .field textarea { width:100%; }
dialog textarea { min-height:80px; resize:vertical; }
dialog .hint { font-size:13px; color:var(--secondary-text-color); margin-bottom:12px; }
dialog .err { color:var(--error-color, #db4437); font-size:13px; min-height:1em; margin-bottom:8px; }
dialog .btns { display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
@media (max-width: 700px) { .hide-narrow { display:none; } }
`;

const COLUMNS = [
  { key: "name", label: "Device" },
  { key: "type", label: "Type" },
  { key: "level", label: "Level" },
  { key: "last_changed", label: "Last changed" },
  { key: "changes", label: "Changes", cls: "hide-narrow" },
  { key: "avg_lifetime_days", label: "Avg life", cls: "hide-narrow" },
  { key: null, label: "" },
];

class BatteryLogPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._data = null;
    this._sort = { key: "name", dir: 1 };
    this._filter = { q: "", type: "", status: "", area: "", ignored: false };
    this._expanded = new Set();
    this._unsub = null;
    this._built = false;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first && this.isConnected) this._subscribe();
  }
  set narrow(value) {
    this.toggleAttribute("narrow", !!value);
  }
  set panel(_) {}
  set route(_) {}

  connectedCallback() {
    this._build();
    if (this._hass && !this._unsub) this._subscribe();
  }

  disconnectedCallback() {
    const unsub = this._unsub;
    this._unsub = null;
    if (unsub) unsub.then((fn) => fn()).catch(() => {});
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
    this._tableHost.replaceChildren(h("div", { class: "empty" }, `Battery Log is unavailable: ${err?.message || err}`));
  }

  _ws(msg) {
    return this._hass.callWS(msg);
  }

  // ---------------------------------------------------------------- build

  _build() {
    if (this._built) return;
    this._built = true;
    const root = this.shadowRoot;
    this._search = h("input", { type: "search", placeholder: "Search device, area, type…", oninput: (e) => this._setFilter("q", e.target.value) });
    this._typeSel = h("select", { onchange: (e) => this._setFilter("type", e.target.value) });
    this._areaSel = h("select", { onchange: (e) => this._setFilter("area", e.target.value) });
    this._statusSel = h(
      "select",
      { onchange: (e) => this._setFilter("status", e.target.value) },
      h("option", { value: "" }, "All statuses"),
      h("option", { value: "low" }, "Low battery"),
      h("option", { value: "suspected" }, "Possible replacement"),
      h("option", { value: "unavailable" }, "Unavailable"),
      h("option", { value: "never" }, "No change recorded")
    );
    this._ignoredChk = h("input", { type: "checkbox", onchange: (e) => this._setFilter("ignored", e.target.checked) });
    this._summary = h("div", { class: "summary" });
    this._tableHost = h("div", { class: "card" }, h("div", { class: "empty" }, "Loading…"));
    this._dialog = h("dialog");
    this._dialog.addEventListener("click", (e) => {
      if (e.target === this._dialog) this._dialog.close();
    });

    root.append(
      h("style", {}, STYLE),
      h(
        "div",
        { class: "bar" },
        h("button", { class: "menu", title: "Menu", onclick: () => this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true })) }, "☰"),
        h("h1", {}, "Battery Log")
      ),
      h(
        "div",
        { class: "wrap" },
        this._summary,
        h("div", { class: "filters" }, this._search, this._typeSel, this._areaSel, this._statusSel, h("label", { class: "chk" }, this._ignoredChk, "Show ignored")),
        this._tableHost
      ),
      this._dialog
    );
  }

  _setFilter(key, value) {
    this._filter[key] = value;
    this._renderTable();
  }

  // --------------------------------------------------------------- render

  _renderAll() {
    if (!this._data) return;
    this._fillSelect(this._typeSel, "All types", [...this._data.types, "(not set)"], this._filter.type);
    const areas = [...new Set(this._data.devices.map((d) => d.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    this._fillSelect(this._areaSel, "All areas", areas, this._filter.area);
    this._renderTable();
  }

  _fillSelect(sel, allLabel, values, current) {
    sel.replaceChildren(h("option", { value: "" }, allLabel), ...values.map((v) => h("option", { value: v, selected: v === current }, v)));
    sel.value = current;
  }

  _visible() {
    const f = this._filter;
    const q = f.q.trim().toLowerCase();
    return this._data.devices.filter((d) => {
      if (d.ignored && !f.ignored) return false;
      if (f.type === "(not set)" ? d.type : f.type && d.type !== f.type) return false;
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
    const buy = {};
    low.forEach((d) => {
      const k = d.type || "type not set";
      buy[k] = (buy[k] || 0) + 1;
    });
    const suspected = all.filter((d) => d.suspected).length;
    this._summary.replaceChildren(
      h("span", {}, h("b", {}, all.length), " devices"),
      h("span", {}, h("b", {}, low.length), ` low (≤ ${this._data.low_threshold}%)`),
      suspected ? h("span", {}, h("b", {}, suspected), " possible replacement(s) to confirm") : null,
      low.length
        ? h("span", {}, "To buy: ", h("b", {}, Object.entries(buy).sort().map(([t, n]) => `${t} ×${n}`).join(", ")))
        : null
    );

    const rows = this._sorted(this._visible());
    const head = h(
      "tr",
      {},
      COLUMNS.map((c) =>
        h(
          "th",
          {
            class: [c.cls, c.key ? "" : "nosort"].join(" ").trim(),
            onclick: c.key ? () => this._toggleSort(c.key) : null,
          },
          c.label,
          this._sort.key === c.key ? (this._sort.dir > 0 ? " ▲" : " ▼") : ""
        )
      )
    );
    const body = rows.flatMap((d) => this._rows(d));
    this._tableHost.replaceChildren(
      rows.length
        ? h("table", {}, h("thead", {}, head), h("tbody", {}, body))
        : h("div", { class: "empty" }, this._data.devices.length ? "No devices match the filters." : "No battery devices found yet.")
    );
  }

  _toggleSort(key) {
    this._sort = this._sort.key === key ? { key, dir: -this._sort.dir } : { key, dir: 1 };
    this._renderTable();
  }

  _fmtDate(iso, withTime = false) {
    const opts = withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
    return new Date(iso).toLocaleString(this._hass?.locale?.language, opts);
  }

  _daysAgo(iso) {
    const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
    return days <= 0 ? "today" : `${days} d ago`;
  }

  _rows(d) {
    const typeSel = h(
      "select",
      { onchange: (e) => this._onTypeChange(d, e.target) },
      h("option", { value: NONE, selected: !d.type }, "— not set —"),
      this._data.types.map((t) => h("option", { value: t, selected: t === d.type }, t)),
      h("option", { value: NEW_TYPE }, "＋ Add new type…")
    );
    const level = d.level !== null
      ? h("span", { class: "lvl" }, `${Math.round(d.level)} %`, d.low ? h("span", { class: "badge low" }, "Low") : null)
      : d.low
        ? h("span", { class: "badge low" }, "Low")
        : h("span", { class: "muted" }, d.unavailable ? "unavailable" : "—");
    const open = this._expanded.has(d.device_id);
    const tr = h(
      "tr",
      {},
      h(
        "td",
        {},
        h("div", { class: "name" }, d.name, d.ignored ? h("span", { class: "badge" }, "ignored") : null, d.suspected ? h("button", { class: "badge warn", title: "Confirm date and note", onclick: () => this._openChange(d) }, "Replaced? Confirm") : null),
        h("div", { class: "sub" }, [d.area, d.model].filter(Boolean).join(" · "))
      ),
      h("td", {}, typeSel),
      h("td", {}, level),
      h("td", {}, d.last_changed ? [this._fmtDate(d.last_changed), h("div", { class: "sub" }, this._daysAgo(d.last_changed))] : h("span", { class: "muted" }, "never")),
      h("td", { class: "hide-narrow" }, d.changes ? h("button", { class: "btn", onclick: () => this._toggleHistory(d.device_id) }, `${d.changes} ${open ? "▴" : "▾"}`) : "0"),
      h("td", { class: "hide-narrow" }, d.avg_lifetime_days ? `≈ ${(d.avg_lifetime_days / 30.44).toFixed(1)} mo` : h("span", { class: "muted" }, "—")),
      h(
        "td",
        {},
        h(
          "div",
          { class: "actions" },
          h("button", { class: "btn primary", onclick: () => this._openChange(d) }, "Change battery"),
          h("button", { class: "btn", onclick: () => this._run({ type: "battery_log/set_ignored", device_id: d.device_id, ignored: !d.ignored }) }, d.ignored ? "Unignore" : "Ignore")
        )
      )
    );
    const out = [tr];
    if (open && d.history.length) out.push(this._historyRow(d));
    return out;
  }

  _historyRow(d) {
    return h(
      "tr",
      { class: "hist" },
      h(
        "td",
        { colspan: COLUMNS.length },
        h(
          "ul",
          {},
          d.history.map((e) =>
            h(
              "li",
              {},
              h("span", { class: "when" }, this._fmtDate(e.at, true)),
              h("span", { class: "muted" }, e.type || ""),
              h("span", {}, e.note || ""),
              h("span", { class: "actions" }, h("button", { class: "btn", onclick: () => this._openEdit(d, e) }, "Edit"), h("button", { class: "btn", onclick: () => this._confirmDelete(d, e) }, "Delete"))
            )
          )
        )
      )
    );
  }

  _toggleHistory(id) {
    this._expanded.has(id) ? this._expanded.delete(id) : this._expanded.add(id);
    this._renderTable();
  }

  // -------------------------------------------------------------- actions

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

  // --------------------------------------------------------------- dialogs

  _alert(text) {
    this._openDialog({ title: "Error", hint: text, buttons: [] });
  }

  /** Generic dialog. `fields` are DOM nodes, `save` returns an error string or null. */
  _openDialog({ title, hint, fields = [], save, saveLabel = "Save", extra = [], buttons }) {
    const err = h("div", { class: "err" });
    const cancel = h("button", { class: "btn", type: "button", onclick: () => this._dialog.close() }, buttons ? "Close" : "Cancel");
    const saveBtn = save
      ? h("button", { class: "btn primary", type: "button", onclick: async () => {
          saveBtn.disabled = true;
          const msg = await save();
          if (msg) {
            err.textContent = msg;
            saveBtn.disabled = false;
          } else this._dialog.close();
        } }, saveLabel)
      : null;
    this._dialog.replaceChildren(h("h2", {}, title), hint ? h("div", { class: "hint" }, hint) : null, ...fields, err, h("div", { class: "btns" }, ...extra, cancel, saveBtn));
    if (!this._dialog.open) this._dialog.showModal();
  }

  _typeField(current) {
    const sel = h("select", {}, h("option", { value: NONE, selected: !current }, "— not set —"), this._data.types.map((t) => h("option", { value: t, selected: t === current }, t)));
    return { sel, node: h("label", { class: "field" }, "Battery type", sel) };
  }

  _fields(initial) {
    const when = h("input", { type: "datetime-local", value: toLocalInput(initial.at), max: toLocalInput(new Date(Date.now() + 86400000)) });
    const note = h("textarea", { maxlength: 500, placeholder: "e.g. Panasonic, bought at Rozetka" });
    note.value = initial.note || "";
    const type = this._typeField(initial.type);
    return {
      when, note, type: type.sel,
      nodes: [h("label", { class: "field" }, "Date and time", when), type.node, h("label", { class: "field" }, "Notes", note)],
    };
  }

  _openChange(d) {
    const s = d.suspected;
    const f = this._fields({ at: s ? new Date(s.detected_at) : new Date(), type: d.type });
    const hint = s
      ? `Level rose${s.from !== null && s.to !== null ? ` from ${Math.round(s.from)}% to ${Math.round(s.to)}%` : ""} on ${this._fmtDate(s.detected_at, true)}. Confirm the real date and add a note.`
      : null;
    this._openDialog({
      title: `Change battery: ${d.name}`,
      hint,
      fields: f.nodes,
      saveLabel: "Save change",
      extra: s
        ? [h("button", { class: "btn", type: "button", onclick: async () => {
            const e = await this._run({ type: "battery_log/dismiss_suspected", device_id: d.device_id });
            e ? this._alert(e) : this._dialog.close();
          } }, "Not replaced")]
        : [],
      save: () => this._saveChange({ type: "battery_log/change", device_id: d.device_id }, f),
    });
  }

  _openEdit(d, entry) {
    const f = this._fields({ at: new Date(entry.at), type: entry.type, note: entry.note });
    this._openDialog({
      title: `Edit change: ${d.name}`,
      fields: f.nodes,
      save: () => this._saveChange({ type: "battery_log/update_change", device_id: d.device_id, change_id: entry.id }, f),
    });
  }

  async _saveChange(base, f) {
    const date = new Date(f.when.value);
    if (!f.when.value || Number.isNaN(date.getTime())) return "Enter a valid date.";
    return this._run({ ...base, at: date.toISOString(), note: f.note.value.trim(), battery_type: f.type.value || null });
  }

  _confirmDelete(d, entry) {
    this._openDialog({
      title: "Delete this change?",
      hint: `${d.name}: ${this._fmtDate(entry.at, true)}${entry.note ? ` — ${entry.note}` : ""}. This cannot be undone.`,
      saveLabel: "Delete",
      save: () => this._run({ type: "battery_log/delete_change", device_id: d.device_id, change_id: entry.id }),
    });
  }

  _openNewType(d) {
    const input = h("input", { type: "text", maxlength: 40, placeholder: "e.g. LR44" });
    this._openDialog({
      title: "Add battery type",
      hint: `It will be added to the shared list and set for ${d.name}.`,
      fields: [h("label", { class: "field" }, "Type name", input)],
      save: async () => {
        const name = input.value.trim();
        if (!name) return "Enter a name.";
        const e1 = await this._run({ type: "battery_log/add_type", battery_type: name });
        if (e1) return e1;
        return this._run({ type: "battery_log/set_type", device_id: d.device_id, battery_type: name });
      },
    });
  }
}

if (!customElements.get("battery-log-panel")) customElements.define("battery-log-panel", BatteryLogPanel);
