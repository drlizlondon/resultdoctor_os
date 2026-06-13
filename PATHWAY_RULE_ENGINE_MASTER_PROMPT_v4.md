# PATHWAY RULE ENGINE — MASTER PROMPT v4

**Purpose:** When given an NHS clinical pathway document (PDF, flowchart, or guideline), produce three artefacts:

1. **An admin/audit HTML tool** — for the person setting the pathway up, verifying the engine, and filling in gaps before deployment.
2. **A clinical-use HTML tool** — for the clinician at the desk with a patient's results, who wants to know what to do next and why.
3. **A registry entry (JSON)** — for the result-first router that lets a clinician enter any results and have the right pathways surface automatically.

All three artefacts must trace verbatim to the source document. Nothing is inferred from clinical knowledge without explicit labelling. Nothing is invented.

---

## Source URL requirement

The first thing you ask for, before producing anything, is the source URL of the pathway PDF. If it's not provided, you flag it clearly in every artefact as "⚠ SOURCE URL NOT PROVIDED" and proceed, but you do not invent one.

---

## THRESHOLD HANDLING PRINCIPLES (new in v4)

These principles apply to every numeric result the clinician can enter. They are non-negotiable design rules — getting them wrong produces clinically misleading output.

### Principle 1: Visual flagging is separate from pathway decision logic

Every numeric result has two threshold layers, and they must not be conflated:

- **Visual flagging thresholds** — used for input border colour and summary chip colour. Applied to every result based on standard reference ranges, regardless of whether the pathway has a clinical decision branch for that exact range.
- **Pathway decision thresholds** — the specific cutoffs that branch the engine's clinical logic. These come from the source PDF.

A result must NEVER display as "normal" green just because the pathway is silent on that value's range. Example: if the pathway encodes ferritin <30 as "iron deficiency" but says nothing about ferritin >1000, the engine must still flag ferritin 1134 as amber/red visually — not green. Where the pathway is silent on a value's clinical action, the visual flagging tells the clinician "this is outside normal" and the engine can surface an informational finding citing any related verbatim PDF text (e.g. "ferritin can be raised in inflammation, infection, malignancy, liver disease").

For each numeric variable:
- Identify the pathway's encoded thresholds (verbatim from PDF)
- Identify standard adult reference range thresholds (clinical knowledge — these must be labelled in the engine as "standard reference, not in PDF" if relevant)
- Apply visual colouring using the wider of the two:
  - Green normal: within both reference range AND pathway's "no action" zone
  - Amber warning: outside reference range OR triggering a non-urgent pathway branch
  - Red abnormal: triggering an urgent pathway branch OR markedly outside reference range (e.g. >3-4x ULN)

Result summary chips must include every entered numeric result, colour-coded.

### Principle 2: Sex-conditional thresholds use "if male X, if female Y" output, never blocking

Many pathways have sex-dependent cutoffs (e.g. Hb anaemia threshold <130 M / <114 F; ferritin IDA threshold <20 M / <10 F). When a value falls into a sex-conditional zone AND sex is not specified, the engine MUST:

1. Compute three zones:
   - **Definite zone** — value triggers the threshold for *both* sexes (e.g. Hb <114 = anaemia regardless of sex)
   - **Ambiguous zone** — value triggers for one sex only (e.g. Hb 114-129 = anaemia in male, not in female)
   - **Definite non-trigger zone** — value triggers for neither sex (e.g. Hb ≥130)

2. Behaviour:
   - **Definite zone:** proceed without asking for sex. Sex may still be needed for downstream routing, but it does not block the primary finding. Note the downstream dependency in the output.
   - **Ambiguous zone + sex unknown:** present a "Conditional — depends on sex" card with explicit "If male: X. If female: Y." text. Do not silently pick one branch. Do not block with "set sex to continue" — show both outcomes side by side.
   - **Definite non-trigger zone:** show no-action card.

This principle applies recursively to every sex-conditional threshold in the pathway. If both anaemia threshold AND ferritin threshold are sex-conditional, both should use this logic — not just the first one.

### Principle 3: Empty-input handling

The engine must NEVER crash or alert on an empty form. If the user clicks Analyse with no inputs:
- Show a friendly "Enter at least one result to begin" state
- Do not throw an error, do not pop an alert
- The form's Analyse button can be disabled until at least one input is non-empty, but the engine must still gracefully handle a stray click

---

## COMPETING PATHWAYS (new in v4)

When the toolkit contains two or more pathways that apply to the same result with different thresholds (e.g. NCL FBC anaemia trigger at Hb <110 vs NWL Anaemia trigger at Hb <130 M / <114 F), the design is:

