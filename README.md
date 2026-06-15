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
| `PATHWAY_RULE_ENGINE_MASTER_PROMPT_v3.md` | The master prompt for adding more pathways |

## Camera scan (live mode)

`index.html` has a **Scan blood results** button that opens a live camera preview and reads results on-device, as a draft only:

1. OCR runs on sampled video frames at a controlled interval (every 1.5s), entirely in the browser. No image is uploaded or stored; frames are released immediately after extraction.
2. Detected results populate a **review table** (Test / Value / Unit / Ref range / Flag), not the analysis fields. A reading appears only after it has been seen on two consecutive frames (debounce). Rows that map to a known analyte and clear the confidence threshold are marked ready (✓); low-confidence, ambiguous or unmapped rows are highlighted for review (⚠).
3. In the table the clinician can **edit**, **delete**, or **add a row manually**. Edited and manual rows are re-validated through the same parser, so they are only analysable once they map to a known analyte with a unit.
4. Nothing touches the result fields until **Confirm and analyse** is pressed. On confirm, only eligible (non-review) rows are written into the existing fields + interpretation log, then the existing **Find pathways** routing runs. needsReview and unmapped rows are never analysed. There is no separate OCR analysis path.

Manual entry and the search bar remain fully available alongside it.

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
