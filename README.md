# MyResultDoctor

Result-first navigation for NHS clinical pathways. Enter blood results → the right pathway(s) surface → clinician picks → see the verbatim guideline text and flow diagram with the actual route highlighted.

## Files in this folder

| File | What it is |
|------|------------|
| `index.html` | **Start here.** Universal result entry — pick this when opening locally or as the landing page on a server |
| `lft.html` | Abnormal LFT pathway (NW London, V1.6 Oct 2019 / V1.4 Aug 2019) — clinical tool **with flow diagram** |
| `lft_admin.html` | Abnormal LFT admin/audit tool |
| `fbc.html` | Abnormal FBC pathway (NCL, Final Jan 2023) — covers 11 sub-pathways |
| `nwl_anaemia.html` | NWL Anaemia pathway (V1, 9 July 2020) — focused IDA workup **with flow diagram** |
| `pathways.json` | Pathway registry |
| `analytes.js` | **Single source of truth** for the analyte layer — labels, units, aliases and plausible ranges. Shared by manual entry, the search bar, the camera parser and the tests. Edit ranges/units here (clinical sign-off required) |
| `bloodResultParser.js` | OCR-independent parser: turns text into structured result rows. No camera/DOM/OCR dependency; unit tested directly |
| `ocrService.js` | OCR abstraction layer (Tesseract.js, on-device). The only module that touches the OCR engine |
| `tests/bloodResultParser.test.js` | Parser + safety-gate unit tests. Run with `node tests/bloodResultParser.test.js` (no framework, no install) |
| `pathwayDiagram.js` | **Shared pathway-diagram renderer + highlight**, extracted verbatim from the NWL LFT pathway. Draws any pathway's diagram with the patient's route highlighted and the rest dimmed. Used by every pathway page |
| `pathwayLft.js` | NWL LFT diagram data (`LFT_FLOW_NODES`/`LFT_FLOW_EDGES`) + `lftActivePath(d)` — the reference rules, extracted so they are reusable and unit tested |
| `tests/pathwayDiagram.test.js` | Diagram/highlight tests: LFT regression, reuse by another pathway, rules→steps mapping, route changes with inputs |
| `auditLogger.js` | Central tester-mode audit/data module (storage abstraction + Supabase / dev-local / memory adapters + models + identifier scan) |
| `testerMode.js` | Reusable tester-mode UX (entry modal, tester login, badge, auto run logging, Query-this-result flow) |
| `admin.html` | Protected admin dashboard — tester accounts, runs, queries, stats, export |
| `config.sample.js` | Config template — copy to `config.js` (git-ignored) for Supabase + admin credentials |
| `supabase_schema.sql` | Supabase tables + starting RLS policies for central audit storage |
| `tests/auditLogger.test.js` | Audit-logger unit tests (run logging, query linking, status, tester auth, privacy scan) |
| `fbc_admin.html`, `nwl_anaemia_admin.html`, `notts_lft_admin.html` | Pathway admin pages on the shared master engine (`pathwayAdmin.js`) |
| `pathwayAdmin.js` | **Master admin engine** — the shared, passcode-gated editing engine reused by every pathway admin page (editable normal ranges + threshold bands, working copy, Change Log, reset-to-master). Master data is never mutated |
| `tests/pathwayAdmin.test.js` | Admin engine tests: working-copy isolation, change log, band add/remove, reset, passcode gate |

## Master admin engine (every pathway)

The admin editing capability — set/edit normal ranges and threshold bands, with a working copy, Change Log, reset-to-master and a passcode gate — is a single shared engine in `pathwayAdmin.js` (`PathwayAdmin`). It is **not** copied per pathway. `lft_admin.html` is the reference consumer.

Adding it to any pathway admin page is one step:

```html
<script src="pathwayAdmin.js"></script>
<script>
  PathwayAdmin.config({
    pin: '2468',                                  // client-side gate only (not real security)
    pages: [{ prefix:'', vars: VARS }],           // this pathway's variable definitions
    dom: { grid:'var-grid', changes:'changes-container',
           btnMaster:'btn-m', btnWorking:'btn-w', notice:'edit-notice' },
    onModeChange: m => { /* re-render this page's rules/gaps for master/working */ }
  });
  PathwayAdmin.renderVars();
</script>
```

A variable is `{ code, full, type, unit, normalHigh, low, thresholds:[{l,c}], note?, ctx? }`. The engine owns all editing; the page only supplies data. Every new pathway inherits the same controls by configuring the engine.
| `PATHWAY_RULE_ENGINE_MASTER_PROMPT_v3.md` | The master prompt for adding more pathways |

## Camera scan (live mode)

`index.html` has a **Scan blood results** button that opens a live camera preview and reads results on-device, as a draft only:

