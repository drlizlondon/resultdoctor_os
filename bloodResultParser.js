// ═══════════════════════════════════════════════════════════════════════
//  bloodResultParser.js  —  OCR-INDEPENDENT blood result parser
// ───────────────────────────────────────────────────────────────────────
//  Converts free OCR text into structured laboratory result rows.
//
//  CLINICAL SAFETY CONTRACT
//    - Never infers a missing value, unit, reference range or test name.
//    - Never interprets results. It only structures what is visibly present.
//    - Rows that are incomplete or low confidence are flagged needsReview
//      and must be excluded from analysis until a human corrects them.
//
//  This module has NO dependency on OCR, the camera, the DOM, or the browser.
//  It is a pure text-in / rows-out function and is unit tested directly with
//  mocked OCR text. The analyte dictionary (aliases/units/ranges) is the same
//  one used by manual entry (analytes.js) — single source of truth.
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.BloodResultParser = api; root.parseBloodResultsFromText = api.parseBloodResultsFromText; }
}(typeof self !== 'undefined' ? self : this, function () {

  // Default confidence threshold (0–100). Rows below this require review.
  const DEFAULT_THRESHOLD = 70;

  // Tests that are legitimately unitless. Missing unit does NOT force review here.
  const UNITLESS = ['egfr', 'inr'];

  // ── OCR character correction (applied to the VALUE token only) ──────────
  //  O/o -> 0, I/l -> 1. Applied to numeric tokens so we never corrupt names.
  function correctNumericToken(tok) {
    let corrected = tok
      .replace(/[Oo]/g, '0')
      .replace(/[Il]/g, '1')
      .replace(/,/g, '');           // strip stray thousands separators
    return corrected;
  }

  // ── Unit normalisation (OCR + casing variants -> canonical form) ────────
  //  Order matters: most specific first.
  function normaliseUnit(raw) {
    if (!raw) return '';
    let u = raw.trim();
    // collapse the many x10^9 spellings
    u = u.replace(/[xX*×]\s*10\s*[\^*]?\s*9\s*\/?\s*[lL]/g, '×10⁹/L');
    u = u.replace(/10\s*[\^*]\s*9\s*\/?\s*[lL]/g, '×10⁹/L');
    u = u.replace(/10\s*9\s*\/\s*[lL]/g, '×10⁹/L');
    // micromol variants
    u = u.replace(/^(u|µ|μ)mol\s*\/?\s*[lL]$/i, 'µmol/L');
    // generic "<x>mol/l" and concentration units -> capital L
    u = u.replace(/mmol\s*\/?\s*[lL]/gi, 'mmol/L');
    u = u.replace(/\bg\s*\/?\s*[lL]\b/gi, 'g/L');
    u = u.replace(/mg\s*\/?\s*[lL]/gi, 'mg/L');
    u = u.replace(/\bg\s*\/?\s*dl\b/gi, 'g/dL');
    u = u.replace(/\bi?u\s*\/?\s*[lL]\b/gi, function (m) { return /i/i.test(m) ? 'IU/L' : 'U/L'; });
    u = u.replace(/\bfl\b/gi, 'fL');
    return u.trim();
  }

  // ── Build an alias -> analyte-key index from the shared config ──────────
  function buildAliasIndex(analytes) {
    const idx = {};
    for (const key in analytes) {
      for (const alias of analytes[key].aliases) idx[alias.toLowerCase()] = key;
    }
    return idx;
  }

  function matchAnalyteKey(name, aliasIndex) {
    const n = name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[:=]+$/, '');
    if (aliasIndex[n]) return aliasIndex[n];
    const ns = n.replace(/\s+/g, '');
    for (const alias in aliasIndex) if (alias.replace(/\s+/g, '') === ns) return aliasIndex[alias];
    return null;
  }

  function inRange(x, range) { return range && x >= range[0] && x <= range[1]; }

  // ── Resolve which unit system a bare number is in (uses shared ranges) ──
  //  Returns { value, unit, converted, status:'single'|'ambiguous'|'none' }
  function resolveUnits(key, x, analytes) {
    const a = analytes[key];
    const candidates = [];
    if (inRange(x, a.plausible)) candidates.push({ unit: a.unit, value: x, converted: false });
    for (const alt of (a.alts || [])) {
      if (inRange(x, alt.plausible)) candidates.push({ unit: alt.unit, value: +(x * alt.factor).toFixed(3), converted: true });
    }
    if (candidates.length === 1) return Object.assign({ status: 'single' }, candidates[0]);
    if (candidates.length > 1) return { status: 'ambiguous', candidates, value: x, unit: a.unit };
    return { status: 'none', value: x, unit: a.unit };
  }

  // Does a token look like a numeric value (after OCR correction)?
  //  Requires a real digit somewhere OR length >= 2, so a lone "l"/"O" inside
  //  a name is never mistaken for the number 1/0.
  function looksNumeric(token) {
    const corrected = correctNumericToken(token);
    if (!/^\d*\.?\d+$/.test(corrected)) return false;
    return /\d/.test(token) || token.length >= 2;
  }
  const COMPARATOR_RE = /^[<>]=?$/;

  // ── Parse a single line into a candidate row (or null) ──────────────────
  //  Whitespace-tokenised: the value is the first token that resolves to a
  //  clean number. Everything before it is the test name; everything after is
  //  the unit / reference range / flag. This keeps OCR character correction
  //  (O->0, l->1) scoped to the value token and never corrupts the name.
  function parseLine(line, ctx) {
    const raw = line.trim();
    if (!raw || !/\d/.test(raw)) return null;        // a result line must contain a digit

    const tokens = raw.split(/\s+/);
    let valueIdx = -1, comparator = '', rawValueTok = '';
    for (let i = 0; i < tokens.length; i++) {
      let tok = tokens[i];
      // a standalone comparator token (">", "<=") attaches to the next value
      if (COMPARATOR_RE.test(tok)) { comparator = tok; continue; }
      const cmpMatch = tok.match(/^([<>]=?)(.*)$/);
      let body = tok;
      if (cmpMatch) { body = cmpMatch[2]; }
      if (looksNumeric(body)) {
        if (cmpMatch) comparator = cmpMatch[1] || comparator;
        valueIdx = i; rawValueTok = body; break;
      }
      comparator = ''; // reset: a non-value token breaks any pending comparator
    }
    if (valueIdx === -1) return null;

    let name = tokens.slice(0, valueIdx).join(' ').replace(/[:=\-]+$/, '').trim();
    let after = tokens.slice(valueIdx + 1).join(' ').trim();
    if (!name || !/[A-Za-z]/.test(name)) return null;  // need a test name with letters

    // Correct OCR character confusions inside the numeric token only.
    const correctedTok = correctNumericToken(rawValueTok);
    const ocrCorrected = correctedTok !== rawValueTok.replace(/,/g, '');
    const valueNum = parseFloat(correctedTok);
    if (isNaN(valueNum)) return null;
    const value = comparator ? comparator + correctedTok : correctedTok;

    // Pull an optional reference range out of the trailing text, e.g. (135-145) or 135 - 145.
    let referenceRange = '';
    const rangeMatch = after.match(/\(?\s*([0-9.]+\s*[-–]\s*[0-9.]+)\s*\)?/);
    if (rangeMatch) { referenceRange = rangeMatch[1].replace(/\s+/g, ''); after = after.replace(rangeMatch[0], ' ').trim(); }

    // Pull an optional abnormal marker (H/L/HH/LL/*). Display only — never trusted for analysis.
    let flag = '';
    const flagMatch = after.match(/(^|\s)(HH|LL|H|L|\*)(\s|$)/);
    if (flagMatch) { flag = flagMatch[2].toUpperCase(); after = after.replace(flagMatch[0], ' ').trim(); }

    // Whatever non-range, non-flag text remains is the unit.
    const unit = normaliseUnit(after);

    return {
      name, value, valueNum, comparator, unit, referenceRange, flag, ocrCorrected,
      lineConfidence: ctx && ctx.lineConfidence ? ctx.lineConfidence(raw) : null
    };
  }

  // ── Compute parse-quality confidence (0–100) for a candidate row ────────
  function scoreRow(cand, key, resolved, analytes) {
    let score = 100;
    if (!key) score -= 55;                                  // unrecognised test name
    const unitlessOk = key && UNITLESS.indexOf(key) !== -1;
    if (!cand.unit && !unitlessOk) score -= 30;             // missing unit
    if (cand.ocrCorrected) score -= 15;                     // needed character correction
    if (key && resolved && resolved.status === 'none') score -= 25;     // implausible for any unit
    if (key && resolved && resolved.status === 'ambiguous') score -= 20; // could be two unit systems
    if (score < 0) score = 0;
    // If OCR supplied a per-line confidence, the row cannot be more confident than the pixels.
    if (cand.lineConfidence != null) score = Math.min(score, cand.lineConfidence);
    return Math.round(score);
  }

  // ═════════════════════════════════════════════════════════════════════
  //  PUBLIC: parseBloodResultsFromText(text, options)
  //    options.analytes   shared analyte dictionary (defaults to global ANALYTES)
  //    options.threshold  confidence threshold (default 70)
  //    options.lineConfidence(rawLine) -> 0..100 optional OCR confidence hook
  //  Returns an array of rows:
  //    { id, testName, key, value, unit, referenceRange, ocrConfidence,
  //      flag, needsReview, converted }
  // ═════════════════════════════════════════════════════════════════════
  function parseBloodResultsFromText(text, options) {
    options = options || {};
    const analytes = options.analytes || (typeof ANALYTES !== 'undefined' ? ANALYTES : null);
    if (!analytes) throw new Error('parseBloodResultsFromText: no analyte dictionary supplied');
    const threshold = options.threshold != null ? options.threshold : DEFAULT_THRESHOLD;
    const aliasIndex = buildAliasIndex(analytes);
    const ctx = { lineConfidence: options.lineConfidence };

    const rows = [];
    const lines = String(text || '').split(/\r?\n/);
    let n = 0;

    for (const line of lines) {
      const cand = parseLine(line, ctx);
      if (!cand) continue;

      const key = matchAnalyteKey(cand.name, aliasIndex);
      const resolved = key ? resolveUnits(key, cand.valueNum, analytes) : null;

      // Prefer the canonical value/unit when the row maps to a known analyte
      // and the unit is unambiguous. Otherwise keep exactly what was read.
      let outValue = cand.value;
      let outUnit = cand.unit;
      let converted = false;
      if (key && resolved && resolved.status === 'single' && !cand.comparator) {
        outValue = String(resolved.value);
        outUnit = resolved.unit;
        converted = resolved.converted;
      }

      const ocrConfidence = scoreRow(cand, key, resolved, analytes);
      const unitlessOk = key && UNITLESS.indexOf(key) !== -1;
      const needsReview =
        ocrConfidence < threshold ||
        !cand.name ||
        cand.valueNum == null || isNaN(cand.valueNum) ||
        (!cand.unit && !unitlessOk) ||
        !key ||
        (resolved && resolved.status === 'ambiguous');

      rows.push({
        id: 'ocr-' + (++n),
        testName: key ? analytes[key].label : cand.name,
        key: key || null,
        value: outValue,
        unit: outUnit,
        referenceRange: cand.referenceRange || '',
        ocrConfidence: ocrConfidence,
        flag: cand.flag || '',
        needsReview: !!needsReview,
        converted: converted
      });
    }
    return rows;
  }

  // ── Analysis safety gate (single definition, used by UI and tests) ──────
  //  A row may flow into the interpretation workflow ONLY if it maps to a
  //  known analyte, is not flagged for review, and clears the confidence
  //  threshold. needsReview rows and unmapped rows are always blocked.
  function isAnalysisEligible(row, threshold) {
    const t = threshold != null ? threshold : DEFAULT_THRESHOLD;
    return !!row && !!row.key && row.needsReview === false && row.ocrConfidence >= t;
  }

  return {
    parseBloodResultsFromText,
    isAnalysisEligible,
    // exposed for unit testing of the internals
    correctNumericToken,
    normaliseUnit,
    buildAliasIndex,
    matchAnalyteKey,
    parseLine,
    DEFAULT_THRESHOLD
  };
}));
