// ════════════════════════════════════════════════════════════════════════
//  rd-admin — Result Doctor admin API (Supabase Edge Function, Deno)
// ────────────────────────────────────────────────────────────────────────
//  The ONLY component that holds the service_role key. The browser admin
//  dashboard calls this function; the function checks an admin secret and then
//  performs privileged reads/updates with service_role (bypassing RLS). This is
//  what lets the admin dashboard read audit data while anon users cannot.
//
//  Deploy:
//    supabase functions deploy rd-admin --no-verify-jwt
//  Set secrets (NOT committed):
//    supabase secrets set SUPABASE_URL=...                # auto-set in most projects
//    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...   # service_role key (server-only)
//    supabase secrets set RD_ADMIN_SECRET=<a long random admin secret>
//
//  The admin enters RD_ADMIN_SECRET at the admin login; it is sent per request
//  as the x-rd-admin-secret header and never stored in committed code.
// ════════════════════════════════════════════════════════════════════════
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SECRET = Deno.env.get("RD_ADMIN_SECRET") || "";
const REST = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-rd-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(REST + path, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}
async function hash(pw: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("resultdoctor::" + pw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function qs(filters: Record<string, unknown> = {}) {
  const p: string[] = [];
  if (filters.testerId) p.push(`testerId=eq.${encodeURIComponent(String(filters.testerId))}`);
  if (filters.pathwayName) p.push(`pathwayName=eq.${encodeURIComponent(String(filters.pathwayName))}`);
  if (filters.status) p.push(`status=eq.${encodeURIComponent(String(filters.status))}`);
  if (filters.queried !== undefined && filters.queried !== null) p.push(`queried=eq.${!!filters.queried}`);
  return p.length ? "&" + p.join("&") : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Constant-ish admin-secret check
  const secret = req.headers.get("x-rd-admin-secret") || "";
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return json({ ok: false, error: "unauthorised" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const action = body.action;

  try {
    switch (action) {
      case "ping":
        return json({ ok: true });
      case "getRuns":
        return json(await sb(`/runs?order=timestamp.desc${qs(body.filters)}`));
      case "getRun":
        return json((await sb(`/runs?runId=eq.${encodeURIComponent(body.runId)}`))?.[0] || null);
      case "getQueries":
        return json(await sb(`/queries?order=timestamp.desc${qs(body.filters)}`));
      case "updateQuery": {
        const patch = { status: body.status, adminNotes: body.adminNotes ?? null, reviewedAt: new Date().toISOString(), reviewedBy: body.reviewedBy ?? "admin" };
        const r = await sb(`/queries?queryId=eq.${encodeURIComponent(body.queryId)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
        return json(r?.[0] || null);
      }
      case "listTesters":
        return json((await sb(`/testers?order=testerId.asc`)).map((t: any) => ({ ...t, passwordHash: undefined })));
      case "upsertTester": {
        const acc: any = { testerId: body.testerId, displayName: body.displayName ?? "", active: body.active !== false, notes: body.notes ?? "", createdBy: body.createdBy ?? "admin" };
        if (body.password) acc.passwordHash = await hash(body.password);
        await sb(`/testers`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(acc) });
        return json({ ok: true });
      }
      case "setTesterActive":
        await sb(`/testers?testerId=eq.${encodeURIComponent(body.testerId)}`, { method: "PATCH", body: JSON.stringify({ active: !!body.active }) });
        return json({ ok: true });
      case "publishConfig": {
        // Insert a new versioned published config (clinician tools read it via anon SELECT).
        const rec = body.record || {};
        await sb(`/published_configs`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ pathwayId: rec.pathwayId, version: rec.version, thresholds: rec.thresholds, publishedAt: rec.publishedAt, publishedBy: rec.publishedBy }) });
        return json({ ok: true, version: rec.version });
      }
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message) }, 500);
  }
});
