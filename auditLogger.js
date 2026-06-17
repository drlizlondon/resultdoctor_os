// ═══════════════════════════════════════════════════════════════════════
//  auditLogger.js — central audit/data module for Result Doctor tester mode
// ───────────────────────────────────────────────────────────────────────
//  ONE place for all tester-mode persistence. Pathway code never talks to a
//  database directly — it calls this module. The module picks an adapter:
//
//    1. Supabase (cloud)  — used when window.RESULTDOCTOR_CONFIG provides
//       supabaseUrl + supabaseAnonKey. Works from a static site (no server).
//       This is the central store admins read from across all testers/devices.
//    2. Local (dev only)  — browser localStorage. CLEARLY development-only;
//       NOT a real multi-device audit store (each device is separate).
//    3. Memory             — no DOM (Node tests).
//
//  Public API (as specified):
//    auditLogger.logAnalysisRun(record)
//    auditLogger.createResultQuery(runId, feedbackText)
//    auditLogger.updateQueryStatus(queryId, status, adminNotes, reviewedBy)
//    auditLogger.getRuns(filters)
//    auditLogger.getQueries(filters)
//  Plus tester accounts + auth:
//    verifyTester(id, pw) · listTesters() · upsertTester() · setTesterActive()
//    verifyAdmin(user, pw) · hashPassword(pw) · scanForIdentifiers(text)
//
//  SAFETY: test-case data only. We never add patient-identifying fields.
//  scanForIdentifiers() gives a lightweight client-side warning for obvious
//  NHS-number / date-of-birth patterns in free text — open to stronger checks.
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.auditLogger = api;
}(typeof self !== 'undefined' ? self : this, function () {

  const CFG = (typeof window !== 'undefined' && window.RESULTDOCTOR_CONFIG) || {};
  const APP_VERSION = CFG.appVersion || 'rd-os-2026-06';   // bump on release; surfaced on every run
  const nodeCrypto = (typeof require !== 'undefined') ? (function(){ try { return require('crypto'); } catch(e){ return null; } })() : null;

  function uid(prefix) {
    const r = (typeof crypto !== 'undefined' && crypto.getRandomValues)
      ? [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('')
      : Math.random().toString(16).slice(2, 18);
    return prefix + '_' + Date.now().toString(36) + '_' + r;
  }
  function nowISO() { return new Date().toISOString(); }

  async function hashPassword(pw) {
    const salt = 'resultdoctor::';   // not a secret; per-deployment hashing should be server-side (Supabase)
    const input = salt + String(pw);
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    if (nodeCrypto) return nodeCrypto.createHash('sha256').update(input).digest('hex');
    throw new Error('No crypto available for password hashing');
  }

  // ── Lightweight identifier scan (warn only, never block) ────────────────
  function scanForIdentifiers(text) {
    const t = String(text || '');
    const warnings = [];
    if (/\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/.test(t) || /\b\d{10}\b/.test(t)) warnings.push('Looks like it may contain an NHS-number-like value.');
    if (/\b(0?[1-9]|[12]\d|3[01])[\/.\-](0?[1-9]|1[0-2])[\/.\-](19|20)?\d{2}\b/.test(t)) warnings.push('Looks like it may contain a full date of birth.');
    return { flagged: warnings.length > 0, warnings: warnings };
  }

  // ── Model factories ─────────────────────────────────────────────────────
  function makeRunRecord(d) {
    d = d || {};
    return {
      runId: uid('run'),
      timestamp: nowISO(),
      testerId: d.testerId || null,
      mode: 'tester',
      pathwayName: d.pathwayName || null,
      pathwayVersion: d.pathwayVersion || null,    // historic runs keep the version tested
      appVersion: d.appVersion || APP_VERSION,
      inputValues: d.inputValues || {},
      contextValues: d.contextValues || {},
      outputShown: d.outputShown != null ? d.outputShown : null,
      displayedResultText: d.displayedResultText || '',
      displayedRecommendation: d.displayedRecommendation || '',
      ruleBranchTriggered: d.ruleBranchTriggered || '',
      warningsShown: d.warningsShown || [],
      missingInfoPrompts: d.missingInfoPrompts || [],
      queried: false,
      queryId: null,
      sessionId: d.sessionId || null,
      userAgent: d.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : null)
    };
  }
  function makeQueryRecord(runId, testerId, feedbackText) {
    return {
      queryId: uid('q'), runId: runId, testerId: testerId || null, timestamp: nowISO(),
      feedbackText: feedbackText || '', status: 'new', adminNotes: '', reviewedAt: null, reviewedBy: null
    };
  }
  function makeTesterAccount(d) {
    return {
      testerId: d.testerId, displayName: d.displayName || '', passwordHash: d.passwordHash || '',
      active: d.active !== false, createdAt: d.createdAt || nowISO(), createdBy: d.createdBy || null, notes: d.notes || ''
    };
  }
  const QUERY_STATUSES = ['new', 'reviewing', 'resolved', 'not_issue', 'needs_pathway_change'];

  // ── In-memory store (base for Memory + Local adapters) ──────────────────
  function makeLocalStore(persist) {
    const load = persist ? persist.load : null, save = persist ? persist.save : null;
    let db = (load && load()) || { runs: [], queries: [], testers: {} };
    const flush = () => { if (save) save(db); };
    return {
      async logRun(rec) { db.runs.push(rec); flush(); return rec; },
      async getRuns(f) { return filterRuns(db.runs.slice(), f); },
      async getRun(runId) { return db.runs.find(r => r.runId === runId) || null; },
      async createQuery(q) {
        db.queries.push(q);
        const run = db.runs.find(r => r.runId === q.runId);
        if (run) { run.queried = true; run.queryId = q.queryId; }
        flush(); return q;
      },
      async getQueries(f) {
        let qs = db.queries.slice();
        if (f && f.status) qs = qs.filter(q => q.status === f.status);
        if (f && f.testerId) qs = qs.filter(q => q.testerId === f.testerId);
        return qs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      },
      async updateQuery(queryId, patch) {
        const q = db.queries.find(x => x.queryId === queryId); if (!q) return null;
        Object.assign(q, patch); flush(); return q;
      },
      async listTesters() { return Object.keys(db.testers).map(k => db.testers[k]); },
      async getTester(id) { return db.testers[id] || null; },
      async upsertTester(acc) { db.testers[acc.testerId] = Object.assign(db.testers[acc.testerId] || {}, acc); flush(); return db.testers[acc.testerId]; },
      _seedTesters(map) { let changed = false; Object.keys(map).forEach(id => { if (!db.testers[id]) { db.testers[id] = map[id]; changed = true; } }); if (changed) flush(); },
      _reset() { db = { runs: [], queries: [], testers: {} }; flush(); }
    };
  }
  function filterRuns(runs, f) {
    f = f || {};
    if (f.testerId) runs = runs.filter(r => r.testerId === f.testerId);
    if (f.pathwayName) runs = runs.filter(r => r.pathwayName === f.pathwayName);
    if (f.queried != null) runs = runs.filter(r => !!r.queried === !!f.queried);
    return runs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  // ── Supabase adapter (HARDENED; static-site friendly) ───────────────────
  //  Tester-facing writes use the anon key: insert a run (write-only) and call
  //  the two SECURITY DEFINER RPCs (login, submit query). Anon has NO table
  //  read access. Every ADMIN read/update goes through the rd-admin Edge
  //  Function (service_role server-side), authenticated with an admin secret
  //  set at admin login — never stored in committed code.
  function makeSupabaseAdapter(url, key) {
    const base = url.replace(/\/$/, '') + '/rest/v1';
    const adminUrl = CFG.adminApiUrl || '';   // rd-admin Edge Function URL
    let adminSecret = '';
    const aHeaders = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };

    async function rq(path, opts) {
      const res = await fetch(base + path, Object.assign({ headers: aHeaders }, opts));
      if (!res.ok) throw new Error('Supabase ' + res.status + ' ' + (await res.text()));
      const txt = await res.text(); return txt ? JSON.parse(txt) : null;
    }
    async function adminCall(action, payload) {
      if (!adminUrl) throw new Error('Admin API not configured (set RESULTDOCTOR_CONFIG.adminApiUrl)');
      if (!adminSecret) throw new Error('Admin not authenticated');
      const res = await fetch(adminUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rd-admin-secret': adminSecret }, body: JSON.stringify(Object.assign({ action: action }, payload || {})) });
      if (res.status === 401) throw new Error('unauthorised');
      if (!res.ok) throw new Error('Admin API ' + res.status + ' ' + (await res.text()));
      const txt = await res.text(); return txt ? JSON.parse(txt) : null;
    }
    return {
      // tester-facing (anon)
      async logRun(rec) { await rq('/runs', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, aHeaders), body: JSON.stringify(rec) }); return rec; },
      async verifyTester(id, pw) {
        const ok = await rq('/rpc/rd_verify_tester', { method: 'POST', body: JSON.stringify({ p_tester_id: id, p_password: pw }) });
        return ok ? { ok: true, tester: { testerId: id, displayName: '' } } : { ok: false };
      },
      async submitQuery(runId, testerId, feedbackText) {
        const queryId = await rq('/rpc/rd_submit_query', { method: 'POST', body: JSON.stringify({ p_run_id: runId, p_tester_id: testerId, p_feedback: feedbackText }) });
        return String(queryId);
      },
      // admin (Edge Function, service_role)
      setAdminSecret(s) { adminSecret = s || ''; },
      async adminPing() { try { const r = await adminCall('ping'); return !!(r && r.ok); } catch (e) { adminSecret = ''; return false; } },
      async getRuns(f) { return adminCall('getRuns', { filters: f || {} }); },
      async getRun(runId) { return adminCall('getRun', { runId: runId }); },
      async getQueries(f) { return adminCall('getQueries', { filters: f || {} }); },
      async updateQuery(queryId, patch) { return adminCall('updateQuery', { queryId: queryId, status: patch.status, adminNotes: patch.adminNotes, reviewedBy: patch.reviewedBy }); },
      async listTesters() { return adminCall('listTesters'); },
      async adminUpsertTester(d) { return adminCall('upsertTester', d); },
      async adminSetActive(testerId, active) { return adminCall('setTesterActive', { testerId: testerId, active: active }); },
      _seedTesters() {}, _reset() {}
    };
  }

  // ── Adapter selection ───────────────────────────────────────────────────
  let storageMode, store;
  if (CFG.supabaseUrl && CFG.supabaseAnonKey && typeof fetch !== 'undefined') {
    storageMode = 'supabase';
    store = makeSupabaseAdapter(CFG.supabaseUrl, CFG.supabaseAnonKey);
  } else if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    storageMode = 'local-dev';
    store = makeLocalStore({
      load: () => { try { return JSON.parse(localStorage.getItem('rd_audit_db') || 'null'); } catch (e) { return null; } },
      save: (db) => { try { localStorage.setItem('rd_audit_db', JSON.stringify(db)); } catch (e) {} }
    });
  } else {
    storageMode = 'memory';
    store = makeLocalStore(null);
  }

  // Dev-only convenience: seed example testers (distinct per-tester dev passwords)
  // so the tester flow is usable out of the box. NEVER used with Supabase.
  async function seedDevTesters() {
    if (storageMode === 'supabase') return;
    const map = {};
    for (let i = 1; i <= 6; i++) {
      const id = 'tester' + String(i).padStart(2, '0');
      map[id] = makeTesterAccount({ testerId: id, displayName: 'Demo tester ' + i, passwordHash: await hashPassword('rd-' + id), createdBy: 'dev-seed', notes: 'Development seed account' });
    }
    store._seedTesters(map);
  }

  // ── Public API ──────────────────────────────────────────────────────────
  const api = {
    APP_VERSION, storageMode, QUERY_STATUSES,
    makeRunRecord, makeQueryRecord, makeTesterAccount, hashPassword, scanForIdentifiers,

    async logAnalysisRun(record) { return store.logRun(makeRunRecord(record)); },
    async getRuns(filters) { return store.getRuns(filters); },
    async getRun(runId) { return store.getRun(runId); },

    async createResultQuery(runId, feedbackText, testerId) {
      if (store.submitQuery) {   // hardened cloud path: server-side RPC, no table writes from anon
        const queryId = await store.submitQuery(runId, testerId, feedbackText);
        return { queryId: queryId, runId: runId, testerId: testerId, feedbackText: feedbackText, status: 'new' };
      }
      const q = makeQueryRecord(runId, testerId, feedbackText);
      await store.createQuery(q);
      return q;
    },
    async getQueries(filters) { return store.getQueries(filters); },
    async updateQueryStatus(queryId, status, adminNotes, reviewedBy) {
      if (QUERY_STATUSES.indexOf(status) === -1) throw new Error('Unknown status: ' + status);
      const patch = { status: status, reviewedAt: nowISO() };
      if (adminNotes != null) patch.adminNotes = adminNotes;
      if (reviewedBy != null) patch.reviewedBy = reviewedBy;
      return store.updateQuery(queryId, patch);
    },

    // Tester accounts + auth
    async listTesters() { return store.listTesters(); },
    async createOrUpdateTester(d, createdBy) {
      if (store.adminUpsertTester) {   // cloud: Edge Function hashes server-side
        return store.adminUpsertTester({ testerId: d.testerId, displayName: d.displayName || '', password: d.password, notes: d.notes || '', active: d.active !== false, createdBy: createdBy || 'admin' });
      }
      const existing = await store.getTester(d.testerId);
      const acc = makeTesterAccount(Object.assign({}, existing || {}, d, { createdBy: (existing && existing.createdBy) || createdBy || null }));
      if (d.password) acc.passwordHash = await hashPassword(d.password);
      else if (existing) acc.passwordHash = existing.passwordHash;
      return store.upsertTester(acc);
    },
    async setTesterActive(testerId, active) {
      if (store.adminSetActive) return store.adminSetActive(testerId, !!active);
      const t = await store.getTester(testerId); if (!t) return null;
      t.active = !!active; return store.upsertTester(t);
    },
    async verifyTester(testerId, password) {
      if (store.verifyTester) return store.verifyTester(testerId, password);   // cloud: server-side RPC
      const t = await store.getTester(testerId);
      if (!t || !t.active) return { ok: false };
      const ok = t.passwordHash === await hashPassword(password);
      return ok ? { ok: true, tester: { testerId: t.testerId, displayName: t.displayName } } : { ok: false };
    },

    // Admin auth. Cloud: the entered password is the admin secret — verified by
    // the rd-admin Edge Function (service_role server-side); never committed.
    // Dev/local: client-side compare against config (DEV FALLBACK ONLY).
    async verifyAdmin(username, password) {
      if (store.setAdminSecret && store.adminPing) {
        store.setAdminSecret(password);
        return await store.adminPing();
      }
      const u = CFG.adminUsername || 'admin';
      const p = CFG.adminPassword || 'change-me-before-live';
      return String(username) === u && String(password) === p;
    },
    setAdminSecret(s) { if (store.setAdminSecret) store.setAdminSecret(s); },

    seedDevTesters,
    _store: store
  };
  return api;
}));
