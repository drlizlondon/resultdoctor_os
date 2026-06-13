# PATHWAY RULE ENGINE — MASTER PROMPT v5

**v5 is v4 plus enforceability.** The v4 principles were correct but treated as guidance. In real-world testing (the iron deficiency build in Cowork), the same bugs returned: empty input defaulted to prescribing iron, the SVG flow diagram had no arrows, sex-conditional logic silently failed. v5 makes the principles mechanically enforceable through reference implementations, mandatory test cases, and a non-negotiable analyse() template.

**If you are an instance of Claude generating a pathway tool from this prompt: read the "Enforceability section" at the end before producing any output. The mandatory test checklist must be in your final message.**

---

## Purpose (unchanged from v4)

Given an NHS clinical pathway document, produce three artefacts:

1. An admin/audit HTML tool
2. A clinical-use HTML tool
3. A registry JSON entry

All three trace verbatim to the source. Nothing is inferred from clinical knowledge without explicit labelling. Nothing is invented.

---

## Source URL requirement (unchanged)

Ask for the source URL before producing anything. If not provided, flag every artefact with "⚠ SOURCE URL NOT PROVIDED" and proceed.

---

## THRESHOLD HANDLING PRINCIPLES (from v4 — restated)

### Principle 1: Visual flagging is separate from pathway decision logic

Every numeric result has two threshold layers:

- **Visual flagging** — input border colour and summary chip colour, based on standard reference ranges, applied to every result regardless of whether the pathway branches on it.
- **Pathway decision** — the cutoffs that branch the engine's clinical logic, from the source PDF.

A result must never display green just because the pathway is silent on its range. Ferritin 1134 must show red even if the pathway only encodes <30 and >150.

### Principle 2: Sex-conditional thresholds use "if male X, if female Y" output, never blocking

For any sex-dependent cutoff (Hb anaemia, ferritin IDA, Hct polycythaemia):

1. Compute three zones:
   - **Definite zone** — value triggers for both sexes
   - **Ambiguous zone** — value triggers for one sex only
   - **Definite non-trigger zone** — value triggers for neither

2. Behaviour:
   - Definite zone → proceed without asking for sex. Sex may be needed downstream but doesn't block primary finding.
   - Ambiguous zone + sex unknown → "Conditional — depends on sex" card with explicit "If male: X. If female: Y."
   - Definite non-trigger → no-action card.

Applies recursively to every sex-conditional threshold in the pathway.

### Principle 3: Empty-input handling

The engine must never crash, alert, or default to a clinical recommendation on empty input. If user clicks Analyse with no values: friendly empty state, no recommendation.

---

## COMPETING PATHWAYS, STALE TAGGING (from v4 — restated)

When two pathways apply to the same result with different thresholds, both surface in the router with a comparison card in each tool. When a pathway's review date has passed, the clinical tool header shows an amber stale-guideline tag.

---

## ENFORCEABILITY — NEW IN v5

This section makes the principles above mechanically enforceable. Skipping any item here means the build is incomplete, regardless of how good the verbatim quoting or visual design is.

### Requirement E1: Reference implementation for the flow diagram

The flow diagram is the standout feature of this toolkit. It must look and behave identically across pathways.

**Do not rewrite the flow diagram from scratch.** Use the canonical implementation from `lft.html` (or `nwl_anaemia.html`, which has the same pattern). Specifically:

1. **`FLOW_NODES` constant** — object keyed by node ID, each value is `{x, y, w, h, text, cls, step}`. Coordinates are absolute positions on the SVG canvas. `cls` is one of: `start-fill, gp-fill, refer-fill, decision-fill`.

2. **`FLOW_EDGES` constant** — array of `{from, to, label?}` objects. Every parent-child relationship between nodes must have an edge. Without edges, the SVG renders disconnected boxes — which is what went wrong in the iron deficiency build.

3. **`renderFlow(activeNodes, activeEdges)` function** — must:
   - Define both `<marker id="arrow">` and `<marker id="arrow-active">` in `<defs>`
   - Render edges FIRST (so nodes overlay), each with `marker-end="url(#arrow)"` or the active variant
   - Render nodes SECOND, each as `<rect>` + `<text>` with class names that drive active/dimmed styling
   - Active edges: NHS blue stroke (`#1859CC`), 2.5px stroke, full opacity
   - Active nodes: filled with category colour, 3.5px stroke, drop shadow
   - Inactive when something else is active: 25% opacity for nodes, 20% for edges
   - Edge labels light up when their edge is active

4. **Active path computed per rule, not by priority string.** Each rule in `analyse()` sets:
   - `activeNodes` — array of node IDs traversed by this specific decision
   - `activeEdges` — array of edge keys in the form `"fromId->toId"` for arrows on the active path

   Never use a hardcoded `activeMap = { urgent: [...], gp: [...] }` keyed by priority. Two rules with the same priority can take entirely different paths through the diagram.

