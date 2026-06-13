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
| `PATHWAY_RULE_ENGINE_MASTER_PROMPT_v3.md` | The master prompt for adding more pathways |

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

## Flow diagram with path highlighting

Both LFT and NWL Anaemia tools have an SVG flow diagram that **highlights the route taken** based on the specific results entered:
- Active path: NHS blue, thicker stroke, drop shadow
- Not taken: dimmed to 25% opacity
- Decision points + referral destinations colour-coded
- Clinician can see at a glance *why* the engine arrived at this recommendation

This is the standout feature of the toolkit. The NCL FBC tool doesn't have it yet because that pathway is actually 12 separate sub-flowcharts in the PDF (one per cell line) — would need careful design to consolidate. On the list.

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
