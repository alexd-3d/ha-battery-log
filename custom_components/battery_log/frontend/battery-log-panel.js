/* Battery Log panel. Plain web component, no dependencies and no HA-internal
 * elements except <ha-icon> (optional, with a text fallback). All data coming
 * from Home Assistant (device names, notes, ...) is inserted with textContent. */

const NEW_TYPE = "__new__";
const NONE = "";
const COMPACT_BELOW = 720; // px: card list below, table above

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
.ibtn.primary { background:var(--primary-color); border-color:var(--primary-color); color:var(--text-primary-color, #fff); }
.ibtn:hover { filter:brightness(1.15); }
.btn { font:inherit; font-size:14px; cursor:pointer; border-radius:10px; padding:0 14px; height:38px; border:1px solid var(--divider-color); background:transparent; color:var(--primary-text-color); display:inline-flex; align-items:center; gap:6px; --mdc-icon-size:20px; }
.btn.primary { background:var(--primary-color); color:var(--text-primary-color, #fff); border-color:var(--primary-color); }
.warnbtn { font:inherit; font-size:13px; cursor:pointer; border:0; border-radius:10px; padding:8px 12px; background:var(--warning-color, #ffa600); color:#000; text-align:left; }
.warnbtn.small { padding:2px 10px; margin-left:8px; border-radius:12px; }
.actions { display:flex; gap:8px; align-items:center; }
.hist { margin:0; padding:0; list-style:none; display:grid; gap:10px; max-width:640px; }
.hist li { display:grid; grid-template-columns:auto 1fr auto; gap:2px 12px; align-items:center; font-size:13px; }
.hist .when { font-weight:500; font-variant-numeric:tabular-nums; }
.hist .meta { grid-column:1 / 3; color:var(--secondary-text-color); overflow-wrap:anywhere; }
.hist .ibtn { width:34px; height:34px; --mdc-icon-size:18px; }
tr.histrow td { background:var(--secondary-background-color, rgba(127,127,127,.08)); }
.dev { padding:14px; display:grid; gap:12px; border-bottom:1px solid var(--divider-color); }
.dev:last-child { border-bottom:0; }
.dev-top { display:flex; gap:10px; align-items:flex-start; justify-content:space-between; }
.dev-top > :first-child { min-width:0; }
.dev-mid { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:12px; align-items:center; font-size:13px; }
.dev-foot { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.dev .histbox { padding-top:4px; border-top:1px dashed var(--divider-color); }
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
  { key: "name", label: "Device" },
  { key: "type", label: "Type" },
  { key: "level", label: "Level" },
  { key: "last_changed", label: "Last changed" },
  { key: "changes", label: "Changes" },
  { key: "avg_lifetime_days", label: "Avg life" },
  { key: null, label: "" },
];

const SORTS = [
  ["name", "Name"],
  ["level", "Level"],
  ["last_changed", "Last changed"],
  ["type", "Type"],
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
    this._tableHost.replaceChildren(h("div", { class: "empty" }, `Battery Log is unavailable: ${err?.message || err}`));
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

    this._search = h("input", { type: "search", placeholder: "Search…", oninput: (e) => this._setFilter("q", e.target.value) });
    this._sortSel = h("select", { title: "Sort by", onchange: (e) => this._setSort(e.target.value) }, SORTS.map(([k, l]) => h("option", { value: k }, l)));
    this._sortDir = this._ibtn("mdi:arrow-up", "↑", "Sort direction", () => this._setSort(this._sort.key, true));
    this._typeSel = h("select", { onchange: (e) => this._setFilter("type", e.target.value) });
    this._areaSel = h("select", { onchange: (e) => this._setFilter("area", e.target.value) });
    this._statusSel = h(
      "select",
      { onchange: (e) => this._setFilter("status", e.target.value) },
      h("option", { value: "" }, "Any status"),
      h("option", { value: "low" }, "Low battery"),
      h("option", { value: "suspected" }, "Replaced?"),
      h("option", { value: "unavailable" }, "Offline"),
      h("option", { value: "never" }, "No change logged")
    );
    this._stats = h("div", { class: "stats" });
    this._buy = h("div", { class: "buy" });
    this._tableHost = h("div", { class: "card" }, h("div", { class: "empty" }, "Loading…"));
    this._tableView = h(
      "div",
      { class: "wrap" },
      this._stats,
      this._buy,
      h("div", { class: "filters" }, h("div", { class: "row1" }, this._search, h("div", { class: "sortctl" }, this._sortSel, this._sortDir)), h("div", { class: "row3" }, this._typeSel, this._areaSel, this._statusSel)),
      this._tableHost
    );

    this._manageSearch = h("input", { type: "search", placeholder: "Search devices…", oninput: (e) => { this._manageQ = e.target.value; this._renderManage(); } });
    this._manageList = h("div", { class: "card" });
    this._manageView = h(
      "div",
      { class: "wrap", hidden: true },
      h("div", { class: "hint" }, "Every device with a battery sensor is found automatically. Switch a device off to stop tracking it: it loses its Battery Log entities and disappears from the table. History is kept."),
      this._manageSearch,
      this._manageList
    );

    this._dialog = h("dialog");
    this._dialog.addEventListener("click", (e) => {
      if (e.target === this._dialog) this._dialog.close();
    });

    root.append(h("style", {}, STYLE), this._bar, this._tableView, this._manageView, this._dialog);
    this._renderBar();
  }

  _renderBar() {
    const manage = this._view === "manage";
    this._title.textContent = manage ? "Tracked devices" : "Battery Log";
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
    this._fillSelect(this._typeSel, "All types", [...this._data.types, "(not set)"], this._filter.type);
    const areas = [...new Set(this._data.devices.filter((d) => !d.ignored).map((d) => d.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    this._fillSelect(this._areaSel, "All areas", areas, this._filter.area);
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
    const suspected = all.filter((d) => d.suspected).length;
    const buy = {};
    low.forEach((d) => {
      const k = d.type || "type not set";
      buy[k] = (buy[k] || 0) + 1;
    });
    this._stats.replaceChildren(
      ...[
        h("span", {}, h("b", {}, all.length), " devices"),
        h("span", {}, h("b", {}, low.length), ` low (≤ ${this._data.low_threshold}%)`),
        suspected ? h("span", {}, h("b", {}, suspected), " to confirm") : null,
      ].filter(Boolean)
    );
    this._buy.hidden = !low.length;
    this._buy.replaceChildren(
      ...(low.length ? ["To buy: ", h("b", {}, Object.entries(buy).sort().map(([t, n]) => `${t} ×${n}`).join(", "))] : [])
    );
    this._sortSel.value = this._sort.key;
    this._sortDir.replaceChildren(this._icon(this._sort.dir > 0 ? "mdi:arrow-up" : "mdi:arrow-down", this._sort.dir > 0 ? "↑" : "↓"));

    const rows = this._sorted(this._visible());
    if (!rows.length) {
      this._tableHost.replaceChildren(h("div", { class: "empty" }, all.length ? "No devices match the filters." : "No tracked battery devices."));
      return;
    }
    this._tableHost.replaceChildren(this._compact ? h("div", {}, rows.map((d) => this._card(d))) : this._table(rows));
  }

  // ---------------------------------------------------------------- formats

  _fmtDate(iso, withTime = false) {
    const opts = withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
    return new Date(iso).toLocaleString(this._hass?.locale?.language, opts);
  }

  _daysAgo(iso) {
    const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
    return days <= 0 ? "today" : `${days} d ago`;
  }

  _avg(d) {
    return d.avg_lifetime_days ? `≈ ${(d.avg_lifetime_days / 30.44).toFixed(1)} mo` : null;
  }

  _levelPill(d) {
    if (d.level !== null) {
      // red: low, yellow: up to the warning level, green: fine (levels come from the integration options)
      const tone = d.low ? "low" : d.level <= (this._data?.warn_threshold ?? 50) ? "mid" : "ok";
      return h("span", { class: `pill ${tone}` }, `${Math.round(d.level)} %`);
    }
    if (d.low) return h("span", { class: "pill low" }, "Low");
    return h("span", { class: "pill off" }, d.unavailable ? "offline" : "—");
  }

  _typeSelect(d) {
    return h(
      "select",
      { onchange: (e) => this._onTypeChange(d, e.target) },
      h("option", { value: NONE, selected: !d.type }, "— type —"),
      this._data.types.map((t) => h("option", { value: t, selected: t === d.type }, t)),
      h("option", { value: NEW_TYPE }, "＋ Add new type…")
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
          c.label,
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
      {},
      h("td", {}, h("div", { class: "name" }, d.name, d.suspected ? h("button", { class: "warnbtn small", title: "Confirm date and note", onclick: () => this._openChange(d) }, "Replaced?") : null), h("div", { class: "sub" }, this._subline(d))),
      h("td", {}, this._typeSelect(d)),
      h("td", {}, this._levelPill(d)),
      h("td", {}, d.last_changed ? [this._fmtDate(d.last_changed), h("div", { class: "sub" }, this._daysAgo(d.last_changed))] : h("span", { class: "muted" }, "never")),
      h("td", {}, d.changes ? h("button", { class: "btn", onclick: () => this._toggleHistory(d.device_id) }, `${d.changes}`, this._icon(open ? "mdi:chevron-up" : "mdi:chevron-down", open ? "▴" : "▾")) : h("span", { class: "muted" }, "0")),
      h("td", {}, this._avg(d) || h("span", { class: "muted" }, "—")),
      h("td", {}, h("button", { class: "btn primary", onclick: () => this._openChange(d) }, this._icon("mdi:battery-sync", "⟳"), "Change battery"))
    );
    const out = [tr];
    if (open && d.history.length) out.push(h("tr", { class: "histrow" }, h("td", { colspan: COLUMNS.length }, this._historyList(d))));
    return out;
  }

  // ------------------------------------------------------ compact: card list

  _card(d) {
    const open = this._expanded.has(d.device_id);
    const stats = [d.changes ? `${d.changes} change${d.changes > 1 ? "s" : ""}` : "no changes logged", this._avg(d) ? `avg ${this._avg(d)}` : null].filter(Boolean).join(" · ");
    return h(
      "div",
      { class: "dev" },
      h("div", { class: "dev-top" }, h("div", {}, h("div", { class: "name" }, d.name), h("div", { class: "sub" }, this._subline(d))), this._levelPill(d)),
      d.suspected ? h("button", { class: "warnbtn", onclick: () => this._openChange(d) }, "Replaced? Tap to confirm date and note") : null,
      h("div", { class: "dev-mid" }, this._typeSelect(d), d.last_changed ? h("div", {}, h("div", {}, this._fmtDate(d.last_changed)), h("div", { class: "sub" }, this._daysAgo(d.last_changed))) : h("div", { class: "muted" }, "never changed")),
      h(
        "div",
        { class: "dev-foot" },
        h("div", { class: "sub" }, stats),
        h("div", { class: "actions" }, d.changes ? this._ibtn(open ? "mdi:chevron-up" : "mdi:history", open ? "▴" : "⏱", "History", () => this._toggleHistory(d.device_id)) : null, this._ibtn("mdi:battery-sync", "⟳", "Change battery", () => this._openChange(d), "primary"))
      ),
      open && d.history.length ? h("div", { class: "histbox" }, this._historyList(d)) : null
    );
  }

  // ------------------------------------------------------------- history

  _historyList(d) {
    return h(
      "ul",
      { class: "hist" },
      d.history.map((e) =>
        h(
          "li",
          {},
          h("span", { class: "when" }, this._fmtDate(e.at, true)),
          h("span", {}),
          h("span", { class: "actions" }, this._ibtn("mdi:pencil", "✎", "Edit", () => this._openEdit(d, e)), this._ibtn("mdi:delete", "🗑", "Delete", () => this._confirmDelete(d, e))),
          [e.type, e.note].filter(Boolean).length ? h("span", { class: "meta" }, [e.type, e.note].filter(Boolean).join(" · ")) : null
        )
      )
    );
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
    this._manageList.replaceChildren(
      list.length
        ? h(
            "div",
            {},
            list.map((d) =>
              h(
                "label",
                { class: `mrow${d.ignored ? " off" : ""}` },
                h("div", { class: "grow" }, h("div", { class: "name" }, d.name), h("div", { class: "sub" }, this._subline(d))),
                this._levelPill(d),
                h("input", { class: "switch", type: "checkbox", title: "Track this device", checked: !d.ignored, onchange: (e) => this._toggleTrack(d, e.target) })
              )
            )
          )
        : h("div", { class: "empty" }, "No devices.")
    );
  }

  async _toggleTrack(d, input) {
    const err = await this._run({ type: "battery_log/set_ignored", device_id: d.device_id, ignored: !input.checked });
    if (err) {
      input.checked = !input.checked;
      this._alert(err);
    }
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
    this._openDialog({ title: "Error", hint: text, closeOnly: true });
  }

  /** Generic dialog. `fields` are DOM nodes, `save` returns an error string or null. */
  _openDialog({ title, hint, fields = [], save, saveLabel = "Save", extra = [], closeOnly = false }) {
    const err = h("div", { class: "err" });
    const cancel = h("button", { class: "btn", type: "button", onclick: () => this._dialog.close() }, closeOnly ? "Close" : "Cancel");
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

  _fields(initial) {
    const when = h("input", { type: "datetime-local", value: toLocalInput(initial.at), max: toLocalInput(new Date(Date.now() + 86400000)) });
    const note = h("textarea", { maxlength: 500, placeholder: "e.g. Panasonic, bought at Rozetka" });
    note.value = initial.note || "";
    const type = h("select", {}, h("option", { value: NONE, selected: !initial.type }, "— not set —"), this._data.types.map((t) => h("option", { value: t, selected: t === initial.type }, t)));
    return {
      when, note, type,
      nodes: [h("label", { class: "field" }, "Date and time", when), h("label", { class: "field" }, "Battery type", type), h("label", { class: "field" }, "Notes", note)],
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