5. **Call site:** `buildFlowDiagram(result.activeNodes || [], result.activeEdges || [])` — passing the per-rule arrays.

Copy this implementation verbatim from `lft.html`. Change only the data (FLOW_NODES contents, FLOW_EDGES contents). Do not rewrite the rendering function.

### Requirement E2: Mandatory `analyse()` template

The first 30 lines of `analyse()` must follow this skeleton. Do not deviate.

```javascript
function analyse() {
  // 1. Read all inputs into structured form
  const d = readAllInputs();  // returns { hb, mcv, ferritin, ..., sex, ..., bleeding, ... }

  // 2. EMPTY-INPUT GUARD (v4 Principle 3) — no exceptions
  const anyResult = [d.hb, d.mcv, d.ferritin, /* ...all numeric inputs */]
    .some(v => v !== null);
  const anyContext = [d.sex, d.bleeding, /* ...all categorical inputs */]
    .some(v => v !== '' && v !== false && v !== null);
  if (!anyResult && !anyContext) {
    renderEmptyState();
    return;
  }

  // 3. Compute threshold zones (v4 Principle 1 + 2)
  //    For every sex-conditional variable: definite / ambiguous / non-trigger zones
  //    For every numeric variable: visual flagging threshold AND pathway decision threshold
  d.thresholds = computeThresholdZones(d);

  // 4. Apply rules — each rule sets activeNodes + activeEdges on its result
  d.findings = applyRules(d);

  // 5. Fallback: no rule matched — explicit no-action card, NEVER a clinical recommendation
  if (d.findings.length === 0) {
    d.findings.push(buildNoFindingsState(d));
  }

  // 6. Sort by urgency, render
  d.findings.sort(byUrgency);
  renderOutput(d);
}
```

The fallback in step 5 is critical. In the iron deficiency bug, the catch-all rule recommended "start iron replacement" whenever no specific rule matched — including for completely empty input. This must never happen. The catch-all is "no findings", not "default to the most common recommendation."

### Requirement E3: Mandatory test cases at end of build

Every build ends with this checklist in the assistant's final message. Each test states pass/fail with the reason. The build is incomplete until every test passes.

```
TEST 1 — Empty form
   Click Analyse with no inputs.
   Expected: friendly empty-state card, no clinical recommendation.
   Result: [PASS / FAIL — describe]

TEST 2 — Single result
   Enter only Hb at a value that should trigger one rule.
   Expected: that rule fires, no other rules fire.
   Result: [PASS / FAIL — describe]

TEST 3 — Sex-conditional, sex unknown
   Enter a value in the sex-ambiguous zone (e.g. Hb 120) without setting sex.
   Expected: "Conditional — depends on sex" card with "if male X, if female Y" text.
   Result: [PASS / FAIL — describe]

TEST 4 — Sex-conditional, both sexes anaemic
   Enter a value below the lower sex threshold (e.g. Hb 100) without setting sex.
   Expected: anaemia confirmed; engine proceeds without blocking on sex.
   Result: [PASS / FAIL — describe]

TEST 5 — Result summary chips
   Enter several numeric values including one that is markedly raised (e.g. ferritin 1500).
   Expected: every entered value appears as a chip in the navy summary bar; the raised value is colour-coded red, not green.
   Result: [PASS / FAIL — describe]

TEST 6 — Flow diagram arrows
   View the rendered SVG source after a rule has fired.
   Expected: SVG contains both <marker id="arrow"> in <defs> AND <path> elements with marker-end attributes between connected nodes.
   Result: [PASS / FAIL — describe]

TEST 7 — Active path varies per rule
   Enter inputs triggering rule A. Note the active node IDs.
   Reset and enter inputs triggering rule B (different priority). Note the active node IDs.
   Expected: the two active paths differ in their middle/end nodes, not just colour.
   Result: [PASS / FAIL — describe]

TEST 8 — Catch-all does not default to recommendation
   Enter a small amount of context that doesn't match any rule (e.g. sex only).
   Expected: "No pathway action triggered" card with explanation, NOT a clinical recommendation.
   Result: [PASS / FAIL — describe]
```

If any test fails: state the failure, identify the bug location, propose the fix, do not declare the build complete.

### Requirement E4: Honest gap reporting

End every build with a "What this tool does NOT do" section listing:

- Pathway branches that exist in the PDF but were not encoded (with reason — e.g. "requires variables we don't ask for")
- Sex-conditional thresholds where the ambiguous zone was not implemented (should be zero — Principle 2 is non-negotiable)
- Empty-input states where the catch-all was used (should be zero — Principle 3 is non-negotiable)
- Visual flagging thresholds that fall back to "standard reference range" because PDF was silent (with explicit "THRESHOLD NOT IN PDF" label in code)

If the list contains items, the build is not yet complete — flag for review.