1. OCR runs on sampled video frames at a controlled interval (every 1.5s), entirely in the browser. No image is uploaded or stored; frames are released immediately after extraction.
2. Detected results populate a **review table** (Test / Value / Unit / Ref range / Flag), not the analysis fields. A reading appears only after it has been seen on two consecutive frames (debounce). Rows that map to a known analyte and clear the confidence threshold are marked ready (✓); low-confidence, ambiguous or unmapped rows are highlighted for review (⚠).
3. In the table the clinician can **edit**, **delete**, or **add a row manually**. Edited and manual rows are re-validated through the same parser, so they are only analysable once they map to a known analyte with a unit.
4. Nothing touches the result fields until **Confirm and analyse** is pressed. On confirm, only eligible (non-review) rows are written into the existing fields + interpretation log, then the existing **Find pathways** routing runs. needsReview and unmapped rows are never analysed. There is no separate OCR analysis path.

Manual entry and the search bar remain fully available alongside it.

## Tester mode, audit & admin

A transparency/validation layer so testers can run large batches of **fictional, anonymised, test-case** inputs and have every run recorded centrally for review. It does not store any patient-identifiable data.

**Areas:** the header offers **Patient Demo · Clinician · Admin**. Patient Demo / Clinician are the same result-first tool; Admin (`admin.html`) is a protected dashboard.

**Tester flow (on each pathway tool):**
- On first use a modal asks *"Are you using an official tester account?"*
- **No, continue as demo user** → tool behaves exactly as before: no login, no badge, no logging, no query control.
- **Yes, I'm a tester** → tester login (Tester ID + password, authenticated per-tester). On success a "Tester mode active" badge appears and **every analysis run is logged automatically** — there is no OK/approve/sign-off button. A *"Query this result"* control lets the tester flag a run; submitting opens a query for admin review. Unqueried runs are kept as ordinary tester runs.

**Modules (reusable across pathways):**
- `auditLogger.js` — the single audit/data module. API: `logAnalysisRun`, `createResultQuery`, `updateQueryStatus`, `getRuns`, `getQueries`, plus tester-account + auth helpers and a lightweight `scanForIdentifiers` (warns on NHS-number/DOB-like free text). Picks a storage adapter automatically (Supabase → dev localStorage → in-memory for tests).
- `testerMode.js` — the tester UX (entry modal, login, badge, automatic run logging, Query-this-result flow, safety wording). A pathway wires it with `TesterMode.init({pathwayName, pathwayVersion})` + `TesterMode.recordRun({...})`.
- `admin.html` — admin login + dashboard: Overview stats, Tester accounts (create / set password / enable-disable), Runs (+ detail), Queries (+ review status & notes), and CSV/JSON export.

### Configure admin credentials
Admin auth reads `window.RESULTDOCTOR_CONFIG.adminUsername` / `adminPassword`. Copy `config.sample.js` → `config.js` (git-ignored), set them, and add `<script src="config.js"></script>` **before** `auditLogger.js`. With no `config.js` the **dev fallback** is `admin` / `change-me-before-live` — change before any real use. (A purely static site can only offer low-assurance admin auth; treat accordingly.)

### Configure cloud storage (central, multi-device) — intended route
localStorage is **not** the real audit store — each device is separate. For testers on different devices use Supabase (works from a static site):
1. Create a Supabase project; run `supabase_schema.sql` in its SQL editor (creates tables, RLS, the login/submit-query RPCs).
2. Deploy the admin function: `supabase functions deploy rd-admin --no-verify-jwt`, then set its secrets (never committed): `SUPABASE_SERVICE_ROLE_KEY`, `RD_ADMIN_SECRET` (a long random admin secret).
3. Copy `config.sample.js` → `config.js` (git-ignored). Set `supabaseUrl`, `supabaseAnonKey`, and `adminApiUrl` (the `rd-admin` function URL).
4. Add `<script src="config.js"></script>` **before** `auditLogger.js` on `admin.html` and each pathway tool.

Testers' browsers use the **anon key** only (write-only run logging + the login/submit-query RPCs). The admin dashboard calls the **rd-admin Edge Function** with the admin secret (entered at login). Without Supabase config everything runs in **development storage** (this browser only) and the dashboard says so. `config.js` is git-ignored — real keys/passwords are never committed.

### Security — answers to the pre-external-tester checklist
1. **RLS enabled on all tables?** Yes. `supabase_schema.sql` runs `enable row level security` on `testers`, `runs` and `queries`, and additionally `revoke`s the anon/authenticated grants PostgREST would use.
2. **Can anon read tester accounts / admin credentials / unrestricted audit data?** No. Anon has **no read policy** on any table, so it cannot list testers, read password hashes, or read any runs/queries. Anon can only (a) **insert** a tester run (`mode='tester'`, write-only) and (b) call two `SECURITY DEFINER` RPCs — `rd_verify_tester` (returns only true/false) and `rd_submit_query` (returns only a query id). **Admin credentials are not stored in the database at all** — admin access is gated by `RD_ADMIN_SECRET` inside the Edge Function (the service_role key lives only there, never in the browser).
3. **What is still low-assurance (static GitHub Pages site)?** There is no server in front of the static pages, so: the anon key is public (safe only because of the RLS above); anyone with the anon key can insert *junk* runs (write-only spam is possible — it cannot read or alter existing data); the admin secret is typed into a static page and held in memory for the session (no httpOnly cookie / CSRF protection / rate-limiting / lockout); and the dev-only `config.js` admin fallback, if ever shipped, would be readable in the browser. Treat the admin area as **low-assurance** and the data as **test-case only** — never patient-identifiable.
4. **Minimum production-safe next step (recommended).** The `rd-admin` Edge Function already moves admin access control + all privileged reads/writes server-side, and tester-password verification is already server-side via `rd_verify_tester`. To reach production-grade, additionally: (a) issue a short-lived signed admin **session token** from the function instead of replaying the raw secret per request, behind rate-limiting/lockout; (b) move run/query **inserts** behind a per-tester signed token (issued by `rd_verify_tester`) so anon cannot spam; (c) serve the admin UI from an authenticated origin (Supabase Auth / a small server) rather than static Pages. Until then, run only **closed pilots with trusted testers** and rotate `RD_ADMIN_SECRET`.

