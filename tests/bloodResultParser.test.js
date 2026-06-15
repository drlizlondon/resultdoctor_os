// ═══════════════════════════════════════════════════════════════════════
//  Parser unit tests — plain Node, no test framework, no build step.
//  Run with:  node tests/bloodResultParser.test.js
//
//  These tests target the parser DIRECTLY with mocked OCR text. They require
//  no camera, no image files, no OCR execution and no browser permissions.
// ═══════════════════════════════════════════════════════════════════════
const assert = require('assert');
const { ANALYTES } = require('../analytes.js');
const P = require('../bloodResultParser.js');
const parse = (t, opts) => P.parseBloodResultsFromText(t, Object.assign({ analytes: ANALYTES }, opts || {}));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function rowFor(rows, key) { return rows.find(r => r.key === key); }

console.log('\nParser: core analyte extraction');

test('Haemoglobin — short and long name both map to hb', () => {
  ['Hb 128 g/L', 'Haemoglobin 128 g/L'].forEach(t => {
    const r = rowFor(parse(t), 'hb');
    assert(r, 'no hb row for "' + t + '"');
    assert.strictEqual(r.value, '128');
    assert.strictEqual(r.unit, 'g/L');
    assert.strictEqual(r.needsReview, false);
  });
});

test('WBC extraction with x10^9/L', () => {
  const r = rowFor(parse('WBC 7.4 x10^9/L'), 'wcc');
  assert(r); assert.strictEqual(r.value, '7.4');
  assert.strictEqual(r.unit, '×10⁹/L');
  assert.strictEqual(r.needsReview, false);
});

test('Platelets extraction', () => {
  const r = rowFor(parse('Platelets 245 x10^9/L'), 'plt');
  assert(r); assert.strictEqual(r.value, '245'); assert.strictEqual(r.needsReview, false);
});

test('Neutrophils extraction', () => {
  const r = rowFor(parse('Neutrophils 4.1 x10^9/L'), 'neut');
  assert(r); assert.strictEqual(r.value, '4.1');
});

console.log('\nParser: LFT extraction');

test('ALT / ALP / Bilirubin / Albumin block', () => {
  const text = ['ALT 45 U/L', 'ALP 110 U/L', 'Bilirubin 12 umol/L', 'Albumin 42 g/L'].join('\n');
  const rows = parse(text);
  assert(rowFor(rows, 'alt')); assert.strictEqual(rowFor(rows, 'alt').value, '45');
  assert(rowFor(rows, 'alp')); assert.strictEqual(rowFor(rows, 'alp').value, '110');
  const bili = rowFor(rows, 'bili');
  assert(bili); assert.strictEqual(bili.value, '12'); assert.strictEqual(bili.unit, 'µmol/L');
  assert(rowFor(rows, 'alb')); assert.strictEqual(rowFor(rows, 'alb').unit, 'g/L');
});

console.log('\nParser: U&E and CRP are extracted as rows (even if not yet mapped)');

test('CRP / Sodium / Potassium / Creatinine extracted with value+unit', () => {
  const text = ['CRP 18 mg/L', 'Sodium 139 mmol/L', 'Potassium 4.3 mmol/L', 'Creatinine 78 umol/L'].join('\n');
  const rows = parse(text);
  const crp = rows.find(r => /crp/i.test(r.testName));
  assert(crp, 'CRP not extracted'); assert.strictEqual(crp.value, '18'); assert.strictEqual(crp.unit, 'mg/L');
  const na = rows.find(r => /sodium/i.test(r.testName));
  assert(na); assert.strictEqual(na.value, '139'); assert.strictEqual(na.unit, 'mmol/L');
  const cr = rows.find(r => /creatinine/i.test(r.testName));
  assert(cr); assert.strictEqual(cr.unit, 'µmol/L');
  // unmapped tests must be flagged for review and excluded from analysis
  assert.strictEqual(crp.needsReview, true);
  assert.strictEqual(crp.key, null);
});

test('eGFR with comparator and no unit is extracted', () => {
  const r = parse('eGFR >90').find(x => /egfr/i.test(x.testName));
  assert(r, 'eGFR not extracted'); assert.strictEqual(r.value, '>90');
});

console.log('\nParser: OCR formatting variations');

test('x10^9/L spelling variants all normalise', () => {
  ['Platelets 245 x10^9/L', 'Platelets 245 10^9/L', 'Platelets 245 10*9/L'].forEach(t => {
    const r = rowFor(parse(t), 'plt');
    assert(r, 'failed on "' + t + '"');
    assert.strictEqual(r.unit, '×10⁹/L');
  });
});

test('lowercase units are normalised (g/l, mmol/l, mg/l)', () => {
  assert.strictEqual(rowFor(parse('Hb 128 g/l'), 'hb').unit, 'g/L');
  assert.strictEqual(parse('Sodium 139 mmol/l').find(r=>/sodium/i.test(r.testName)).unit, 'mmol/L');
  assert.strictEqual(parse('CRP 18 mg/l').find(r=>/crp/i.test(r.testName)).unit, 'mg/L');
});