---

## PART 1 — The admin/audit HTML tool (unchanged from v4)

Sidebar layout. Tabs: Provenance, Variables (with both visual + decision thresholds shown), Decision rules, Context map, Gaps & resolution, Copy sheet, Change log. Stale review-date tag in header if applicable.

## PART 2 — The clinical-use HTML tool (mostly unchanged from v4, with v5 additions)

Single-file HTML, ResultDoctor design language. Sticky navy header. Pathway header with status tags including stale-guideline tag if applicable.

Result entry form with:
- Numeric inputs coloured per Principle 1 (visual flagging based on reference range PLUS pathway logic on top)
- Context dropdowns
- Patient identifier field
- Empty-input handling per Principle 3

Output:
- Result summary chip row at the top — every entered numeric appears, colour-coded
- Primary action card with verbatim quote panel, logic trace, source attribution
- **Conditional cards** for sex-conditional unknowns (Principle 2)
- **Flow diagram with path highlighting** — must use canonical implementation per Requirement E1
- Secondary cards for parallel findings
- Competing-pathway comparison card if applicable
- Copy-for-EMR sticky bar

Engine:
- Follows the mandatory `analyse()` template per Requirement E2
- Test checklist passes per Requirement E3

## PART 3 — The registry entry (unchanged from v4)

```json
{
  "id": "...",
  "title": "...",
  "icb": "...",
  "version": "...",
  "status": "live",
  "tool_path": "....html",
  "trigger_variables": ["..."],
  "trigger_context": ["..."],
  "competing_pathways": ["..."],
  "review_date": "YYYY-MM-DD",
  "review_status": "current | stale | unknown",
  "primary_pattern": "..."
}
```

---

## Critical rules — unchanged

1. Verbatim is sacred
2. Inferred is labelled
3. Gaps are surfaced, never invented
4. Context dependencies from source only
5. Copyright: under 15 words per quote, one quote per source section, attributed
6. No clinical advice generated outside the pathway
7. All three artefacts share the same data model
8. Threshold handling per Principle 1
9. Sex-conditional handling per Principle 2
10. Empty input handled gracefully per Principle 3
11. **NEW:** Flow diagram uses canonical implementation per Requirement E1
12. **NEW:** `analyse()` uses mandatory template per Requirement E2
13. **NEW:** Test checklist passes per Requirement E3
14. **NEW:** Honest gap reporting per Requirement E4

---

## Output format

When given a new pathway PDF:

1. Ask for the source URL if not provided
2. Read the PDF in full
3. Identify all variables, branches, gaps, context dependencies, sex-conditional thresholds, review date status, competing pathways
4. Produce three files (admin HTML, clinical HTML, registry JSON)
5. Run the eight mandatory tests (Requirement E3) and report pass/fail for each
6. List every gap surfaced (Requirement E4)
7. Confirm what needs clinical team input before deployment

---

## Enforceability section (read this first if generating)

If you are an instance of Claude generating a pathway tool from this prompt, your final message MUST contain:

1. The three files (HTML admin, HTML clinical, JSON registry)
2. The completed test checklist with pass/fail for each of the eight tests
3. The honest gap report

If you cannot pass a test, state the failure and propose the fix. Do not declare the build complete.

The two specific failure modes seen in real-world builds before v5:

- **"Always defaults to recommending the most common action when input is sparse"** — caused by a catch-all rule (`if (!result)`) that builds a clinical recommendation. Fix: catch-all must build a no-findings card per Requirement E2 step 5.
- **"Flow diagram has coloured boxes but no arrows between them"** — caused by rewriting the SVG renderer without including edges. Fix: copy `renderFlow` from `lft.html` verbatim per Requirement E1.

If you find yourself writing `if (!result) { result = { priority: 'gp', ... }; }` with a default clinical action, STOP. That's the iron deficiency bug.

If you find yourself writing a new SVG renderer for the flow diagram instead of copying the canonical pattern, STOP. That's the iron deficiency bug.

---

## Version history

- v1: Original — admin tool only
- v2: Sidebar layout, Gaps tab, Context Map, Change Log
- v3: Clinical tool with flow diagram, primary action cards, verbatim quotes, EMR copy, registry JSON
- v4: Threshold handling principles (1+2+3), competing pathways pattern, stale guideline tagging
- **v5 (this version):**
  - Reference implementation requirement for flow diagram (Requirement E1) — copy from `lft.html`, don't reinvent
  - Mandatory `analyse()` template (Requirement E2) — empty-input guard at top, no-findings fallback at bottom, never default to clinical recommendation
  - Mandatory test checklist at end of every build (Requirement E3) — eight tests, each pass/fail with reason
  - Honest gap reporting required (Requirement E4)
  - Enforceability section calling out the two specific failure modes seen in real builds (iron deficiency catch-all, missing arrows)
