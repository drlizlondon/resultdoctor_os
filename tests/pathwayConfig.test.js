// ═══════════════════════════════════════════════════════════════════════
//  pathwayConfig tests — plain Node, no framework. Uses the in-memory store
//  (no window/localStorage in Node). Run: node tests/pathwayConfig.test.js
// ═══════════════════════════════════════════════════════════════════════
const assert = require('assert');
const PC = require('../pathwayConfig.js');
const CFG = require('../notts_lft_config.js');

let passed = 0, failed = 0;
function test(name, fn) {
  return Promise.resolve().then(fn).then(
    () => { passed++; console.log('  ok   ' + name); },
    (e) => { failed++; console.log('  FAIL ' + name + '\n         ' + (e && e.message)); }
  );
}

(async function () {
  console.log('\npathwayConfig — effective merge (pure)');
  await test('effective returns master defaults when nothing is published', () => {
    const eff = PC.effective(CFG.thresholds, null);
    assert.strictEqual(eff.alt250, 250);
    assert.strictEqual(eff.fib4High, 3.25);
  });
  await test('published overrides win; unknown/blank keys ignored; values coerced to number', () => {
    const eff = PC.effective(CFG.thresholds, { thresholds: { alt250: '300', fib4High: 3.0, bogus: 9, ferritinHigh: '' } });
    assert.strictEqual(eff.alt250, 300);
    assert.strictEqual(eff.fib4High, 3.0);
    assert.strictEqual('bogus' in eff, false, 'unknown keys are not introduced');
    assert.strictEqual(eff.ferritinHigh, 1000, 'blank override falls back to master');
  });
  await test('effective does not mutate the master defaults object', () => {
    const before = CFG.thresholds.alt250;
    PC.effective(CFG.thresholds, { thresholds: { alt250: 999 } });
    assert.strictEqual(CFG.thresholds.alt250, before);
  });

  console.log('\npathwayConfig — publish / getPublished (in-memory)');
  await test('publish stores a v1 record and getPublished returns it', async () => {
    delete PC._mem['notts_lft'];
    const rec = await PC.publish('notts_lft', Object.assign({}, CFG.thresholds, { alt250: 280 }), 'admin1');
    assert.strictEqual(rec.version, 1);
    const got = await PC.getPublished('notts_lft');
    assert.strictEqual(got.version, 1);
    assert.strictEqual(got.thresholds.alt250, 280);
    assert.strictEqual(got.publishedBy, 'admin1');
  });
  await test('publishing again bumps the version', async () => {
    const rec2 = await PC.publish('notts_lft', Object.assign({}, CFG.thresholds, { alt250: 260 }), 'admin2');
    assert.strictEqual(rec2.version, 2);
    assert.strictEqual((await PC.getPublished('notts_lft')).thresholds.alt250, 260);
  });
  await test('the clinician effective config reflects the latest publish', async () => {
    const pub = await PC.getPublished('notts_lft');
    const eff = PC.effective(CFG.thresholds, pub);
    assert.strictEqual(eff.alt250, 260);          // published value
    assert.strictEqual(eff.fib4High, 3.25);       // untouched key stays at master
  });

  console.log('\n' + (failed ? 'FAILED ' : 'PASSED ') + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})();
