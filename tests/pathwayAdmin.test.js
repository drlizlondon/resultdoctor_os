// ═══════════════════════════════════════════════════════════════════════
//  Master admin engine tests — plain Node, no framework, no DOM.
//  Run with:  node tests/pathwayAdmin.test.js
//
//  Proves the reusable engine's guarantees: master data is never mutated,
//  edits live on a working copy, the change log records everything, threshold
//  bands edit/add/remove, reset restores, and the passcode gate works.
// ═══════════════════════════════════════════════════════════════════════
const assert = require('assert');
const PathwayAdmin = require('../pathwayAdmin.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n         ' + e.message); }
}

// A representative two-page variable set (the shape any pathway supplies).
function freshConfig() {
  const VARS_P1 = [
    { code: 'ALT', full: 'Alanine Aminotransferase', type: 'enzyme', unit: 'IU/L', normalHigh: null, low: null,
      thresholds: [{ l: 'Normal', c: 'p-n' }, { l: 'Raised — hepatitic pattern', c: 'p-hi' }] },
    { code: 'BMI', full: 'Body Mass Index', type: 'metabolic', unit: 'kg/m²', normalHigh: 25, low: null,
      thresholds: [{ l: 'BMI ≤25', c: 'p-n' }, { l: 'BMI >25 → NAFLD risk', c: 'p-th' }] }
  ];
  const VARS_P2 = [
    { code: 'GGT', full: 'Gamma-Glutamyl Transferase', type: 'enzyme', unit: 'IU/L', normalHigh: null, low: null,
      thresholds: [{ l: 'Normal', c: 'p-n' }] }
  ];
  PathwayAdmin.config({ pin: '2468', pages: [{ prefix: '', vars: VARS_P1 }, { prefix: 'p2_', vars: VARS_P2 }] });
  // reset engine state between tests
  PathwayAdmin._state.wv = {}; PathwayAdmin._state.changes = []; PathwayAdmin._state.adminUnlocked = false; PathwayAdmin._state.mode = 'master';
  return { VARS_P1, VARS_P2 };
}

console.log('\nMaster admin engine');

test('editing a range that was "not set" stores it on the working copy, not master', () => {
  const { VARS_P1 } = freshConfig();
  PathwayAdmin.updateVar('ALT', 'normalHigh', '40');
  assert.strictEqual(PathwayAdmin.workingCopy.ALT.normalHigh, '40');
  assert.strictEqual(PathwayAdmin.effective('ALT').normalHigh, '40');
  assert.strictEqual(VARS_P1[0].normalHigh, null, 'master must remain null');
});

test('change log records the before/after with (not set) for null masters', () => {
  freshConfig();
  PathwayAdmin.updateVar('ALT', 'normalHigh', '40');
  assert.strictEqual(PathwayAdmin.changes.length, 1);
  assert(/ALT — normal high: \(not set\) → 40/.test(PathwayAdmin.changes[0].description), PathwayAdmin.changes[0].description);
});

test('clearing a previously set range removes the override and logs it', () => {
  freshConfig();
  PathwayAdmin.updateVar('ALT', 'normalHigh', '40');
  PathwayAdmin.updateVar('ALT', 'normalHigh', '');
  assert.strictEqual(PathwayAdmin.workingCopy.ALT, undefined, 'empty override should clean up');
  assert(/→ \(cleared\)/.test(PathwayAdmin.changes[1].description));
});

test('editing a band copies-on-write and never mutates the master bands', () => {
  const { VARS_P1 } = freshConfig();
  PathwayAdmin.updateBand('ALT', 1, 'l', 'Raised — initiates hepatic pathway');
  assert.strictEqual(PathwayAdmin.effective('ALT').thresholds[1].l, 'Raised — initiates hepatic pathway');
  assert.strictEqual(VARS_P1[0].thresholds[1].l, 'Raised — hepatitic pattern', 'master band untouched');
});

test('recolouring a band is tracked', () => {
  freshConfig();
  PathwayAdmin.updateBand('ALT', 0, 'c', 'p-th');
  assert.strictEqual(PathwayAdmin.effective('ALT').thresholds[0].c, 'p-th');
  assert(/band 1 colour: "p-n" → "p-th"/.test(PathwayAdmin.changes[0].description));
});

test('adding and removing bands works and is logged', () => {
  freshConfig();
  PathwayAdmin.addBand('ALT');
  assert.strictEqual(PathwayAdmin.effective('ALT').thresholds.length, 3);
  PathwayAdmin.removeBand('ALT', 2);
  assert.strictEqual(PathwayAdmin.effective('ALT').thresholds.length, 2);
  assert(/added a threshold band/.test(PathwayAdmin.changes[0].description));
  assert(/removed band "New band"/.test(PathwayAdmin.changes[1].description));
});

