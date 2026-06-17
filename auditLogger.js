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

  // ── Supabase adapter (cloud; static-site friendly via REST) ─────────────
  function makeSupabaseAdapter(url, key) {
    const base = url.replace(/\/$/, '') + '/rest/v1';
    const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
    async function rq(path, opts) {
      const res = await fetch(base + path, Object.assign({ headers: headers }, opts));
      if (!res.ok) throw new Error('Supabase ' + res.status + ' ' + (await res.text()));
      const txt = await res.text(); return txt ? JSON.parse(txt) : null;
    }
    return {
      async logRun(rec) { await rq('/runs', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, headers), body: JSON.stringify(rec) }); return rec; },
      async getRuns(f) {
        let q = '/runs?order=timestamp.desc';
        if (f && f.testerId) q += '&testerId=eq.' + encodeURIComponent(f.testerId);
        if (f && f.pathwayName) q += '&pathwayName=eq.' + encodeURIComponent(f.pathwayName);
        if (f && f.queried != null) q += '&queried=eq.' + (!!f.queried);
        return await rq(q);
      },
      async getRun(runId) { const r = await rq('/runs?runId=eq.' + encodeURIComponent(runId)); return (r && r[0]) || null; },
      async createQuery(qrec) {
        await rq('/queries', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, headers), body: JSON.stringify(qrec) });
        await rq('/runs?runId=eq.' + encodeURIComponent(qrec.runId), { method: 'PATCH', body: JSON.stringify({ queried: true, queryId: qrec.queryId }) });
        return qrec;
      },
      async getQueries(f) {
        let q = '/queries?order=timestamp.desc';
        if (f && f.status) q += '&status=eq.' + encodeURIComponent(f.status);
        if (f && f.testerId) q += '&testerId=eq.' + encodeURIComponent(f.testerId);
        return await rq(q);
      },
      async updateQuery(queryId, patch) { const r = await rq('/queries?queryId=eq.' + encodeURIComponent(queryId), { method: 'PATCH', headers: Object.assign({ Prefer: 'return=representation' }, headers), body: JSON.stringify(patch) }); return (r && r[0]) || null; },
      async listTesters() { return await rq('/testers?order=testerId.asc'); },
      async getTester(id) { const r = await rq('/testers?testerId=eq.' + encodeURIComponent(id)); return (r && r[0]) || null; },
      async upsertTester(acc) { await rq('/testers', { method: 'POST', headers: Object.assign({ Prefer: 'resolution=merge-duplicates,return=minimal' }, headers), body: JSON.stringify(acc) }); return acc; },
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
      const existing = await store.getTester(d.testerId);
      const acc = makeTesterAccount(Object.assign({}, existing || {}, d, { createdBy: (existing && existing.createdBy) || createdBy || null }));
      if (d.password) acc.passwordHash = await hashPassword(d.password);
      else if (existing) acc.passwordHash = existing.passwordHash;
      return store.upsertTester(acc);
    },
    async setTesterActive(testerId, active) {
      const t = await store.getTester(testerId); if (!t) return null;
      t.active = !!active; return store.upsertTester(t);
    },
    async verifyTester(testerId, password) {
      const t = await store.getTester(testerId);
      if (!t || !t.active) return { ok: false };
      const ok = t.passwordHash === await hashPassword(password);
      return ok ? { ok: true, tester: { testerId: t.testerId, displayName: t.displayName } } : { ok: false };
    },

    // Admin auth (client-side check; real secret lives in config/env — see docs)
    verifyAdmin(username, password) {
      const u = CFG.adminUsername || 'admin';
      const p = CFG.adminPassword || 'change-me-before-live';   // DEV FALLBACK ONLY
      return String(username) === u && String(password) === p;
    },

    seedDevTesters,
    _store: store
  };
  return api;
}));