1. **Both pathways surface in the router.** The result-first landing page lists every triggered pathway as a card. The clinician picks which applies to their patient/area. The router does NOT pick for them.

2. **Each pathway tool includes a "How this differs from [other pathway]" comparison card** as a collapsible secondary block at the bottom of its output. Lists threshold differences explicitly:
   - Anaemia trigger
   - IDA criteria
   - Scope (e.g. anaemia only vs full FBC)
   - Approving body
   - Any other meaningful divergence

3. **No silent hierarchy.** The toolkit must not prefer one pathway over another based on clinical judgement. Both are valid; the clinician picks.

---

## STALE GUIDELINE TAGGING (new in v4)

When a pathway's published review date has passed at the time of build, the clinical tool's pathway header must show an amber warning tag like "⚠ Review was due [year]". This is a small visual cue that the source guideline may be out of date and worth verifying with the issuing body before clinical use. The admin tool's Provenance tab must also flag this.

If the review date is in the future, no tag needed. If the review date is absent from the PDF, surface this as a gap in the Gaps tab.

---

## PART 1 — The admin/audit HTML tool

A single-file HTML with a sidebar layout (260px sidebar, main content area), white/cream surfaces on light grey background, and the following tabs:

### 1. Provenance & metadata
- ICB / organisation, area covered, pathway title, population (state if not in source — flag for clinical review), setting (mark INFERRED if you deduce it), version + date, **review date with stale-guideline warning if past**, authors, approving body, contact, source URL, all indexed variables
- Exclusion criteria panel (red) — list what the source says, or mark "not stated in source — clinical team to define before deployment"
- Patient-facing information panel (green) — leaflets/URLs from source, or mark not stated
- Escalation contacts panel (amber) — every phone number, hotline, referral route the source mentions, with explicit notes where contact details are absent

### 2. Variables & ranges
- One card per variable with: code, full name, also-known-as synonyms (3-5 alternates), unit, type, threshold pills
- **Both visual flagging thresholds AND pathway decision thresholds shown as separate pills** (Principle 1) — e.g. ferritin should show "Reference: 30-300" alongside "Pathway: <30 IDA, >150 raised"
- **Sex-conditional thresholds shown with both M/F values** and a "conditional" badge (Principle 2) — e.g. Hb shows "<130 M / <114 F" with a sex-conditional indicator
- Pathway note (verbatim or paraphrased with explicit attribution) explaining how the variable is used
- Context badge (purple) where the variable cannot be interpreted alone — e.g. ALP requires GGT, split bilirubin requires fasting sample
- In Working mode, numeric thresholds become editable input fields; modifications tracked in the Change Log
- Page tabs if the source PDF has multiple pages

### 3. Decision rules
- One rule card per branch in the flowchart
- Header with step ID, category badge (Urgent/GP/Refer/No-action/Monitor), source badge (EXPLICIT/INFERRED), title, expand chevron
- Body sections:
  - **Conditions** — IF / AND / OR / AND NOT / THEN logic lines, colour-coded keywords
  - **Meaning** — plain-English summary
  - **Management** — priority-ordered actions
  - **Source trail** — serif italic block-quote of the exact source text plus page/section reference. Tagged EXPLICIT or INFERRED
  - **Admin / user output panel** — locked guideline summary in one column, editable local-instruction textarea in the other (only editable in Working mode), live preview of clinician-facing output
  - **Copy this rule** — copy-to-clipboard button
- Search bar + category filter buttons at the top
- Page tabs if multi-page source

### 4. Context map
- Table listing every variable that explicitly requires additional context before interpretation
- One detail card per context-dependent variable, with source quote and branching logic
- **Sex-dependent variables must be listed here** with the conditional zones shown (Principle 2)

### 5. Gaps & resolution
- Statistics row: Open / Partial / Resolved / Total
- Filter buttons
- One gap card per item the system could not extract
- Each gap card with "Why flagged" (locked) and "Local resolution" (editable in Working mode), timestamp
- **Stale review date appears here as a gap if applicable** (Principle: stale tagging)
- Gaps count badge appears in sidebar nav

### 6. Copy sheet
- One copy-block per variable, per rule, plus combined blocks
- Each block with header label, copy button, scrollable pre-formatted text

### 7. Change log
- Empty by default. Every variable edit, admin output change, gap resolution timestamped. Reverse chronological.

