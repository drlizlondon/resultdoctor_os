// ═══════════════════════════════════════════════════════════════════════
//  ncl_iron_deficiency_config.js — single source of truth for NCL Adult Iron
//  Deficiency. RD_NCL_IRON_DEFICIENCY_CONFIG global. Reviewable in admin.
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const cfg = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = cfg;
  if (typeof window !== 'undefined') window.RD_NCL_IRON_DEFICIENCY_CONFIG = cfg;
}(typeof self !== 'undefined' ? self : this, function () {
  const PDF = 'NCL Adult Iron Deficiency primary-care pathway (Final Aug 2022)';
  return {
    pathwayId: 'ncl_iron_deficiency',
    pathwayName: 'NCL Adult Iron Deficiency',
    pathwayVersion: 'Final Aug 2022',
    thresholds: {
      hbAnaemiaM: 130, hbAnaemiaF: 120, hbMarked: 100, hbMarkedM: 120,
      ferritinLow: 30, ferritinAbsent: 15, mcvLow: 80
    },
    meta: {
      hbAnaemiaM:    { label: 'Anaemia — male (Hb below)', unit: 'g/L', explicit: true, source: PDF + ' (men <130)' },
      hbAnaemiaF:    { label: 'Anaemia — female (Hb below)', unit: 'g/L', explicit: true, source: PDF + ' (non-pregnant women <120)' },
      hbMarked:      { label: 'Investigate more urgently — postmenopausal women (Hb below)', unit: 'g/L', explicit: true, source: PDF + ' (postmenopausal women <100)' },
      hbMarkedM:     { label: 'Investigate more urgently — men (Hb below)', unit: 'g/L', explicit: true, source: PDF + ' (men <120)' },
      ferritinLow:   { label: 'Low iron stores (ferritin below)', unit: 'µg/L', explicit: true, source: PDF + ' (<30 low body iron stores)' },
      ferritinAbsent:{ label: 'Absent iron stores (ferritin below)', unit: 'µg/L', explicit: true, source: PDF + ' (<15 absent stores)' },
      mcvLow:        { label: 'Microcytosis (MCV below)', unit: 'fl', explicit: true, source: PDF + ' (<80)' }
    },
    references: {
      hb:       { label: 'Haemoglobin', unit: 'g/L', lowKeyM: 'hbAnaemiaM', lowKeyF: 'hbAnaemiaF', note: 'anaemia if below; investigate more urgently men <120 / postmenopausal women <100' },
      mcv:      { label: 'MCV', unit: 'fl', lowKey: 'mcvLow', highKey: null, note: 'microcytosis below' },
      ferritin: { label: 'Ferritin', unit: 'µg/L', lowKey: 'ferritinLow', highKey: null, note: 'low iron stores below; absent stores <15' }
    }
  };
}));
