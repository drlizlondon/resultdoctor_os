// ═══════════════════════════════════════════════════════════════════════
//  nwl_anaemia_config.js — single source of truth for NWL Anaemia.
//  RD_NWL_ANAEMIA_CONFIG global. Reviewable in the admin Pathways dashboard.
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const cfg = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = cfg;
  if (typeof window !== 'undefined') window.RD_NWL_ANAEMIA_CONFIG = cfg;
}(typeof self !== 'undefined' ? self : this, function () {
  const PDF = 'NW London Anaemia pathway (V1, 9 July 2020)';
  return {
    pathwayId: 'nwl_anaemia',
    pathwayName: 'NWL Anaemia',
    pathwayVersion: 'V1 · 9 July 2020',
    thresholds: {
      hbAnaemiaM: 130, hbAnaemiaF: 114,
      mcvIDA: 83.5, ferritinIDAF: 10, ferritinIDAM: 20
    },
    meta: {
      hbAnaemiaM:   { label: 'Anaemia — male (Hb below)', unit: 'g/L', explicit: true, source: PDF + ' (Hb <130 men)' },
      hbAnaemiaF:   { label: 'Anaemia — female (Hb below)', unit: 'g/L', explicit: true, source: PDF + ' (Hb <114 women)' },
      mcvIDA:       { label: 'Iron-deficiency MCV criterion (below)', unit: 'fL', explicit: true, source: PDF + ' (one of three strict IDA criteria)' },
      ferritinIDAF: { label: 'Iron deficiency — female (ferritin below)', unit: 'µg/L', explicit: true, source: PDF + ' (ferritin <10 women)' },
      ferritinIDAM: { label: 'Iron deficiency — male (ferritin below)', unit: 'µg/L', explicit: true, source: PDF + ' (ferritin <20 men)' }
    },
    references: {
      hb:       { label: 'Haemoglobin', unit: 'g/L', lowKeyM: 'hbAnaemiaM', lowKeyF: 'hbAnaemiaF', note: 'anaemia if below' },
      mcv:      { label: 'MCV', unit: 'fL', lowKey: 'mcvIDA', highKey: null, note: 'below supports iron deficiency (with low Hb + ferritin)' },
      ferritin: { label: 'Ferritin', unit: 'µg/L', lowKeyM: 'ferritinIDAM', lowKeyF: 'ferritinIDAF', note: 'iron deficiency if below' }
    }
  };
}));
