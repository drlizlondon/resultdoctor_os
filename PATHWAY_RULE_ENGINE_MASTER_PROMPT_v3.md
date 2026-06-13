# PATHWAY RULE ENGINE — MASTER PROMPT v3

**Purpose:** When given an NHS clinical pathway document (PDF, flowchart, or guideline), produce three artefacts:

1. **An admin/audit HTML tool** — for the person setting the pathway up, verifying the engine, and filling in gaps before deployment.
2. **A clinical-use HTML tool** — for the clinician at the desk with a patient's results, who wants to know what to do next and why.
3. **A registry entry (JSON)** — for the result-first router that lets a clinician enter any results and have the right pathways surface automatically.

All three artefacts must trace verbatim to the source document. Nothing is inferred from clinical knowledge without explicit labelling. Nothing is invented.

---

## Source URL requirement

The first thing you ask for, before producing anything, is the source URL of the pathway PDF. If it's not provided, you flag it clearly in every artefact as "⚠ SOURCE URL NOT PROVIDED" and proceed, but you do not invent one.

---

## PART 1 — The admin/audit HTML tool

A single-file HTML with a sidebar layout (260px sidebar, main content area), white/cream surfaces on light grey background, and the following tabs:

### 1. Provenance & metadata
- ICB / organisation, area covered, pathway title, population (state if not in source — flag for clinical review), setting (mark INFERRED if you deduce it), version + date, review date, authors, approving body, contact, source URL, all indexed variables
- Exclusion criteria panel (red) — list what the source says, or mark "not stated in source — clinical team to define before deployment"
- Patient-facing information panel (green) — leaflets/URLs from source, or mark not stated
- Escalation contacts panel (amber) — every phone number, hotline, referral route the source mentions, with explicit notes where contact details are absent

### 2. Variables & ranges
- One card per variable with: code, full name, also-known-as synonyms (3-5 alternates), unit, type, threshold pills (Normal / Threshold / Raised / Binary / Context-required)
- Pathway note (verbatim or paraphrased with explicit attribution) explaining how the variable is used
- Context badge (purple) where the variable cannot be interpreted alone — e.g. ALP requires GGT, split bilirubin requires fasting sample, transferrin saturation requires elevated ferritin
- In Working mode, numeric thresholds become editable input fields; modifications are tracked in the Change Log
- Page tabs if the source PDF has multiple pages (e.g. Page 1 hepatic / Page 2 cholestatic)

### 3. Decision rules
- One rule card per branch in the flowchart
- Header with step ID, category badge (Urgent/GP/Refer/No-action/Monitor), source badge (EXPLICIT/INFERRED), title, expand chevron
- Body sections:
  - **Conditions** — IF / AND / OR / AND NOT / THEN logic lines, colour-coded keywords (blue IF, green AND, amber OR, red AND-NOT, navy THEN, purple CONTEXT)
  - **Meaning** — plain-English summary in a grey block
  - **Management** — priority-ordered actions (URGENT red, GP-now blue, Monitor green etc.)
  - **Source trail** — for every rule, a serif italic block-quote of the exact source text plus the page/section reference. Tagged EXPLICIT if directly stated, INFERRED if deduced from flow arrows or layout
  - **Admin / user output panel** — a locked guideline summary in one column and an editable "local instruction" textarea in the other column (only editable in Working mode), with a live preview of what the clinician will see
  - **Copy this rule** — copy-to-clipboard button with the rule serialised
- Search bar + category filter buttons at the top of the rules tab
- Page tabs if source has multiple pages

### 4. Context map
- Table listing every variable that explicitly requires additional context before interpretation (paired variable, collection condition, occurrence dependency)
- One detail card per context-dependent variable, with source quote and branching logic
- All entries must trace to the source PDF — never invent contextual dependencies

### 5. Gaps & resolution
- Statistics row: Open / Partial / Resolved / Total
- Filter buttons: All / Open / Partial / Resolved
- One gap card per item the system could not extract (source URL, phone numbers, leaflet URLs, exclusion criteria, population, review date, authors, approving body, external pathway URLs)
- Each gap card has:
  - **Why flagged** column (locked) — the source-derived reason
  - **Local resolution** column (editable in Working mode) — a textarea, Save button, Mark Resolved / Mark Partial buttons
  - Timestamp of last update
- Gaps count badge appears in the sidebar nav

### 6. Copy sheet
- One copy-block per variable, per rule, plus combined "all variables" and "all rules" blocks
- Each block has a header label, copy button with click-to-clipboard feedback, and a scrollable pre-formatted text area