### Limitations / assumptions
- The Supabase + Edge Function path is **provided and documented but not verified against a live project** here (no credentials in this environment). Dev/local mode is fully verified.
- Dev seed: in dev (no Supabase) the tester flow works out of the box with example accounts `tester01`–`tester06`, each with a distinct dev password `rd-<id>` (e.g. `rd-tester01`). Development-only; never created against Supabase.
- Test coverage: `tests/auditLogger.test.js` (9 cases) covers run logging + versioning, query linking, status updates, filters, tester auth (distinct hashed passwords, disable-blocks-login, history retained), async admin auth and the identifier scan. UI flows (demo path, tester login incl. failure, automatic logging, query submission, admin login/dashboards) verified in-browser in dev mode.

## How the routing works

1. The user enters any results into the universal form on `index.html`
2. The router checks each pathway in `pathways.json` against the variables entered
3. **Every** pathway with at least one matched variable is surfaced
4. When two pathways apply to the same result (e.g. NCL FBC + NWL Anaemia both trigger on Hb), **both surface as cards** — the clinician picks which one applies to their patient/area
5. Clicking through carries the results via URL params + sessionStorage so the pathway tool is pre-filled

The router does NOT make clinical decisions. It only matches variable names. All clinical logic lives in each pathway's own HTML file.

## How the two anaemia pathways differ

| | NCL Abnormal FBC | NWL Anaemia |
|---|---|---|
| Anaemia trigger | Hb <110 (both sexes) | Hb <130 (M) / <114 (F) |
| IDA criteria | ferritin <30 alone | all three: Hb low + MCV <83.5 + ferritin <10 (F) / <20 (M) |
| GI workup | not directly routed | sex/menopausal-status routed |
| Scope | anaemia + 10 white-cell/platelet sub-pathways | anaemia only |

Both surface when Hb is entered. Clinician picks.

## Flow diagram with path highlighting ("YOUR PATH THROUGH THE PATHWAY")

The LFT, NWL Anaemia and Iron Deficiency tools each show their source pathway diagram and **highlight the route taken** based on the specific results entered:
- Active path: NHS blue, thicker stroke, drop shadow
- Not taken: dimmed to 25% opacity
- Decision points + referral destinations colour-coded
- Section labelled **YOUR PATH THROUGH THE PATHWAY** on every pathway page

This behaviour originated in the NWL LFT pathway (the reference). It has been **extracted into one shared renderer** (`pathwayDiagram.js`) so every pathway repeats it identically: each pathway keeps its own diagram data (`FLOW_NODES`/`FLOW_EDGES`) and its own clinical logic (which produces the active node/edge sets), and hands both to the shared renderer. There is no separate diagram engine per pathway. Adding a future pathway = define its nodes/edges, produce its active path, call `PathwayDiagram.renderPathwayDiagram(...)`.

The NCL FBC tool doesn't have a diagram yet because that pathway is actually 12 separate sub-flowcharts in the PDF (one per cell line) — would need careful design to consolidate. On the list.

## How to add a new pathway

1. Feed `PATHWAY_RULE_ENGINE_MASTER_PROMPT_v3.md` + the new pathway PDF to Claude
2. Claude produces clinical HTML + admin HTML + registry JSON entry
3. Drop the HTML files into this folder
4. Append the JSON entry to `pathways.json` and to the PATHWAYS array in `index.html`

## How to share with friends for testing

Drag the `MyResultDoctor` folder onto https://app.netlify.com/drop → public URL in seconds, no account needed.

For a permanent home, use GitHub Pages.

## Important caveats

- **The NWL Anaemia pathway is V1 from July 2020 with review due in 2021.** A yellow tag in the pathway header flags this — the source guideline is overdue review by the issuing body. Worth checking with NWL ICB whether an updated version exists before clinical use.
- **The LFT pathway source URL was not provided during build** — see Gaps tab in `lft_admin.html`.
- **Local instructions** (phone numbers, referral routes, leaflet URLs) live in each user's browser localStorage. They don't sync between users without a backend.
- **This is not an NHS service.** Supports clinical navigation, does not replace clinical judgement.