### Visual language
- Fonts: system sans for body, mono for variable codes
- Colours: navy header, NHS-blue primary, semantic colours per category
- Rounded corners (8/12/16px), subtle shadows, 0.5px borders
- Mode toggle in sidebar footer: Master (read-only) vs Working (editable)
- Amber edit-notice in Working mode

---

## PART 2 — The clinical-use HTML tool

Single-file HTML matching the ResultDoctor design language. Header navy (#0B1C3D), serif headings (DM Serif Display), sans body (DM Sans), white cards on light grey background.

### Layout
- Sticky navy header with logo, breadcrumb, mode toggle
- Dark navy pathway header strip with Live tag, ICB tag, version tag, **stale-guideline amber tag if review date past** (Principle: stale tagging), serif title, subtitle, source attribution strip
- Main content max-width 880px, centred
- Sticky "Copy for EMR" bar at bottom when analysis has run

### Result entry form
- One numeric input per measurable variable, with unit hint and placeholder example
- **Inputs colour as the clinician types using BOTH layers (Principle 1):** standard reference range for visual flagging, plus any pathway-specific colouring on top. Inputs must never display green when outside normal reference range.
- Reference range NOT shown unless the source PDF states it explicitly
- Clinical context dropdowns below — one per binary/categorical context variable the pathway requires
- "Patient identifier (optional)" text field for EMR copy
- Large blue "Analyse →" button
- "Reset all" link
- **Graceful empty handling (Principle 3):** Analyse button disabled until any input has a value; if pressed empty anyway, friendly empty-state output

### Output — primary action card (always shown)
- Single big card with coloured pulsing flag (Urgent / GP action / Refer / No action / Conditional / Context-required)
- Serif title (the headline answer)
- Plain-English subtitle (the WHY)
- Optional context-warning strip (amber) if a dependency is unresolved
- Numbered action list (white sub-cards with numbered circles)
- Where an action needs a local detail (phone, URL, route), a "Local instruction" sub-block appears
- In Admin mode, each local-instruction block has an inline editable textarea
- **"📖 Show why"** expand button reveals three detail blocks:
  - **Verbatim pathway text** — serif italic block-quote with blue left border + source attribution
  - **Logic trace** — IF / AND / OR / THEN lines with ✓ for met and · for unmet
  - **Source attribution** — Explicit/Inferred tag + full page/section reference

### Output — conditional cards (new in v4)

When the engine encounters a sex-conditional value with sex unspecified (Principle 2), the primary card type is `info` with a "Conditional — depends on sex" flag. The card explicitly shows:
- "**If male:** [outcome A]"
- "**If female:** [outcome B]"
- A prompt to set sex in the context panel to see the full route

The flow diagram lights only the entry/decision nodes; the sex-dependent branches remain dimmed because no decision has been made.

### Output — flow diagram with path highlighting

REQUIRED for every pathway. Below the primary action card, a "📍 Your path through the [pathway name]" panel.

- Click "Show diagram" — reveals inline SVG of the entire pathway as boxes connected by arrows
- Active path: strong coloured fill + 3.5px stroke + drop shadow; active arrows turn NHS blue + 2.5px stroke
- Inactive boxes drop to 25% opacity, arrows to 20% opacity
- Each box shows: step number (top-left, small uppercase), node text (centred, word-wrapped)
- Colour-coded by category (urgent red, GP blue, refer purple, no-action green, decision amber)
- Edge labels light up on active path
- Legend at the bottom

This is the standout feature. Multi-sub-pathway sources (like NCL FBC's 11 separate flowcharts) need careful design to consolidate or split — never skip the diagram.

### Output — secondary cards (collapsed by default)
- For "also relevant to this pattern" — branches that apply but aren't the headline
- Compact card with category tag + title + expand chevron

### Output — competing pathways comparison (new in v4)

If this pathway has a competing pathway in the toolkit (Principle: Competing pathways), a collapsible "How this differs from [other pathway]" card appears as a secondary at the bottom of the output. Lists threshold differences explicitly so the clinician understands why both surface and what they're choosing between.

### Output — global pathway note
- Always shown at the bottom
- Collapsed secondary with the pathway's global caveat

### Result summary chip row (new in v4)
- Above the primary card, navy chip strip showing **every entered result** (not just headline ones), colour-coded per Principle 1
- Red urgent / amber warning / green normal / dimmed if not entered
- Must include all numeric inputs the user provided, not a subset

### Copy for EMR
- Sticky navy bar at bottom, appears once analysis runs
- Shows headline interpretation
- "📋 Copy for EMR" button copies a structured record entry:
  ```
  [Test type] reviewed [timestamp] — Pt: [identifier if entered]
  Per [Pathway name and version].
  Results: [comma list with units]
  Context: [list of context flags]
  Interpretation: [primary recordSummary]
  Plan: [primary recordPlan]
  Source: [Pathway name] (verbatim guideline text reviewed via ResultDoctor).
  Disclaimer: Pathway logic only; does not replace clinical judgement.
  ```
- Confirmation tick on copy

### Admin mode
- Toggleable from header
- Yellow banner: "Admin mode active. Local instructions can be edited inline."
- Every gap-derived local instruction becomes an inline editable textarea + Save button
- Values persist to localStorage with a pathway-specific key

### Engine principles
- Logic is fixed and traces to the source PDF — no clinician-knowledge inference for decision branches
- Engine handles missing values gracefully — context dropdowns default to "not assessed," numeric fields default to null
- **Threshold handling per Principle 1, sex-conditional per Principle 2, empty input per Principle 3**
- Where the source PDF does not state a threshold, use standard reference ranges WITH a clear "THRESHOLD NOT IN PDF — standard reference used" flag in the logic trace AND in the engine code comments

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
  "status": "live",
  "tool_path": "lft.html",
  "admin_path": "lft_admin.html",
  "description": "...",
  "trigger_variables": ["bilirubin", "alt", "ast", "alp", "ggt", "albumin", "inr"],
  "trigger_context": ["jaundice", "weight_loss", "alcohol", "nafld_risk"],
  "competing_pathways": ["ncl_fbc"],
  "review_date": "2021-07-01",
  "review_status": "stale",
  "primary_pattern": "..."
}
```

New in v4:
- `competing_pathways` — array of pathway IDs that overlap with this one's trigger variables (Principle: Competing pathways)
- `review_date` and `review_status` (current/stale/unknown) — drives the stale-guideline tag (Principle: stale tagging)

The router uses `trigger_variables` to surface candidates. Where two pathways have overlapping trigger variables, BOTH surface and the clinician picks. The router does NOT make clinical decisions.

---

## Critical rules — applies to all three artefacts

1. **Verbatim is sacred.** Every quoted block must be the exact text of the source PDF. Never paraphrase a quote.

2. **Inferred is labelled.** Label `[INFERRED — from flow diagram arrow]` or `[THRESHOLD NOT IN PDF]` where appropriate.

3. **Gaps are surfaced, never invented.** No phone numbers from elsewhere, no leaflet URLs guessed.

4. **Context dependencies must be from the source.** Don't invent dependencies from clinical knowledge.

5. **Copyright.** Limit quoted source text to under 15 words per quote, one quote per source section, except blockquotes inside source-trail/verbatim panels which may be longer. Always attribute fully.

6. **No clinical advice generated.** The artefacts reproduce the pathway's logic exactly.

7. **All three artefacts share the same data model.** Variables, rules, gaps, quotes extracted once, reused across all three.

8. **Threshold handling per Principle 1.** Visual flagging is independent of decision logic.

9. **Sex-conditional handling per Principle 2.** "If male X, if female Y" — never block.

10. **Empty input handled gracefully per Principle 3.**

---

## Output format

When given a new pathway PDF:

1. Ask for the source URL if not provided
2. Read the PDF in full
3. Identify all variables, branches, gaps, context dependencies, sex-conditional thresholds, review date status
4. For each numeric variable, list both visual flagging thresholds and pathway decision thresholds
5. Identify any competing pathways already in the toolkit (ask the user if uncertain)
6. Produce three files:
   - `[pathway_id]_admin.html`
   - `[pathway_id].html`
   - `[pathway_id].json`
7. List every gap surfaced
8. Confirm which items need clinical team input before deployment

---

## Version history

- v1: Original — admin tool only, single page
- v2: Sidebar layout, Gaps tab, Context Map, Change Log
- v3: Clinical tool with flow diagram path highlighting, primary action cards, verbatim quotes inline, EMR copy, registry JSON for result-first routing
- **v4 (this version):**
  - **Threshold handling principles** — visual flagging separated from pathway decision logic (Principle 1); every numeric result needs high/low cutoffs even where pathway is silent
  - **Sex-conditional thresholds** — "if male X, if female Y" conditional output instead of blocking (Principle 2); applies recursively to every sex-dependent variable
  - **Empty-input handling** — graceful state, no crashes (Principle 3)
  - **Competing pathways pattern** — both surface in router, comparison card in each tool
  - **Stale guideline tagging** — amber warning tag when review date past
  - Result summary chips must include every entered result (not subset)
  - Conditional card type added to clinical tool output
