// ═══════════════════════════════════════════════════════════════════════
//  nwl_lft_config.js — single source of truth for NW London Abnormal LFT
//  (mirrors notts_lft_config.js structure; consumed by lft.html + lft_admin.html
//   and reviewable in the admin Pathways dashboard). RD_NWL_LFT_CONFIG global.
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const cfg = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = cfg;
  if (typeof window !== 'undefined') window.RD_NWL_LFT_CONFIG = cfg;
}(typeof self !== 'undefined' ? self : this, function () {
  const PDF = 'NW London Abnormal LFT pathway (V1.6 Oct 2019 / V1.4 Aug 2019)';
  const LAB = 'Local laboratory reference range — NOT stated in the pathway (adjust to your lab)';
  const CRIT = 'Criterion named in the pathway; numeric cut-off NOT stated — inferred standard value';
  return {
    pathwayId: 'nwl_lft',
    pathwayName: 'NW London Abnormal LFT',
    pathwayVersion: 'V1.6 Oct 2019 / V1.4 Aug 2019',
    thresholds: {
      biliULN: 20, altULN: 40, astULN: 40, alpLow: 30, alpULN: 130, ggtULN: 55,
      albLow: 35, albHigh: 50, inrLow: 0.8, inrHigh: 1.2,
      gilbertsBili: 85, gilbertsConjPct: 20
    },
    meta: {
      biliULN:  { label: 'Bilirubin upper limit of normal', unit: 'µmol/L', explicit: false, source: LAB },
      altULN:   { label: 'ALT upper limit of normal', unit: 'IU/L', explicit: false, source: LAB },
      astULN:   { label: 'AST upper limit of normal', unit: 'IU/L', explicit: false, source: LAB },
      alpLow:   { label: 'ALP lower limit of normal', unit: 'IU/L', explicit: false, source: LAB },
      alpULN:   { label: 'ALP upper limit of normal', unit: 'IU/L', explicit: false, source: LAB },
      ggtULN:   { label: 'GGT upper limit of normal', unit: 'IU/L', explicit: false, source: LAB },
      albLow:   { label: 'Albumin low (synthetic failure)', unit: 'g/L', explicit: false, source: CRIT + ' (low albumin = synthetic-failure criterion)' },
      albHigh:  { label: 'Albumin upper limit of normal', unit: 'g/L', explicit: false, source: LAB },
      inrLow:   { label: 'INR lower limit of normal', unit: 'ratio', explicit: false, source: LAB },
      inrHigh:  { label: 'INR prolonged (synthetic failure)', unit: 'ratio', explicit: false, source: CRIT + ' (prolonged INR = synthetic-failure criterion)' },
      gilbertsBili:   { label: "Gilbert's — total bilirubin below", unit: 'µmol/L', explicit: true, source: PDF + " (Gilbert's diagnostic criterion)" },
      gilbertsConjPct:{ label: "Gilbert's — conjugated fraction below", unit: '%', explicit: true, source: PDF + " (Gilbert's diagnostic criterion)" }
    },
    references: {
      bili: { label: 'Bilirubin', unit: 'µmol/L', lowKey: null, highKey: 'biliULN' },
      alt:  { label: 'ALT', unit: 'IU/L', lowKey: null, highKey: 'altULN' },
      ast:  { label: 'AST', unit: 'IU/L', lowKey: null, highKey: 'astULN' },
      alp:  { label: 'ALP', unit: 'IU/L', lowKey: 'alpLow', highKey: 'alpULN' },
      ggt:  { label: 'GGT', unit: 'IU/L', lowKey: null, highKey: 'ggtULN' },
      alb:  { label: 'Albumin', unit: 'g/L', lowKey: 'albLow', highKey: 'albHigh' },
      inr:  { label: 'INR', unit: 'ratio', lowKey: 'inrLow', highKey: 'inrHigh' }
    }
  };
}));
