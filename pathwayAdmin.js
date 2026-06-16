// ═══════════════════════════════════════════════════════════════════════
//  pathwayAdmin.js  —  ResultDoctor MASTER ADMIN ENGINE
// ───────────────────────────────────────────────────────────────────────
//  The shared, reusable admin-editing engine for EVERY pathway. A pathway's
//  admin page supplies its variable definitions; this engine provides the
//  passcode-gated editing of normal ranges and threshold bands, the working
//  copy (master is never mutated), the Change Log, and reset-to-master.
//
//  Adding the engine to a pathway admin page is one step:
//    1. <script src="pathwayAdmin.js"></script>
//    2. PathwayAdmin.config({ pin, pages:[{prefix,vars}], dom:{...}, onModeChange })
//    3. PathwayAdmin.renderVars()  (and call PathwayAdmin.logChange / .setMode
//       from the page's own Master/Working buttons, rules and gaps editors)
//
//  A "variable" is { code, full, also?, type, unit, normalHigh, low, thresholds,
//  note?, ctx? } where thresholds = [{ l:label, c:colourClass }]. The engine
//  edits normalHigh / low and the thresholds; everything else is display data
//  owned by the pathway.
//
//  Pure state logic (working copy, change log, master preservation) runs with
//  or without a DOM, so it is unit tested directly in Node.
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PathwayAdmin = api;
}(typeof self !== 'undefined' ? self : this, function () {

  const DEFAULT_BAND_COLOURS = [
    { c: 'p-n',   label: 'Normal (green)' },
    { c: 'p-hi',  label: 'Abnormal (red)' },
    { c: 'p-th',  label: 'Caution (amber)' },
    { c: 'p-ctx', label: 'Context (purple)' }
  ];

  const state = {
    pin: '2468',
    adminUnlocked: false,
    mode: 'master',
    pages: [],            // [{ prefix, vars:[...] }]
    varPage: 0,           // index into pages
    varIndex: {},         // key -> master variable
    wv: {},               // working copy: key -> { normalHigh?, low?, thresholds? }
    changes: [],          // [{ time, description }]
    bandColours: DEFAULT_BAND_COLOURS,
    onModeChange: null,
    dom: {}               // { grid, changes, btnMaster, btnWorking, notice }
  };

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function config(opts) {
    opts = opts || {};
    if (opts.pin != null) state.pin = String(opts.pin);
    if (opts.pages) state.pages = opts.pages;
    if (opts.bandColours) state.bandColours = opts.bandColours;
    if (opts.onModeChange) state.onModeChange = opts.onModeChange;
    if (opts.dom) state.dom = opts.dom;
    state.varPage = 0;
    rebuildIndex();
    return api;
  }

  function rebuildIndex() {
    state.varIndex = {};
    state.pages.forEach(function (pg) {
      (pg.vars || []).forEach(function (v) { state.varIndex[(pg.prefix || '') + v.code] = v; });
    });
  }

  function masterVar(key) { return state.varIndex[key]; }

  // ── DOM helpers (all no-op when there is no document) ──────────────────
  function el(id) { return (typeof document !== 'undefined' && id) ? document.getElementById(id) : null; }

  // ── Edit gate ──────────────────────────────────────────────────────────
  function tryUnlock(pin) {
    if (String(pin) === state.pin) { state.adminUnlocked = true; return true; }
    return false;
  }

  function setMode(m) {
    if (m === 'working' && !state.adminUnlocked) {
      if (typeof window === 'undefined' || !window.prompt) return;   // can't prompt; stay locked
      const entry = window.prompt('Enter admin passcode to edit thresholds, bands and local instructions:');
      if (entry === null) return;
      if (!tryUnlock(entry)) { if (window.alert) window.alert('Incorrect passcode. Edit mode stays locked.'); return; }
    }
    state.mode = m;
    const bm = el(state.dom.btnMaster), bw = el(state.dom.btnWorking), nt = el(state.dom.notice);
    if (bm) bm.classList.toggle('on', m === 'master');
    if (bw) bw.classList.toggle('on', m === 'working');
    if (nt) nt.classList.toggle('show', m === 'working');
    renderVars();
    if (typeof state.onModeChange === 'function') state.onModeChange(m);
  }

  function setVarPage(i) { state.varPage = i; renderVars(); }

  // ── Working-copy mutations (master is never touched) ────────────────────
  function cleanupWV(key) { if (state.wv[key] && Object.keys(state.wv[key]).length === 0) delete state.wv[key]; }

  function ensureWorkingThresholds(key) {
    if (!state.wv[key]) state.wv[key] = {};
    if (!state.wv[key].thresholds) {
      const m = masterVar(key);
      state.wv[key].thresholds = JSON.parse(JSON.stringify((m && m.thresholds) || []));
    }
    return state.wv[key].thresholds;
  }

  function updateVar(key, field, value) {
    const master = masterVar(key); if (!master) return;
    if (!state.wv[key]) state.wv[key] = {};
    const label = field === 'normalHigh' ? 'normal high' : 'normal low';
    const mv = (master[field] === null || master[field] === undefined) ? '(not set)' : master[field];
    const trimmed = (value == null ? '' : String(value)).trim();
    if (trimmed === '') { delete state.wv[key][field]; logChange('Variable ' + master.code + ' — ' + label + ': ' + mv + ' → (cleared)'); }
    else { state.wv[key][field] = trimmed; logChange('Variable ' + master.code + ' — ' + label + ': ' + mv + ' → ' + trimmed); }
    cleanupWV(key); renderVars();
  }

  function updateBand(key, i, field, value) {
    const master = masterVar(key); if (!master) return;
    const thr = ensureWorkingThresholds(key);
    if (!thr[i]) return;
    const old = thr[i][field];
    thr[i][field] = value;
    logChange('Variable ' + master.code + ' — band ' + (i + 1) + ' ' + (field === 'l' ? 'label' : 'colour') + ': "' + old + '" → "' + value + '"');
    renderVars();
  }

  function addBand(key) {
    const master = masterVar(key); if (!master) return;
    ensureWorkingThresholds(key).push({ l: 'New band', c: 'p-th' });
    logChange('Variable ' + master.code + ' — added a threshold band');
    renderVars();
  }

  function removeBand(key, i) {
    const master = masterVar(key); if (!master) return;
    const thr = ensureWorkingThresholds(key);
    const removed = thr[i] ? thr[i].l : '';
    thr.splice(i, 1);
    logChange('Variable ' + master.code + ' — removed band "' + removed + '"');
    renderVars();
  }

  function resetVar(key) {
    const master = masterVar(key); if (!master) return;
    delete state.wv[key];
    logChange('Variable ' + master.code + ': reset to master values');
    renderVars();
  }

  // The current effective value of a variable field (working copy over master).
  function effective(key) {
    const m = masterVar(key) || {}, w = state.wv[key] || {};
    return {
      normalHigh: w.normalHigh !== undefined ? w.normalHigh : m.normalHigh,
      low: w.low !== undefined ? w.low : m.low,
      thresholds: w.thresholds || m.thresholds || [],
      changed: w.normalHigh !== undefined || w.low !== undefined || w.thresholds !== undefined
    };
  }

  // ── Change log ──────────────────────────────────────────────────────────
  function logChange(description) { state.changes.push({ time: new Date().toLocaleString(), description: description }); }

  function renderChanges() {
    const c = el(state.dom.changes); if (!c) return;
    if (!state.changes.length) {
      c.innerHTML = '<div class="empty">No changes yet. Switch to Working mode to edit variable ranges, bands, local instructions, or gaps.</div>';
      return;
    }
    c.innerHTML = state.changes.slice().reverse().map(function (ch) {
      return '<div class="ch-item"><div class="ch-meta"><span class="ch-time">' + escHtml(ch.time) +
        '</span><span class="ch-tag">modified</span></div><div class="ch-diff">' + escHtml(ch.description) + '</div></div>';
    }).join('');
  }

  // ── Variables grid (editable ranges + bands in Working mode) ────────────
  function renderVars() {
    const grid = el(state.dom.grid); if (!grid) return;
    const pg = state.pages[state.varPage]; if (!pg) return;
    const prefix = pg.prefix || '';
    grid.innerHTML = '';
    (pg.vars || []).forEach(function (v) {
      const key = prefix + v.code;
      const eff = effective(key);
      const ctxBadge = v.ctx ? '<div style="margin-top:5px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:var(--pu-bg);color:var(--pu);border:0.5px solid var(--pu-bd);display:inline-block">⚠ ' + escHtml(v.ctx) + '</div>' : '';

      let bandsHTML;
      if (state.mode === 'working') {
        const rows = eff.thresholds.map(function (t, i) {
          return '<div class="bandrow">' +
            '<span class="band-swatch ' + t.c + '"></span>' +
            '<input class="band-input" type="text" value="' + escHtml(t.l) + '" onchange="PathwayAdmin.updateBand(\'' + key + '\',' + i + ',\'l\',this.value)" aria-label="Band ' + (i + 1) + ' label" />' +
            '<select class="band-sel" onchange="PathwayAdmin.updateBand(\'' + key + '\',' + i + ',\'c\',this.value)" aria-label="Band ' + (i + 1) + ' colour">' +
              state.bandColours.map(function (bc) { return '<option value="' + bc.c + '" ' + (t.c === bc.c ? 'selected' : '') + '>' + escHtml(bc.label) + '</option>'; }).join('') +
            '</select>' +
            '<button class="band-del" title="Remove band" onclick="PathwayAdmin.removeBand(\'' + key + '\',' + i + ')">×</button>' +
          '</div>';
        }).join('');
        bandsHTML = '<div class="band-edit">' + rows + '<button class="band-add" onclick="PathwayAdmin.addBand(\'' + key + '\')">+ Add band</button></div>';
      } else {
        bandsHTML = '<div class="vc-pills">' + eff.thresholds.map(function (t) { return '<span class="pill ' + t.c + '">' + escHtml(t.l) + '</span>'; }).join('') + '</div>';
      }

      const editFields =
        '<div class="ef"><label>Normal high (' + escHtml(v.unit) + ')</label><input type="text" value="' + (eff.normalHigh == null ? '' : escHtml(eff.normalHigh)) + '" placeholder="not set" onchange="PathwayAdmin.updateVar(\'' + key + '\',\'normalHigh\',this.value)" /></div>' +
        '<div class="ef"><label>Normal low (' + escHtml(v.unit) + ')</label><input type="text" value="' + (eff.low == null ? '' : escHtml(eff.low)) + '" placeholder="not set" onchange="PathwayAdmin.updateVar(\'' + key + '\',\'low\',this.value)" /></div>' +
        (eff.changed ? '<span class="mod-badge">Modified</span>' : '') +
        (eff.changed ? '<button onclick="PathwayAdmin.resetVar(\'' + key + '\')" style="font-size:11px;padding:3px 8px;border:0.5px solid var(--border2);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text2);">Reset to master</button>' : '');

      const c = document.createElement('div');
      c.className = 'vc';
      c.innerHTML =
        '<div class="vc-head"><div><div class="vc-code">' + escHtml(v.code) + '</div><div class="vc-full">' + escHtml(v.full) + '</div>' +
          (v.also ? '<div class="vc-also">Also: ' + escHtml(v.also) + '</div>' : '') + '</div>' +
          '<div style="text-align:right;font-size:11px;color:var(--text3);">' + escHtml(v.unit) + '<br><span style="font-size:10px;">' + escHtml(v.type) + '</span></div></div>' +
        bandsHTML +
        (v.note ? '<div class="vc-note">' + v.note + '</div>' : '') +
        (ctxBadge ? '<div style="padding:6px 14px;">' + ctxBadge + '</div>' : '') +
        '<div class="vc-edit ' + (state.mode === 'working' ? 'show' : '') + '">' + editFields + '</div>';
      grid.appendChild(c);
    });
  }

  const api = {
    config, setMode, tryUnlock, setVarPage, renderVars, renderChanges, logChange,
    updateVar, updateBand, addBand, removeBand, resetVar, effective, escHtml,
    // accessors (read-only views of engine state, handy for tests / export)
    get mode() { return state.mode; },
    get workingCopy() { return state.wv; },
    get changes() { return state.changes; },
    get unlocked() { return state.adminUnlocked; },
    _state: state
  };
  return api;
}));
