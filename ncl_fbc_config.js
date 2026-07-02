// ═══════════════════════════════════════════════════════════════════════
//  ncl_fbc_config.js — single source of truth for NCL Abnormal FBC.
//  RD_NCL_FBC_CONFIG global. Reviewable in the admin Pathways dashboard.
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const cfg = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = cfg;
  if (typeof window !== 'undefined') window.RD_NCL_FBC_CONFIG = cfg;
}(typeof self !== 'undefined' ? self : this, function () {
  const PDF = 'NCL Abnormal FBC primary-care pathway (Final Jan 2023)';
  const LAB = 'Local laboratory reference range — NOT a pathway cut-off (adjust to your lab)';
  return {
    pathwayId: 'ncl_fbc',
    pathwayName: 'NCL Abnormal FBC',
    pathwayVersion: 'Final Jan 2023 · Review Jan 2026',
    thresholds: {
      hbAnaemia: 110, hbSevere: 50, hbLowM: 130, hbLowF: 120,
      mcvLow: 80, mcvHigh: 100, mcvPersist: 105,
      hctPolyM: 0.52, hctPolyF: 0.48, hctUrgentM: 0.60, hctUrgentF: 0.56,
      wccLow: 4, wccHigh: 11,
      neutLow: 1.5, neutMod: 1.0, neutSev: 0.5, neutHigh: 7.5, neutHighUrgent: 50,
      lymphLow: 1.0, lymphHigh: 3.5, lymphHighUrgent: 20,
      eosHigh: 0.5, eosHyper: 1.5, monoHigh: 1.0, monoExtreme: 5.0,
      pltLow: 150, pltSevere: 20, pltHigh: 450, pltExtreme: 1000,
      ferritinLow: 30, ferritinHigh: 150, ferritinVeryHigh: 1000,
      b12Low: 170, folateLow: 3, crpRaised: 30
    },
    meta: {
      hbAnaemia: { label: 'Anaemia (both sexes)', unit: 'g/L', explicit: true, source: PDF },
      hbSevere:  { label: 'Severe anaemia (urgent)', unit: 'g/L', explicit: true, source: PDF },
      hbLowM:    { label: 'Haemoglobin lower limit of normal — male', unit: 'g/L', explicit: false, source: LAB },
      hbLowF:    { label: 'Haemoglobin lower limit of normal — female', unit: 'g/L', explicit: false, source: LAB },
      mcvLow:    { label: 'Microcytosis below', unit: 'fL', explicit: true, source: PDF },
      mcvHigh:   { label: 'Macrocytosis above', unit: 'fL', explicit: true, source: PDF },
      mcvPersist:{ label: 'Persistent macrocytosis above', unit: 'fL', explicit: true, source: PDF },
      hctPolyM:  { label: 'Polycythaemia — male', unit: 'L/L', explicit: true, source: PDF },
      hctPolyF:  { label: 'Polycythaemia — female', unit: 'L/L', explicit: true, source: PDF },
      hctUrgentM:{ label: 'Polycythaemia urgent — male', unit: 'L/L', explicit: true, source: PDF },
      hctUrgentF:{ label: 'Polycythaemia urgent — female', unit: 'L/L', explicit: true, source: PDF },
      wccLow:    { label: 'WCC lower limit of normal', unit: '×10⁹/L', explicit: false, source: LAB },
      wccHigh:   { label: 'WCC upper limit of normal', unit: '×10⁹/L', explicit: false, source: LAB },
      neutLow:   { label: 'Neutropenia below', unit: '×10⁹/L', explicit: true, source: PDF },
      neutMod:   { label: 'Moderate neutropenia below', unit: '×10⁹/L', explicit: true, source: PDF },
      neutSev:   { label: 'Severe neutropenia below', unit: '×10⁹/L', explicit: true, source: PDF },
      neutHigh:  { label: 'Neutrophilia above', unit: '×10⁹/L', explicit: true, source: PDF },
      neutHighUrgent: { label: 'Neutrophilia urgent above', unit: '×10⁹/L', explicit: true, source: PDF },
      lymphLow:  { label: 'Lymphopenia below', unit: '×10⁹/L', explicit: true, source: PDF },
      lymphHigh: { label: 'Lymphocytosis above', unit: '×10⁹/L', explicit: true, source: PDF },
      lymphHighUrgent: { label: 'Lymphocytosis urgent above', unit: '×10⁹/L', explicit: true, source: PDF },
      eosHigh:   { label: 'Eosinophilia above', unit: '×10⁹/L', explicit: true, source: PDF },
      eosHyper:  { label: 'Hypereosinophilia above', unit: '×10⁹/L', explicit: true, source: PDF },
      monoHigh:  { label: 'Monocytosis above', unit: '×10⁹/L', explicit: true, source: PDF },
      monoExtreme: { label: 'Extreme monocytosis above', unit: '×10⁹/L', explicit: true, source: PDF },
      pltLow:    { label: 'Thrombocytopenia below', unit: '×10⁹/L', explicit: true, source: PDF },
      pltSevere: { label: 'Severe thrombocytopenia below', unit: '×10⁹/L', explicit: true, source: PDF },
      pltHigh:   { label: 'Thrombocytosis above', unit: '×10⁹/L', explicit: true, source: PDF },
      pltExtreme:{ label: 'Extreme thrombocytosis above', unit: '×10⁹/L', explicit: true, source: PDF },
      ferritinLow:  { label: 'Iron deficiency — ferritin below', unit: 'µg/L', explicit: true, source: PDF },
      ferritinHigh: { label: 'Ferritin raised above', unit: 'µg/L', explicit: true, source: PDF },
      ferritinVeryHigh: { label: 'Ferritin markedly raised above', unit: 'µg/L', explicit: true, source: PDF },
      b12Low:    { label: 'Low B12 below', unit: 'ng/L', explicit: true, source: PDF },
      folateLow: { label: 'Low folate below', unit: 'µg/L', explicit: true, source: PDF },
      crpRaised: { label: 'CRP raised above', unit: 'mg/L', explicit: true, source: PDF }
    },
    references: {
      hb:    { label: 'Haemoglobin', unit: 'g/L', lowKey: 'hbAnaemia', highKey: null, note: 'anaemia if below (pathway); lab normal ~130 M / 120 F' },
      mcv:   { label: 'MCV', unit: 'fL', lowKey: 'mcvLow', highKey: 'mcvHigh' },
      wcc:   { label: 'WCC', unit: '×10⁹/L', lowKey: 'wccLow', highKey: 'wccHigh' },
      neut:  { label: 'Neutrophils', unit: '×10⁹/L', lowKey: 'neutLow', highKey: 'neutHigh' },
      lymph: { label: 'Lymphocytes', unit: '×10⁹/L', lowKey: 'lymphLow', highKey: 'lymphHigh' },
      eos:   { label: 'Eosinophils', unit: '×10⁹/L', lowKey: null, highKey: 'eosHigh' },
      mono:  { label: 'Monocytes', unit: '×10⁹/L', lowKey: null, highKey: 'monoHigh' },
      plt:   { label: 'Platelets', unit: '×10⁹/L', lowKey: 'pltLow', highKey: 'pltHigh' },
      ferritin: { label: 'Ferritin', unit: 'µg/L', lowKey: 'ferritinLow', highKey: 'ferritinHigh' },
      b12:   { label: 'Vitamin B12', unit: 'ng/L', lowKey: 'b12Low', highKey: null },
      folate:{ label: 'Folate', unit: 'µg/L', lowKey: 'folateLow', highKey: null },
      crp:   { label: 'CRP', unit: 'mg/L', lowKey: null, highKey: 'crpRaised' }
    }
  };
}));
