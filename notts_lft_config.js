// ═══════════════════════════════════════════════════════════════════════
//  notts_lft_config.js — SINGLE SOURCE OF TRUTH for the Notts LFT thresholds
// ───────────────────────────────────────────────────────────────────────
//  Both the clinician tool (notts_lft.html) and its admin page
//  (notts_lft_admin.html) import this. The clinician tool computes its
//  decisions from the EFFECTIVE config = these master defaults overridden by
//  whatever the admin has PUBLISHED (see pathwayConfig.js). Editing/publishing
//  in admin therefore changes what clinicians see — without forking the numbers.
//
//  `thresholds` are the editable decision values. `meta` documents each one:
//    label, unit, and explicit=true if the value is stated verbatim in the
//    source guideline (vs a standard lab value not given in the PDF).
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const cfg = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = cfg;
  if (typeof window !== 'undefined') window.RD_NOTTS_LFT_CONFIG = cfg;
}(typeof self !== 'undefined' ? self : this, function () {
  return {
    pathwayId: 'notts_lft',
    pathwayName: 'Nottingham & Nottinghamshire Adult Liver Disease (LFT)',
    pathwayVersion: 'V37 · September 2021',
    thresholds: {
      altULN: 40, alpULN: 130, alpGGTauto: 160, ggtULN: 55, biliULN: 21,
      albLow: 35, inrHigh: 1.2, alt250: 250,
      tsatM: 55, tsatF: 50, ferritinHigh: 1000,
      alcoholM: 50, alcoholF: 35, audit: 19,
      fib4LowU65: 1.3, fib4Low65: 2.0, fib4High: 3.25,
      fibroscanLow: 8, fibroscanHigh: 15, elfRefer: 10.51
    },
    meta: {
      altULN:     { label: 'ALT upper limit of normal', unit: 'IU/L', explicit: false },
      alpULN:     { label: 'ALP upper limit of normal', unit: 'U/L', explicit: false },
      alpGGTauto: { label: 'ALP at which lab auto-adds GGT', unit: 'U/L', explicit: true },
      ggtULN:     { label: 'GGT upper limit of normal', unit: 'IU/L', explicit: false },
      biliULN:    { label: 'Bilirubin upper limit of normal', unit: 'µmol/L', explicit: false },
      albLow:     { label: 'Albumin low (synthetic failure)', unit: 'g/L', explicit: false },
      inrHigh:    { label: 'INR prolonged (synthetic failure)', unit: 'ratio', explicit: false },
      alt250:     { label: 'ALT high-referral threshold (→ ultrasound)', unit: 'IU/L', explicit: true },
      tsatM:      { label: 'Transferrin saturation raised — male', unit: '%', explicit: true },
      tsatF:      { label: 'Transferrin saturation raised — female', unit: '%', explicit: true },
      ferritinHigh: { label: 'Ferritin → refer + HFE', unit: 'µg/L', explicit: true },
      alcoholM:   { label: 'Harmful alcohol — male', unit: 'units/week', explicit: true },
      alcoholF:   { label: 'Harmful alcohol — female', unit: 'units/week', explicit: true },
      audit:      { label: 'Full AUDIT harmful threshold', unit: 'score', explicit: true },
      fib4LowU65: { label: 'FIB-4 low cut-off (under 65)', unit: 'index', explicit: true },
      fib4Low65:  { label: 'FIB-4 low cut-off (65 and over)', unit: 'index', explicit: true },
      fib4High:   { label: 'FIB-4 high cut-off (any age → refer)', unit: 'index', explicit: true },
      fibroscanLow:  { label: 'Fibroscan reassure cut-off', unit: 'kPa', explicit: true },
      fibroscanHigh: { label: 'Fibroscan refer cut-off', unit: 'kPa', explicit: true },
      elfRefer:   { label: 'ELF refer cut-off', unit: 'index', explicit: true }
    }
  };
}));
