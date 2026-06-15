// ═══════════════════════════════════════════════════════════════════════
//  Pathway diagram + highlight tests — plain Node, no framework, no build.
//  Run with:  node tests/pathwayDiagram.test.js
//
//  Proves the LFT highlight behaviour was preserved and is now reusable:
//    - NWL LFT still produces the same active route for given inputs
//    - the same renderer highlights ANOTHER pathway's diagram
//    - extracted rules map to highlighted diagram steps
//    - the highlighted route changes when results / answers change
// ═══════════════════════════════════════════════════════════════════════
const assert = require('assert');
const PD = require('../pathwayDiagram.js');
const { LFT_FLOW_NODES, LFT_FLOW_EDGES, lftActivePath } = require('../pathwayLft.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n         ' + e.message); }
}

// A minimal `d` flag object (what lft.html analyse() builds). Defaults = all false.
function dFlags(over) {
  return Object.assign({
    ggt: null, syntheticFailure: false, malignancy: false, isolatedBili: false,
    gilbertsConfirmed: false, hepaticPattern: false, nafldY: false, isRepeat: false,
    cholestaticPattern: false, alpRaised: false, ggtRaised: false, ggtNormal: false,
    alcoholHigh: false
  }, over || {});
}

console.log('\nShared renderer (pathway-agnostic)');

