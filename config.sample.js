// ═══════════════════════════════════════════════════════════════════════
//  config.sample.js — Result Doctor tester-mode / audit configuration TEMPLATE
// ───────────────────────────────────────────────────────────────────────
//  HOW TO USE
//    1. Copy this file to  config.js   (config.js is git-ignored — never commit it)
//    2. Fill in your Supabase project URL + anon key (and optionally admin creds)
//    3. Add this line BEFORE auditLogger.js in admin.html and each pathway tool:
//         <script src="config.js"></script>
//
//  If config.js is absent (or supabaseUrl/anonKey are blank), the app falls back
//  to DEVELOPMENT storage (browser localStorage) — single-device only, NOT a real
//  multi-device audit store. The admin dashboard shows which mode is active.
//
//  SECURITY NOTES (static site)
//    - The Supabase anon key is public by design; protect tables with Row Level
//      Security (see supabase_schema.sql). Tester password hashing/verification
//      should ideally move to a Supabase Edge Function / RPC for production.
//    - Admin credentials below are a DEV FALLBACK only. For a real deployment,
//      serve config.js with proper values from a protected build/host step and
//      treat the admin area as low-assurance on a purely static site.
// ═══════════════════════════════════════════════════════════════════════
window.RESULTDOCTOR_CONFIG = {
  // ── Cloud audit store (Supabase) — leave blank to use the dev fallback ──
  supabaseUrl: '',          // e.g. 'https://YOURPROJECT.supabase.co'
  supabaseAnonKey: '',      // e.g. 'eyJhbGciOi...'

  // ── App / build identifier stamped on every run ──
  appVersion: 'rd-os-2026-06',

  // ── Admin credentials (DEV FALLBACK ONLY — change before any real use) ──
  adminUsername: 'admin',
  adminPassword: 'change-me-before-live'
};
