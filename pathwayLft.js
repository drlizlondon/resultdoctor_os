// ═══════════════════════════════════════════════════════════════════════
//  pathwayLft.js  —  NWL Adult Abnormal LFT pathway: diagram data + rules
// ───────────────────────────────────────────────────────────────────────
//  The reference implementation, extracted so the highlight behaviour is
//  reusable AND testable. This contains ONLY:
//    - LFT_FLOW_NODES / LFT_FLOW_EDGES : the source pathway diagram (verbatim)
//    - lftActivePath(d)                : which nodes/edges the patient's results
//                                        light up (the "rules -> diagram steps"
//                                        mapping, verbatim from analyse())
//  The clinical thresholds that build `d`, and the action cards, stay in
//  lft.html unchanged. This file does not make any new clinical decision.
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.LFT_FLOW_NODES = api.LFT_FLOW_NODES; root.LFT_FLOW_EDGES = api.LFT_FLOW_EDGES; root.lftActivePath = api.lftActivePath; }
}(typeof self !== 'undefined' ? self : this, function () {

  const LFT_FLOW_NODES = {
    start:       { x: 350, y: 30,  w: 220, h: 40,  text: 'Patient has abnormal LFTs', cls: 'gp-fill', step: 'Start' },
    history:     { x: 350, y: 100, w: 220, h: 60,  text: 'Take history: alcohol, BMI/metabolic, drugs, viral hep risk', cls: 'gp-fill', step: 'Step 1' },
    urgent:      { x: 60,  y: 200, w: 220, h: 70,  text: 'Jaundice / low albumin / prolonged INR / weight loss / marked cholestasis', cls: 'urgent-fill', step: 'Urgent' },
    urgentAct:   { x: 60,  y: 310, w: 220, h: 60,  text: '⚡ 2WW hep / jaundice hotline / emergency admission', cls: 'urgent-fill', step: 'Step 2' },
    isolatedBili:{ x: 350, y: 200, w: 200, h: 60,  text: 'Isolated raised bilirubin (other LFTs normal)', cls: 'gp-fill', step: 'Step 3' },
    splitBili:   { x: 350, y: 290, w: 200, h: 50,  text: 'Repeat with split bilirubin + FBC (fasting)', cls: 'gp-fill', step: 'Step 3a' },
    gilberts:    { x: 350, y: 370, w: 200, h: 60,  text: '✓ Gilbert\'s: bili <85, conj <20%, FBC normal', cls: 'noaction-fill', step: 'Step 4' },
    hepatic:     { x: 620, y: 200, w: 220, h: 60,  text: 'Hepatic enzymes raised (ALT or AST)', cls: 'gp-fill', step: 'Step 5' },
    aetiology:   { x: 620, y: 290, w: 220, h: 70,  text: 'Liver aetiology screen + USS', cls: 'gp-fill', step: 'Step 5a' },
    nafld:       { x: 620, y: 410, w: 220, h: 50,  text: 'USS normal/fatty + NAFLD risks → NAFLD pathway', cls: 'amber-fill', step: 'Step 6' },
    refer1:      { x: 620, y: 490, w: 220, h: 50,  text: 'Abnormal USS / +ve screen → refer hepatology', cls: 'refer-fill', step: 'Step 7' },
    refer2:      { x: 360, y: 490, w: 220, h: 50,  text: 'Persistent abnormal ALT/AST → refer hepatology', cls: 'refer-fill', step: 'Step 8' },
    alcohol:     { x: 100, y: 410, w: 180, h: 50,  text: 'Alcohol cause → alcohol guidelines', cls: 'amber-fill', step: 'Step 9' },
    alpggt:      { x: 90,  y: 580, w: 240, h: 50,  text: 'Cholestatic: raised ALP — check GGT', cls: 'gp-fill', step: 'P2 Step 5' },
    alpLiver:    { x: 380, y: 580, w: 200, h: 50,  text: 'GGT raised → liver screen', cls: 'gp-fill', step: 'P2 Step 2' },
    alpBone:     { x: 600, y: 580, w: 220, h: 50,  text: 'GGT normal → bone/drug, Vit D', cls: 'amber-fill', step: 'P2 Step 5b' },
    isoGGT:      { x: 90,  y: 660, w: 240, h: 50,  text: 'Isolated GGT → alcohol/metabolic', cls: 'amber-fill', step: 'P2 Step 6' },
  };

  const LFT_FLOW_EDGES = [
    { from: 'start', to: 'history' },
    { from: 'history', to: 'urgent', label: 'urgent flags' },
    { from: 'history', to: 'isolatedBili', label: 'iso. bili' },
    { from: 'history', to: 'hepatic', label: 'ALT/AST raised' },
    { from: 'history', to: 'alpggt', label: 'ALP raised' },
    { from: 'history', to: 'isoGGT', label: 'iso. GGT' },
    { from: 'history', to: 'alcohol', label: 'alcohol' },
    { from: 'urgent', to: 'urgentAct' },
    { from: 'isolatedBili', to: 'splitBili' },
    { from: 'splitBili', to: 'gilberts', label: 'criteria met' },
    { from: 'hepatic', to: 'aetiology' },
    { from: 'aetiology', to: 'nafld', label: 'fatty + risks' },
    { from: 'aetiology', to: 'refer1', label: 'abn USS / +ve' },
    { from: 'aetiology', to: 'refer2', label: 'persistent' },
    { from: 'alpggt', to: 'alpLiver', label: 'GGT↑' },
    { from: 'alpggt', to: 'alpBone', label: 'GGT normal' },
  ];

  // Verbatim from lft.html analyse(): the priority ladder that lights up the
  // patient's route through the diagram. Depends only on the `d` flags.
  function lftActivePath(d) {
    let activeNodes = ['start', 'history'];
    let activeEdges = ['start->history'];

    if (d.syntheticFailure || d.malignancy) {
      activeNodes.push('urgent', 'urgentAct');
      activeEdges.push('history->urgent', 'urgent->urgentAct');
    } else if (d.isolatedBili) {
      activeNodes.push('isolatedBili', 'splitBili');
      activeEdges.push('history->isolatedBili', 'isolatedBili->splitBili');
      if (d.gilbertsConfirmed) {
        activeNodes.push('gilberts');
        activeEdges.push('splitBili->gilberts');
      }
    } else if (d.hepaticPattern) {
      activeNodes.push('hepatic', 'aetiology');
      activeEdges.push('history->hepatic', 'hepatic->aetiology');
      if (d.nafldY) { activeNodes.push('nafld'); activeEdges.push('aetiology->nafld'); }
      else if (d.isRepeat) { activeNodes.push('refer2'); activeEdges.push('aetiology->refer2'); }
    } else if (d.cholestaticPattern) {
      activeNodes.push('alpggt');
      activeEdges.push('history->alpggt');
      if (d.alpRaised && d.ggt === null) {
        // GGT required for the branch — no further node lights up yet
      } else if (d.alpRaised && d.ggtRaised) {
        activeNodes.push('alpLiver'); activeEdges.push('alpggt->alpLiver');
      } else if (d.alpRaised && d.ggtNormal) {
        activeNodes.push('alpBone'); activeEdges.push('alpggt->alpBone');
      } else if (d.ggtRaised && !d.alpRaised) {
        activeNodes = ['start', 'history', 'isoGGT'];
        activeEdges = ['start->history', 'history->isoGGT'];
      }
    } else if (d.alcoholHigh) {
      activeNodes.push('alcohol');
      activeEdges.push('history->alcohol');
    }
    return { activeNodes: activeNodes, activeEdges: activeEdges };
  }

  return { LFT_FLOW_NODES, LFT_FLOW_EDGES, lftActivePath };
}));
