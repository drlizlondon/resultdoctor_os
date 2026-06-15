// ═══════════════════════════════════════════════════════════════════════
//  ANALYTE CONFIG  —  EDITABLE · REQUIRES CLINICAL SIGN-OFF
// ───────────────────────────────────────────────────────────────────────
//  Single source of truth for the analyte definitions used by:
//    - manual result entry + search bar (index.html)
//    - the camera OCR parser (bloodResultParser.js)
//    - the parser unit tests (tests/bloodResultParser.test.js)
//
//  Each analyte declares:
//    key        canonical short id (also the URL param carried to tools)
//    label      display name
//    unit       canonical unit (what pathway tools expect)
//    aliases    accepted names (lowercase) for the search bar AND OCR parser
//    plausible  [lo, hi] plausible value range IN THE CANONICAL UNIT.
//               Used ONLY to (a) disambiguate units and (b) gently warn —
//               it does NOT make any clinical decision.
//    step       input step for the number field
//    alts       other unit systems a bare number might be in:
//                 unit      label of the alternate unit
//                 factor    multiply by this to convert -> canonical unit
//                 plausible [lo, hi] plausible range IN THE ALTERNATE UNIT
//
//  Disambiguation rule (transparent, no hidden logic):
//    Given a bare number x, collect every unit system whose plausible range
//    contains x. If exactly one  -> use it. If more than one -> ambiguous,
//    ask the clinician. If none   -> accept as canonical but flag a warning.
//
//  The ranges below are sensible defaults from common UK adult reference
//  intervals, provided as a starting point. Review and sign off before
//  clinical use.
// ═══════════════════════════════════════════════════════════════════════
const ANALYTES = {
  // ---- LFTs ----
  bili:  { label:'Bilirubin', unit:'µmol/L', step:'1',   aliases:['bili','bilirubin','tbil','t.bil'],
           plausible:[1, 600],  alts:[{ unit:'mg/dL', factor:17.1, plausible:[0.1, 30] }] },
  alt:   { label:'ALT',       unit:'IU/L',   step:'1',   aliases:['alt','sgpt'],
           plausible:[1, 5000], alts:[] },
  ast:   { label:'AST',       unit:'IU/L',   step:'1',   aliases:['ast','sgot'],
           plausible:[1, 5000], alts:[] },
  alp:   { label:'ALP',       unit:'IU/L',   step:'1',   aliases:['alp','alk phos','alkaline phosphatase','alkphos'],
           plausible:[10, 2000], alts:[] },
  ggt:   { label:'GGT',       unit:'IU/L',   step:'1',   aliases:['ggt','gammagt','gamma gt','gamma-gt'],
           plausible:[5, 3000], alts:[] },
  alb:   { label:'Albumin',   unit:'g/L',    step:'1',   aliases:['alb','albumin'],
           plausible:[10, 60],  alts:[{ unit:'g/dL', factor:10, plausible:[1, 6] }] },
  inr:   { label:'INR',       unit:'ratio',  step:'0.1', aliases:['inr'],
           plausible:[0.8, 12], alts:[] },
  // ---- FBC ----
  hb:    { label:'Haemoglobin', unit:'g/L',  step:'1',   aliases:['hb','haemoglobin','hgb','hb.'],
           plausible:[20, 250], alts:[{ unit:'g/dL', factor:10, plausible:[2, 25] }] },
  mcv:   { label:'MCV',       unit:'fL',     step:'1',   aliases:['mcv'],
           plausible:[50, 150], alts:[] },
  wcc:   { label:'WCC',       unit:'×10⁹/L', step:'0.1', aliases:['wcc','wbc','white cell','white cells','white cell count'],
           plausible:[0.1, 500], alts:[{ unit:'/µL', factor:0.001, plausible:[100, 500000] }] },
  neut:  { label:'Neutrophils', unit:'×10⁹/L', step:'0.1', aliases:['neut','neutrophils','neutrophil','anc'],
           plausible:[0.05, 100], alts:[{ unit:'/µL', factor:0.001, plausible:[50, 100000] }] },
  lymph: { label:'Lymphocytes', unit:'×10⁹/L', step:'0.1', aliases:['lymph','lymphocytes','lymphocyte','lymphs'],
           plausible:[0.05, 100], alts:[{ unit:'/µL', factor:0.001, plausible:[50, 100000] }] },
  plt:   { label:'Platelets', unit:'×10⁹/L', step:'1',   aliases:['plt','platelets','platelet','plat'],
           plausible:[5, 2000], alts:[{ unit:'/µL', factor:0.001, plausible:[5000, 2000000] }] }
};

// ───────────────────────────────────────────────────────────────────────
//  PANEL CONFIG  —  grouping of analytes into collapsible test panels.
//  Adding a new test group = one entry. Adding an analyte = one ANALYTES
//  entry + its key listed in a panel.
// ───────────────────────────────────────────────────────────────────────
const PANELS = [
  { id:'fbc', label:'FBC — full blood count', analytes:['hb','mcv','wcc','neut','lymph','plt'] },
  { id:'lft', label:'LFTs — liver function',  analytes:['bili','alt','ast','alp','ggt','alb','inr'] }
];

// UMD-style export so Node tests can require this file without a build step.
// In the browser these remain plain globals for the inline scripts.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ANALYTES, PANELS };
}