### 7. Change log
- Empty by default
- Every variable edit, admin output change, and gap resolution timestamped and listed
- Reverse chronological order

### Visual language
- Fonts: system sans for body, mono for variable codes and source attribution metadata
- Colours: navy header, NHS-blue primary, semantic colours per category (red urgent, blue GP, pink/purple refer, green no-action, amber alcohol/metabolic, purple context-required)
- Rounded corners (8/12/16px), subtle shadows, 0.5px borders for technical feel
- Mode toggle in sidebar footer: Master (read-only) vs Working (editable)
- An amber edit-notice appears in Working mode

---

## PART 2 — The clinical-use HTML tool

A single-file HTML matching the ResultDoctor design language. Header navy (#0B1C3D), serif headings (DM Serif Display), sans body (DM Sans), white cards on light grey background.

### Layout
- Sticky navy header with logo, breadcrumb, and Patient/Clinician/Admin mode toggle
- Dark navy "pathway header" strip with Live tag, ICB tag, version tag, serif title, subtitle, and source attribution strip
- Main content max-width 880px, centred
- Sticky "Copy for EMR" bar at bottom of viewport when analysis has run

### Result entry form
- One numeric input per measurable variable, with unit hint and placeholder example
- Reference range NOT shown unless the source PDF states it explicitly
- Inputs colour as the clinician types: green border if within standard reference, red if abnormal, amber if context-dependent
- Clinical context dropdowns below the result grid — one for each binary/categorical context variable the pathway requires (Jaundice yes/no, weight loss yes/no, alcohol >14u/wk, NAFLD risk factors, repeat result, etc.)
- A "Patient identifier (optional)" text field for the EMR copy
- Large blue "Analyse →" button
- Small "Reset all" link

### Output — primary action card (always shown when analysis runs)
- Single big card with a coloured pulsing flag at the top (Urgent / GP action / Refer / No action / Amber-action / Context-required)
- Serif title (the headline answer — what to DO)
- Plain-English subtitle (the WHY, in 1-2 sentences)
- Optional context-warning strip (amber) if a contextual dependency is unresolved
- Numbered action list (each action in a white sub-card with numbered circle)
- Where an action needs a local detail (phone number, URL, referral route), a "Local instruction" sub-block appears underneath that action, showing the value if set or "not yet set — admin can add" if not
- In Admin mode, each local-instruction block has an inline editable textarea + Save button
- **"📖 Show why"** expand button at the bottom of the card — when opened, reveals three detail blocks:
  - **Verbatim NW London pathway text** — serif italic block-quote of the exact source text with blue left border, followed by source attribution line
  - **Logic trace** — IF / AND / OR / THEN lines with ✓ for conditions matched and · for unmet
  - **Source attribution** — Explicit/Inferred tag + full page/section reference

### Output — flow diagram with path highlighting
- Below the primary action card, a "📍 Your path through the [pathway name]" panel
- Click "Show diagram" — reveals an inline SVG of the entire pathway as boxes connected by arrows
- The active path is highlighted: active boxes get strong coloured fill + 3.5px stroke + drop shadow, active arrows turn NHS blue + 2.5px stroke, inactive boxes drop to 25% opacity
- Each box shows: step number (top-left, small uppercase), node text (centred, word-wrapped)
- Colour-coded by category (urgent red, GP blue, refer purple, no-action green, amber-action amber)
- Legend at the bottom of the panel

### Output — secondary cards (collapsed by default)
- For "also relevant to this pattern" — branches that apply but aren't the headline
- Compact card with category tag + title + expand chevron
- Expands to show subtitle, action list, and verbatim source quote

### Output — global pathway note
- Always shown at the bottom
- Collapsed secondary-style card with the pathway's global caveat (e.g. "the degree of abnormality is not an indication of the severity of disease")

### Result summary chip row
- Above the primary card, a navy chip strip showing each entered result with colour-coded value (red if abnormal, green if normal, dimmed if not entered)

### Copy for EMR
- Sticky navy bar at the bottom of the screen, appearing once analysis runs
- Shows the headline interpretation
- "📋 Copy for EMR" button copies a structured record entry:
  ```
  LFTs reviewed [timestamp] — Pt: [identifier if entered]
  Per [Pathway name and version].
  Results: [comma list of entered results with units]
  Context: [list of context flags]
  Interpretation: [primary recordSummary]
  Plan: [primary recordPlan]
  Source: [Pathway name] (verbatim guideline text reviewed via ResultDoctor).
  Disclaimer: Pathway logic only; does not replace clinical judgement.
  ```
- Confirmation tick on copy

### Admin mode
- Toggleable from the header
- Yellow banner across the top: "Admin mode active. Local instructions can be edited inline."
- Every gap-derived local instruction (phone numbers, URLs, referral routes, leaflets) becomes an inline editable textarea + Save button
- Values persist to localStorage with a pathway-specific key (e.g. `nwl_lft_local`)

### Engine principles
- Logic is fixed and traces to the source PDF — no clinician-knowledge inference
- Engine is concrete: every IF/AND/OR is checked, every branch reachable only via explicit conditions
- Where the source PDF does not state a threshold (e.g. "ALT raised" without a number), use standard reference ranges with a clear `THRESHOLD NOT IN PDF — standard reference used` flag in the logic trace
- Engine handles missing values gracefully — context dropdowns default to "not assessed," numeric fields default to null

### Visual language (must match)
- Headings: `DM Serif Display`, serif, weight 400
- Body: `DM Sans`, sans, weights 300-700
- Primary action card border 2px in category colour, padding 28px, border-radius 20px
- Subtle drop shadows, generous whitespace, calm composure

---

## PART 3 — The registry entry (JSON)

A small JSON file describing this pathway so the result-first router can detect when it applies.

```json
{
  "id": "nwl_lft",
  "title": "Abnormal LFT",
  "icb": "NW London",
  "version": "V1.6 Oct 2019 / V1.4 Aug 2019",
  "tool_path": "lft.html",
  "description": "Adult abnormal liver function tests — hepatic and cholestatic patterns, Gilbert's syndrome, NAFLD, alcohol-related",
  "trigger_variables": ["bilirubin", "alt", "ast", "alp", "ggt", "albumin", "inr"],
  "trigger_context": ["jaundice", "weight_loss", "alcohol", "nafld_risk"],
  "primary_pattern": "Abnormal LFT — any of: raised ALT/AST, raised ALP/GGT, raised bilirubin, low albumin, prolonged INR"
}
```

The router uses `trigger_variables` to decide which pathways apply: if any one of the trigger variables has a value entered, the pathway is surfaced as a candidate. The router does NOT make clinical decisions — it only matches variable names. The actual pathway logic runs inside each pathway tool when the clinician clicks through.

---

## Critical rules — applies to all three artefacts

1. **Verbatim is sacred.** Every quoted block must be the exact text of the source PDF. Never paraphrase a quote.

2. **Inferred is labelled.** When a branch destination is implied by an arrow but not stated, label it `[INFERRED — from flow diagram arrow]`. When a threshold isn't given, label it `[THRESHOLD NOT IN PDF]`.

3. **Gaps are surfaced, never invented.** If the source doesn't give a phone number, the gap shows "not stated in source." Do not look up a number from elsewhere.

4. **Context dependencies must be from the source.** Only mark a variable as context-dependent if the source PDF explicitly couples it to another variable or condition. Don't invent dependencies from clinical knowledge.

5. **Copyright.** Limit quoted source text to under 15 words per quote, one quote per source section, except for blockquotes inside the source-trail/verbatim panels which are the whole point of the artefact and may be longer. Always attribute fully (pathway, version, date, page/section).

6. **No clinical advice generated.** The artefacts reproduce the pathway's logic exactly. They do not add recommendations, modify priorities, or substitute clinical judgement.

7. **All three artefacts share the same data model.** A pathway's variables, rules, gaps, and verbatim quotes are extracted once and reused across the admin tool, clinical tool, and registry entry. They must remain consistent.

---

## Output format

When given a new pathway PDF:

1. Ask for the source URL if not provided
2. Read the PDF in full
3. Identify all variables, branches, gaps, context dependencies
4. Produce three files:
   - `[pathway_id]_admin.html` — the admin/audit tool
   - `[pathway_id].html` — the clinical-use tool
   - `[pathway_id].json` — the registry entry
5. List every gap surfaced with its type (URL, contact, exclusion, metadata, population)
6. Confirm which items in the admin tool's Gaps tab need clinical team input before deployment

---

## Version history

- v1: Original — admin tool only, single page
- v2: Added sidebar layout, Gaps tab, Context Map, Change Log
- v3 (this version): Added clinical-use tool with flow diagram path highlighting, primary action cards, verbatim quotes inline, EMR copy. Added registry JSON for result-first routing.