test('reset to master clears all overrides for a variable', () => {
  freshConfig();
  PathwayAdmin.updateVar('ALT', 'normalHigh', '40');
  PathwayAdmin.updateBand('ALT', 0, 'l', 'Edited');
  assert(PathwayAdmin.effective('ALT').changed);
  PathwayAdmin.resetVar('ALT');
  assert.strictEqual(PathwayAdmin.effective('ALT').changed, false);
  assert.strictEqual(PathwayAdmin.effective('ALT').normalHigh, null);
  assert.strictEqual(PathwayAdmin.effective('ALT').thresholds[0].l, 'Normal');
});

test('page-2 variables are addressed by their prefixed key', () => {
  freshConfig();
  PathwayAdmin.updateVar('p2_GGT', 'normalHigh', '55');
  assert.strictEqual(PathwayAdmin.effective('p2_GGT').normalHigh, '55');
  assert(/GGT — normal high/.test(PathwayAdmin.changes[0].description));
});

test('a preset numeric master (BMI=25) shows through until overridden', () => {
  freshConfig();
  assert.strictEqual(PathwayAdmin.effective('BMI').normalHigh, 25);
  PathwayAdmin.updateVar('BMI', 'normalHigh', '30');
  assert.strictEqual(PathwayAdmin.effective('BMI').normalHigh, '30');
  assert(/BMI — normal high: 25 → 30/.test(PathwayAdmin.changes[0].description));
});

console.log('\nSex-specific ranges');

function freshSexConfig() {
  const VARS = [
    { code: 'TSAT', full: 'Transferrin saturation', type: 'metabolic', unit: '%', sexSpecific: true,
      normalHigh: { m: 55, f: 50 }, low: null, thresholds: [{ l: 'Raised → iron overload', c: 'p-hi' }] }
  ];
  PathwayAdmin.config({ pin: '2468', pages: [{ prefix: '', vars: VARS }] });
  PathwayAdmin._state.wv = {}; PathwayAdmin._state.changes = []; PathwayAdmin._state.adminUnlocked = false; PathwayAdmin._state.mode = 'master';
  return { VARS };
}

test('sex-specific master values show through per sex', () => {
  freshSexConfig();
  const eff = PathwayAdmin.effective('TSAT');
  assert.strictEqual(eff.sexSpecific, true);
  assert.strictEqual(eff.normalHigh.m, 55);
  assert.strictEqual(eff.normalHigh.f, 50);
});

test('editing one sex leaves the other and the master intact', () => {
  const { VARS } = freshSexConfig();
  PathwayAdmin.updateVar('TSAT', 'normalHigh', '60', 'm');
  const eff = PathwayAdmin.effective('TSAT');
  assert.strictEqual(eff.normalHigh.m, '60');
  assert.strictEqual(eff.normalHigh.f, 50, 'female untouched');
  assert.strictEqual(VARS[0].normalHigh.m, 55, 'master untouched');
  assert(/TSAT — normal high \(male\): 55 → 60/.test(PathwayAdmin.changes[0].description), PathwayAdmin.changes[0].description);
});

test('clearing a sex override reverts to master and cleans up', () => {
  freshSexConfig();
  PathwayAdmin.updateVar('TSAT', 'normalHigh', '60', 'm');
  PathwayAdmin.updateVar('TSAT', 'normalHigh', '', 'm');
  assert.strictEqual(PathwayAdmin.effective('TSAT').normalHigh.m, 55);
  assert.strictEqual(PathwayAdmin.workingCopy.TSAT, undefined);
});

console.log('\nPasscode gate');

test('correct passcode unlocks, wrong one does not', () => {
  freshConfig();
  assert.strictEqual(PathwayAdmin.unlocked, false);
  assert.strictEqual(PathwayAdmin.tryUnlock('0000'), false);
  assert.strictEqual(PathwayAdmin.unlocked, false);
  assert.strictEqual(PathwayAdmin.tryUnlock('2468'), true);
  assert.strictEqual(PathwayAdmin.unlocked, true);
});

test('a configurable passcode is honoured', () => {
  PathwayAdmin.config({ pin: '9119', pages: [{ prefix: '', vars: [] }] });
  PathwayAdmin._state.adminUnlocked = false;
  assert.strictEqual(PathwayAdmin.tryUnlock('2468'), false);
  assert.strictEqual(PathwayAdmin.tryUnlock('9119'), true);
});

console.log('\n' + (failed ? 'FAILED ' : 'PASSED ') + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