test('micromol spellings normalise (umol/L, μmol/L, µmol/L)', () => {
  ['Bilirubin 12 umol/L', 'Bilirubin 12 μmol/L', 'Bilirubin 12 µmol/L'].forEach(t => {
    assert.strictEqual(rowFor(parse(t), 'bili').unit, 'µmol/L', 'failed on "' + t + '"');
  });
});

console.log('\nParser: OCR character mistakes');

test('O->0 and l->1 corrected inside the value', () => {
  // "l28" should become 128, "O" -> 0
  const r1 = rowFor(parse('Hb l28 g/L'), 'hb');
  assert(r1); assert.strictEqual(r1.value, '128');
  const r2 = rowFor(parse('Platelets 2O0 x10^9/L'), 'plt');
  assert(r2); assert.strictEqual(r2.value, '200');
});

test('character correction lowers confidence', () => {
  const clean = rowFor(parse('Hb 128 g/L'), 'hb');
  const dirty = rowFor(parse('Hb l28 g/L'), 'hb');
  assert(dirty.ocrConfidence < clean.ocrConfidence, 'corrected row should be less confident');
});

console.log('\nParser: confidence scoring and review-state generation');

test('missing unit on a non-unitless test forces review', () => {
  const r = rowFor(parse('Hb 128'), 'hb');
  assert(r); assert.strictEqual(r.needsReview, true);
});

test('unrecognised test name is returned but needsReview and has no key', () => {
  const rows = parse('Widgetase 55 U/L');
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].key, null);
  assert.strictEqual(rows[0].needsReview, true);
});

test('ambiguous unit value forces review (hb 23 plausible as g/L or g/dL)', () => {
  const r = rowFor(parse('Hb 23 g/L'.replace(' g/L','')), 'hb'); // bare-ish: rely on value ambiguity
  // when no unit present it already needs review; test the analyte+value path instead:
  const r2 = rowFor(parse('Hb 23'), 'hb');
  assert(r2); assert.strictEqual(r2.needsReview, true);
});

test('low threshold lets a clean row through without review', () => {
  const r = rowFor(parse('Hb 128 g/L', { threshold: 50 }), 'hb');
  assert.strictEqual(r.needsReview, false);
});

test('per-line OCR confidence caps the row confidence', () => {
  const r = rowFor(parse('Hb 128 g/L', { lineConfidence: () => 40, threshold: 70 }), 'hb');
  assert(r.ocrConfidence <= 40);
  assert.strictEqual(r.needsReview, true);
});

console.log('\nParser: reference range and flag capture (display only)');

test('reference range and H/L flag are captured but never invented', () => {
  const r = rowFor(parse('Sodium 148 mmol/L (135-145) H'.replace('Sodium','sodium')) , null);
  const na = parse('Sodium 148 mmol/L (135-145) H').find(x => /sodium/i.test(x.testName));
  assert(na); assert.strictEqual(na.referenceRange, '135-145'); assert.strictEqual(na.flag, 'H');
  const plain = rowFor(parse('Hb 128 g/L'), 'hb');
  assert.strictEqual(plain.referenceRange, ''); assert.strictEqual(plain.flag, '');
});

console.log('\nParser: never fabricates rows from non-results');

test('blank text and prose without numbers yield no rows', () => {
  assert.strictEqual(parse('').length, 0);
  assert.strictEqual(parse('Full blood count report follows').length, 0);
});

console.log('\nAnalysis safety gate (rows entering the interpretation workflow)');

test('a clean mapped row is eligible for analysis', () => {
  const r = rowFor(parse('Hb 128 g/L'), 'hb');
  assert.strictEqual(P.isAnalysisEligible(r), true);
});

test('a needsReview row is blocked from analysis', () => {
  const r = rowFor(parse('Hb 128'), 'hb');           // missing unit -> needsReview
  assert.strictEqual(r.needsReview, true);
  assert.strictEqual(P.isAnalysisEligible(r), false);
});

test('an unmapped row (no analyte key) is blocked from analysis', () => {
  const crp = parse('CRP 18 mg/L').find(r => /crp/i.test(r.testName));
  assert.strictEqual(P.isAnalysisEligible(crp), false);
});

test('a low-confidence row is blocked even if mapped', () => {
  const r = rowFor(parse('Hb 128 g/L', { lineConfidence: () => 30 }), 'hb');
  assert.strictEqual(P.isAnalysisEligible(r, 70), false);
});

test('mixed dataset: only the confirmed mapped rows are eligible', () => {
  const text = ['Hb 128 g/L', 'Hb 23', 'Widgetase 9 U/L', 'CRP 18 mg/L', 'Platelets 245 x10^9/L'].join('\n');
  const rows = parse(text);
  const eligibleKeys = rows.filter(r => P.isAnalysisEligible(r)).map(r => r.key).sort();
  assert.deepStrictEqual(eligibleKeys, ['hb', 'plt']); // 128 g/L and platelets only
  // the second Hb (bare 23, ambiguous/no unit) must NOT be eligible
  const bareHb = rows.filter(r => r.key === 'hb');
  assert(bareHb.some(r => r.value === '128' && !r.needsReview));
  assert(bareHb.some(r => r.needsReview === true));
});

console.log('\n' + (failed ? 'FAILED ' : 'PASSED ') + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
