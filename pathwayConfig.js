// ═══════════════════════════════════════════════════════════════════════
//  pathwayConfig.js — published-threshold store (the publish pipeline)
// ───────────────────────────────────────────────────────────────────────
//  Closes the loop: admin Working edits → PUBLISH → clinician tool reads the
//  agreed values. A "published config" is a versioned set of threshold
//  overrides for a pathway.
//
//    PathwayConfig.effective(defaults, published)  -> merged thresholds (pure)
//    PathwayConfig.getPublished(pathwayId)         -> {version,thresholds,...}|null
//    PathwayConfig.publish(pathwayId, thresholds, publishedBy, opts) -> record
//
//  Storage (mirrors auditLogger):
//    • Supabase: clinician tools read the published_configs table with the
//      ANON key (published = public, anon-readable by design — see schema);
//      admin publishes via the rd-admin Edge Function (service_role).
//    • Dev/local: browser localStorage (single device) — proves the loop;
//      NOT multi-device. The admin UI says which mode is active.
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PathwayConfig = api;
}(typeof self !== 'undefined' ? self : this, function () {

  const CFG = (typeof window !== 'undefined' && window.RESULTDOCTOR_CONFIG) || {};
  const cloud = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && typeof fetch !== 'undefined');
  const mem = {};   // node/in-memory fallback

  // Pure merge — defaults overridden by any published values of the same key.
  function effective(defaults, published) {
    const out = Object.assign({}, defaults || {});
    const t = published && published.thresholds;
    if (t) Object.keys(t).forEach(function (k) { if (k in out && t[k] != null && t[k] !== '') out[k] = +t[k]; });
    return out;
  }

  const hasLS = (typeof window !== 'undefined' && typeof localStorage !== 'undefined');   // browser only
  function lsKey(id) { return 'rd_pub_' + id; }
  function localGet(id) {
    if (hasLS) { try { return JSON.parse(localStorage.getItem(lsKey(id)) || 'null'); } catch (e) { return null; } }
    return mem[id] || null;
  }
  function localPut(id, rec) {
    if (hasLS) { try { localStorage.setItem(lsKey(id), JSON.stringify(rec)); } catch (e) {} }
    else mem[id] = rec;
  }

  async function getPublished(pathwayId) {
    if (cloud) {
      try {
        const base = CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1';
        const res = await fetch(base + '/published_configs?pathwayId=eq.' + encodeURIComponent(pathwayId) + '&order=version.desc&limit=1',
          { headers: { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey } });
        if (res.ok) { const rows = await res.json(); return (rows && rows[0]) || null; }
      } catch (e) { /* fall through to local */ }
    }
    return localGet(pathwayId);
  }

  async function publish(pathwayId, thresholds, publishedBy, opts) {
    opts = opts || {};
    const prev = await getPublished(pathwayId);
    const rec = {
      pathwayId: pathwayId,
      version: (prev && prev.version ? prev.version : 0) + 1,
      thresholds: thresholds || {},
      publishedAt: new Date().toISOString(),
      publishedBy: publishedBy || 'admin'
    };
    if (cloud && opts.adminApiUrl && opts.adminSecret) {
      const res = await fetch(opts.adminApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-rd-admin-secret': opts.adminSecret },
        body: JSON.stringify({ action: 'publishConfig', record: rec })
      });
      if (!res.ok) throw new Error('Publish failed: ' + res.status + ' ' + (await res.text()));
      return rec;
    }
    localPut(pathwayId, rec);   // dev/local
    return rec;
  }

  return { effective, getPublished, publish, cloud: cloud, _mem: mem };
}));
