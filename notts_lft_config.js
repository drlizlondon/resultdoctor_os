// ═══════════════════════════════════════════════════════════════════════
//  notts_lft_config.js — SINGLE SOURCE OF TRUTH for the Notts LFT thresholds
// ───────────────────────────────────────────────────────────────────────
//  Both the clinician tool (notts_lft.html) and its admin page
//  (notts_lft_admin.html) import this. The clinician tool computes its
//  decisions — and prints the normal ranges — from the EFFECTIVE config =
//  these master defaults overridden by whatever Admin has PUBLISHED
//  (pathwayConfig.js). Editing/publishing in admin therefore changes what
//  clinicians see, without forking the numbers.
//
//  `thresholds` — the editable numeric values (decision cut-offs AND the
//                 normal-range bounds for each measured variable).
//  `meta`       — for each threshold: label, unit, source (provenance text),
//                 and explicit=true if the value is stated verbatim in the
//                 guideline, false if it is an inferred / local-lab value.
//  `references` — per measured variable: which threshold keys are its normal
//                 low/high, so the clinician tool can print "normal X–Y" and
//                 flag within / above / below.
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const cfg = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = cfg;
  if (typeof window !== 'undefined') window.RD_NOTTS_LFT_CONFIG = cfg;
}(typeof self !== 'undefined' ? self : this, function () {
  const GUIDELINE = 'Notts V37 guideline (BSG 2017 abnormal liver blood tests; NICE NG49/NG50)';
  const LAB = 'Local laboratory reference range — NOT stated in the guideline (adjust to your lab)';
  const INFERRED = 'Criterion named in the guideline; numeric cut-off NOT stated — inferred standard value';

  return {
    pathwayId: 'notts_lft',
    pathwayName: 'Nottingham & Nottinghamshire Adult Liver Disease (LFT)',
    pathwayVersion: 'V37 · September 2021',

    thresholds: {
      // normal-range bounds for each measured variable
      altULN: 40, astULN: 40, alpLow: 30, alpULN: 130, ggtULN: 55,
      biliULN: 21, albLow: 35, albHigh: 50, inrLow: 0.8, inrHigh: 1.2,
      pltLow: 150, pltHigh: 400, ferritinLow: 30, tsatLow: 20,
      // decision cut-offs
      alpGGTauto: 160, alt250: 250, tsatM: 55, tsatF: 50, ferritinHigh: 1000,
      alcoholM: 50, alcoholF: 35, audit: 19,
      fib4LowU65: 1.3, fib4Low65: 2.0, fib4High: 3.25,
      fibroscanLow: 8, fibroscanHigh: 15, elfRefer: 10.51
    },

    meta: {
      altULN:     { label: 'ALT upper limit of normal', unit: 'IU/L', explicit: false, source: LAB },
      astULN:     { label: 'AST upper limit of normal', unit: 'IU/L', explicit: false, source: LAB },
      alpLow:     { label: 'ALP lower limit of normal', unit: 'U/L', explicit: false, source: LAB },
      alpULN:     { label: 'ALP upper limit of normal', unit: 'U/L', explicit: false, source: LAB },
      ggtULN:     { label: 'GGT upper limit of normal', unit: 'IU/L', explicit: false, source: LAB },
      biliULN:    { label: 'Bilirubin upper limit of normal', unit: 'µmol/L', explicit: false, source: LAB },
      albLow:     { label: 'Albumin lower limit of normal', unit: 'g/L', explicit: false, source: INFERRED + ' (low albumin = synthetic-failure criterion)' },
      albHigh:    { label: 'Albumin upper limit of normal', unit: 'g/L', explicit: false, source: LAB },
      inrLow:     { label: 'INR lower limit of normal', unit: 'ratio', explicit: false, source: LAB },
      inrHigh:    { label: 'INR prolonged (synthetic failure)', unit: 'ratio', explicit: false, source: INFERRED + ' (prolonged INR = synthetic-failure criterion)' },
      pltLow:     { label: 'Platelets lower limit of normal', unit: '×10⁹/L', explicit: false, source: LAB },
      pltHigh:    { label: 'Platelets upper limit of normal', unit: '×10⁹/L', explicit: false, source: LAB },
      ferritinLow:{ label: 'Ferritin lower limit of normal', unit: 'µg/L', explicit: false, source: LAB },
      tsatLow:    { label: 'Transferrin saturation lower limit of normal', unit: '%', explicit: false, source: LAB },
      alpGGTauto: { label: 'ALP at which lab auto-adds GGT', unit: 'U/L', explicit: true, source: GUIDELINE + ' (NUH lab adds GGT when ALP ≥160)' },
      alt250:     { label: 'ALT high-referral threshold (→ ultrasound)', unit: 'IU/L', explicit: true, source: GUIDELINE },
      tsatM:      { label: 'Transferrin saturation raised — male', unit: '%', explicit: true, source: GUIDELINE + ' (>55% male)' },
      tsatF:      { label: 'Transferrin saturation raised — female', unit: '%', explicit: true, source: GUIDELINE + ' (>50% female)' },
      ferritinHigh: { label: 'Ferritin → refer + HFE', unit: 'µg/L', explicit: true, source: GUIDELINE + ' (>1000)' },
      alcoholM:   { label: 'Harmful alcohol — male', unit: 'units/week', explicit: true, source: 'NICE — men >50 units/week' },
      alcoholF:   { label: 'Harmful alcohol — female', unit: 'units/week', explicit: true, source: 'NICE — women >35 units/week' },
      audit:      { label: 'Full AUDIT harmful threshold', unit: 'score', explicit: true, source: 'NICE — full AUDIT >19' },
      fib4LowU65: { label: 'FIB-4 low cut-off (under 65)', unit: 'index', explicit: true, source: GUIDELINE + ' (BSG age-modified)' },
      fib4Low65:  { label: 'FIB-4 low cut-off (65 and over)', unit: 'index', explicit: true, source: GUIDELINE + ' (BSG age-modified)' },
      fib4High:   { label: 'FIB-4 high cut-off (any age → refer)', unit: 'index', explicit: true, source: GUIDELINE + ' (BSG)' },
      fibroscanLow:  { label: 'Fibroscan reassure cut-off', unit: 'kPa', explicit: true, source: GUIDELINE },
      fibroscanHigh: { label: 'Fibroscan refer cut-off', unit: 'kPa', explicit: true, source: GUIDELINE },
      elfRefer:   { label: 'ELF refer cut-off', unit: 'index', explicit: true, source: GUIDELINE + ' (NG49: ELF ≥10.51)' }
    },

    // Measured variable (param key) → its normal-range bounds (threshold keys).
    // highKeyM/highKeyF = sex-specific upper bound.
    references: {
      alt:      { label: 'ALT', unit: 'IU/L', lowKey: null, highKey: 'altULN' },
      ast:      { label: 'AST', unit: 'IU/L', lowKey: null, highKey: 'astULN' },
      alp:      { label: 'ALP', unit: 'U/L', lowKey: 'alpLow', highKey: 'alpULN' },
      ggt:      { label: 'GGT', unit: 'IU/L', lowKey: null, highKey: 'ggtULN' },
      bili:     { label: 'Bilirubin', unit: 'µmol/L', lowKey: null, highKey: 'biliULN' },
      alb:      { label: 'Albumin', unit: 'g/L', lowKey: 'albLow', highKey: 'albHigh' },
      inr:      { label: 'INR', unit: 'ratio', lowKey: 'inrLow', highKey: 'inrHigh' },
      plt:      { label: 'Platelets', unit: '×10⁹/L', lowKey: 'pltLow', highKey: 'pltHigh' },
      ferritin: { label: 'Ferritin', unit: 'µg/L', lowKey: 'ferritinLow', highKey: null, note: 'raised ferritin is commonly fatty liver; >1000 → refer + HFE' },
      tsat:     { label: 'Transferrin saturation', unit: '%', lowKey: 'tsatLow', highKeyM: 'tsatM', highKeyF: 'tsatF' }
    }
  };
}));