test('renders an SVG with the active node marked active and others dimmed', () => {
  const svg = PD.renderPathwayDiagram(LFT_FLOW_NODES, LFT_FLOW_EDGES, ['start', 'history'], ['start->history']);
  assert(/<svg/.test(svg) && /<\/svg>/.test(svg));
  assert(/fn-box gp-fill active/.test(svg), 'active node should carry the active class');
  assert(/fn-box [^"]*dimmed/.test(svg), 'non-active nodes should be dimmed');
  assert(/fn-arrow active/.test(svg), 'active edge should be highlighted');
  assert(/marker-end="url\(#arrow-active\)"/.test(svg), 'active edge uses the active marker');
});

test('with no active route nothing is dimmed (plain diagram)', () => {
  const svg = PD.renderPathwayDiagram(LFT_FLOW_NODES, LFT_FLOW_EDGES, [], []);
  assert(!/dimmed/.test(svg), 'empty active set should not dim anything');
});

test('the standard label is exposed and correct', () => {
  assert.strictEqual(PD.PATHWAY_PATH_LABEL, 'YOUR PATH THROUGH THE PATHWAY');
});

console.log('\nAnother pathway reuses the same highlighting behaviour');

// A small, independent second pathway diagram (shape only) to prove the renderer
// is not LFT-specific.
const OTHER_NODES = {
  a: { x: 10, y: 10, w: 120, h: 40, text: 'Anaemia identified', cls: 'start-fill', step: 'Definition' },
  b: { x: 10, y: 80, w: 120, h: 40, text: 'Iron studies', cls: 'gp-fill', step: 'Step 1' },
  c: { x: 10, y: 150, w: 120, h: 40, text: 'Refer GI', cls: 'refer-fill', step: 'Referral' }
};
const OTHER_EDGES = [{ from: 'a', to: 'b' }, { from: 'b', to: 'c', label: 'IDA' }];

test('renderer highlights a non-LFT pathway diagram identically', () => {
  const svg = PD.renderPathwayDiagram(OTHER_NODES, OTHER_EDGES, ['a', 'b'], ['a->b']);
  assert(/fn-box start-fill active/.test(svg));
  assert(/fn-box refer-fill[^"]*dimmed/.test(svg), 'unvisited refer node should be dimmed');
  assert(/Anaemia identified/.test(svg) && /Refer GI/.test(svg), 'source node text is preserved');
});

console.log('\nNWL LFT regression — active route for known inputs');

test('isolated raised bilirubin meeting Gilbert\'s lights the Gilbert\'s route', () => {
  const { activeNodes, activeEdges } = lftActivePath(dFlags({ isolatedBili: true, gilbertsConfirmed: true }));
  assert.deepStrictEqual(activeNodes, ['start', 'history', 'isolatedBili', 'splitBili', 'gilberts']);
  assert(activeEdges.indexOf('splitBili->gilberts') !== -1);
});

test('hepatic pattern with NAFLD lights the NAFLD route', () => {
  const { activeNodes } = lftActivePath(dFlags({ hepaticPattern: true, nafldY: true }));
  assert.deepStrictEqual(activeNodes, ['start', 'history', 'hepatic', 'aetiology', 'nafld']);
});

test('urgent flags take priority over everything', () => {
  const { activeNodes } = lftActivePath(dFlags({ syntheticFailure: true, hepaticPattern: true, cholestaticPattern: true }));
  assert.deepStrictEqual(activeNodes, ['start', 'history', 'urgent', 'urgentAct']);
});

test('cholestatic ALP raised but GGT not yet done stops at the ALP/GGT node', () => {
  const { activeNodes } = lftActivePath(dFlags({ cholestaticPattern: true, alpRaised: true, ggt: null }));
  assert.deepStrictEqual(activeNodes, ['start', 'history', 'alpggt']);
});

test('isolated raised GGT reroutes to the isolated-GGT node', () => {
  const { activeNodes, activeEdges } = lftActivePath(dFlags({ cholestaticPattern: true, ggtRaised: true, alpRaised: false }));
  assert.deepStrictEqual(activeNodes, ['start', 'history', 'isoGGT']);
  assert.deepStrictEqual(activeEdges, ['start->history', 'history->isoGGT']);
});

test('no abnormality lights only the entry nodes', () => {
  const { activeNodes } = lftActivePath(dFlags());
  assert.deepStrictEqual(activeNodes, ['start', 'history']);
});

console.log('\nExtracted rules map to highlighted diagram steps');

test('active node ids resolve to their diagram step labels', () => {
  const { activeNodes } = lftActivePath(dFlags({ hepaticPattern: true, nafldY: true }));
  const steps = PD.activeSteps(LFT_FLOW_NODES, activeNodes);
  assert.deepStrictEqual(steps, ['Start', 'Step 1', 'Step 5', 'Step 5a', 'Step 6']);
});

test('every active node exists in the diagram (no orphan highlight)', () => {
  ['isolatedBili', 'hepatic', 'cholestaticPattern'].forEach(() => {});
  const cases = [
    dFlags({ isolatedBili: true, gilbertsConfirmed: true }),
    dFlags({ cholestaticPattern: true, alpRaised: true, ggtRaised: true }),
    dFlags({ alcoholHigh: true })
  ];
  cases.forEach(d => {
    lftActivePath(d).activeNodes.forEach(id => assert(LFT_FLOW_NODES[id], 'unknown node ' + id));
  });
});

console.log('\nHighlighted route changes when results / answers change');

test('changing the hepatic answer from NAFLD to repeat changes the highlighted route', () => {
  const a = lftActivePath(dFlags({ hepaticPattern: true, nafldY: true })).activeNodes;
  const b = lftActivePath(dFlags({ hepaticPattern: true, isRepeat: true })).activeNodes;
  assert.notDeepStrictEqual(a, b);
  assert(a.indexOf('nafld') !== -1 && a.indexOf('refer2') === -1);
  assert(b.indexOf('refer2') !== -1 && b.indexOf('nafld') === -1);
});

test('changing GGT result moves the cholestatic route between liver and bone branches', () => {
  const liver = lftActivePath(dFlags({ cholestaticPattern: true, alpRaised: true, ggt: 100, ggtRaised: true })).activeNodes;
  const bone = lftActivePath(dFlags({ cholestaticPattern: true, alpRaised: true, ggt: 30, ggtNormal: true })).activeNodes;
  assert(liver.indexOf('alpLiver') !== -1 && liver.indexOf('alpBone') === -1);
  assert(bone.indexOf('alpBone') !== -1 && bone.indexOf('alpLiver') === -1);
});

test('the rendered SVG itself differs when the active route differs', () => {
  const s1 = PD.renderPathwayDiagram(LFT_FLOW_NODES, LFT_FLOW_EDGES, lftActivePath(dFlags({ hepaticPattern: true, nafldY: true })).activeNodes, []);
  const s2 = PD.renderPathwayDiagram(LFT_FLOW_NODES, LFT_FLOW_EDGES, lftActivePath(dFlags({ alcoholHigh: true })).activeNodes, []);
  assert(s1 !== s2, 'different routes must render different SVG');
});

console.log('\n' + (failed ? 'FAILED ' : 'PASSED ') + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
