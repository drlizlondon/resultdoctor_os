// ═══════════════════════════════════════════════════════════════════════
//  testerMode.js — reusable tester-mode UX for any Result Doctor pathway
// ───────────────────────────────────────────────────────────────────────
//  Drop into a pathway tool:
//    <script src="auditLogger.js"></script>
//    <script src="testerMode.js"></script>
//    TesterMode.init({ pathwayName:'Notts LFT', pathwayVersion:'V37 Sep 2021' });
//  After each analysis the pathway calls:
//    TesterMode.recordRun({ mount: <resultCardEl>, inputValues, contextValues,
//      displayedResultText, displayedRecommendation, ruleBranchTriggered,
//      warningsShown, missingInfoPrompts });
//
//  Demo users: tool behaves exactly as before — no badge, no logging, no query
//  control. Official testers: every run is logged automatically (no OK/approve
//  button); a "Query this result" control lets them flag a run for review.
//
//  SAFETY: test-case data only; never patient-identifiable information.
// ═══════════════════════════════════════════════════════════════════════
window.TesterMode = (function () {
  const SAFE = 'Use fictional, anonymised or test-case data only. Do not enter patient-identifiable information.';
  const DISCLAIMER = 'Result Doctor is a clinical decision-support and education tool. It does not replace clinical judgement.';
  const K_CHOICE = 'rd_tester_choice', K_TESTER = 'rd_tester', K_SESSION = 'rd_session_id';
  let cfg = { pathwayName: 'Pathway', pathwayVersion: '' };

  function ss(k, v) { try { return v === undefined ? sessionStorage.getItem(k) : sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function ssRemove(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  function tester() { try { return JSON.parse(ss(K_TESTER) || 'null'); } catch (e) { return null; } }
  function isTester() { return !!tester(); }
  function sessionId() { let s = ss(K_SESSION); if (!s) { s = 'sess_' + Math.random().toString(36).slice(2, 12); ss(K_SESSION, s); } return s; }

  function injectStyles() {
    if (document.getElementById('tm-styles')) return;
    const css = `
    .tm-overlay{position:fixed;inset:0;background:rgba(11,28,61,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:18px}
    .tm-modal{background:#fff;border-radius:14px;max-width:440px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.25);font-family:'DM Sans',system-ui,sans-serif;overflow:hidden}
    .tm-modal h3{font-family:'DM Serif Display',Georgia,serif;font-weight:400;font-size:20px;padding:18px 22px 0;color:#0B1C3D}
    .tm-modal .tm-body{padding:10px 22px 4px;font-size:13.5px;color:#374151;line-height:1.5}
    .tm-modal .tm-safe{background:#FFFBEB;border:1px solid #FCD34D;color:#92400E;font-size:12px;border-radius:8px;padding:9px 12px;margin:12px 22px}
    .tm-modal .tm-disc{font-size:11.5px;color:#6B7280;padding:0 22px 4px}
    .tm-field{display:flex;flex-direction:column;gap:4px;padding:6px 22px}
    .tm-field label{font-size:12px;font-weight:600;color:#374151}
    .tm-field input,.tm-modal textarea{padding:9px 11px;border:1.5px solid #D1D5DB;border-radius:8px;font-size:14px;font-family:inherit;width:100%}
    .tm-field input:focus,.tm-modal textarea:focus{outline:none;border-color:#1859CC;box-shadow:0 0 0 3px rgba(24,89,204,.1)}
    .tm-err{color:#B91C1C;font-size:12.5px;padding:2px 22px;min-height:16px}
    .tm-warn{color:#92400E;font-size:12px;padding:2px 22px;min-height:14px}
    .tm-actions{display:flex;gap:10px;justify-content:flex-end;padding:14px 22px 20px}
    .tm-btn{padding:10px 16px;border-radius:9px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;border:1.5px solid #D1D5DB;background:#fff;color:#374151}
    .tm-btn:hover{border-color:#1859CC;color:#1859CC}
    .tm-btn.primary{background:#1859CC;color:#fff;border-color:#1859CC}.tm-btn.primary:hover{background:#1348B0;color:#fff}
    .tm-badge{position:fixed;left:14px;bottom:14px;z-index:9000;background:#0B1C3D;color:#fff;border-radius:20px;padding:7px 12px 7px 10px;font-family:'DM Sans',system-ui,sans-serif;font-size:12px;display:flex;align-items:center;gap:8px;box-shadow:0 4px 14px rgba(0,0,0,.2)}
    .tm-badge .dot{width:8px;height:8px;border-radius:50%;background:#34D399}
    .tm-badge button{background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:12px;font-size:11px;padding:3px 8px;cursor:pointer;font-family:inherit}
    .tm-feedback{margin-top:12px;border-top:1px dashed #E5E7EB;padding-top:12px}
    .tm-recorded{font-size:12px;color:#6B7280;margin-bottom:8px;display:flex;align-items:center;gap:7px}
    .tm-recorded .dot{width:7px;height:7px;border-radius:50%;background:#34D399;flex-shrink:0}
    .tm-query-btn{font-size:13px;font-weight:600;color:#1859CC;background:#E8F0FD;border:1px solid #BFDBFE;border-radius:8px;padding:8px 14px;cursor:pointer;font-family:inherit}
    .tm-query-btn:hover{background:#DBEAFE}
    .tm-done{font-size:13px;color:#00703C;font-weight:600}
    `;
    const s = document.createElement('style'); s.id = 'tm-styles'; s.textContent = css; document.head.appendChild(s);
  }

  function modal(html) {
    const ov = document.createElement('div'); ov.className = 'tm-overlay';
    ov.innerHTML = '<div class="tm-modal" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(ov);
    return { ov, close: () => ov.remove(), q: (sel) => ov.querySelector(sel) };
  }

  function showEntryModal() {
    const m = modal(
      '<h3>Tester mode</h3>' +
      '<div class="tm-body">Are you using an official tester account?</div>' +
      '<div class="tm-safe">' + SAFE + '</div>' +
      '<div class="tm-disc">' + DISCLAIMER + '</div>' +
      '<div class="tm-actions"><button class="tm-btn" id="tm-no">No, continue as demo user</button>' +
      '<button class="tm-btn primary" id="tm-yes">Yes, I’m a tester</button></div>');
    m.q('#tm-no').onclick = () => { ss(K_CHOICE, 'demo'); m.close(); };
    m.q('#tm-yes').onclick = () => { m.close(); showLoginModal(); };
  }

  function showLoginModal() {
    const m = modal(
      '<h3>Official tester login</h3>' +
      '<div class="tm-body">Official testers help improve Result Doctor by allowing their test inputs, pathway outputs and feedback queries to be recorded for review. ' + SAFE + '</div>' +
      '<div class="tm-field"><label>Tester ID</label><input id="tm-id" autocomplete="off" placeholder="e.g. tester01"></div>' +
      '<div class="tm-field"><label>Tester password</label><input id="tm-pw" type="password" autocomplete="off"></div>' +
      '<div class="tm-err" id="tm-login-err"></div>' +
      '<div class="tm-actions"><button class="tm-btn" id="tm-back">Back</button>' +
      '<button class="tm-btn primary" id="tm-continue">Continue</button></div>');
    m.q('#tm-back').onclick = () => { ss(K_CHOICE, 'demo'); m.close(); };
    m.q('#tm-continue').onclick = async () => {
      const id = m.q('#tm-id').value.trim(), pw = m.q('#tm-pw').value;
      const res = await auditLogger.verifyTester(id, pw);
      if (!res.ok) { m.q('#tm-login-err').textContent = 'That tester ID or password does not match an official tester account.'; return; }
      ss(K_TESTER, JSON.stringify(res.tester)); ss(K_CHOICE, 'tester');
      m.close(); showBadge();
    };
    m.q('#tm-id').focus();
  }

  function showBadge() {
    if (document.getElementById('tm-badge')) return;
    const t = tester(); if (!t) return;
    const b = document.createElement('div'); b.className = 'tm-badge'; b.id = 'tm-badge';
    b.innerHTML = '<span class="dot"></span><span>Tester mode active · ' + (t.testerId || '') + '</span><button id="tm-exit" title="' + DISCLAIMER + '">Exit</button>';
    document.body.appendChild(b);
    b.querySelector('#tm-exit').onclick = exitTesterMode;
  }
  function exitTesterMode() {
    ssRemove(K_TESTER); ss(K_CHOICE, 'demo');
    const b = document.getElementById('tm-badge'); if (b) b.remove();
    document.querySelectorAll('.tm-feedback').forEach(e => e.remove());
  }

  // ── Automatic run logging + the "Query this result" control ─────────────
  async function recordRun(data) {
    if (!isTester()) return null;                       // demo users: nothing logged, nothing shown
    const t = tester();
    let runId = null;
    try {
      const rec = await auditLogger.logAnalysisRun({
        testerId: t.testerId, pathwayName: cfg.pathwayName, pathwayVersion: cfg.pathwayVersion,
        sessionId: sessionId(),
        inputValues: data.inputValues || {}, contextValues: data.contextValues || {},
        outputShown: data.outputShown != null ? data.outputShown : true,
        displayedResultText: data.displayedResultText || '',
        displayedRecommendation: data.displayedRecommendation || '',
        ruleBranchTriggered: data.ruleBranchTriggered || '',
        warningsShown: data.warningsShown || [], missingInfoPrompts: data.missingInfoPrompts || []
      });
      runId = rec.runId;
    } catch (e) { /* logging must never break the clinical tool */ }
    if (data.mount && runId) renderFeedbackControl(data.mount, runId);
    return runId ? { runId } : null;
  }

  function renderFeedbackControl(mount, runId) {
    const el = (typeof mount === 'string') ? document.querySelector(mount) : mount;
    if (!el) return;
    const prev = el.querySelector(':scope > .tm-feedback'); if (prev) prev.remove();
    const box = document.createElement('div'); box.className = 'tm-feedback';
    box.innerHTML =
      '<div class="tm-recorded"><span class="dot"></span>This tester run has been recorded. Only query the result if something looks wrong, unclear, incomplete or unsafe.</div>' +
      '<button class="tm-query-btn">Query this result</button>';
    box.querySelector('.tm-query-btn').onclick = () => openQuery(runId, box);
    el.appendChild(box);
  }

  function openQuery(runId, box) {
    const m = modal(
      '<h3>Query this result</h3>' +
      '<div class="tm-body">Please give feedback on this result for review. Do not include patient-identifiable information.</div>' +
      '<div class="tm-field"><textarea id="tm-q" rows="4" placeholder="What looks wrong, unclear, unsafe or incomplete?"></textarea></div>' +
      '<div class="tm-warn" id="tm-q-warn"></div>' +
      '<div class="tm-actions"><button class="tm-btn" id="tm-q-cancel">Cancel</button>' +
      '<button class="tm-btn primary" id="tm-q-submit">Submit query</button></div>');
    const ta = m.q('#tm-q');
    ta.oninput = () => {
      const scan = auditLogger.scanForIdentifiers(ta.value);
      m.q('#tm-q-warn').textContent = scan.flagged ? ('⚠ ' + scan.warnings.join(' ') + ' Please remove it.') : '';
    };
    m.q('#tm-q-cancel').onclick = m.close;
    m.q('#tm-q-submit').onclick = async () => {
      const text = ta.value.trim(); if (!text) { ta.focus(); return; }
      const t = tester();
      try { await auditLogger.createResultQuery(runId, text, t ? t.testerId : null); } catch (e) {}
      m.close();
      if (box) box.innerHTML = '<div class="tm-done">Query saved for review. Thank you.</div>';
    };
    ta.focus();
  }

  function init(options) {
    cfg = Object.assign(cfg, options || {});
    injectStyles();
    if (auditLogger.seedDevTesters) auditLogger.seedDevTesters();   // dev-only; no-op on Supabase
    if (isTester()) { showBadge(); return; }
    if (ss(K_CHOICE)) return;            // already chose demo this session
    showEntryModal();
  }

  return { init, recordRun, isTester, exitTesterMode, SAFE, DISCLAIMER };
})();
