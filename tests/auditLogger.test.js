// ═══════════════════════════════════════════════════════════════════════
//  auditLogger tests — plain Node, no framework. Uses the in-memory adapter
//  (no window/localStorage in Node), so no cloud or DOM is required.
//  Run with:  node tests/auditLogger.test.js
// ═══════════════════════════════════════════════════════════════════════
const assert = require('assert');
const audit = require('../auditLogger.js');

let passed = 0, failed = 0;
function test(name, fn) {
  return Promise.resolve().then(fn).then(
    () => { passed++; console.log('  ok   ' + name); },
    (e) => { failed++; console.log('  FAIL ' + name + '\n         ' + (e && e.message)); }
  );
}

(async function () {
  console.log('\nauditLogger — storage mode');
  await test('uses the in-memory adapter under Node (no cloud, no localStorage)', () => {
    assert.strictEqual(audit.storageMode, 'memory');
  });

  console.log('\nRun logging');
  await test('logAnalysisRun shapes a record with id, timestamp, version and defaults', async () => {
    audit._store._reset();
    const rec = await audit.logAnalysisRun({
      testerId: 'tester01', pathwayName: 'Notts LFT', pathwayVersion: 'V37',
      inputValues: { alt: 120 }, displayedResultText: 'Refer', ruleBranchTriggered: 'nafld'
    });
    assert(/^run_/.test(rec.runId));
    assert(rec.timestamp && rec.appVersion);
    assert.strictEqual(rec.mode, 'tester');
    assert.strictEqual(rec.queried, false);
    assert.strictEqual(rec.pathwayVersion, 'V37');
    assert.strictEqual(rec.inputValues.alt, 120);
  });

  await test('historic runs keep the pathway version even after a later version exists', async () => {
    audit._store._reset();
    await audit.logAnalysisRun({ testerId: 't1', pathwayName: 'P', pathwayVersion: 'V1' });
    await audit.logAnalysisRun({ testerId: 't1', pathwayName: 'P', pathwayVersion: 'V2' });
    const runs = await audit.getRuns({ pathwayName: 'P' });
    const versions = runs.map(r => r.pathwayVersion).sort();
    assert.deepStrictEqual(versions, ['V1', 'V2']);
  });

  console.log('\nQueries');
  await test('createResultQuery links to the run and flips queried=true', async () => {
    audit._store._reset();
    const run = await audit.logAnalysisRun({ testerId: 't1', pathwayName: 'P', pathwayVersion: 'V1' });
    const q = await audit.createResultQuery(run.runId, 'ALT branch looks wrong', 't1');
    assert(/^q_/.test(q.queryId));
    assert.strictEqual(q.status, 'new');
    const reloaded = await audit.getRun(run.runId);
    assert.strictEqual(reloaded.queried, true);
    assert.strictEqual(reloaded.queryId, q.queryId);
  });

  await test('getQueries returns only queried runs; getRuns can filter by queried', async () => {
    audit._store._reset();
    const a = await audit.logAnalysisRun({ testerId: 't1', pathwayName: 'P', pathwayVersion: 'V1' });
    await audit.logAnalysisRun({ testerId: 't1', pathwayName: 'P', pathwayVersion: 'V1' }); // unqueried
    await audit.createResultQuery(a.runId, 'issue', 't1');
    assert.strictEqual((await audit.getQueries()).length, 1);
    assert.strictEqual((await audit.getRuns({ queried: true })).length, 1);
    assert.strictEqual((await audit.getRuns({ queried: false })).length, 1);
  });

  await test('updateQueryStatus changes status, stamps reviewedAt and rejects bad status', async () => {
    audit._store._reset();
    const run = await audit.logAnalysisRun({ testerId: 't1', pathwayName: 'P', pathwayVersion: 'V1' });
    const q = await audit.createResultQuery(run.runId, 'issue', 't1');
    const upd = await audit.updateQueryStatus(q.queryId, 'needs_pathway_change', 'confirmed bug', 'admin');
    assert.strictEqual(upd.status, 'needs_pathway_change');
    assert.strictEqual(upd.adminNotes, 'confirmed bug');
    assert.strictEqual(upd.reviewedBy, 'admin');
    assert(upd.reviewedAt);
    await assert.rejects(audit.updateQueryStatus(q.queryId, 'approved'));
  });

  console.log('\nTester accounts + auth');
  await test('create tester, distinct passwords, verify, disable blocks login but keeps history', async () => {
    audit._store._reset();
    await audit.createOrUpdateTester({ testerId: 'tester01', displayName: 'One', password: 'pw-one' }, 'admin');
    await audit.createOrUpdateTester({ testerId: 'tester02', displayName: 'Two', password: 'pw-two' }, 'admin');
    // a run by tester01 (history)
    await audit.logAnalysisRun({ testerId: 'tester01', pathwayName: 'P', pathwayVersion: 'V1' });
    // wrong password fails, right password works, and passwords are not shared
    assert.strictEqual((await audit.verifyTester('tester01', 'pw-two')).ok, false);
    assert.strictEqual((await audit.verifyTester('tester01', 'pw-one')).ok, true);
    // passwords stored hashed, not plaintext
    const t = await audit._store.getTester('tester01');
    assert(t.passwordHash && t.passwordHash !== 'pw-one' && t.passwordHash.length >= 32);
    // disable blocks login, history remains
    await audit.setTesterActive('tester01', false);
    assert.strictEqual((await audit.verifyTester('tester01', 'pw-one')).ok, false);
    assert.strictEqual((await audit.getRuns({ testerId: 'tester01' })).length, 1);
  });

  console.log('\nAdmin auth + privacy scan');
  await test('verifyAdmin uses dev fallback when no config', () => {
    assert.strictEqual(audit.verifyAdmin('admin', 'change-me-before-live'), true);
    assert.strictEqual(audit.verifyAdmin('admin', 'wrong'), false);
  });
  await test('scanForIdentifiers flags NHS-number-like and DOB-like free text', () => {
    assert.strictEqual(audit.scanForIdentifiers('ALT 120, plt 90').flagged, false);
    assert.strictEqual(audit.scanForIdentifiers('nhs 123 456 7890').flagged, true);
    assert.strictEqual(audit.scanForIdentifiers('dob 12/03/1980').flagged, true);
  });

  console.log('\n' + (failed ? 'FAILED ' : 'PASSED ') + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})();
