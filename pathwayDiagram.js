// ═══════════════════════════════════════════════════════════════════════
//  pathwayDiagram.js  —  shared pathway-diagram renderer + highlight
// ───────────────────────────────────────────────────────────────────────
//  This is the NWL Adult Abnormal LFT pathway's diagram behaviour, extracted
//  verbatim so EVERY pathway can repeat it. It is NOT a new visualisation
//  concept — it is the existing reference renderer made reusable.
//
//  Each pathway keeps its OWN diagram (its FLOW_NODES / FLOW_EDGES — the source
//  pathway diagram) and its OWN clinical logic (which produces the active path).
//  This module only takes those and draws the diagram with the active route
//  highlighted and everything else dimmed — exactly as the LFT page does today.
//
//  Contract (unchanged from lft.html renderFlow):
//    nodes  : { id: { x, y, w, h, text, cls, step } }   (step optional)
//    edges  : [ { from, to, label } ]
//    active : activeNodes = [nodeId...], activeEdges = ['from->to'...]
//  A node/edge in the active set is highlighted; if anything is active the
//  rest are dimmed. Styling uses the page's .fn-* CSS classes (the LFT classes).
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PathwayDiagram = api;
}(typeof self !== 'undefined' ? self : this, function () {

  // The section label every pathway must show above its diagram.
  const PATHWAY_PATH_LABEL = 'YOUR PATH THROUGH THE PATHWAY';

  // Wrap a node's text into lines: honour explicit "\n" hard breaks first, then
  // word-wrap each segment to the box width (same heuristic as lft.html).
  function wrapText(text, w) {
    const maxChars = Math.max(6, Math.floor((w - 20) / 5.2));
    const out = [];
    String(text == null ? '' : text).split('\n').forEach(function (segment) {
      const words = segment.split(' ');
      let cur = '';
      words.forEach(function (word) {
        if ((cur + ' ' + word).trim().length > maxChars) { if (cur.trim()) out.push(cur.trim()); cur = word; }
        else cur += ' ' + word;
      });
      if (cur.trim()) out.push(cur.trim());
    });
    return out.length ? out : [''];
  }

  // Render the SVG string for a pathway diagram with the active route highlighted.
  // opts.viewBox defaults to the LFT viewBox; pass each pathway's own.
  function renderPathwayDiagram(nodes, edges, activeNodes, activeEdges, opts) {
    opts = opts || {};
    const viewBox = opts.viewBox || '0 0 900 720';
    const aN = new Set(activeNodes || []);
    const aE = new Set(activeEdges || []);
    const anyActive = !!(activeNodes && activeNodes.length);

    let svg = '<svg viewBox="' + viewBox + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
          '<path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8"/></marker>' +
        '<marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
          '<path d="M 0 0 L 10 5 L 0 10 z" fill="#1859CC"/></marker>' +
      '</defs>';

    // Edges (drawn first so nodes sit on top)
    (edges || []).forEach(function (e) {
      const f = nodes[e.from], t = nodes[e.to];
      if (!f || !t) return;
      const x1 = f.x + f.w / 2, y1 = f.y + f.h;
      const x2 = t.x + t.w / 2, y2 = t.y;
      const edgeKey = e.from + '->' + e.to;
      const active = aE.has(edgeKey);
      const dimmed = anyActive && !active;
      const cls = active ? 'fn-arrow active' : (dimmed ? 'fn-arrow dimmed' : 'fn-arrow');
      const marker = active ? 'url(#arrow-active)' : 'url(#arrow)';
      const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
      svg += '<path class="' + cls + '" d="M ' + x1 + ' ' + y1 + ' Q ' + midX + ' ' + (midY + 10) + ' ' + x2 + ' ' + y2 + '" marker-end="' + marker + '"/>';
      if (e.label) {
        const lblCls = dimmed ? 'fn-label dimmed' : 'fn-label';
        svg += '<text class="' + lblCls + '" x="' + midX + '" y="' + (midY - 4) + '" text-anchor="middle">' + e.label + '</text>';
      }
    });

    // Nodes
    Object.keys(nodes).forEach(function (id) {
      const n = nodes[id];
      const active = aN.has(id);
      const dimmed = anyActive && !active;
      let cls = 'fn-box ' + (n.cls || '');
      if (active) cls += ' active';
      if (dimmed) cls += ' dimmed';
      const textCls = dimmed ? 'fn-text dimmed' : 'fn-text fn-text-bold';
      const stepCls = active ? 'fn-rect-step active' : (dimmed ? 'fn-rect-step dimmed' : 'fn-rect-step');
      svg += '<rect class="' + cls + '" x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="8" ry="8"/>';
      if (n.step) svg += '<text class="' + stepCls + '" x="' + (n.x + 8) + '" y="' + (n.y + 14) + '">' + String(n.step).toUpperCase() + '</text>';
      const lines = wrapText(n.text, n.w);
      const lineH = 13;
      const startY = n.y + (n.h - (lines.length * lineH)) / 2 + 18;
      lines.forEach(function (line, i) {
        svg += '<text class="' + textCls + '" x="' + (n.x + n.w / 2) + '" y="' + (startY + i * lineH) + '" text-anchor="middle">' + line + '</text>';
      });
    });

    svg += '</svg>';
    return svg;
  }

  // Which step labels does the active route pass through? Lets a pathway map its
  // extracted rules to the highlighted diagram steps (and test that mapping).
  function activeSteps(nodes, activeNodes) {
    return (activeNodes || []).map(function (id) { return nodes[id] && nodes[id].step; })
      .filter(function (s) { return !!s; });
  }

  // Full panel HTML with the standard label + legend + collapsible diagram,
  // matching the LFT panel. Pathways may use this or keep their own panel and
  // just call renderPathwayDiagram — but the label must be PATHWAY_PATH_LABEL.
  function renderPathwayPanel(o) {
    o = o || {};
    const svg = renderPathwayDiagram(o.nodes, o.edges, o.activeNodes, o.activeEdges, { viewBox: o.viewBox });
    const legend = o.legend || (
      '<div class="legend-item"><div class="legend-dot" style="background:var(--blue)"></div>Active path</div>' +
      '<div class="legend-item"><div class="legend-dot" style="background:#CBD5E1"></div>Not taken</div>');
    return '' +
      '<div class="flow-diagram-panel">' +
        '<div class="flow-diagram-head">' +
          '<span class="flow-diagram-head-label">' + PATHWAY_PATH_LABEL + '</span>' +
          '<button class="flow-toggle" onclick="toggleFlow(this)">Show diagram &#9662;</button>' +
        '</div>' +
        '<div id="flow-svg-wrap" style="display:none">' +
          '<div class="flow-diagram-svg">' + svg + '</div>' +
          '<div class="flow-legend">' + legend + '</div>' +
        '</div>' +
      '</div>';
  }

  return { PATHWAY_PATH_LABEL, renderPathwayDiagram, renderPathwayPanel, activeSteps, wrapText };
}));
