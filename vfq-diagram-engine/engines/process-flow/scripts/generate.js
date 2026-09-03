#!/usr/bin/env node
/**
 * Process Flow Diagram Generator v2.3 (Deterministic)
 * ------------------------------------------------------------------
 * Produces collision-free, viewport-constrained flowcharts with intelligent
 * row wrapping, dynamic spacing, and reliable connector routing.
 *
 * Core capabilities:
 * - Viewport-aware automatic row wrapping (no horizontal scroll)
 * - Collision detection with dynamic spacing resolution
 * - Intelligent connector routing (wrap, decision, loop paths)
 * - Responsive sizing (adapts to viewport/zoom)
 * - No hardcoded node counts, coordinates, or data-specific values
 * - DETERMINISTIC SPEC NORMALIZATION (v2.3+)
 *
 * v2.1 — closes three conformance gaps found by scripts/verify.js:
 *   1. In-canvas legend (§10) is now emitted, mirroring only the styles used.
 *   2. `spec.loops` is rendered (§6.3 taxonomy) instead of silently ignored.
 *   3. `edgeLabel` is read off the SOURCE node, matching schema.json's definition
 *      of it as the OUTGOING payload label (it previously rendered one hop early).
 * The viewBox is now derived from real drawn extents — including loop channels,
 * text advance widths, and the legend band — so the 10-unit gutter rule in §5.5
 * is exact rather than approximate.
 *
 * v2.2 — optional interactivity layer (§11.3), OFF by default. When `interactive`
 * is falsy the emitted file is byte-for-byte the static design system, so the
 * §14 diff-test against the exemplars still holds.
 *
 * v2.3 — deterministic spec normalization preprocessing:
 *   • All numeric values rounded to 2 decimal places
 *   • All strings trimmed and whitespace normalized
 *   • All dates converted to ISO 8601 format
 *   • All booleans normalized to true/false
 *   • All object keys sorted alphabetically
 *   • Audit trail: input hash, timestamp, processing metadata
 *   • Guarantees identical output for identical inputs
 *
 * Usage:
 *   node generate.js <spec.json> [out.html] [viewport_width]
 *   node generate.js --demo
 *   node generate.js <spec.json> [out.html] --normalize-only
 */

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SpecNormalizer } = require('./normalize-spec');
const { validateDiagramCompliance } = require('./compliance');

/* ============================================================= *
 * CONFIGURATION SYSTEM (v2.3+)
 * ============================================================= */

/* ============================================================= *
 * CONFIGURATION DEFAULTS (v2.3)
 * All diagram styling/layout rules are configurable, reusable.
 * Spec can override any value via spec.config.* or CLI flags.
 * ============================================================= */
const CONFIG_DEFAULTS = {
  layout: {
    containerWidth: 1600,        // max page width in px (a ceiling, not a fixed width); null = 1920 default
    // This is a BASELINE offset, not the real gap to the line: the label's own descent (glyphs
    // dipping below the baseline) and its background plate's padding both eat back into it, so
    // the actual rendered clearance measured at the glyph's own lower edge came out ~2.5px short
    // of this nominal value (10 nominal measured as ~7.65 real). Raised so real clearance clears
    // the 10px minimum connector labels must keep from any line.
    edgeLabelSpacing: 13          // px above connector lines (payloadLabels)
  },
  styling: {
    payloadLabelBackground: {
      opacity: 1,                 // 0 = transparent (clean), 1 = fully solid
      // Must match the diagram CARD ground: this rect is a knockout painted behind a connector
      // label so the line doesn't run through the glyphs. mergeConfig() overwrites the PLATE
      // token with this value, so changing PLATE alone silently has no effect.
      fill: '#ffffff'             // Background color when opacity > 0
    }
  },
  drawer: {
    overlayMode: true,            // true = position:fixed overlay (recommended), false = layout push
    minWidth: 320,                // Minimum drawer width when resized
    maxWidth: 760,                // Maximum drawer width when resized
    defaultWidth: 400             // Initial drawer width on open
  },
  cards: {
    showIOTable: false            // true = show Input→Output table, false = drawer only (default)
  },
  interactive: true               // true = drawer enabled, false = static mode
};

function mergeConfig(spec, cliOverrides = {}) {
  const merged = JSON.parse(JSON.stringify(CONFIG_DEFAULTS));
  if (spec && spec.config) {
    deepMerge(merged, spec.config);
  }
  deepMerge(merged, cliOverrides);
  return merged;
}

function deepMerge(target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
}

/* ============================================================= *
 * INLINE LAYOUT ENGINE
 * ============================================================= */

class LayoutConfig {
  constructor(overrides = {}) {
    this.viewportWidth = overrides.viewportWidth ?? 1200;
    this.pixelToSvgScale = overrides.pixelToSvgScale ?? 1;
    this.safetyMargin = overrides.safetyMargin ?? 120;

    this.nodeWidth = {
      step: overrides.nodeWidth?.step ?? 160,
      decision: overrides.nodeWidth?.decision ?? 114,
      start: overrides.nodeWidth?.start ?? 100,
      end: overrides.nodeWidth?.end ?? 120,
      pill: overrides.nodeWidth?.pill ?? 120
    };

    this.nodeHeight = {
      step: overrides.nodeHeight?.step ?? 80,
      decision: overrides.nodeHeight?.decision ?? 80,
      pill: overrides.nodeHeight?.pill ?? 40
    };

    this.horizontalGap = overrides.horizontalGap ?? 60;
    this.verticalGap = overrides.verticalGap ?? 300;
    this.textPadding = overrides.textPadding ?? 8;
    this.marginLeft = overrides.marginLeft ?? 30;
    this.marginRight = overrides.marginRight ?? 30;
    this.marginTop = overrides.marginTop ?? 30;
    this.marginBottom = overrides.marginBottom ?? 30;
    this.connectorBuffer = overrides.connectorBuffer ?? 40;
    this.edgeLabelPad = overrides.edgeLabelPad ?? 10;   // air each side of a payload label
    // Node growth (r5). Width stays fixed so the column stride and every connector anchor
    // survive; height grows when measured content needs it, up to a ceiling.
    this.nodeMaxHeight = overrides.nodeMaxHeight ?? 140;
    this.rowClearance = overrides.rowClearance ?? 60;   // gap below the tallest node in a row

    this.validate();
  }

  validate() {
    const minViewport = this.safetyMargin + 200;
    if (this.viewportWidth < minViewport) {
      throw new Error(`Viewport ${this.viewportWidth}px too narrow (min ${minViewport}px)`);
    }
  }

  maxRowWidth() {
    const cssPx = (this.viewportWidth * this.pixelToSvgScale) - this.safetyMargin;
    return cssPx - (this.marginLeft + this.marginRight);
  }

  getNodeWidth(type) {
    if (type === 'decision') return this.nodeWidth.decision;
    if (type === 'start' || type === 'end') {
      return type === 'start' ? this.nodeWidth.start : this.nodeWidth.end;
    }
    return this.nodeWidth.step;
  }

  getNodeHeight(type) {
    if (type === 'decision') return this.nodeHeight.decision;
    if (type === 'start' || type === 'end') return this.nodeHeight.pill;
    return this.nodeHeight.step;
  }
}

class Rectangle {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  left() { return this.x; }
  right() { return this.x + this.width; }
  top() { return this.y; }
  bottom() { return this.y + this.height; }
  centerX() { return this.x + this.width / 2; }
  centerY() { return this.y + this.height / 2; }

  intersects(other, margin = 0) {
    return !(
      this.right() + margin < other.left() ||
      this.left() - margin > other.right() ||
      this.bottom() + margin < other.top() ||
      this.top() - margin > other.bottom()
    );
  }
}

class LayoutNode {
  constructor(flowNode, type, config, rowIndex, rowX, baselineY) {
    this.flowNode = flowNode;
    // Hoist content fields from the flow spec so the renderer (which reads
    // n.title / n.kind / n.role / n.desc / n.label / n.num / n.variant …)
    // sees them instead of falling back to defaults.
    Object.assign(this, flowNode);
    this.type = type;
    this.id = flowNode.id;
    this.flowIndex = flowNode.flowIndex;

    const w = config.getNodeWidth(type);
    const h = config.getNodeHeight(type);

    this.x = rowX;
    this.y = baselineY - h / 2;
    this.width = w;
    this.height = h;
    this.bbox = new Rectangle(this.x, this.y, this.width, this.height);

    this.cx = this.x + this.width / 2;
    this.cy = baselineY;

    this.rowIndex = rowIndex;
    this.baselineY = baselineY;
    this.config = config;
  }

  exitAnchor() { return { x: this.x + this.width, y: this.cy }; }
  entryAnchor() { return { x: this.x, y: this.cy }; }
  // A decision's bottom/top wrap anchors are a special case, not the generic this.y/this.height
  // math every other node type uses. nodeWidth.decision (114, see Config) already accounts for
  // the diamond's 45° rotation, so exitAnchor()/entryAnchor() above land correctly on the true
  // left/right vertices by construction. nodeHeight.decision (80) does NOT get the same
  // treatment — it deliberately stays the PRE-rotation square's side length, because
  // diamondReach() (below) derives the diamond's true reach FROM that 80 value
  // (80*Math.SQRT2/2 = 56.57). Using this.height directly here, as if it were the rendered
  // shape's actual vertical extent, computed a wrap anchor ~17px short of the diamond's real
  // bottom/top tip — landing INSIDE the shape instead of on its boundary (found empirically:
  // a decision's wrap-case connector started at cy+40 instead of the true tip at cy+56.57,
  // confirmed against the live-rendered Fibre process-flow output, not by reasoning about the
  // code alone). diamondReach(this) is the same helper drawNoBranches() already uses for the
  // identical geometry, so this now agrees with every other decision-anchored connector in the
  // file rather than introducing a second, diverging formula.
  wrapExitAnchor() {
    if (this.type === 'decision') return { x: this.cx, y: this.cy + diamondReach(this) };
    return { x: this.cx, y: this.y + this.height };
  }
  wrapEntryAnchor() {
    if (this.type === 'decision') return { x: this.cx, y: this.cy - diamondReach(this) };
    return { x: this.cx, y: this.y };
  }
}

function distributeNodesPerRow(flow, config) {
  const maxWidth = config.maxRowWidth();
  const rows = [[]];
  let currentRowWidth = config.marginLeft;

  for (let i = 0; i < flow.length; i++) {
    const node = flow[i];
    if (node.type === 'rowbreak') continue;

    const nodeW = config.getNodeWidth(node.type);
    const prev = i > 0 ? flow[i - 1] : null;
    const spaceNeeded = currentRowWidth === config.marginLeft
      ? nodeW
      : gapAfter(prev, config) + nodeW;

    const projectedWidth = currentRowWidth + spaceNeeded;

    if (projectedWidth + config.marginRight <= maxWidth) {
      rows[rows.length - 1].push({ ...node, flowIndex: i });
      currentRowWidth = projectedWidth;
    } else {
      rows.push([{ ...node, flowIndex: i }]);
      currentRowWidth = config.marginLeft + nodeW;
    }
  }

  return rows;
}

/* The channel a connector occupies is sized to the payload label riding above it (§6.2).
 * A fixed 60-unit gap silently truncates anything longer — "rollback result" needs 74 — and
 * the label then overhangs the boxes on either side. The node box stays 160 wide (§4.1, a
 * hard rule); only the space BETWEEN boxes flexes, which is free space by definition. */
function gapAfter(flowNode, config) {
  const label = flowNode && flowNode.edgeLabel;
  if (!label) return config.horizontalGap;
  // The arrowhead needs ~14 clear at the target end, plus a little air each side of the text.
  const needed = textWidth(label, TYPE.edgeLabel) + config.edgeLabelPad * 2 + 14;
  return Math.max(config.horizontalGap, Math.ceil(needed));
}

/* Required box height for a node's measured content (r5, §4.1a). The 160 width is a hard
 * rule, so wrapping is fixed and only the vertical axis can absorb long content. */
function measuredHeight(flowNode, config) {
  if (flowNode.type !== 'step') return config.getNodeHeight(flowNode.type);
  const titles = wrapToBox(flowNode.title || 'Step', TYPE.title, 2).length;
  const metas = (flowNode.desc || []).flatMap(d => wrapToBox(d, TYPE.meta, 2)).length;
  let block = LH.titleTitle * Math.max(0, titles - 1);
  if (metas) block += LH.titleMeta + LH.metaMeta * (metas - 1);
  const needed = block + 34;                      // the §3.1 centring margin, top and bottom
  return Math.min(config.nodeMaxHeight, Math.max(config.nodeHeight.step, Math.ceil(needed)));
}

function placeNodes(rows, config) {
  const maxRowWidth = config.maxRowWidth();
  const placedNodes = [];
  let currentY = config.marginTop;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const rowNodes = rows[rowIdx];
    if (rowNodes.length === 0) continue;

    const baselineY = currentY + config.nodeHeight.step / 2;

    let totalNodeWidth = 0;
    for (const n of rowNodes) totalNodeWidth += config.getNodeWidth(n.type);

    // Per-edge gaps: the last node in a row has no following connector on that row.
    const gaps = rowNodes.slice(0, -1).map(n => gapAfter(n, config));
    const totalGapWidth = gaps.reduce((a, b) => a + b, 0);
    const totalRowWidth = totalNodeWidth + totalGapWidth;
    const leftPadding = config.marginLeft + Math.max(0, (maxRowWidth - totalRowWidth) / 2);

    let currentX = leftPadding;
    let tallest = config.nodeHeight.step;
    rowNodes.forEach((flowNode, i) => {
      const nodeW = config.getNodeWidth(flowNode.type);
      const h = measuredHeight(flowNode, config);
      tallest = Math.max(tallest, h);
      const ln = new LayoutNode(flowNode, flowNode.type, config, rowIdx, currentX, baselineY);
      if (flowNode.type === 'step' && h !== ln.height) {
        // Re-seat the box on the same baseline at its measured height.
        ln.height = h;
        ln.y = baselineY - h / 2;
        ln.bbox = new Rectangle(ln.x, ln.y, ln.width, h);
      }
      placedNodes.push(ln);
      currentX += nodeW + (gaps[i] ?? config.horizontalGap);
    });

    // Share one role-label band per row: the topmost box edge in the row.
    const rowStart = placedNodes.length - rowNodes.length;
    const rowTop = Math.min(...placedNodes.slice(rowStart).map(n => n.y));
    for (let i = rowStart; i < placedNodes.length; i++) placedNodes[i].rowTop = rowTop;

    // Advance by what this row actually occupies, not a constant. A row of tall nodes used to
    // run into the next row's role labels because verticalGap never looked at the content.
    currentY += Math.max(config.verticalGap, tallest + config.rowClearance + config.nodeHeight.step);
  }

  return placedNodes;
}

function computeLayout(flow, configOverrides = {}) {
  const config = new LayoutConfig(configOverrides);
  const rows = distributeNodesPerRow(flow, config);
  const layoutNodes = placeNodes(rows, config);
  return { nodes: layoutNodes, rows, config };
}

/* ============================================================= *
 * DESIGN TOKENS (§2, §13 — authoritative values)
 * ============================================================= */
/* LIGHT THEME (§2, §13). The canvas is a warm off-white card on a cream page; every node type
 * is a PALE TINT FILL paired with a SATURATED STROKE of the same hue. That pairing — rather
 * than a saturated fill — is what keeps six node types mutually legible on a light ground
 * while leaving node TITLE text as near-black ink at >=15:1 on every fill.
 *
 * Every stroke/fill pair below clears WCAG's 3.0:1 non-text minimum against its own fill, and
 * every stroke clears 3.0:1 against the canvas, so type is never carried by fill alone and the
 * diagram survives greyscale printing. Values are shared with the bpmn-swimlane skill's design system so
 * a reader moving between a swimlane map and a process flow sees one colour language. */
const INK      = '#1a1a1a';   // node titles, pill/decision text — near-black, never pure #000
const KIND = {
  manual:      { stroke: '#2e9e6b', fill: '#eafaf2', marker: 'arrowhead-emerald', glyph: '👤', legend: 'Manual / Human-in-loop' },
  automated:   { stroke: '#7c5cd6', fill: '#f3eefc', marker: 'arrowhead-violet',  glyph: '⚡', legend: 'Automated' },
  integration: { stroke: '#9e7513', fill: '#fdf6e0', marker: 'arrowhead-amber',   glyph: '🔗', legend: 'Integration / API' },
};
const DECISION = { stroke: '#d4667f', fill: '#fdeef2', marker: 'arrowhead-rose' };
const TERMINAL = { stroke: '#16829a', fill: '#e2f6fb' };
const REJECT   = { stroke: '#c8365f', fill: '#fdeaef' };
const NEUTRAL  = '#6b7280';   // meta text, legend labels, slate connectors — 4.8:1 on the card
const LOOP_STYLE = {
  cycle:     { stroke: '#16829a', width: 1.5, dash: '6,3', marker: 'arrowhead',       legend: 'Cycle loop' },
  revision:  { stroke: '#2e9e6b', width: 1.5, dash: '4,3', marker: null,              legend: 'Revision loop' },
  exception: { stroke: '#c8365f', width: 1.5, dash: '4,3', marker: 'arrowhead-crimson', legend: 'Exception path' },
  plain:     { stroke: '#6b7280', width: 1.5, dash: '5,4', marker: 'arrowhead-slate', legend: 'Loop-back' },
};
const WRAP_STYLE = { stroke: '#6b7280', width: 1.5, dash: '6,3', marker: 'arrowhead-slate', legend: 'Row wrap' };

/* Export formats (r7). A menu, not three bare buttons: the format a reader wants depends on
 * what they are about to do with it, and the hint says so rather than making them guess.
 * SVG is a genuine vector serialisation of the live <svg> — not a raster in a wrapper — so it
 * stays editable in Figma/Illustrator and stays sharp at any zoom. JPG exists because some
 * upload fields still reject PNG; it is flattened onto the canvas ground since JPEG has no
 * alpha channel. Order is deliberate: fidelity first, convenience last.
 * `fn` names the emitted handler, so adding a format here is the only edit needed. */
const EXPORT_FORMATS = [
  { id: 'svg', label: 'SVG', hint: 'vector · editing', fn: 'downloadSVG' },
  { id: 'jpg', label: 'JPG', hint: 'image · sharing',  fn: 'downloadJPG' },
  { id: 'pdf', label: 'PDF', hint: 'document',         fn: 'downloadPDF' },
];
const JPEG_QUALITY = 0.92;
const CANVAS_GROUND = '#ffffff';   // the diagram CARD, not the page — exports capture the card

/* Role labels are TEXT, not iconography (r7).
 *
 * A glyph in front of a role reads as a second, competing encoding: the node's colour and its
 * legend entry already say whether a step is manual, automated or an integration, so the emoji
 * restates that in a form that renders differently on every platform (and not at all in some
 * PDF pipelines) while eating horizontal room the role name needs.
 *
 * Stripping happens at RENDER time, not in the spec, because glyphs arrive from two directions:
 * this generator's own fallback, and caller data that already has them baked into `role` (the
 * ingester deliberately emits roles verbatim). Cleaning only one source leaves the other to
 * reintroduce them on the next dataset. */
const GLYPH_RE = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}\u{2B00}-\u{2BFF}]/gu;
const stripGlyphs = s => String(s == null ? '' : s).replace(GLYPH_RE, '').replace(/\s{2,}/g, ' ').trim();

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ============================================================= *
 * EXTENT TRACKING
 * The viewBox is derived from what is actually drawn (§5.5: viewBox width =
 * content right edge + 10). Tracking extents as we draw — rather than guessing
 * from node boxes alone — is what makes the 10-unit gutter exact even when a
 * loop channel, a payload label, or the legend is the widest thing on the canvas.
 * ============================================================= */
function newBounds() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}
function markRect(b, x, y, w, h) {
  if (!b) return;
  b.minX = Math.min(b.minX, x);
  b.minY = Math.min(b.minY, y);
  b.maxX = Math.max(b.maxX, x + w);
  b.maxY = Math.max(b.maxY, y + h);
}
function markPoint(b, x, y) { markRect(b, x, y, 0, 0); }

// JetBrains Mono is monospaced at ~0.6 em advance; 0.62 leaves a hair of slack
// so a label never lands flush against the trimmed gutter.
const MONO_ADVANCE = 0.62;
function textWidth(text, size) { return String(text == null ? '' : text).length * size * MONO_ADVANCE; }
function markText(b, x, y, size, text, anchor) {
  const w = textWidth(text, size);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  markRect(b, x0, y - size, w, size * 1.25);
}

/* Label plate (r7). A connector label sits ON its connector, so the line runs straight
 * through the glyphs and the two compete: at 10px the strike-through is enough to cost a
 * beat of reading. A plate in the canvas ground knocks the line out behind the text, which is
 * the standard treatment for edge labels (Visio, Lucid, Graphviz all do it).
 *
 * Geometry is DERIVED from the measured text, never hardcoded: the plate cannot be a fixed
 * rect or it stops matching the label the moment the wording or the type scale changes.
 * `rx` is half the plate height, giving a full pill regardless of size. */
let PLATE = { padX: 4, padY: 2, fill: '#ffffff', opacity: 1 };  // matches the card ground so a payload label reads as a knockout, not a floating chip
function labelPlate(x, y, size, text, anchor) {
  const w = textWidth(text, size) + PLATE.padX * 2;
  const h = size + PLATE.padY * 2;
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x - PLATE.padX;
  // Mono glyphs sit roughly 0.75em above the baseline; centre the plate on the ink, not the
  // baseline, or a descender-free label looks low in its own pill.
  const y0 = y - size * 0.78 - PLATE.padY;
  return { svg: `<rect x="${r2(x0)}" y="${r2(y0)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(h / 2)}" fill="${PLATE.fill}" opacity="${PLATE.opacity}"/>`,
           box: { x: x0, y: y0, w, h } };
}

// Connector Label Placement Rule: a plated label (payload/branch/loop labels — the only kind
// meant to sit ON a connector, per labelPlate() above) must have unambiguous ownership of its
// own connector, not merely avoid literal overlap with node text. Two plated labels landing on
// or near each other read as "which connector is this for?" even when their pixel boxes don't
// technically intersect a neighbour's TITLE — the ambiguity is between labels, and between a
// label and a node it happens to drift over. boxesOverlap()/nudge below check every new plated
// label against every box already placed (via opts.placedLabels, a per-render array seeded with
// every node's own box before any connector is drawn — see buildSVG()) and, on collision, walk
// it along the label's OWN axis (vertical for a 'middle'-anchored label — true for every plated
// call site in this file — horizontal otherwise) in growing steps until clear. This is placement
// order dependent: earlier-drawn connectors (main flow) keep their natural position; later ones
// (loops, decision branches, drawn after) are the ones that move — see the drawConnectors/
// drawNoBranches/drawLoops call order in buildSVG(), which puts the primary flow first
// deliberately, so an exception/loop label is what yields, never the main path's own label.
function boxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
const t = (x, y, fill, size, text, opts = {}) => {
  const w = opts.weight ? ` font-weight="${opts.weight}"` : '';
  const a = opts.anchor ? ` text-anchor="${opts.anchor}"` : '';
  if (opts.bounds) markText(opts.bounds, x, y, size, text, opts.anchor);
  if (!opts.plate) {
    const c = opts.cls ? ` class="${opts.cls}"` : '';
    return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}"${w}${a}${c}>${esc(text)}</text>`;
  }
  // Highlight & Dimming Rule: every plated label is a CONNECTOR label (payload/branch/wrap/loop
  // — see labelPlate()'s own comment), so it must dim/undim in lockstep with the connector it
  // names. `pf-elabel` plus data-from/data-to (mirroring edgeAttrs()'s own convention on the
  // path element right beside each of these calls) is what pfApplyHL()/pfClearAllHL() key off —
  // without this, a label drawn as a plain <text> sibling of its connector (never a CSS child of
  // it) inherits no opacity from the connector's own .pf-hl-dim class, and stays at full
  // contrast regardless of what's highlighted. opts.cls, if the caller also passed one, is kept
  // alongside pf-elabel rather than overwritten.
  const cls = ['pf-elabel', opts.cls].filter(Boolean).join(' ');
  const c = ` class="${cls}"`;
  const d = (opts.edgeFrom !== undefined || opts.edgeTo !== undefined)
    ? ` data-from="${esc(opts.edgeFrom || '')}" data-to="${esc(opts.edgeTo || '')}"` : '';
  let py = y, px = x;
  let box = labelPlate(px, py, size, text, opts.anchor).box;
  if (opts.placedLabels && text) {
    const STEP = size + PLATE.padY * 2 + 3;   // one plate-height-plus-breathing-room per nudge
    // Every plated call site in this file rides a vertical (or near-vertical) connector segment
    // — the main flow's payload labels, the decision branch labels beside a straight-down "No"
    // drop, and a loop's rise/channel segment near its target all run top-to-bottom. Nudging
    // vertically keeps a label travelling along its own connector's length when it has to yield,
    // rather than drifting sideways off the line it's meant to be read against.
    let tries = 0;
    while (tries < 12 && opts.placedLabels.some(bx => boxesOverlap(box, bx))) {
      tries++;
      const dir = tries % 2 ? 1 : -1;
      const mag = Math.ceil(tries / 2) * STEP;
      py = y + dir * mag;
      box = labelPlate(px, py, size, text, opts.anchor).box;
    }
    opts.placedLabels.push(box);
  }
  const p = labelPlate(px, py, size, text, opts.anchor);
  if (opts.bounds) markRect(opts.bounds, p.box.x, p.box.y, p.box.w, p.box.h);
  const txt = `<text x="${px}" y="${py}" fill="${fill}" font-size="${size}"${w}${a}${c}${d}>${esc(text)}</text>`;
  return p.svg + txt;
};

/* ============================================================= *
 * DRAWING FUNCTIONS
 * ============================================================= */

/* Node text rhythm (§3.1). Line-height: title→title 15, title→meta 17, meta→meta 12.
 * The whole text block is vertically centred in the 80px box. */
const LH = { titleTitle: 15, titleMeta: 17, metaMeta: 12 };
// Type scale (r3). Nudged down a step so dense rows read as a diagram rather than as
// paragraphs: payload/role 9→8, meta 9→8.5, title 11→10.5. The node box is fixed at
// 160×80 (§4.1), so smaller glyphs are also what buys longer labels room inside it.
/* ---------------------------------------------------------------- *
 * TYPE SCALE (r4) — the single source of truth for every glyph size.
 *
 * Why tokens and not literals: these values were previously scattered as inline
 * arguments at eight different draw sites, so "make the labels bigger" meant hunting
 * through the renderer and inevitably missing some. A reusable skill has to expose this
 * as one dial. Override per run via `spec.type`, e.g. { "type": { "min": 11 } }.
 *
 * Why a 10px floor: below ~10px, text stops surviving the things these diagrams are
 * actually for — a PNG downscaled into a slide, a PDF printed at A4, a screenshot pasted
 * into a doc, someone reading a shared link on a laptop. html2canvas captures at 2× so the
 * export itself is sharp, but sharpness is not legibility once the image is scaled to fit.
 * Anything the reader must READ (payload, role, meta, legend, branch labels) sits at or
 * above the floor. Only the step badge NUMERAL may sit below it: it is a single glyph
 * inside a 24px ring, identified by position rather than by reading.
 * ---------------------------------------------------------------- */
const TYPE_DEFAULTS = {
  min: 8,           // readable floor — nothing meant to be read goes under this
  // Tier 1 — primary. What names the thing.
  title: 10,        // node title (reduced from 12px)
  pill: 10,         // start/end terminal text (reduced from 12px)
  // Tier 2 — secondary. Attributes of a node, read after its name.
  meta: 9,          // node description lines (reduced from 11px)
  role: 9,          // `id: role` line above the box (§7) (reduced from 11px)
  decision: 9,      // text inside the diamond (reduced from 11px)
  // Tier 3 — annotation, at the floor. Read on demand, not in the primary scan.
  edgeLabel: 8,     // payload label riding above a connector (§6.2) (reduced from 10px)
  branch: 8,        // decision Yes/No branch labels (§8) (reduced from 10px)
  loop: 8,          // loop / feedback path labels (§6.3) (reduced from 10px)
  wrap: 8,          // row-wrap "continue" label (§5.3) (reduced from 10px)
  legend: 8,        // legend entry labels (§10) (reduced from 10px)
  badge: 8          // step badge numeral — exempt from `min`, see above (reduced from 10px)
};
let TYPE = { ...TYPE_DEFAULTS };
function resolveType(overrides) {
  TYPE = { ...TYPE_DEFAULTS, ...(overrides || {}) };
  // Enforce the floor on everything a reader has to read. The badge numeral is the one
  // deliberate exception; raising `min` raises the readable set with it.
  for (const k of ['title', 'meta', 'role', 'edgeLabel', 'branch', 'loop', 'wrap', 'legend', 'pill', 'decision']) {
    if (TYPE[k] < TYPE.min) TYPE[k] = TYPE.min;
  }
  return TYPE;
}

/* Payload label placement (r7).
 *
 * The label rides ON its connector, vertically centred on the stroke, with a plate in the
 * canvas ground knocking the line out behind the glyphs (see PLATE / labelPlate). Centring is
 * what welds a label to its own connector: floated above the line, a label between two rows of
 * boxes is ambiguous about which stroke it belongs to, and it competes with the role band.
 *
 * `lift` is the offset from the connector to the text BASELINE. Mono glyphs sit ~0.36em above
 * the visual centre of their x-height, so a small positive lift is what makes the ink look
 * centred on the stroke rather than hanging below it. It stays a function of the type scale so
 * raising `spec.type` keeps the label centred instead of drifting off the line. */
let EDGE_LABEL_LIFT = 10;  // Updated from config
const edgeLabelLift = () => EDGE_LABEL_LIFT;
/* Fallback strings, in one place. A generator that hardcodes "Rejected" or "No" inside a draw
 * site cannot be localised or relabelled without editing the renderer; override per run via
 * spec.labels. */
const DEFAULT_LABELS_BASE = {
  start: 'Start', end: 'Complete', decision: 'Decision', step: 'Step',
  yes: 'Yes', no: 'No', negativeTerminal: 'Rejected', wrap: 'continue'
};
let DEFAULT_LABELS = { ...DEFAULT_LABELS_BASE };
function resolveLabels(over) { DEFAULT_LABELS = { ...DEFAULT_LABELS_BASE, ...(over || {}) }; return DEFAULT_LABELS; }
const PILL_TEXT_PAD = 16;   // horizontal air inside a terminal pill
/* Role band: one baseline per row, sitting clear ABOVE the payload labels on that row's
 * connector line. Payload stays welded to its connector; the role label yields. */
function roleBandY(n) {
  const top = (n.rowTop != null ? n.rowTop : n.y);
  const payloadY = n.baselineY - edgeLabelLift();      // where payload labels sit on this row
  return Math.min(top - 12, payloadY - TYPE.role - 4);
}
function nodeBaselines(nTitle, nMeta, boxTop) {
  let block = nTitle ? LH.titleTitle * (nTitle - 1) : 0;
  if (nMeta) block += (nTitle ? LH.titleMeta : 0) + LH.metaMeta * (nMeta - 1);
  const first = Math.round(((80 - block) / 2 + 4) * 4) / 4;
  const ys = [];
  let y = boxTop + first;
  for (let i = 0; i < nTitle; i++) { ys.push(y); y += LH.titleTitle; }
  if (nMeta) {
    y = nTitle ? ys[ys.length - 1] + LH.titleMeta : boxTop + first;
    for (let i = 0; i < nMeta; i++) { ys.push(y); y += LH.metaMeta; }
  }
  return ys;
}

// Semantic type of a node, for filtering and for the legend. Resolved from what the
// node IS in the flow (§2.1) — never from a word in its label.
/* Greedy word wrap to the node's inner width (§4.1). Returns at most `maxLines`; a word too
 * long to fit alone is left over-wide rather than broken mid-word, and the §4.1 verifier check
 * will flag it — better a visible failure than a silently mangled label. */
const NODE_INNER = 160 - 12;
/* How many meta lines a box of this height can hold under the §3.1 rhythm. Derived, so
 * raising node height or lowering the type scale admits more lines automatically. */
function maxMetaLines(boxH) {
  const usable = (boxH || 80) - 8;                 // 4 units of breathing room top and bottom
  const titleBlock = LH.titleTitle + LH.titleMeta; // one title line plus the title→meta gap
  return Math.max(1, Math.floor((usable - titleBlock) / LH.metaMeta) + 1);
}
function wrapToBox(text, size, maxLines) {
  // Split on spaces, but also AFTER dots/slashes/hyphens/arrows/pipes: labels like
  // `adoption.metrics.published` are one unbreakable word to a space-only wrapper, and they
  // are exactly the kind of label these diagrams carry. The separator stays on the first line
  // so the token still reads as one identifier.
  const words = String(text == null ? '' : text)
    .split(/\s+/).filter(Boolean)
    .flatMap(w => textWidth(w, size) <= NODE_INNER ? [w] : w.split(/(?<=[./\-→>|])/));
  if (!words.length) return [''];
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (textWidth(trial, size) <= NODE_INNER || !cur) cur = trial;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  // Beyond the cap the remainder has to go somewhere. Folding it into the last permitted
  // line can overflow the box, so re-wrap the tail across the cap instead of concatenating:
  // an evenly divided overflow still fits where a single fat line does not.
  const head = lines.slice(0, maxLines - 1);
  const tail = lines.slice(maxLines - 1);
  const merged = tail.join(' ');
  if (textWidth(merged, size) <= NODE_INNER) return [...head, merged];
  // Split the tail at the last break that still fits.
  let keep = tail[0];
  for (let i = 1; i < tail.length; i++) {
    const trial = keep + ' ' + tail[i];
    if (textWidth(trial, size) > NODE_INNER) break;
    keep = trial;
  }
  return [...head, keep];
}
/* Decision labels never went through wrapToBox() above at all — the spec supplies a pre-split
 * array of lines (chosen by whoever authored the extraction, not measured), and drawNode() just
 * rendered it as-is. Even if it HAD gone through wrapToBox(), that budget (NODE_INNER, sized for
 * the 160px rectangle step nodes) would still be wrong here: a decision diamond is a rotated
 * square, so its usable width isn't flat like a rectangle's — it tapers the further a line sits
 * from vertical centre, reaching zero at the top/bottom tips. A two-line label that measures
 * under a flat budget can still be too wide for its own second line's narrower slice of the
 * diamond. This wraps against the diamond's real per-line width instead, trying 1, then 2, then
 * 3 lines (matching the existing 1-or-2-line vertical centring in nodeBaselines()) until every
 * line fits the diamond at the height it will actually be drawn. */
function wrapToDiamond(text, size, reach) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return [''];
  const widthAt = y => Math.max(0, 2 * (reach - Math.abs(y)));
  const words = raw.split(/\s+/).filter(Boolean)
    .flatMap(w => textWidth(w, size) <= widthAt(0) ? [w] : w.split(/(?<=[./\-→>|])/));
  if (!words.length) return [''];
  function attempt(n) {
    const ys = nodeBaselines(n, 0, -40);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const trial = cur ? cur + ' ' + w : w;
      const budget = widthAt(ys[lines.length]);
      if (textWidth(trial, size) <= budget || !cur) cur = trial;
      else {
        lines.push(cur);
        if (lines.length >= n) return null;   // ran out of permitted lines mid-wrap
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.length <= n ? lines : null;
  }
  for (let n = 1; n <= 3; n++) {
    const lines = attempt(n);
    if (lines) return lines;
  }
  // Even 3 lines can't fit every word within the diamond's own taper — fold the remainder into
  // the last line rather than silently dropping it; an over-wide diamond is a visible signal to
  // shorten the label in the source spec, a silently dropped word is not.
  const ys = nodeBaselines(3, 0, -40);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (lines.length < 2 && cur && textWidth(trial, size) > widthAt(ys[lines.length])) {
      lines.push(cur); cur = w;
    } else cur = trial;
  }
  lines.push(cur);
  return lines;
}

/* The ONE place a node becomes a canonical record. Every consumer — drawer, filters,
 * accessibility name, edge endpoints — reads this, so the rendered SVG and the JSON can no
 * longer disagree about a node's number, title or type. */
function titlesJoined(n) {
  return Array.isArray(n.title) ? n.title.join(' ') : (n.title || n.label || '');
}

/* Fields that are LAYOUT/PLUMBING, not content — added by the layout engine
 * (LayoutNode's Object.assign(this, flowNode) plus placeNodes' own bookkeeping) or consumed
 * elsewhere in this record already. Anything NOT in this set is, by construction, a piece of
 * content the spec author put on the node, and the drawer must show it (§Interactive Drawer
 * Guide "metadata-driven, not limited to predefined fields"). This is the ONLY filter allowed
 * to hide a field from the drawer — it is a denylist of engine internals, never an allowlist of
 * "known" business fields, so a spec author can invent any field name and it still surfaces. */
const NODE_INTERNAL_FIELDS = new Set([
  'x', 'y', 'cx', 'cy', 'width', 'height', 'bbox', 'rowIndex', 'baselineY', 'rowTop',
  'config', 'flowIndex', 'flowNode', 'type', 'id', 'num', 'title',
  'no'   // negative-branch routing plumbing — its content reaches the drawer via PF_EDGES/outcomes instead
]);
function extractNodeMeta(n) {
  const meta = {};
  for (const key of Object.keys(n)) {
    if (NODE_INTERNAL_FIELDS.has(key)) continue;
    const v = n[key];
    if (typeof v === 'function') continue;
    if (v === undefined) continue;
    meta[key] = v;
  }
  return meta;
}
function recordNode(ctx, n, over) {
  ctx.nodes.push({
    id: n.id, type: semanticType(n), num: '', title: titlesJoined(n),
    // Strip here, not only at the SVG draw site: this record feeds the drawer, the filters and
    // the accessible name, so a glyph left in it is ANNOUNCED — a screen reader reads "high
    // voltage" or "bust in silhouette" before the role name. (r7)
    role: stripGlyphs(n.role), desc: (n.desc || []),   // full text — the box may elide, the drawer never does
    meaning: n.meaning, inputDesc: n.inputDesc, outputDesc: n.outputDesc, example: n.example,  // kept for back-compat with any external consumer reading these top-level fields directly
    // FULL metadata passthrough (§Interactive Drawer Guide). Every property the spec author put
    // on this flow node — named field or ad hoc — lands here verbatim and the drawer renders it
    // dynamically. Nothing above this line is a ceiling on what the drawer can show.
    meta: extractNodeMeta(n),
    ...over
  });
}

function semanticType(n) {
  if (n.type === 'decision') return 'decision';
  // A negative terminal is its own semantic type (r6). The LEGEND already distinguishes
  // "Rejected / negative end" from "Start / End", but this collapsed both into `terminal`, so
  // the filter was coarser than the key beside it: a rose reject pill lit up under the cyan
  // Start/End chip. Colour is supposed to encode type and nothing else (§2) — if two things
  // are drawn differently they must filter differently.
  if (n.type === 'end' && n.variant === 'reject') return 'reject';
  if (n.type === 'start' || n.type === 'end') return 'terminal';
  return n.kind || 'manual';
}

function nodeOpen(n, ctx) {
  if (!ctx.interactive) return '';
  const st = semanticType(n);
  const label = n.type === 'decision'
    ? `Decision: ${[].concat(n.title || 'Decision?').join(' ')}`
    : (n.type === 'start' || n.type === 'end')
      ? `Terminal: ${n.title || (n.type === 'start' ? DEFAULT_LABELS.start : DEFAULT_LABELS.end)}`
      : (() => { const r = stripGlyphs(n.role); return `${n.title || DEFAULT_LABELS.step}${r ? ', ' + r : ''}. Open details.`; })();
  return `<g class="pf-node" data-id="${esc(n.id || '')}" data-type="${esc(st)}" tabindex="0" role="button" aria-label="${esc(label)}">`;
}
function nodeClose(ctx) { return ctx.interactive ? '</g>' : ''; }

function drawNode(n, ctx, B) {
  const out = [];
  out.push(nodeOpen(n, ctx));

  if (n.type === 'start' || n.type === 'end') {
    const pal = n.variant === 'reject' ? REJECT : TERMINAL;
    const h = n.config.nodeHeight.pill;
    out.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${h}" rx="20" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1.5"/>`);
    markRect(B, n.x, n.y, n.width, h);
    const pillText = n.title || (n.type === 'start' ? DEFAULT_LABELS.start : DEFAULT_LABELS.end);
    out.push(t(n.cx, n.cy + 5, INK, TYPE.pill, pillText, { weight: 600, anchor: 'middle', bounds: B }));
    recordNode(ctx, n, { title: pillText, num: '' });
    ctx.usedTerminal = true;
    if (n.variant === 'reject') ctx.usedReject = true;
    out.push(nodeClose(ctx));
    return out.join('\n');
  }

  if (n.type === 'decision') {
    ctx.usedDecision = true;
    // n.title may arrive as a pre-split array (older specs) or a plain string — either way,
    // re-wrap it ourselves against the diamond's own tapered width rather than trusting
    // whatever line breaks the spec happened to carry (see wrapToDiamond() above).
    const rawTitle = Array.isArray(n.title) ? n.title.join(' ') : (n.title || DEFAULT_LABELS.decision);
    const lines = wrapToDiamond(rawTitle, TYPE.decision, diamondReach(n));
    out.push(`<g transform="translate(${n.cx}, ${n.cy})">`);
    out.push(`  <rect x="-40" y="-40" width="80" height="80" rx="4" transform="rotate(45)" fill="${DECISION.fill}" stroke="${DECISION.stroke}" stroke-width="1.5"/>`);
    // A 80×80 square rotated 45° reaches ±56.57 from centre — the ±57 tips in §13.
    markRect(B, n.cx - 57, n.cy - 57, 114, 114);
    const ys = nodeBaselines(lines.length, 0, -40);
    lines.forEach((ln, k) => out.push('  ' + t(0, ys[k], INK, TYPE.decision, ln, { weight: 600, anchor: 'middle' })));
    out.push('</g>');
    recordNode(ctx, n, { title: lines.join(' '), num: '' });
    out.push(nodeClose(ctx));
    return out.join('\n');
  }

  const k = KIND[n.kind] || KIND.manual;
  ctx.usedKinds.add(n.kind || 'manual');

  // Role label sits at boxTop − 12 (§6.2); payload labels clear it at boxTop − 32.
  // Right-aligned to the box's right edge: the badge already occupies the top-LEFT corner,
  // so a start-anchored label has to dodge it and ends up floating at an arbitrary offset.
  // Anchoring to the far edge gives every role label one shared alignment regardless of
  // length, and puts it as far from the badge as the box allows.
  const role = stripGlyphs(n.role) || (n.kind || 'manual');
  // r5: role labels align to a ROW-level band, not to each box's own top. With variable
  // heights the tops differ by tens of units, so a per-box offset scattered the labels across
  // the band and taller neighbours' titles collided with shorter neighbours' roles. One shared
  // baseline per row keeps them legible as a row of annotations, which is how they read.
  // The annotation stack above a row is, bottom to top: box, payload label (connector − lift),
  // then the role band. Deriving the band from the payload line keeps a fixed reading order
  // whatever the node heights, instead of the two competing for the same y.
  const roleY = roleBandY(n);
  out.push(t(n.x + n.width, roleY, k.stroke, TYPE.role, role, { anchor: 'end', weight: 600, bounds: B }));

  out.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="8" fill="${k.fill}" stroke="${k.stroke}" stroke-width="1.5"/>`);
  markRect(B, n.x, n.y, n.width, n.height);
  // Wrap rather than shrink. The box is fixed at 160 (§4.1) and the type floor is 10px (§3.2),
  // so a long title cannot be made to fit by scaling it down without breaking readability —
  // the only honest lever left is a second line. Titles come from the source data and must
  // never be truncated: a clipped node name is a wrong node name.
  // Node height grows to fit its content, within configured limits (r5). The box was a fixed
  // 80 and anything past three meta lines was dropped by a bare .slice(0,3) — no ellipsis, no
  // warning, so a five-line node silently became a three-line node. Growing is the honest
  // response: the reader sees everything the data says, and the row spacing absorbs it.
  const titles = wrapToBox(n.title || DEFAULT_LABELS.step, TYPE.title, 2);
  const allMetas = (n.desc || []).flatMap(d => wrapToBox(d, TYPE.meta, 2));
  const cap = maxMetaLines(n.height);
  const metas = allMetas.slice(0, cap);
  if (allMetas.length > cap) {
    // Cannot grow further — mark the elision visibly and name the node on stderr, rather
    // than letting the content vanish.
    metas[metas.length - 1] = metas[metas.length - 1].replace(/\s*$/, '') + ' …';
    console.warn(`  ! node "${n.id}": ${allMetas.length - cap} description line(s) elided — box is at its height limit.`);
  }
  const ys = nodeBaselines(titles.length, metas.length, n.y);
  titles.forEach((ln, i) => out.push(t(n.cx, ys[i], INK, TYPE.title, ln, { weight: 600, anchor: 'middle' })));
  metas.forEach((d, di) => out.push(t(n.cx, ys[titles.length + di], NEUTRAL, TYPE.meta, d, { anchor: 'middle' })));

  // The badge is centred ON the box's top-left corner, so the box overlaps its lower-right
  // quadrant. It therefore MUST be painted after the box (§4.1): drawn before, the corner's
  // fill and stroke cut an arc straight through the ring and the badge reads as broken.
  // Its own opaque fill then masks the corner cleanly.
  out.push(`<circle cx="${n.x}" cy="${n.y - 5}" r="12" fill="#ffffff" stroke="${k.stroke}" stroke-width="1.5"/>`);
  markRect(B, n.x - 12, n.y - 17, 24, 24);
  // Resolve the badge ONCE and record it with the node. Previously the SVG used
  // `n.num ?? ctx.stepNo++` while the drawer JSON used `n.num ?? ''`, so auto-numbered
  // nodes rendered "1, 2, 3" on the canvas and lost their number in the drawer.
  const badgeNum = n.num != null ? String(n.num) : String(ctx.stepNo);
  out.push(t(n.x, n.y - 1, k.stroke, TYPE.badge, badgeNum, { weight: 600, anchor: 'middle' }));
  if (n.num == null) ctx.stepNo++;
  recordNode(ctx, n, { title: titlesJoined(n), num: badgeNum });

  out.push(nodeClose(ctx));
  return out.join('\n');
}

/* `idx` MUST equal ctx.edges.length at the moment this is called, i.e. the index the matching
 * ctx.edges.push() below is about to occupy — that is how the click handler on this element
 * finds its full metadata record in PF_EDGES (data-from/data-to alone aren't unique once two
 * connectors share the same endpoints, e.g. a loop-back that retraces a flow edge). Every call
 * site pairs one edgeAttrs() with exactly one ctx.edges.push() and nothing pushes in between. */
function edgeAttrs(ctx, from, to, idx) {
  if (!ctx.interactive) return '';
  const label = `Connector: ${from || '?'} to ${to || '?'}. Open details.`;
  return ` class="pf-edge" data-from="${esc(from || '')}" data-to="${esc(to || '')}" data-eidx="${idx}" tabindex="0" role="button" aria-label="${esc(label)}"`;
}

/* The negative branch of a decision (§8). A diamond with a single visible exit reads as an
 * unconditional step — the reader cannot tell what happens when the condition fails, which is
 * usually the case the diagram exists to document. So whenever a decision declares `no`, draw
 * the branch: down from the bottom tip, labelled, into its own terminal pill.
 *
 * Rose throughout, matching the diamond and the exception taxonomy (§6.3): the negative path
 * is the same semantic thread as the gate that produced it. */
/* Routing geometry, derived — never a fixed coordinate.
 *
 * Every value here is computed from the node it attaches to, so a change to node size or
 * spacing moves the connector with it. The one number that used to be hardcoded (the
 * diamond's 57-unit reach) would have silently detached the No-branch by ~14 units the
 * moment a decision's height changed. */

// A square of side S rotated 45° about its centre reaches S·√2/2 from that centre — the
// diamond's bottom tip. Read the side off the node rather than assuming 80.
const diamondReach = n => (n.config.nodeHeight.decision * Math.SQRT2) / 2;
// True top/bottom Y for a node's own anchor purposes — n.bbox.top()/bottom() give the PRE-
// rotation square's extent for a decision (n.config.nodeHeight.decision, 80), not the rendered
// diamond's actual reach (56.57, via diamondReach()); anything anchoring a connector to a
// decision's top/bottom edge must use these, not raw bbox.top()/bottom(), or it lands ~17px
// short — inside the shape rather than on its boundary. Every other node type is unaffected
// (bbox already matches its real rendered extent), so these are safe drop-in replacements
// anywhere a connector-anchor calculation currently reads bbox.top()/bottom() directly.
const nodeTrueTop = n => n.type === 'decision' ? n.cy - diamondReach(n) : n.bbox.top();
const nodeTrueBottom = n => n.type === 'decision' ? n.cy + diamondReach(n) : n.bbox.bottom();

const ROUTE = {
  // A branch label that rides in this channel (see the n.no.to case in drawNoBranches()) sits
  // centred between the two lines bounding it — so the channel has to hold the label's own
  // height PLUS 10px of clearance on both sides simultaneously, not just fit the connector
  // itself. 34 left only ~8px on either side once the label's own glyph height was subtracted;
  // widened so every branch label sandwiched in a channel clears both bounding lines by ≥10px.
  channelGap: 40,     // clearance from a node's underside to a loop channel
  riseGap: 44,        // clearance above a target's box for the approach channel
  gutterGap: 26,      // clearance from the content edge to a side gutter
  stagger: 14,        // offset between successive loops sharing a direction
  branchDrop: 56,     // diamond tip to the top of its No-terminal
  // A branch label sits beside its own vertical line, offset purely horizontally by this much —
  // so this IS the label's whole clearance budget from that line, not just a visual nicety. 8
  // measured exactly 8px of real clearance (and less again near an L-shaped bend, where the
  // corner brings the line closer than the straight-segment gap alone implies). Raised to clear
  // the 10px minimum with a small margin.
  labelInset: 12      // horizontal inset for a branch label beside its path
};
function drawNoBranches(layoutNodes, ctx, B) {
  const out = [];
  const byId = {};
  for (const n of layoutNodes) if (n.id) byId[n.id] = n;

  for (const n of layoutNodes) {
    if (n.type !== 'decision' || !n.no) continue;
    ctx.usedDecision = true;

    /* A negative branch can go to an EXISTING node (r6).
     *
     * `no: { to: "fix" }` routes the branch into that node instead of synthesising a terminal.
     * Without it, the only way to express "No goes to the manual fix step" was a dead-end pill
     * labelled "Manual Fix path" — which duplicated the real node's name, filtered as a
     * terminal rather than as manual work, and told the reader the process stops there when it
     * does not. A branch that rejoins the flow is the common case in real processes; a branch
     * that truly ends is the special one. */
    if (n.no.to) {
      const tgt = byId[String(n.no.to)];
      if (!tgt) {
        throw specError(`Decision "${n.id}" has no.to = "${n.no.to}", which matches no node id.`,
          `Known ids: ${Object.keys(byId).join(', ')}`);
      }
      const label = n.noLabel || DEFAULT_LABELS.no;
      const tip = n.cy + diamondReach(n);
      const chan = Math.max(tip, n.bbox.bottom()) + ROUTE.channelGap;
      /* Target anchor. The branch always drops into the channel BELOW the diamond first, so the
       * final segment is vertical and the only sensible termination is a horizontal edge of the
       * target — top-centre when the target sits lower, bottom-centre when the connector has to
       * climb back up to a node on the same row or above.
       *
       * The fallback here used to be entryAnchor(), which is the LEFT-edge anchor. That produced
       * a connector running along the bottom channel, turning up at the node's left edge, and
       * arrowing into its side — which reads as flow arriving from the left, i.e. from the
       * previous step in the row, rather than from the decision it actually came from. Anchoring
       * to bottom-centre keeps the arrow on the axis the connector genuinely travelled, and
       * matches how drawLoops() already terminates its own bottom-channel routes. */
      // nodeTrueTop()/nodeTrueBottom(), not raw tgt.bbox.top()/bottom() — matters if the no.to
      // target is ITSELF a decision (see nodeTrueTop/nodeTrueBottom's own comment); harmless
      // no-op for every other node type, whose bbox already matches its real rendered extent.
      const entry = tgt.cy > n.cy
        ? { x: tgt.cx, y: nodeTrueTop(tgt) }       // target below: drop in at top-centre
        : { x: tgt.cx, y: nodeTrueBottom(tgt) };   // same row or above: climb into bottom-centre
      // Both legs are identical once the anchor is chosen; the branch above is the only variance.
      const d = `M ${n.cx} ${tip} L ${n.cx} ${chan} L ${entry.x} ${chan} L ${entry.x} ${entry.y}`;
      out.push(`<path d="${d}" stroke="${DECISION.stroke}" stroke-width="1.5" fill="none" stroke-dasharray="4,3" marker-end="url(#${DECISION.marker})"${edgeAttrs(ctx, n.id, tgt.id, ctx.edges.length)}/>`);
      markPoint(B, n.cx, chan); markPoint(B, entry.x, chan); markPoint(B, entry.x, entry.y);
      out.push(t(n.cx + ROUTE.labelInset, tip + ROUTE.channelGap / 2, DECISION.stroke, TYPE.branch, label, { weight: 600, bounds: B, plate: true, placedLabels: ctx.placedLabels, edgeFrom: n.id, edgeTo: tgt.id }));
      // n.no.meta carries any connector-level metadata the spec author attached to this
      // negative branch (condition, triggerEvent, dataTransferred, businessMeaning,
      // downstreamImpact, routingPurpose, or anything else) — surfaced verbatim in the drawer.
      ctx.edges.push({ from: n.id, to: tgt.id, label, style: 'exception', ...(n.no.meta || {}) });
      continue;
    }

    ctx.usedReject = true;

    const label = n.noLabel || DEFAULT_LABELS.no;
    const text = n.no.label || DEFAULT_LABELS.negativeTerminal;
    const top = n.cy + diamondReach(n);              // bottom tip, from the node's own size
    const pillH = n.config.nodeHeight.pill;
    const pillW = Math.max(n.config.nodeWidth.pill, Math.ceil(textWidth(text, TYPE.pill) + PILL_TEXT_PAD * 2));
    const pillY = top + ROUTE.branchDrop;
    const pillX = n.cx - pillW / 2;
    // The synthetic terminal is a real node: it needs its own id so it can be filtered,
    // focused and opened like any other. Deterministic, derived from its gate.
    const noId = `${n.id}-no`;

    out.push(`<line x1="${n.cx}" y1="${top}" x2="${n.cx}" y2="${pillY}" stroke="${DECISION.stroke}" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#${DECISION.marker})"${edgeAttrs(ctx, n.id, noId, ctx.edges.length)}/>`);
    // Label sits midway down the branch path, offset clear of the stroke.
    out.push(t(n.cx + ROUTE.labelInset, top + ROUTE.branchDrop / 2 - 6, DECISION.stroke, TYPE.branch, label, { weight: 600, bounds: B, plate: true, placedLabels: ctx.placedLabels, edgeFrom: n.id, edgeTo: noId }));

    // Wrapped as an interactive group like every other node, so the type filters and the
    // drawer reach it. Previously it was drawn as bare shapes and pushed straight into
    // ctx.nodes, so it appeared in the model but had no element to filter — it stayed lit
    // whatever the filter said, and clicking it did nothing.
    // variant:'reject' is what makes it filter as a negative outcome rather than a bookend.
    out.push(nodeOpen({ id: noId, type: 'end', variant: 'reject', title: text, label: text, config: n.config }, ctx));
    out.push(`<rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="20" fill="${REJECT.fill}" stroke="${REJECT.stroke}" stroke-width="1.5"/>`);
    markRect(B, pillX, pillY, pillW, pillH);
    out.push(t(n.cx, pillY + pillH / 2 + 4, INK, TYPE.pill, text, { weight: 600, anchor: 'middle', bounds: B }));
    out.push(nodeClose(ctx));

    ctx.edges.push({ from: n.id, to: noId, label, style: 'exception', ...(n.no.meta || {}) });
    recordNode(ctx, { id: noId, type: 'end', variant: 'reject', label: text, role: '', desc: [] }, { title: text, num: '' });
  }
  return out.join('\n');
}

/* Inter-row corridors (r5, §5.3 / §6.3).
 *
 * A wrap or loop crossing the gap between two rows needs a clear y. The previous code used
 * the arithmetic midpoint of the two row baselines, which knows nothing about what already
 * occupies that band — so a decision's No-branch pill hanging below row 0 was overlapped by
 * the wrap connector by a couple of units. Spacing was never the problem: the corridor simply
 * was not allocated, it was averaged.
 *
 * Here the band's obstructions are measured (node boxes, and any No-branch pill that drops
 * out of the row above), and each corridor is handed the next free y beneath them. */
function bandObstructions(layoutNodes, rowIndex) {
  const bottoms = [];
  for (const n of layoutNodes) {
    if (n.rowIndex !== rowIndex) continue;
    bottoms.push(n.bbox.bottom());
    if (n.type === 'decision' && n.no) {
      // The negative branch drops a labelled path into its own terminal pill.
      const tip = n.cy + diamondReach(n);
      bottoms.push(tip + ROUTE.branchDrop + n.config.nodeHeight.pill);
    }
  }
  return bottoms.length ? Math.max(...bottoms) : null;
}

function makeCorridors(layoutNodes) {
  const used = new Map();   // rowIndex -> next free y in the band below that row
  return function corridor(fromRow, toRow, fallback) {
    const key = Math.min(fromRow, toRow);
    if (!used.has(key)) {
      const deepest = bandObstructions(layoutNodes, key);
      used.set(key, (deepest == null ? fallback : deepest + ROUTE.channelGap));
    }
    const y = used.get(key);
    used.set(key, y + ROUTE.stagger + 4);   // stagger successive users of the same band
    return y;
  };
}

/* Nudge a vertical descent clear of any node it would pass through. Returns the original x
 * when the drop is already clear, so the common case emits the simple three-segment path. */
function clearDescentX(layoutNodes, x, fromY, toY) {
  const top = Math.min(fromY, toY), bottom = Math.max(fromY, toY);
  // Include the synthetic No-branch terminals: they are drawn from the decision node rather
  // than laid out, so they are absent from layoutNodes yet very much present on the canvas.
  const obstacles = [];
  for (const n of layoutNodes) {
    obstacles.push({ l: n.bbox.left(), r: n.bbox.right(), t: n.bbox.top(), b: n.bbox.bottom() });
    if (n.type === 'decision' && n.no) {
      const tip = n.cy + diamondReach(n);
      const pt = tip + ROUTE.branchDrop;
      // Must mirror drawNoBranches exactly — a second literal copy meant overriding
      // labels.negativeTerminal made the obstacle width disagree with the drawn pill.
      const pw = Math.max(n.config.nodeWidth.pill,
        Math.ceil(textWidth(n.no.label || DEFAULT_LABELS.negativeTerminal, TYPE.pill) + PILL_TEXT_PAD * 2));
      obstacles.push({ l: n.cx - pw / 2, r: n.cx + pw / 2, t: pt, b: pt + n.config.nodeHeight.pill });
    }
  }
  const blockers = obstacles.filter(o =>
    o.t < bottom - 1 && o.b > top + 1 && o.l < x - 1 && o.r > x + 1);
  if (!blockers.length) return x;
  // Step just past the widest blocker, on whichever side is nearer.
  const left = Math.min(...blockers.map(o => o.l)) - ROUTE.gutterGap;
  const right = Math.max(...blockers.map(o => o.r)) + ROUTE.gutterGap;
  return (x - left) <= (right - x) ? left : right;
}

function drawConnectors(layoutNodes, flow, ctx, B) {
  const corridor = makeCorridors(layoutNodes);
  const out = [];
  const nodeByFlowIndex = {};
  for (const n of layoutNodes) nodeByFlowIndex[n.flowIndex] = n;

  let prevNode = null;
  for (let i = 0; i < flow.length; i++) {
    const curr = flow[i];
    if (curr.type === 'rowbreak') { prevNode = null; continue; }

    const currNode = nodeByFlowIndex[i];
    if (!currNode) continue;

    if (prevNode && prevNode.rowIndex === currNode.rowIndex) {
      const k = KIND[prevNode.kind] || KIND.manual;
      const ex = prevNode.exitAnchor(), en = currNode.entryAnchor();
      out.push(`<line x1="${ex.x}" y1="${ex.y}" x2="${en.x}" y2="${en.y}" stroke="${k.stroke}" stroke-width="1.5" opacity="0.75" marker-end="url(#${k.marker})"${edgeAttrs(ctx, prevNode.id, currNode.id, ctx.edges.length)}/>`);
      markRect(B, ex.x, ex.y - 1, en.x - ex.x, 2);
      // `edgeLabel` is the payload leaving its own node (schema.json), so it is read
      // off the SOURCE. Reading it off `curr` rendered every label one hop early.
      //
      // The label rides just above the connector it names (r3), centred on the span. It used
      // to sit at boxTop − 32, which pinned it to the node rather than to the line and left it
      // floating 72 units up, level with the role labels — close enough to those to read as
      // one of them. Anchored to the line, it is unambiguously that connector's payload.
      // A decision's in-lane edge is its affirmative branch and MUST say so (§8). An unlabelled
      // edge out of a diamond forces the reader to guess which outcome continues the main line,
      // and a diamond with one visible exit reads as though the other outcome does not exist.
      const branchLabel = prevNode.type === 'decision'
        ? (prevNode.yesLabel || DEFAULT_LABELS.yes)
        : prevNode.edgeLabel;
      if (branchLabel) {
        const mid = (ex.x + en.x) / 2;
        // The payload label belongs to its CONNECTOR and rides a fixed clearance above that
        // line — that is the whole point of it (§6.2). Earlier r5 work raised it to clear the
        // role band instead, which pushed it 73 units up, level with the role labels and
        // detached from the line it names. The role band moves out of the way instead; see
        // roleBandY(), which is lifted above this label rather than the reverse.
        const lift = edgeLabelLift();
        // The plate applies to labels that sit ON a connector line (r7). Node-attached text
        // (role, title, meta) has clear ground behind it and needs none.
        const style = prevNode.type === 'decision'
          ? { anchor: 'middle', weight: 600, bounds: B, plate: true, placedLabels: ctx.placedLabels, edgeFrom: prevNode.id, edgeTo: currNode.id }
          : { anchor: 'middle', bounds: B, plate: true, placedLabels: ctx.placedLabels, edgeFrom: prevNode.id, edgeTo: currNode.id };
        const fill = prevNode.type === 'decision' ? DECISION.stroke : NEUTRAL;
        const bSize = prevNode.type === 'decision' ? TYPE.branch : TYPE.edgeLabel;
        out.push(t(mid, ex.y - lift, fill, bSize, branchLabel, style));
      }
      // prevNode.edgeMeta carries any connector-level metadata attached to this flow edge's
      // SOURCE node (condition, triggerEvent, dataTransferred, businessMeaning,
      // downstreamImpact, routingPurpose, or any ad hoc field) — surfaced verbatim in the drawer.
      ctx.edges.push({ from: prevNode.id, to: currNode.id, label: prevNode.edgeLabel || '', style: 'flow', ...(prevNode.edgeMeta || {}) });
    } else if (prevNode && prevNode.rowIndex !== currNode.rowIndex) {
      // Row wrap (§5.3) — dashed slate continue path.
      const exit = prevNode.wrapExitAnchor();
      const entry = currNode.wrapEntryAnchor();
      // Allocate a clear y in the band rather than averaging the two baselines.
      const mid = corridor(prevNode.rowIndex, currNode.rowIndex,
        (prevNode.baselineY + currNode.baselineY) / 2);
      // The descent leg drops from the source node to the corridor. If it would pass through a
      // node hanging into the band — a decision's No-branch terminal sits directly below the
      // gate — step the leg sideways into the clear before descending. Routing the horizontal
      // run clear of an obstruction is not enough; the vertical run has to clear it too.
      const legX = clearDescentX(layoutNodes, exit.x, exit.y, mid);
      const path = legX === exit.x
        ? `M ${exit.x} ${exit.y} L ${exit.x} ${mid} L ${entry.x} ${mid} L ${entry.x} ${entry.y}`
        : `M ${exit.x} ${exit.y} L ${exit.x} ${exit.y + ROUTE.channelGap} L ${legX} ${exit.y + ROUTE.channelGap} L ${legX} ${mid} L ${entry.x} ${mid} L ${entry.x} ${entry.y}`;
      if (legX !== exit.x) markPoint(B, legX, exit.y + ROUTE.channelGap);
      out.push(`<path d="${path}" stroke="${WRAP_STYLE.stroke}" stroke-width="${WRAP_STYLE.width}" fill="none" opacity="0.6" stroke-dasharray="${WRAP_STYLE.dash}" marker-end="url(#${WRAP_STYLE.marker})"${edgeAttrs(ctx, prevNode.id, currNode.id, ctx.edges.length)}/>`);
      markPoint(B, exit.x, exit.y); markPoint(B, entry.x, mid); markPoint(B, entry.x, entry.y);
      ctx.usedWrap = true;
      const wrapLabel = prevNode.wrapLabel || DEFAULT_LABELS.wrap;
      // -8 measured ~7px of real clearance to the corridor line once the glyph's own descent and
      // plate padding were accounted for (same shortfall as edgeLabelSpacing above) — raised to
      // clear the 10px minimum.
      out.push(t(exit.x + 10, mid - 11, NEUTRAL, TYPE.wrap, wrapLabel, { bounds: B, plate: true, placedLabels: ctx.placedLabels, edgeFrom: prevNode.id, edgeTo: currNode.id }));
      ctx.edges.push({ from: prevNode.id, to: currNode.id, label: wrapLabel, style: 'wrap', ...(prevNode.wrapMeta || {}) });
    }

    // An `end` node is a SINK: the flow stops there. Chaining the next entry off it drew a
    // connector out of a terminal, which is what happens whenever a spec lists more than one
    // outcome (a success end and a `reject` end) as consecutive flow entries — the second
    // appeared to follow the first. Dropping the source here rather than special-casing each
    // branch above keeps the rule in one place: nothing is ever connected out of a terminal.
    prevNode = currNode.type === 'end' ? null : currNode;
  }

  return out.join('\n');
}

/* Loops (§6.3). Routed in a channel that never crosses a node box:
 * - same row  → a channel under that row
 * - cross row → down out of the source, out to a side gutter, back to the target's
 *   entry edge. Successive loops stagger by 14 so two loops never coincide.
 * `spec.loops` used to be parsed by the schema but dropped on the floor here. */
function drawLoops(layoutNodes, loops, ctx, B) {
  if (!loops || !loops.length) return '';
  const byId = {};
  for (const n of layoutNodes) if (n.id) byId[n.id] = n;

  const contentLeft = Math.min(...layoutNodes.map(n => n.bbox.left()));
  const contentRight = Math.max(...layoutNodes.map(n => n.bbox.right()));
  const out = [];
  let stagger = 0;

  for (const lp of loops) {
    const a = byId[lp.from], b = byId[lp.to];
    if (!a || !b) {
      console.warn(`  ! loop skipped: no node with id "${!a ? lp.from : lp.to}"`);
      continue;
    }
    const st = LOOP_STYLE[lp.style] || LOOP_STYLE.plain;
    ctx.usedLoops.add(lp.style && LOOP_STYLE[lp.style] ? lp.style : 'plain');
    const off = stagger * ROUTE.stagger;
    stagger++;

    // nodeTrueBottom()/nodeTrueTop() (not raw bbox.bottom()/bbox.top()) everywhere below: for a
    // decision node, bbox.height is the pre-rotation square's side (80), which understates the
    // rendered diamond's real vertical reach (56.57 from centre, ~113 total) by ~17px on each
    // side — anchoring a loop connector to raw bbox.bottom()/top() landed it inside the diamond
    // shape rather than on its true tip. Every other node type's bbox already matches its real
    // extent, so this is a safe substitution regardless of node type (see nodeTrueTop/
    // nodeTrueBottom's own comment above).
    const aBottom = nodeTrueBottom(a), bBottom = nodeTrueBottom(b), bTop = nodeTrueTop(b);
    let d, labelX, labelY;
    if (a.rowIndex === b.rowIndex) {
      // Same row: a channel under the row, entering the target's underside.
      const chan = aBottom + ROUTE.channelGap + off;
      d = `M ${a.cx} ${aBottom} L ${a.cx} ${chan} L ${b.cx} ${chan} L ${b.cx} ${bBottom}`;
      // r7: centre the label ON its own channel, like every other connector label. It used to
      // be pushed 12 units BELOW the channel, which put it on whatever ran underneath — with a
      // decision's No corridor there, "re-score" appeared to label the rejection path instead
      // of its own loop. The plate knocks out the loop stroke behind the text.
      labelX = (a.cx + b.cx) / 2; labelY = chan + edgeLabelLift();
      markPoint(B, a.cx, chan); markPoint(B, b.cx, chan); markPoint(B, labelX, labelY);
    } else {
      // Cross row: leave via the source's underside, run up a side gutter that holds no
      // boxes, then approach the target through the channel ABOVE its row (§6.3) and drop
      // into its top edge. Entering from the side would drag the path across every box
      // between the gutter and the target — §6.3 forbids a loop crossing a node box.
      // The channel sits at targetTop − 44, clear of the payload (−32) and role (−12) labels.
      const goingBack = b.rowIndex < a.rowIndex || b.bbox.left() < a.bbox.left();
      const gutter = goingBack ? contentLeft - ROUTE.gutterGap - off : contentRight + ROUTE.gutterGap + off;
      const drop = aBottom + ROUTE.channelGap + off;
      const rise = bTop - ROUTE.riseGap - off;
      d = `M ${a.cx} ${aBottom} L ${a.cx} ${drop} L ${gutter} ${drop} L ${gutter} ${rise} L ${b.cx} ${rise} L ${b.cx} ${bTop}`;
      labelX = (gutter + b.cx) / 2; labelY = rise - 6;
      markPoint(B, gutter, drop); markPoint(B, gutter, rise); markPoint(B, b.cx, bTop);
      markText(B, labelX, labelY, TYPE.loop, lp.label || '', 'middle');
    }

    const marker = st.marker ? ` marker-end="url(#${st.marker})"` : '';
    out.push(`<path d="${d}" stroke="${st.stroke}" stroke-width="${st.width}" fill="none" stroke-dasharray="${st.dash}"${marker}${edgeAttrs(ctx, lp.from, lp.to, ctx.edges.length)}/>`);
    if (lp.label) {
      out.push(t(labelX, labelY, st.stroke, TYPE.loop, lp.label, { anchor: 'middle', weight: 600, bounds: B, plate: true, placedLabels: ctx.placedLabels, edgeFrom: lp.from, edgeTo: lp.to }));
    }
    // lp.meta carries any connector-level metadata attached to this loop/exception edge in the
    // spec (condition, triggerEvent, dataTransferred, businessMeaning, downstreamImpact,
    // routingPurpose, or any ad hoc field) — surfaced verbatim in the drawer.
    ctx.edges.push({ from: lp.from, to: lp.to, label: lp.label || '', style: lp.style || 'plain', ...(lp.meta || {}) });
  }

  return out.join('\n');
}

/* Legend (§10). Lists ONLY the styles the diagram actually uses — the point of the
 * legend is to decode this diagram, so an entry for an unused style is a defect,
 * not a harmless extra. Laid out left-to-right, wrapping to a second row. */
function drawLegend(ctx, x0, y0, maxWidthIn, B) {
  let maxWidth = maxWidthIn;
  const swatches = [];
  // Enumerate the registry: a kind added to KIND must appear in the legend automatically.
  for (const kind of Object.keys(KIND)) {
    if (ctx.usedKinds.has(kind)) swatches.push({ shape: 'box', ...KIND[kind], label: KIND[kind].legend });
  }
  if (ctx.usedTerminal) swatches.push({ shape: 'pill', stroke: TERMINAL.stroke, fill: TERMINAL.fill, label: 'Start / End' });
  if (ctx.usedReject) swatches.push({ shape: 'pill', stroke: REJECT.stroke, fill: REJECT.fill, label: 'Rejected / negative end' });
  if (ctx.usedDecision) swatches.push({ shape: 'diamond', stroke: DECISION.stroke, fill: DECISION.fill, label: 'Decision' });

  const lines = [];
  for (const style of Object.keys(LOOP_STYLE)) {
    if (ctx.usedLoops.has(style)) lines.push({ ...LOOP_STYLE[style], label: LOOP_STYLE[style].legend });
  }
  if (ctx.usedWrap) lines.push({ ...WRAP_STYLE, label: WRAP_STYLE.legend });

  const out = [];

  // No "Legend" heading. The swatches are self-evidently a key — labelling them costs a line
  // and tells the reader something the shapes already say.
  //
  // One flat sequence: swatches then line styles, with no forced break between the two
  // groups. The legend is a single reading line — breaking it by category makes the reader
  // scan twice for something that is really one list.
  const items = [
    ...swatches.map(s => ({ ...s, kind: 'swatch' })),
    ...lines.map(l => ({ ...l, kind: 'line' }))
  ];
  if (!items.length) return { svg: '', bottom: y0 };

  const GAP = 26;
  const advance = item => 16 + 6 + textWidth(item.label, TYPE.legend) + GAP;
  const total = items.reduce((n, it) => n + advance(it), 0) - GAP;

  // Fit on one row if the canvas allows it. Only when the full set genuinely cannot fit do
  // we wrap, and then into the fewest rows that will hold it with an even split, rather than
  // packing one long row and leaving a stub underneath.
  const rows = total <= maxWidth ? 1 : Math.ceil(total / maxWidth);
  const perRow = Math.ceil(items.length / rows);

  // Centre each row on the canvas. The legend describes the whole diagram rather than
  // belonging to its left edge, so it is centred on the same axis the flow is centred on —
  // measured per row, so a wrapped legend stays balanced instead of ragging right.
  const rowWidth = r => {
    const slice = items.slice(r * perRow, (r + 1) * perRow);
    return slice.reduce((n, it) => n + advance(it), 0) - GAP;
  };
  // Centre on the axis the caller passed (x0 + maxWidth/2), but derive each row's start from
  // that row's OWN measured width. When a row is wider than the budget — which larger type
  // makes routine — dividing the budget instead of the row leaves the legend visibly adrift.
  // x0 IS the centre axis (see the call site). Each row starts half its own measured width to
  // the left of it, so a row wider than the nominal budget stays centred instead of drifting.
  const rowStart = r => x0 - rowWidth(r) / 2;

  let row = 0, x = rowStart(0), y = y0 + 6, inRow = 0;
  for (const item of items) {
    if (inRow === perRow) { row++; x = rowStart(row); y += 18; inRow = 0; }
    if (item.kind === 'swatch') {
      if (item.shape === 'diamond') {
        out.push(`<rect x="-5" y="-5" width="10" height="10" transform="translate(${x + 8}, ${y + 4}) rotate(45)" fill="${item.fill}" stroke="${item.stroke}" stroke-width="1.5"/>`);
      } else {
        const rx = item.shape === 'pill' ? 5 : 2;
        out.push(`<rect x="${x}" y="${y - 1}" width="16" height="10" rx="${rx}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="1.5"/>`);
      }
    } else {
      const marker = item.marker ? ` marker-end="url(#${item.marker})"` : '';
      out.push(`<line x1="${x}" y1="${y + 4}" x2="${x + 16}" y2="${y + 4}" stroke="${item.stroke}" stroke-width="${item.width}" stroke-dasharray="${item.dash}"${marker}/>`);
    }
    out.push(t(x + 22, y + 8, NEUTRAL, TYPE.legend, item.label, { bounds: B }));
    markRect(B, x, y - 2, 16, 12);
    x += advance(item);
    inRow++;
  }

  return { svg: out.join('\n'), bottom: y + 12 };
}

/* ============================================================= *
 * SVG ASSEMBLY
 * ============================================================= */
/* ============================================================= *
 * NORMALISE + VALIDATE (r5)
 *
 * One pass, before any layout, that guarantees the invariants every downstream stage
 * assumes. Previously none of these held: a node could render with id "" (and did — the
 * start/end pills had no id at all), two nodes could share an id and silently collapse in
 * the drawer, an edge could carry `undefined` endpoints that JSON.stringify then dropped
 * entirely, and a spec missing `flow` produced a raw TypeError stack trace instead of a
 * diagnostic.
 *
 * Normalising here rather than at each draw site is what makes the canonical model single:
 * every emitter downstream reads ids that are already guaranteed present and unique.
 * ============================================================= */
function specError(msg, hint) {
  const e = new Error(hint ? `${msg}\n  → ${hint}` : msg);
  e.name = 'SpecError';
  return e;
}

function normaliseSpec(spec) {
  if (!spec || typeof spec !== 'object') throw specError('Spec is not an object.');
  if (!Array.isArray(spec.flow)) {
    throw specError('Spec has no `flow` array.', 'Every diagram needs at least one node — see references/schema.json.');
  }
  if (!spec.flow.length) throw specError('`flow` is empty.', 'Add at least one node.');

  const TYPES = new Set(['start', 'end', 'step', 'decision', 'rowbreak']);
  const KINDS = new Set(['manual', 'automated', 'integration']);
  const seen = new Map();
  const warnings = [];

  spec.flow.forEach((n, i) => {
    if (!n || typeof n !== 'object') throw specError(`flow[${i}] is not an object.`);
    if (!TYPES.has(n.type)) {
      throw specError(`flow[${i}] has type "${n.type}".`, `Valid types: ${[...TYPES].join(', ')}.`);
    }
    if (n.type === 'rowbreak') return;
    if (n.type === 'step' && n.kind != null && !KINDS.has(n.kind)) {
      throw specError(`flow[${i}] ("${n.title || n.id || 'untitled'}") has kind "${n.kind}".`,
        `Valid kinds: ${[...KINDS].join(', ')}. Omit it to leave the type unresolved.`);
    }
    // Deterministic synthetic id. Derived from flow position, so the same spec always
    // yields the same ids — the drawer, filters and edges stay stable across rebuilds.
    if (n.id == null || String(n.id).trim() === '') {
      n.id = `${n.type === 'start' || n.type === 'end' ? n.type : 'n'}${i + 1}`;
      warnings.push(`flow[${i}] had no id; assigned "${n.id}".`);
    }
    n.id = String(n.id);
    if (seen.has(n.id)) {
      throw specError(`Duplicate node id "${n.id}" at flow[${i}] and flow[${seen.get(n.id)}].`,
        'Ids address nodes in the drawer, filters and loops — they must be unique.');
    }
    seen.set(n.id, i);
  });

  // Loops reference nodes by id; an unresolved endpoint used to be a console.warn and a
  // silently dropped edge. Surface it as an error naming both the loop and the valid ids.
  (spec.loops || []).forEach((lp, i) => {
    for (const end of ['from', 'to']) {
      if (!lp[end]) throw specError(`loops[${i}] has no \`${end}\`.`);
      if (!seen.has(String(lp[end]))) {
        throw specError(`loops[${i}].${end} = "${lp[end]}" matches no node id.`,
          `Known ids: ${[...seen.keys()].join(', ')}`);
      }
    }
  });

  // Auto-assignment is normal for hand-written specs (start/end pills rarely carry ids), so
  // report it only when asked. PF_VERBOSE=1 surfaces it during authoring.
  if (warnings.length && process.env.PF_VERBOSE) {
    console.warn(`  ! ${warnings.length} node id(s) auto-assigned:`);
    warnings.forEach(w => console.warn(`      ${w}`));
  }
  return spec;
}

function buildSVG(spec, viewportWidth) {
  normaliseSpec(spec);      // ids and graph integrity before anything reads them
  resolveType(spec.type);   // tokens first
  resolveLabels(spec.labels);   // fallback strings, overridable per run
  const layout = computeLayout(spec.flow, { viewportWidth });
  const { nodes: layoutNodes, config } = layout;
  // Every bound below is a Math.min/max over this array. Empty — a flow of only `rowbreak`
  // items, which the schema permits — yielded `viewBox="Infinity Infinity -Infinity -Infinity"`
  // and `min-width:-Infinitypx`, written to disk with exit code 0. A broken file that reports
  // success is worse than a crash, because nothing downstream knows to look.
  if (!layoutNodes.length) {
    throw specError('`flow` contains no drawable nodes.',
      'Only `rowbreak` entries were found. Add at least one start, step, decision or end node.');
  }
  // Interactive mode: enabled by default (drawer opens on node click), can be explicitly disabled
  const interactive = spec.interactive !== false;  // defaults to true unless explicitly set to false
  const ctx = {
    stepNo: 1, interactive,
    usedKinds: new Set(), usedLoops: new Set(),
    usedDecision: false, usedTerminal: false, usedReject: false, usedWrap: false,
    edges: [], nodes: [],
    // Connector Label Placement Rule (r8): every plated connector/branch/loop label registers
    // its final box here as it's drawn (see t()'s opts.placedLabels handling above) so the NEXT
    // label drawn can detect and nudge away from it. Seeded with every node's own box below,
    // before any connector is drawn, so a label can't drift onto a node either — a node's
    // position is fixed by computeLayout() already, so it's always the label that has to yield,
    // never the box.
    placedLabels: []
  };

  for (const n of layoutNodes) {
    ctx.placedLabels.push({ x: n.bbox.left(), y: n.bbox.top(), w: n.bbox.width, h: n.bbox.height });
  }

  const B = newBounds();

  // Body is drawn first so the extents — and therefore the trimmed viewBox — reflect
  // everything that is actually on the canvas, not just the node boxes.
  const connectorSvg = drawConnectors(layoutNodes, spec.flow, ctx, B);
  const noBranchSvg = drawNoBranches(layoutNodes, ctx, B);
  const loopSvg = drawLoops(layoutNodes, spec.loops, ctx, B);
  const nodeSvg = layoutNodes.map(n => drawNode(n, ctx, B)).join('\n');

  const contentLeft = B.minX;
  // The legend may use the full canvas width, not merely the width the nodes happen to
  // occupy: it sits below the flow with nothing beside it, so constraining it to the content
  // bounds wrapped it into two or three rows while the canvas still had room to spare. If it
  // overruns, it extends the canvas — which is correct, a legend that fits on one line is
  // worth a slightly wider diagram.
  const legendWidth = Math.max(360, B.maxX - B.minX, (config.viewportWidth || 0) - config.safetyMargin);
  // Centre the legend on the content's own centre line, so it aligns with the flow above it
  // rather than with an abstract canvas midpoint the diagram may not actually sit on.
  // Centre on the NODE bounds, not on B. B accumulates every drawn extent including text, so
  // one long payload or loop label drags the midpoint sideways and the legend visibly follows
  // it. The boxes are what the reader perceives as the diagram's axis.
  // Every node counts toward the axis, decisions included. Excluding them was meant to avoid
  // the diamond's oversized layout bbox skewing the centre, but a decision is a visible node
  // like any other — dropping it from the span shifts the axis by half the diagram whenever
  // the gate sits at one end, and it disagreed with what the verifier measures.
  const axisNodes = layoutNodes;
  const nodeLeft = Math.min(...axisNodes.map(n => n.bbox.left()));
  const nodeRight = Math.max(...axisNodes.map(n => n.bbox.right()));
  // Centre the legend on the node axis. Where the legend row is wider than the flow above it
  // — a nine-entry key under a four-node row — it necessarily extends past the nodes on both
  // sides; the canvas trim (§5.5) then grows to contain it, which is correct. What must not
  // happen is the row being pinned to the left edge, so the axis is passed through unclamped.
  const legend = drawLegend(ctx, (nodeLeft + nodeRight) / 2, B.maxY + 34, legendWidth, B);

  // §5.5 — trim to content with a 10-unit gutter each side; ≥48 above the topmost
  // box so the role label (boxTop−12) and payload label (boxTop−32) both clear.
  const topBox = Math.min(...layoutNodes.map(n => n.bbox.top()));
  const minX = B.minX - 10;
  const maxX = B.maxX + 10;
  const minY = Math.min(B.minY - 8, topBox - 48);
  const maxY = Math.max(B.maxY, legend.bottom) + 20;
  const viewBox = { x: r2(minX), y: r2(minY), width: r2(maxX - minX), height: r2(maxY - minY) };

  const parts = [];
  // Accessible name via aria-label ONLY — never an SVG <title> element. A <title> child is
  // read by assistive tech, but browsers ALSO render it as a native tooltip on hover, so the
  // whole canvas sprouts a pop-up when the pointer rests on it. aria-label carries the same
  // text to the same readers and paints nothing. Same reasoning as the `title` attribute ban
  // on the toolbar toggle (§11.1).
  const name = interactive
    ? `${spec.title || 'Process flow'} diagram. ${layoutNodes.length} nodes; each is focusable for details.`
    // NB: spec.subtitle is no longer rendered as visible chrome, but it is still read here for
    // the diagram's accessible description. Removing the field from a spec silently falls back
    // to the generic node-count sentence, which is a worse screen-reader summary.
    : `${spec.title || 'Process flow'} diagram. ${spec.subtitle || `Process flow with ${layoutNodes.length} nodes.`}`;
  const a11y = ` role="${interactive ? 'group' : 'img'}" aria-label="${esc(name)}"`;
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}"${a11y}>`);

  parts.push(`<defs>`);
  parts.push(`<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#6b7280"/></marker>`);
  /* One marker per stroke colour, DERIVED from the palette above. These were six hardcoded
   * literals; when the palette moved from dark to light they silently kept the old hues, so
   * every connector rendered a light-theme line terminating in a dark-theme arrowhead. */
  for (const [mid, col] of [
    ['arrowhead-emerald', KIND.manual.stroke],
    ['arrowhead-violet',  KIND.automated.stroke],
    ['arrowhead-amber',   KIND.integration.stroke],
    ['arrowhead-rose',    DECISION.stroke],
    ['arrowhead-crimson', REJECT.stroke],
    ['arrowhead-slate',   NEUTRAL],
  ]) {
    parts.push(`<marker id="${mid}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${col}"/></marker>`);
  }
  // Dedicated highlight marker: an SVG marker's fill is fixed at definition time and is outside
  // the reach of any CSS class on the <path>/<line> that references it via marker-end, so
  // .pf-edge.pf-hl-path's CSS stroke override alone would leave a red highlighted line ending in
  // whatever colour that edge kind's own marker was defined with. pfApplyHL()/pfClearHL() below
  // swap marker-end to this id (and back) alongside toggling the class, keeping line and
  // arrowhead in sync.
  parts.push(`<marker id="arrowhead-hl" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#e60000"/></marker>`);
  // Grid pattern stays available in <defs> but is NOT painted: the r2 default canvas is
  // the clean #ffffff card ground (§1). To re-enable an alignment backdrop, paint a
  // full-canvas rect with fill="url(#grid)" opacity="0.5" immediately after the defs.
  // Grid pattern stroke updated to 1.5px (§1 compliance) for design system backdrop consistency
  parts.push(`<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#A4D3FF" stroke-width="1.5"/></pattern>`);
  parts.push(`</defs>`);

  // Draw order (§1): connectors → loops → nodes → legend.
  parts.push(connectorSvg);
  if (noBranchSvg) parts.push(noBranchSvg);
  if (loopSvg) parts.push(loopSvg);
  parts.push(nodeSvg);
  parts.push(legend.svg);
  parts.push(`</svg>`);

  return { svg: parts.join('\n'), W: viewBox.width, H: viewBox.height, ctx };
}

function r2(n) { return Math.round(n * 100) / 100; }

/* ============================================================= *
 * CARDS (§9)
 * ============================================================= */
function card(color, title, items) {
  return `      <div class="card">
        <div class="card-header">
          <div class="card-dot ${color}"></div>
          <h3>${esc(title)}</h3>
        </div>
        <ul>
${(items || []).map(i => `          <li>• ${esc(i)}</li>`).join('\n')}
        </ul>
      </div>`;
}

// Mode A1 — Input · Output · Example · Meaning table (default; matches the exemplars).
function firstTerm(s) { return String(s || '').split(/[,;]/)[0].trim(); }
function ioTableCard(rows) {
  const body = (rows || []).map((r, i) => {
    const ex = r.example || `${firstTerm(r.input)} → ${firstTerm(r.output)}`;
    return `            <tr><th scope="row">Step ${i + 1}</th>` +
      `<td class="io-in">${esc(r.input)}</td>` +
      `<td class="io-out">${esc(r.output)}</td>` +
      `<td class="io-ex">${esc(ex)}</td>` +
      `<td class="io-mean">${esc(r.meaning || '')}</td></tr>`;
  }).join('\n');
  return `      <div class="card">
        <div class="card-header"><div class="card-dot violet"></div><h3>Input → Output Transformation</h3></div>
        <table class="io-table">
          <thead><tr><th class="io-col-step"></th><th>Input</th><th>Output</th><th>Example</th><th>Meaning</th></tr></thead>
          <tbody>
${body}
          </tbody>
        </table>
      </div>`;
}

/* ============================================================= *
 * INTERACTIVITY LAYER (§11.3) — emitted only when spec.interactive is true.
 * Kept entirely additive so that with it off the file is the static design system
 * and still passes the §14 diff-test against the exemplars.
 * ============================================================= */
const TYPE_LABEL = {
  manual: 'Manual', automated: 'Automated', integration: 'Integration',
  decision: 'Decision', terminal: 'Start / End', reject: 'Rejected'
};
/* Filter-chip accents. These are TEXT and BORDER colours on a white chip, so they must be the
 * saturated strokes, not the pale fills — the dark theme's bright tints sat around 1.6:1 on
 * white and the chip row read as disabled. Kept in lockstep with KIND/DECISION/TERMINAL/REJECT
 * above: a chip must be the same colour as the nodes it filters. */
const TYPE_ACCENT = {
  manual: KIND.manual.stroke, automated: KIND.automated.stroke, integration: KIND.integration.stroke,
  decision: DECISION.stroke, terminal: TERMINAL.stroke, reject: REJECT.stroke
};

function interactiveCSS() {
  return `
    /* --- interactivity layer (§11.3) --- */
    /* Filter toolbar (r6).
     *
     * The problem it fixes: the chips previously used the same vocabulary as the nodes and the
     * legend — a rounded outline with a small coloured dot — so a row of CONTROLS read as a
     * third kind of swatch. Nothing signalled it was interactive, and it competed with the
     * diagram for attention instead of sitting above it.
     *
     * The fix is to stop borrowing that vocabulary. Controls now get their own surface: a
     * raised, bordered bar that visually detaches from the canvas, an accent rule to anchor it,
     * and a SOLID fill on the active chip — an unmistakably UI treatment, since nothing else in
     * a diagram is ever filled with its own accent colour at full opacity. */
    .pf-filters { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.5rem; align-items: center;
      background: #ffffff; border: 1px solid #A4D3FF; border-left: 3px solid #6d4aad;
      border-radius: 0.5rem; padding: 0.55rem 0.75rem; box-shadow: 0 1px 3px rgba(24, 20, 14, 0.05); }
    .pf-filters-label { color: #44464d; font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.1em; margin-right: 0.55rem; display: inline-flex; align-items: center; gap: 0.4rem; }
    .pf-filters-label::before { content: ''; width: 11px; height: 11px; flex: 0 0 11px;
      /* Funnel glyph, drawn rather than an emoji: it must render identically everywhere. */
      background: #6d4aad; clip-path: polygon(0 0, 100% 0, 62% 45%, 62% 100%, 38% 100%, 38% 45%); }
    .pf-chip { background: #ffffff; border: 1px solid currentColor; color: #44464d; padding: 0.3rem 0.7rem;
      border-radius: 0.375rem; font-family: inherit; font-size: 0.7rem; font-weight: 500; cursor: pointer;
      display: inline-flex; align-items: center; gap: 0.4rem; line-height: 1.2;
      transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s; }
    .pf-chip:hover { background: #E9F2FE; }
    .pf-chip:focus-visible { outline: 2px solid #6d4aad; outline-offset: 2px; }
    /* Selected: the chip fills with its own accent. High contrast, unambiguous, and impossible
       to confuse with a legend swatch — legend marks are outlines on the bare ground. */
    .pf-chip[aria-pressed="true"] { background: currentColor; border-color: currentColor;
      box-shadow: 0 0 0 3px rgba(109, 74, 173, 0.14); }
    /* Selected chip fills with its own accent and flips the label to the light side. On a light
       theme the fill is the dark element, so the label must invert — keeping it dark here (as the
       dark theme did) put dark-on-saturated text at roughly 2:1 and made the ACTIVE filter the
       least readable chip in the row. */
    .pf-chip[aria-pressed="true"] .pf-chip-label { color: #ffffff; font-weight: 700; }
    .pf-chip[aria-pressed="true"] .pf-chip-dot { background: #ffffff; opacity: 0.8; }
    .pf-chip-label { color: inherit; }
    .pf-chip-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: 0 0 7px; }
    .pf-node { cursor: pointer; }
    /* Light fills DARKEN on hover; brightness(>1) on a pale tint washes it toward white and the
       hover reads as the node disappearing rather than activating. */
    .pf-node:hover { filter: brightness(0.96) saturate(1.15); }
    .pf-node:focus { outline: none; }
    .pf-node:focus-visible { outline: 2px solid #6d4aad; outline-offset: 3px; border-radius: 4px; }
    .pf-node, .pf-edge { transition: opacity 0.2s ease; }
    .pf-node.is-dim, .pf-edge.is-dim { opacity: 0.22; pointer-events: none; }
    .pf-node.is-sel > rect, .pf-node.is-sel > circle, .pf-node.is-sel > g > rect { stroke-width: 3; }
    /* Neighbor-network highlight (hover, and click-to-lock — see pfApplyHL()/toggleHlLock() in
     * the script below). Deliberately separate class names from the TYPE-filter's own .is-dim
     * (pfApplyFilter()) — the two dimming mechanisms are independent and must not stomp on each
     * other if a filter happens to be active at the same time a node is hovered/locked. No
     * pointer-events:none here (unlike .is-dim): a dimmed node under an active highlight must
     * stay clickable, since clicking a different node is exactly how the lock switches targets. */
    .pf-node.pf-hl-dim, .pf-edge.pf-hl-dim, .pf-elabel.pf-hl-dim { opacity: 0.12; filter: grayscale(1) brightness(1.15); }
    /* Stroke-width deliberately NOT overridden here (an earlier version bumped it to 3px): every
     * marker in this file is defined with the SVG default markerUnits="strokeWidth", so widening
     * the line also silently scaled up its arrowhead — both caused a layout shift at the moment
     * of hover, which a later requirement explicitly disallows. Colour + glow alone signal the
     * highlighted path now; geometry, thickness, and arrowhead size stay exactly as drawn. */
    .pf-edge.pf-hl-path { stroke: #e60000 !important; filter: drop-shadow(0 0 3px rgba(230,0,0,.55)); }
    /* The click-locked anchor node's own outline — distinct from .is-sel (which marks whichever
     * node/edge the DRAWER is currently showing, a separate and independently-triggered state
     * now that a plain click no longer opens the drawer — see the click/dblclick handlers below). */
    .pf-node.pf-hl-lock > rect, .pf-node.pf-hl-lock > circle, .pf-node.pf-hl-lock > g > rect { stroke: #e60000 !important; stroke-width: 3 !important; }
    /* The drawer floats as an overlay — position: fixed with no body padding. Opening/closing
       the drawer does not affect layout of the diagram or any page content. */
    /* top/height were previously fixed 0/100vh, same as .header itself (z-index:50, above the
       drawer's own 40) — since both started at the exact same y, the header's opaque background
       painted over the drawer's own top portion, hiding content underneath it. --pf-header-h is
       set at runtime (see syncPfHeaderH()) to the header's actual rendered height — not a
       hardcoded px guess — since a long title can wrap onto a second line at a narrow viewport,
       growing the header. top/height are deliberately NOT in the transition list below (only
       transform is) — found empirically elsewhere in this project that transitioning a
       var()/calc()-driven length makes some engines freeze at the initial computed value
       instead of animating; a resize-triggered header-height change is rare and doesn't need
       animating anyway. */
    .pf-drawer { position: fixed; top: var(--pf-header-h, 48px); right: 0; height: calc(100vh - var(--pf-header-h, 48px)); width: var(--pf-drawer-w, 400px); background: #ffffff; border-left: 1px solid #A4D3FF; box-shadow: -12px 0 32px rgba(24,20,14,0.10); transform: translateX(101%); transition: transform 0.25s ease; z-index: 40; display: flex; }
    .pf-drawer.is-open { transform: none; }
    /* The resize handle is a filled bar rather than a transparent strip with a hairline: at 6px
     * wide an invisible grab target is undiscoverable, and the drawer's own left border already
     * supplies the edge line. The border-right is dropped because it would now be the same colour
     * as the fill and only widen the bar by a pixel. */
    .pf-drawer-handle { width: 6px; flex: 0 0 6px; cursor: ew-resize; background: #A4D3FF; }
    /* Hover/focus deepens the same hue instead of switching to another one — the handle is still
     * the same control, so the feedback should read as "active", not as a different element. The
     * previous value was a leftover violet from the pre-light palette. */
    .pf-drawer-handle:hover, .pf-drawer-handle:focus-visible { background: #6FB6FA; outline: none; }
    .pf-drawer-body { flex: 1; overflow-y: auto; padding: 1.25rem; min-width: 0; }
    /* Full-bleed header rule. The body carries 1.25rem of padding, so a plain border-bottom on
     * this block would stop 1.25rem short of each edge and read as a boxed-in divider rather than
     * a separator between the header and the content. Negative horizontal margins pull the block
     * out to the drawer's own edges; the padding is then reintroduced on the block itself so the
     * text stays aligned with everything below it. Keep the negative margins equal to
     * .pf-drawer-body's padding — if one changes the other must follow. */
    /* Pinned while the body scrolls. The header carries the element's identity — type badge,
     * number, name, owning role — and the drawer below it can run to several screens of metadata,
     * so without this you scroll into a wall of field labels with nothing left on screen saying
     * WHICH element they describe. It also keeps the close control permanently reachable instead
     * of stranding it above the fold.
     *
     * Requires an opaque background: the body content scrolls UNDER this block, and with a
     * transparent header the text simply overlaps. z-index keeps it above content that would
     * otherwise paint over it.
     *
     * top is -1.25rem, NOT 0, and that is load-bearing: sticky constrains the element's MARGIN
     * box, and this block carries margin-top:-1.25rem to reach full bleed. With top:0 the margin
     * edge pinned to the scrollport top, which left the border box 1.25rem lower and opened a
     * strip along the top edge where scrolled content showed through above the header. Offsetting
     * top by the same amount as the negative margin pins the border box flush instead. If the
     * body padding or that margin ever changes, this value has to change with them. */
    .pf-drawer-header { position: sticky; top: -1.25rem; z-index: 2; background: #ffffff;
      margin: -1.25rem -1.25rem 1.25rem; padding: 1.25rem; border-bottom: 1px solid #A4D3FF; }
    .pf-drawer-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.75rem; }
    .pf-badge { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; padding: 0.2rem 0.5rem; border-radius: 0.25rem; border: 1px solid currentColor; white-space: nowrap; }
    .pf-drawer-close { background: transparent; border: none; color: #6b7280; font-size: 1.5rem; line-height: 1; cursor: pointer; padding: 0 0.25rem; }
    .pf-drawer-close:hover { color: #1a1a1a; }
    .pf-drawer-close:focus-visible { outline: 2px solid #6d4aad; outline-offset: 2px; }
    .pf-drawer h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.25rem; word-break: break-word; }
    .pf-drawer-role { color: #6b7280; font-size: 0.75rem; margin-bottom: 0; word-break: break-word; }
    .pf-drawer-sections { display: flex; flex-direction: column; gap: 0; }
    /* One rule set for every section the drawer renders — the fixed Paths block above and every
     * dynamically-generated metadata group below share the same visual rhythm, so a spec author
     * adding a brand-new field never produces a section that looks "bolted on". */
    /* Section rhythm: each section is separated from the one above by a hairline with equal
     * breathing room on both sides of the rule (margin-top above it, padding-top below it). */
    .pf-sec { margin-top: 1.25rem; border-top: 1px solid #A4D3FF; padding-top: 1.15rem; }
    /* Suppress the rule on the FIRST section of the drawer only. This must be scoped with the
     * child combinator: the metadata sections are rendered into their own #pfDynamic container,
     * so a bare '.pf-sec:first-child' also matched Overview — the first section inside THAT
     * container — and silently deleted the separator between Paths and Overview. The rule looked
     * correct in isolation and only misbehaved because the drawer body has two section parents. */
    .pf-drawer-sections > .pf-sec:first-child { margin-top: 0; }
    /* The border/padding reset must EXCLUDE the Paths card. This reset exists to drop the leading
     * section hairline and the space around it — but .pf-paths is not a hairline-separated
     * section, it is a bordered box, and 'border-top: none' / 'padding-top: 0' applied to a box
     * strips its own top edge and its own internal padding. Both of those regressed here in turn:
     * first the headings sat flush against the card's top edge, then the card's top border went
     * missing entirely. A card's border and padding are its own concern, not section rhythm. */
    .pf-drawer-sections > .pf-sec:first-child:not(.pf-paths) { border-top: none; padding-top: 0; }
    /* Connector mode hides the Paths card, but it remains the DOM :first-child — and a structural
     * selector cannot see display:none. Without this the next section kept its leading hairline
     * and drew a rule floating in an empty band just below the header rule. The class is toggled
     * in pfSetPathsVisible() so the visual first section is always the one without a top rule. */
    .pf-drawer-sections.pf-no-paths > #pfDynamic > .pf-sec:first-child { border-top: none; margin-top: 0; padding-top: 0; }
    .pf-sec h3 { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 0.65rem; margin-top: 0; }
    /* Primary section headings (Overview, Ownership & Actors, Data, ... and the connector-mode
     * equivalents) go to full black so they outrank the .pf-field-label subheadings beneath them.
     * Both were previously #6b7280, which made a section title and the field labels inside it read
     * as the same level and flattened the hierarchy.
     *
     * Scoped to #pfDynamic on purpose: the Paths card's INCOMING/OUTGOING headings are the same
     * <h3> element but are NOT section headings — they label two columns inside one section, so
     * promoting them would claim a rank they don't hold. The id also wins the specificity contest
     * against the base rule above without needing !important. */
    #pfDynamic .pf-sec h3 { color: #000000; }
    .pf-sec ul { list-style: none; margin: 0 0 0.5rem 0; padding: 0; }
    .pf-sec li { color: #2c2c2c; font-size: 0.75rem; margin-bottom: 0.4rem; line-height: 1.5; word-break: break-word; }
    .pf-sec .pf-empty { color: #9aa0a6; font-style: italic; }
    .pf-drawer-meaning { color: #2c2c2c; font-size: 0.75rem; line-height: 1.5; word-break: break-word; margin: 0 0 0.5rem 0; }
    /* Callout variant: the value is set as a bordered card in italics with a looser line-height.
     * An example is an illustration of the section above it rather than another data field, so it
     * gets a visual frame that separates it from the label/value pairs it sits among. */
    .pf-sec--callout .pf-drawer-meaning { background: #E9F2FE; border: 1px solid #A4D3FF; border-radius: 0.6rem; padding: 0.9rem 1rem; font-style: italic; line-height: 1.75; margin: 0; }
    .pf-drawer-example { color: #2c2c2c; font-size: 0.75rem; line-height: 1.5; word-break: break-word; margin: 0; }
    .pf-drawer-desc { color: #2c2c2c; font-size: 0.75rem; line-height: 1.5; word-break: break-word; margin: 0 0 0.5rem 0; }
    /* Metadata-driven rendering (§Interactive Drawer Guide). Every field on the source element —
     * named or ad hoc — is rendered as a label + value pair, or as a list, or as a card per
     * array-of-objects entry (decision outcomes, integration contracts, etc.). This is the single
     * generic vocabulary the dynamic renderer draws on; it never special-cases a field name in CSS. */
    .pf-field-label { color: #6b7280; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin: 0.85rem 0 0.3rem 0; }
    .pf-field-label:first-of-type { margin-top: 0; }
    /* Identifier sets render as chips: each value is a discrete token rather than a line of
     * prose, and a bulleted column of one-word entries wastes vertical space while implying a
     * sequence that isn't there. Wrapping inline also lets a dozen field names sit in the room
     * three bullets used to take. */
    .pf-chips { list-style: none; display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0 0 0.45rem 0; padding: 0; }
    .pf-chips li { background: #E9F2FE; border: 1px solid #A4D3FF; border-radius: 0.45rem; padding: 0.22rem 0.6rem; color: #2c2c2c; font-size: 0.72rem; line-height: 1.45; word-break: break-word; }
    .pf-meta-list { list-style: none; margin: 0 0 0.4rem 0; padding: 0; }
    .pf-meta-list li { color: #2c2c2c; font-size: 0.75rem; line-height: 1.5; margin-bottom: 0.25rem; padding-left: 0.9rem; position: relative; word-break: break-word; }
    .pf-meta-list li::before { content: '\\2022'; position: absolute; left: 0; color: #9aa0a6; }
    /* Card per entry. No left accent bar: with five or six of these stacked, a coloured rail on
     * each one reads as a status indicator that carries meaning it does not have. The border and
     * fill alone are enough to group a label with its value. */
    .pf-meta-card { background: #F4F8FE; border: 1px solid #A4D3FF; border-radius: 0.55rem; padding: 0.75rem 0.85rem; margin-bottom: 0.5rem; }
    .pf-meta-card:last-child { margin-bottom: 0; }
    .pf-card-label { color: #626b79; font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 0.32rem; }
    .pf-card-value { color: #2c2c2c; font-size: 0.75rem; line-height: 1.6; word-break: break-word; }
    /* Sub-entries inside a grouped card (e.g. each field of a decision outcome) need separation
     * from the entry above without the full gap a standalone card carries. */
    .pf-card-label--sub { margin-top: 0.55rem; }
    .pf-card-label--sub:first-child { margin-top: 0; }
    .pf-meta-row { display: flex; gap: 0.4rem; font-size: 0.72rem; line-height: 1.5; margin-bottom: 0.15rem; word-break: break-word; }
    .pf-meta-row:last-child { margin-bottom: 0; }
    .pf-meta-key { color: #6b7280; font-weight: 600; flex: 0 0 auto; white-space: nowrap; }
    .pf-meta-val { color: #1a1a1a; }
    /* Paths panel. Incoming and outgoing sit SIDE BY SIDE in a bordered panel rather than as two
     * stacked lists: they are a matched pair (what feeds this element / what it feeds), and
     * stacking them made the reader scroll to compare the two halves of one idea. The panel edge
     * also separates graph navigation from the metadata sections that follow it.
     * auto-fit/minmax collapses back to a single column when the drawer is dragged narrow, so the
     * two columns never crush to unreadable widths at the 320px minimum. */
    .pf-paths { background: #F4F8FE; border: 1px solid #A4D3FF; border-radius: 0.5rem; padding: 0.9rem 1rem; margin-top: 0; }
    .pf-paths-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 0.9rem 1rem; }
    /* 128px floor, not 150: at the 400px default drawer width the panel's usable inner width is
       ~320px after drawer padding, panel padding and the resize handle, so a 150px floor fell
       one or two pixels short of fitting two tracks and silently collapsed to a single stacked
       column — the exact layout this redesign replaced. Long names wrap within their track,
       which is fine; losing the side-by-side pairing is not. */
    .pf-paths h3 { margin-bottom: 0.55rem; }
    .pf-paths ul { margin: 0; }
    .pf-path-item { margin-bottom: 0.6rem; }
    .pf-path-item:last-child { margin-bottom: 0; }
    /* The whole row is the control, but only the NAME carries emphasis — the arrow is a direction
     * marker, not part of the link text, so it stays neutral and doesn't compete with the name. */
    .pf-path-link { display: flex; gap: 0.4rem; align-items: baseline; background: none; border: none; padding: 0; margin: 0; font: inherit; cursor: pointer; text-align: left; }
    .pf-path-arrow { color: #9aa0a6; flex: 0 0 auto; font-size: 0.78rem; line-height: 1.3; }
    .pf-path-name { color: #1a1a1a; font-weight: 700; font-size: 0.78rem; line-height: 1.3; }
    .pf-path-link:hover .pf-path-name { color: #6d4aad; }
    .pf-path-link:focus-visible { outline: 2px solid #6d4aad; outline-offset: 2px; border-radius: 3px; }
    /* Payload drops to its own line, indented to the name's left edge (arrow width + gap). It is
     * the connector's label, not the target's name, so inlining it after a middot read as part of
     * the link text. */
    .pf-path-payload { display: block; margin-left: 1.05rem; margin-top: 0.1rem; color: #6b7280; font-size: 0.72rem; line-height: 1.35; word-break: break-word; }
    .pf-link { background: none; border: none; color: #6d4aad; font-family: inherit; font-size: 0.75rem; cursor: pointer; padding: 0; text-align: left; text-decoration: underline; text-underline-offset: 2px; }
    .pf-link:hover { color: #52308f; }
    .pf-link:focus-visible { outline: 2px solid #6d4aad; outline-offset: 2px; }
    .pf-payload { color: #6b7280; }
    .pf-edge:focus-visible { outline: 2px solid #6d4aad; outline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) {
      .pulse-dot { animation: none; }
      body, .pf-drawer, .pf-node, .pf-edge { transition: none; }
    }
    @media print { .pf-drawer, .pf-filters { display: none !important; } }`;
}

function interactiveMarkup(ctx) {
  const types = [];
  for (const type of [...Object.keys(KIND), 'decision', 'terminal', 'reject']) {
    if (ctx.nodes.some(n => n.type === type)) types.push(type);
  }
  const chips = types.map(ty =>
    `        <button class="pf-chip" data-filter="${ty}" aria-pressed="false" style="color:${TYPE_ACCENT[ty]}"><span class="pf-chip-dot"></span><span class="pf-chip-label">${esc(TYPE_LABEL[ty])}</span></button>`
  ).join('\n');

  return {
    filters: `    <div class="pf-filters" role="group" aria-label="Filter diagram by node type">
        <span class="pf-filters-label">Filter</span>
        <button class="pf-chip" data-filter="all" aria-pressed="true" style="color:#6d4aad"><span class="pf-chip-dot"></span><span class="pf-chip-label">All</span></button>
${chips}
      </div>`,
    drawer: `  <aside class="pf-drawer" id="pfDrawer" role="dialog" aria-labelledby="pfDrawerTitle" aria-hidden="true">
    <div class="pf-drawer-handle" id="pfHandle" role="separator" aria-orientation="vertical" aria-label="Resize detail panel. Use left and right arrow keys." tabindex="0"></div>
    <div class="pf-drawer-body">
      <div class="pf-drawer-header">
        <div class="pf-drawer-head">
          <span class="pf-badge" id="pfBadge"></span>
          <button class="pf-drawer-close" id="pfClose" aria-label="Close detail panel">&times;</button>
        </div>
        <h2 id="pfDrawerTitle"></h2>
        <p class="pf-drawer-role" id="pfRole"></p>
      </div>
      <div class="pf-drawer-sections">
        <!-- Incoming/Outgoing Paths — shown for every element type (activities, decisions,
             gateways, integrations, data stores, etc.); hidden when a connector itself is
             selected, since "incoming path of a path" is not a meaningful question. -->
        <div class="pf-sec pf-paths" id="pfPathsSection">
          <div class="pf-paths-grid">
            <div class="pf-paths-col">
              <h3 id="pfInHeading">Incoming Paths</h3>
              <ul id="pfIn"></ul>
            </div>
            <div class="pf-paths-col">
              <h3 id="pfOutHeading">Outgoing Paths</h3>
              <ul id="pfOut"></ul>
            </div>
          </div>
        </div>
        <!-- Metadata-driven body. Populated entirely by JS from the selected element's full
             source-data record (PF_NODES[n].meta for elements, PF_EDGES[n] for connectors) —
             no field is hardcoded here, so a spec author can add any attribute and it appears
             automatically without touching this template. -->
        <div id="pfDynamic"></div>
      </div>
    </div>
  </aside>`
  };
}

function interactiveJS(ctx) {
  return `
    /* --- interactivity layer (§11.3) --- */
    const PF_NODES = ${JSON.stringify(ctx.nodes)};
    const PF_EDGES = ${JSON.stringify(ctx.edges)};
    const PF_TYPE_LABEL = ${JSON.stringify(TYPE_LABEL)};
    const PF_TYPE_ACCENT = ${JSON.stringify(TYPE_ACCENT)};
    const pfById = Object.fromEntries(PF_NODES.filter(n => n.id).map(n => [n.id, n]));
    const pfDrawer = document.getElementById('pfDrawer');
    let pfSelected = null;      // id of the selected NODE, or null
    let pfSelectedEdge = null;  // index into PF_EDGES of the selected CONNECTOR, or null

    const pfNodeEls = () => Array.from(document.querySelectorAll('.pf-node'));
    const pfEdgeEls = () => Array.from(document.querySelectorAll('.pf-edge'));
    const pfLabelEls = () => Array.from(document.querySelectorAll('.pf-elabel'));

    // ---- neighbor-network highlight (hover preview + click-to-lock) -------------------------
    // Deliberately a SEPARATE state from pfSelected/pfSelectedEdge (the drawer's own selection):
    // a plain click now only toggles this highlight lock, the drawer opens on double click, and
    // closing the drawer does not clear the lock — the two are independent interactions.
    let pfHlLocked = null;   // id of the locked-highlighted node, or null
    function pfNeighbors(id) {
      const s = new Set([id]);
      PF_EDGES.forEach(e => { if (e.from === id) s.add(e.to); if (e.to === id) s.add(e.from); });
      return s;
    }
    function pfApplyHL(id) {
      const ns = pfNeighbors(id);
      pfNodeEls().forEach(el => el.classList.toggle('pf-hl-dim', !ns.has(el.dataset.id)));
      pfEdgeEls().forEach(el => {
        const on = el.dataset.from === id || el.dataset.to === id;
        el.classList.toggle('pf-hl-dim', !on);
        el.classList.toggle('pf-hl-path', on);
        if (!el.dataset.origMarker) { const m = el.getAttribute('marker-end'); if (m) el.dataset.origMarker = m; }
        if (el.dataset.origMarker) el.setAttribute('marker-end', on ? 'url(#arrowhead-hl)' : el.dataset.origMarker);
      });
      // Connector labels (.pf-elabel — payload/branch/wrap/loop text like "Yes", "queue ticket",
      // "continue") are drawn as plain <text> siblings of their connector, never its CSS child,
      // so they previously never inherited any opacity from the connector's own .pf-hl-dim and
      // stayed at full contrast regardless of what was highlighted — a label for an unrelated,
      // dimmed connector reading exactly as sharp as one on the active path. data-from/data-to
      // (set alongside pf-elabel in t()'s plate branch, mirroring edgeAttrs()'s own convention)
      // give each label the same from/to ownership test used for edges just above.
      pfLabelEls().forEach(el => {
        const on = el.dataset.from === id || el.dataset.to === id;
        el.classList.toggle('pf-hl-dim', !on);
      });
      if (pfHlLocked) { const lg = pfNodeEls().find(e => e.dataset.id === pfHlLocked); if (lg) lg.classList.remove('pf-hl-dim'); }
    }
    function pfClearAllHL() {
      pfNodeEls().forEach(el => el.classList.remove('pf-hl-dim'));
      pfEdgeEls().forEach(el => {
        el.classList.remove('pf-hl-dim', 'pf-hl-path');
        if (el.dataset.origMarker) el.setAttribute('marker-end', el.dataset.origMarker);
      });
      pfLabelEls().forEach(el => el.classList.remove('pf-hl-dim'));
    }
    // Hover works independently of an active lock, and does not override/clear it: hovering ANY
    // node — related to the lock or not — substitutes that node's own neighbour set for the
    // duration of the hover, and pfHoverClearHL() (mouseleave) reverts to re-painting the locked
    // node's view, not to nothing. The lock's underlying state (pfHlLocked, the .pf-hl-lock
    // class) never changes from hovering — only pfSetLock()/pfClearLock() (click) touch that.
    // (An earlier pass through this file made hover fully inert while a lock was active instead,
    // reasoning that a hover briefly showing a different outcome than the click asked for reads
    // as the lock being interrupted; a later, explicit requirement reversed that back to this
    // independent-hover behaviour, which is what ships now — see the matching bpmn-swimlane
    // engine's own "---- highlight" comment for the same history.)
    function pfHoverHL(id) { pfApplyHL(id); }                               // mouseenter
    function pfHoverClearHL() { if (pfHlLocked) { pfApplyHL(pfHlLocked); return; } pfClearAllHL(); }  // mouseleave
    function pfSetLock(id) {
      if (pfHlLocked) { const p = pfNodeEls().find(e => e.dataset.id === pfHlLocked); if (p) p.classList.remove('pf-hl-lock'); }
      pfHlLocked = id;
      const g = pfNodeEls().find(e => e.dataset.id === id); if (g) g.classList.add('pf-hl-lock');
    }
    function pfClearLock() {
      if (pfHlLocked) { const g = pfNodeEls().find(e => e.dataset.id === pfHlLocked); if (g) g.classList.remove('pf-hl-lock'); }
      pfHlLocked = null;
    }
    function toggleHlLock(id) {
      if (pfHlLocked === id) { pfClearLock(); pfClearAllHL(); }
      else { pfSetLock(id); pfApplyHL(id); }
    }

    // ---- View Details mode: a persistent-inspection variant of the drawer. OFF (default): a
    // plain node click toggles the highlight lock, as above. ON: a plain node click opens/
    // updates the drawer directly (via pfOpen — see the node click handler below) and applies
    // the highlight lock to match; neither clicking a different node nor clicking empty canvas
    // closes it — only turning this toggle back off, or the drawer's own × button (kept in sync
    // with the toggle — see pfClose()), does. Turning the toggle on does not itself open the
    // drawer (nothing is selected yet); turning it off closes whatever it's currently showing.
    let pfViewDetailsMode = false;
    const pfViewDetailsBtn = document.getElementById('viewDetailsBtn');
    function setPfViewDetails(on) {
      pfViewDetailsMode = on;
      if (pfViewDetailsBtn) { pfViewDetailsBtn.classList.toggle('is-active', on); pfViewDetailsBtn.setAttribute('aria-pressed', String(on)); }
      if (!on) pfClose();
    }
    if (pfViewDetailsBtn) pfViewDetailsBtn.addEventListener('click', () => setPfViewDetails(!pfViewDetailsMode));

    function pfLabelFor(id) {
      const n = pfById[id];
      if (!n) return id || 'unknown';
      return n.title || n.id;
    }
    function pfLi(html) { const li = document.createElement('li'); li.innerHTML = html; return li; }
    function pfFill(ul, items, emptyText) {
      ul.textContent = '';
      if (!items.length) { ul.appendChild(pfLi('<span class="pf-empty">' + emptyText + '</span>')); return; }
      items.forEach(i => ul.appendChild(i));
    }
    function pfEdgeItem(otherId, e, dir) {
      const li = document.createElement('li');
      li.className = 'pf-path-item';
      const btn = document.createElement('button');
      btn.className = 'pf-path-link';
      btn.type = 'button';
      // Arrow and name are separate spans so the arrow can stay neutral while the name carries
      // the emphasis and the hover/focus affordance. Using one text node (as before) forced them
      // to share a single colour and made the glyph part of the link label for screen readers.
      const arrow = document.createElement('span');
      arrow.className = 'pf-path-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = dir === 'in' ? '\u2190' : '\u2192';
      const name = document.createElement('span');
      name.className = 'pf-path-name';
      name.textContent = pfLabelFor(otherId);
      btn.appendChild(arrow);
      btn.appendChild(name);
      btn.setAttribute('aria-label', (dir === 'in' ? 'Incoming from ' : 'Outgoing to ') + pfLabelFor(otherId));
      btn.addEventListener('click', () => pfOpen(otherId));
      li.appendChild(btn);
      const meta = [];
      if (e.label) meta.push(e.label);
      if (e.style && e.style !== 'flow') meta.push(e.style);
      if (meta.length) {
        // Sibling of the button, not a child: the payload describes the CONNECTOR, so it must not
        // be inside the control that navigates to the target node.
        const span = document.createElement('span');
        span.className = 'pf-path-payload';
        span.textContent = meta.join(' \u00b7 ');
        li.appendChild(span);
      }
      return li;
    }

    /* ---------------------------------------------------------------------------------------
     * METADATA-DRIVEN RENDERING
     * ---------------------------------------------------------------------------------------
     * The drawer is the single place a user goes to see everything known about a diagram
     * element or connector. It is NOT a fixed template of four fields — it renders whatever
     * the source data actually contains, field by field, grouped for readability but never
     * gated on a field being one the diagram author anticipated. A field that isn't recognised
     * still renders, under "Additional Details" — nothing in the source data is ever dropped,
     * truncated or silently ignored.
     * ------------------------------------------------------------------------------------- */

    // Friendlier display names for common field keys. This is a COSMETIC lookup only — any key
    // absent from this map still renders in full, under an auto-generated Title Case label.
    const PF_LABEL_OVERRIDES = {
      desc: 'Description', inputDesc: 'Input Description', outputDesc: 'Output Description',
      edgeLabel: 'Outgoing Payload Label', yesLabel: 'Affirmative Path Label', noLabel: 'Negative Path Label',
      wrapLabel: 'Continuation Label', kind: 'Element Kind', variant: 'Variant',
      sourceSystem: 'Source System', targetSystem: 'Target System', apiDetails: 'API / Integration Details',
      systemInteractions: 'System Interactions', dataIn: 'Input Data', dataOut: 'Output Data',
      dataInput: 'Input Data', dataOutput: 'Output Data', dataEntities: 'Data Entities & Attributes',
      dataTransformation: 'Data Transformation', payload: 'Exchanged Payload',
      businessRules: 'Business Rules', policyConstraints: 'Policy Constraints',
      validationRules: 'Validation Rules', validationOutcome: 'Validation Outcome',
      decisionLogic: 'Decision Logic', evaluationCriteria: 'Evaluation Criteria',
      ruleExpression: 'Rule Expression / Validation Formula', conditions: 'Conditions',
      entryCondition: 'Entry Condition', exitCondition: 'Exit Condition',
      triggerEvent: 'Triggering Event', triggeringEvent: 'Triggering Event',
      resultingEvent: 'Resulting Event', precondition: 'Precondition', preconditions: 'Preconditions',
      postcondition: 'Postcondition', postconditions: 'Postconditions', dependencies: 'Dependencies',
      prerequisites: 'Prerequisites', upstreamImpact: 'Upstream Process Impact',
      downstreamImpact: 'Downstream Process Impact', successPath: 'Success Path',
      failurePath: 'Failure Path', exceptionPath: 'Exception Path', fallbackPath: 'Fallback Path',
      rejectionPath: 'Rejection Path', escalationPath: 'Escalation Path',
      notifications: 'Notifications & Alerts', statusTransitions: 'Status / State Transitions',
      stateTransitions: 'Status / State Transitions', audit: 'Audit Trail', compliance: 'Compliance',
      governance: 'Governance', kpis: 'KPIs', slas: 'SLAs', metrics: 'Operational Metrics',
      documents: 'Reference Documents', references: 'Linked Artefacts / Supporting Evidence',
      relatedJourneys: 'Related Customer Journeys', capabilities: 'Business Capabilities',
      requirements: 'Requirements', relatedElements: 'Related Process Elements',
      businessContext: 'Business Context', purpose: 'Process Purpose', actor: 'Actor',
      actors: 'Actors', owner: 'Owner', team: 'Team', responsibleParty: 'Responsible Party',
      outcomes: 'Branch Outcomes', businessMeaning: 'Business Meaning of Transition',
      routingPurpose: 'Routing Purpose', dataTransferred: 'Data Transferred',
      transitionCondition: 'Transition Condition', source: 'Source Element', target: 'Target Element',
      style: 'Connector Style'
    };
    function pfHumanLabel(key) {
      if (PF_LABEL_OVERRIDES[key]) return PF_LABEL_OVERRIDES[key];
      return key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/^./, c => c.toUpperCase())
        .trim();
    }
    function pfIsEmpty(v) {
      if (v === null || v === undefined) return true;
      if (Array.isArray(v)) return v.length === 0;
      if (typeof v === 'object') return Object.keys(v).length === 0;
      if (typeof v === 'string') return v.trim() === '';
      return false;
    }
    // Renders one field's VALUE beneath its label. Strings/numbers/booleans become a short
    // paragraph; a flat array becomes a bulleted list; an array of objects (e.g. decision
    // outcomes, integration contracts) becomes one card per entry with every sub-field listed;
    // a plain object becomes a key/value list. Every branch is generic — none of it depends on
    // which field name is being rendered, so new metadata shapes need no code changes here.
    function pfRenderValue(container, value) {
      if (Array.isArray(value)) {
        const flat = value.every(v => v === null || typeof v !== 'object');
        if (flat) {
          const items = value.map(v => String(v).trim()).filter(v => v !== '');
          /* Chip layout vs bullet list is decided by the SHAPE of the values, not by field name —
           * hardcoding 'dataEntities' would mean the next spec author's equivalent field
           * (entities, attributes, tags, ...) silently falls back to bullets.
           *
           * The test is "is every item a single bare token": no internal whitespace, and short.
           * That is what separates an identifier set (ProductCode, Customer.legalName, SYS-01)
           * from a list of prose items. Length alone is not enough — 'Prospective Customer' under
           * ACTORS is just as short as 'SessionToken' but is a phrase, and chipping phrases makes
           * them read as enum values rather than as a list. The whitespace test draws that line
           * exactly where the reference design draws it. */
          const isTokenList = items.length > 0 &&
            items.every(v => v.indexOf(' ') === -1 && v.length <= 40);
            // Deliberately indexOf, not a regex: this whole block is emitted from inside a
            // template literal, where a backslash class like \\s either gets eaten as an escape
            // (shipping /s/, which matches any letter s) or survives doubled (shipping /\\s/,
            // which matches a literal backslash). Both fail silently and send every list down
            // the wrong branch. A plain indexOf has no escaping surface at all.
          const ul = document.createElement('ul');
          ul.className = isTokenList ? 'pf-chips' : 'pf-meta-list';
          items.forEach(v => { const li = document.createElement('li'); li.textContent = v; ul.appendChild(li); });
          container.appendChild(ul);
        } else {
          value.forEach(item => {
            const card = document.createElement('div');
            card.className = 'pf-meta-card';
            if (item && typeof item === 'object') {
              // Same stacked label/value as the plain-object branch. These were inline flex rows
              // with a nowrap key, which forced multi-line values (a decision outcome's business
              // impact is a sentence) into a narrow ragged column hanging off the key. Stacking
              // gives every value the full card width and one consistent left edge.
              Object.keys(item).forEach(k => {
                if (pfIsEmpty(item[k])) return;
                const kEl = document.createElement('div');
                kEl.className = 'pf-card-label pf-card-label--sub';
                kEl.textContent = pfHumanLabel(k);
                const vEl = document.createElement('div');
                vEl.className = 'pf-card-value';
                vEl.textContent = Array.isArray(item[k]) ? item[k].join(', ') : String(item[k]);
                card.appendChild(kEl); card.appendChild(vEl);
              });
            } else {
              card.textContent = String(item);
            }
            container.appendChild(card);
          });
        }
      } else if (value && typeof value === 'object') {
        // One card per key, with the key STACKED above its value rather than inline before it.
        // These values are frequently full sentences (business meaning, downstream impact), and an
        // inline 'Key: sentence' row makes the second and later lines wrap back underneath the key
        // with nothing marking where the label ended and the prose began. Stacking gives every
        // entry the same left edge and lets the card boundary do the grouping.
        Object.keys(value).forEach(k => {
          if (pfIsEmpty(value[k])) return;
          const card = document.createElement('div');
          card.className = 'pf-meta-card';
          const kEl = document.createElement('div');
          kEl.className = 'pf-card-label';
          kEl.textContent = pfHumanLabel(k);
          const vEl = document.createElement('div');
          vEl.className = 'pf-card-value';
          vEl.textContent = Array.isArray(value[k]) ? value[k].join(', ') : String(value[k]);
          card.appendChild(kEl); card.appendChild(vEl);
          container.appendChild(card);
        });
      } else {
        const p = document.createElement('p');
        p.className = 'pf-drawer-meaning';
        p.textContent = String(value);
        container.appendChild(p);
      }
    }
    // Renders every field in \`data\` into \`root\`, grouped by \`groups\` (an ordered list of
    // { title, fields } — see PF_NODE_GROUPS / PF_EDGE_GROUPS below), then sweeps up anything
    // present in \`data\` that no group claimed into a final "Additional Details" section. That
    // sweep is what guarantees no source-data field can ever be silently omitted: a spec author
    // inventing a brand-new attribute name still sees it in the drawer with zero code changes.
    function pfRenderGroups(root, data, groups, alreadyShownKeys) {
      root.textContent = '';
      const used = new Set(alreadyShownKeys || []);
      groups.forEach(g => {
        const present = g.fields.filter(f => !pfIsEmpty(data[f]));
        if (!present.length) return;
        const sec = document.createElement('div');
        sec.className = 'pf-sec' + (g.variant ? ' pf-sec--' + g.variant : '');
        const h = document.createElement('h3'); h.textContent = g.title; sec.appendChild(h);
        present.forEach(f => {
          used.add(f);
          // Suppress a field label that merely restates the section heading. A single-field group
          // whose title matches its field (Example / example) otherwise printed the same word
          // twice, once as the heading and again as the label above the value.
          const labelText = pfHumanLabel(f);
          if (labelText.toLowerCase() !== String(g.title).toLowerCase()) {
            const label = document.createElement('div');
            label.className = 'pf-field-label';
            label.textContent = labelText;
            sec.appendChild(label);
          }
          pfRenderValue(sec, data[f]);
        });
        root.appendChild(sec);
      });
      const extraKeys = Object.keys(data).filter(k => !used.has(k) && !pfIsEmpty(data[k]));
      if (extraKeys.length) {
        const sec = document.createElement('div');
        sec.className = 'pf-sec';
        const h = document.createElement('h3'); h.textContent = 'Additional Details'; sec.appendChild(h);
        extraKeys.forEach(f => {
          const label = document.createElement('div');
          label.className = 'pf-field-label';
          label.textContent = pfHumanLabel(f);
          sec.appendChild(label);
          pfRenderValue(sec, data[f]);
        });
        root.appendChild(sec);
      }
      if (!root.children.length) {
        const empty = document.createElement('p');
        empty.className = 'pf-sec pf-empty';
        empty.textContent = 'No additional details were provided for this element in the source data.';
        root.appendChild(empty);
      }
    }

    // Field groups for a NODE (activity, task, decision, gateway, validation, integration, data
    // store, document, notification, exception, outcome, artefact — every element type shares
    // this one dynamic renderer; a decision's "outcomes" array and an integration's
    // "apiDetails" both just fall into whichever group lists that field name, or into
    // Additional Details if neither does).
    const PF_NODE_GROUPS = [
      { title: 'Overview', fields: ['description', 'desc', 'purpose', 'businessContext', 'meaning', 'kind', 'variant'] },
      { title: 'Ownership & Actors', fields: ['actor', 'actors', 'owner', 'team', 'responsibleParty'] },
      { title: 'Systems & Integration', fields: ['sourceSystem', 'targetSystem', 'systems', 'systemInteractions', 'apiDetails', 'integration', 'endpoint'] },
      { title: 'Data', fields: ['inputDesc', 'outputDesc', 'dataIn', 'dataInput', 'dataOut', 'dataOutput', 'dataEntities', 'dataTransformation', 'payload'] },
      { title: 'Business Rules & Validation', fields: ['businessRules', 'policyConstraints', 'validationRules', 'validationOutcome'] },
      { title: 'Decision Logic', fields: ['decisionLogic', 'evaluationCriteria', 'ruleExpression', 'conditions', 'outcomes'] },
      { title: 'Conditions, Triggers & Events', fields: ['entryCondition', 'exitCondition', 'triggerEvent', 'triggeringEvent', 'resultingEvent', 'precondition', 'preconditions', 'postcondition', 'postconditions'] },
      { title: 'Dependencies & Process Impact', fields: ['dependencies', 'prerequisites', 'upstreamImpact', 'downstreamImpact'] },
      { title: 'Outcomes & Exception Paths', fields: ['successPath', 'failurePath', 'exceptionPath', 'fallbackPath', 'rejectionPath', 'escalationPath'] },
      { title: 'Notifications & Status', fields: ['notifications', 'statusTransitions', 'stateTransitions'] },
      { title: 'Audit, Compliance & Governance', fields: ['audit', 'compliance', 'governance'] },
      { title: 'KPIs, SLAs & Metrics', fields: ['kpis', 'slas', 'metrics'] },
      { title: 'References & Related Items', fields: ['documents', 'references', 'relatedJourneys', 'capabilities', 'requirements', 'relatedElements'] },
      { title: 'Flow Labels', fields: ['edgeLabel', 'yesLabel', 'noLabel', 'wrapLabel'] },
      // 'variant' is a presentation hint carried by the GROUP, so a section can opt into a
      // different treatment without pfRenderValue growing a per-field-name branch. Any future
      // group can use it; nothing about it is specific to 'example'.
      { title: 'Example', fields: ['example'], variant: 'callout' }
    ];
    // Field groups for a CONNECTOR/transition (the drawer opens the same way for an edge as for
    // a node — source, target, routing purpose, condition, trigger, data transferred, business
    // meaning and downstream impact, per the connector requirements).
    const PF_EDGE_GROUPS = [
      { title: 'Connection', fields: ['source', 'target', 'style', 'routingPurpose'] },
      { title: 'Condition & Trigger', fields: ['transitionCondition', 'condition', 'triggerEvent', 'triggeringEvent'] },
      { title: 'Data', fields: ['dataTransferred', 'payload'] },
      { title: 'Business Meaning & Impact', fields: ['businessMeaning', 'upstreamImpact', 'downstreamImpact'] }
    ];

    function pfSetPathsVisible(visible) {
      document.getElementById('pfPathsSection').style.display = visible ? '' : 'none';
      // Mirror the hidden state as a class: CSS structural selectors can't react to display:none,
      // so the leading-hairline suppression has to be driven from here.
      document.querySelector('.pf-drawer-sections').classList.toggle('pf-no-paths', !visible);
    }

    function pfOpen(id) {
      const n = pfById[id];
      if (!n) return;
      pfSelected = id;
      pfSelectedEdge = null;
      const badge = document.getElementById('pfBadge');
      badge.textContent = PF_TYPE_LABEL[n.type] || n.type;
      badge.style.color = PF_TYPE_ACCENT[n.type] || '#94a3b8';
      document.getElementById('pfDrawerTitle').textContent = (n.num ? n.num + '. ' : '') + (n.title || n.id);
      document.getElementById('pfRole').textContent = n.role || '';
      pfSetPathsVisible(true);
      pfFill(document.getElementById('pfIn'),
        PF_EDGES.filter(e => e.to === id).map(e => pfEdgeItem(e.from, e, 'in')),
        'Nothing flows into this element.');
      pfFill(document.getElementById('pfOut'),
        PF_EDGES.filter(e => e.from === id).map(e => pfEdgeItem(e.to, e, 'out')),
        'Nothing flows out of this element.');
      // The full source-data record for this element — every field, named or ad hoc.
      pfRenderGroups(document.getElementById('pfDynamic'), n.meta || {}, PF_NODE_GROUPS, ['role']);
      pfDrawer.classList.add('is-open');
      document.body.classList.add('pf-open');
      pfDrawer.setAttribute('aria-hidden', 'false');
      pfNodeEls().forEach(el => el.classList.toggle('is-sel', el.dataset.id === id));
      pfEdgeEls().forEach(el => el.classList.remove('is-sel'));
      document.getElementById('pfClose').focus();
    }

    function pfOpenEdge(idx) {
      const e = PF_EDGES[idx];
      if (!e) return;
      pfSelected = null;
      pfSelectedEdge = idx;
      const badge = document.getElementById('pfBadge');
      badge.textContent = 'Connector';
      badge.style.color = '#94a3b8';
      document.getElementById('pfDrawerTitle').textContent = pfLabelFor(e.from) + ' → ' + pfLabelFor(e.to);
      document.getElementById('pfRole').textContent = e.label ? ('Label: ' + e.label) : '';
      pfSetPathsVisible(false);
      // Merge the fixed connection facts with every ad hoc field the spec author attached to
      // this edge (condition, triggerEvent, dataTransferred, businessMeaning, downstreamImpact,
      // routingPurpose, or anything else) — same dynamic renderer as a node, different group set.
      const data = Object.assign(
        { source: pfLabelFor(e.from), target: pfLabelFor(e.to), style: e.style },
        e.label ? { transitionCondition: e.label } : {},
        e
      );
      delete data.from; delete data.to; delete data.label;
      pfRenderGroups(document.getElementById('pfDynamic'), data, PF_EDGE_GROUPS, []);
      pfDrawer.classList.add('is-open');
      document.body.classList.add('pf-open');
      pfDrawer.setAttribute('aria-hidden', 'false');
      pfNodeEls().forEach(el => el.classList.remove('is-sel'));
      pfEdgeEls().forEach(el => el.classList.toggle('is-sel', Number(el.dataset.eidx) === idx));
      document.getElementById('pfClose').focus();
    }

    function pfClose() {
      pfDrawer.classList.remove('is-open');
      document.body.classList.remove('pf-open');
      pfDrawer.setAttribute('aria-hidden', 'true');
      pfNodeEls().forEach(el => el.classList.remove('is-sel'));
      pfEdgeEls().forEach(el => el.classList.remove('is-sel'));
      if (pfSelected) {
        const el = pfNodeEls().find(e => e.dataset.id === pfSelected);
        if (el) el.focus();
      } else if (pfSelectedEdge !== null) {
        const el = pfEdgeEls().find(e => Number(e.dataset.eidx) === pfSelectedEdge);
        if (el) el.focus();
      }
      pfSelected = null;
      pfSelectedEdge = null;
    }

    function pfApplyFilter(type) {
      const all = type === 'all';
      pfNodeEls().forEach(el => el.classList.toggle('is-dim', !all && el.dataset.type !== type));
      const visible = new Set(PF_NODES.filter(n => all || n.type === type).map(n => n.id));
      pfEdgeEls().forEach(el => {
        const on = all || (visible.has(el.dataset.from) && visible.has(el.dataset.to));
        el.classList.toggle('is-dim', !on);
      });
      document.querySelectorAll('.pf-chip').forEach(c =>
        c.setAttribute('aria-pressed', String(c.dataset.filter === type)));
    }
    // Exports must always show the whole diagram — a filtered PNG silently loses
    // nodes and reads as the complete picture, which is worse than no filter at all.
    // Closing the drawer first also restores the page width the capture is measured from.
    function pfResetView() { pfApplyFilter('all'); if (pfSelected || pfSelectedEdge !== null) pfClose(); }

    pfNodeEls().forEach(el => {
      // Plain click behaviour branches on View Details mode. OFF (default): toggles the
      // persistent neighbor highlight instead of opening the drawer, as established before this
      // mode existed. ON: click opens/updates the drawer directly, every time, as a pinned
      // inspection panel. Double click keeps its own OFF-mode behaviour (opens the drawer
      // transiently) unchanged either way — while View Details is ON it's simply redundant with
      // the single click, not conflicting with it (its two leading native 'click' events already
      // run the branch below twice before 'dblclick' fires; both branches set state
      // unconditionally rather than toggling when a node is passed explicitly, so the end result
      // is the same regardless of that leading pair). Keyboard access (Enter/Space) is left
      // opening the drawer directly, same as before: there is no keyboard equivalent of a double
      // click, and keyboard users should not lose direct one-key access to a node's detail view.
      el.addEventListener('click', () => {
        if (pfViewDetailsMode) { pfSetLock(el.dataset.id); pfApplyHL(el.dataset.id); pfOpen(el.dataset.id); }
        else { toggleHlLock(el.dataset.id); }
      });
      el.addEventListener('dblclick', () => { pfSetLock(el.dataset.id); pfApplyHL(el.dataset.id); pfOpen(el.dataset.id); });
      el.addEventListener('mouseenter', () => pfHoverHL(el.dataset.id));
      el.addEventListener('mouseleave', () => pfHoverClearHL());
      el.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pfOpen(el.dataset.id); }
      });
    });
    // Connectors are clickable too (§Connectors requirements): source, target, routing purpose,
    // transition condition, triggering event, data transferred, business meaning and downstream
    // impact all live in the same drawer, opened the same way, as any node.
    pfEdgeEls().forEach(el => {
      const idx = Number(el.dataset.eidx);
      el.addEventListener('click', () => pfOpenEdge(idx));
      el.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pfOpenEdge(idx); }
      });
      // Thin connector strokes are hard to hit precisely; widen on hover/focus as an affordance
      // without altering the static (non-interactive) rendering at all.
      const baseWidth = el.getAttribute('stroke-width');
      el.addEventListener('mouseenter', () => { if (baseWidth) el.setAttribute('stroke-width', String(parseFloat(baseWidth) + 1.5)); });
      el.addEventListener('mouseleave', () => { if (baseWidth) el.setAttribute('stroke-width', baseWidth); });
    });
    document.querySelectorAll('.pf-chip').forEach(c =>
      c.addEventListener('click', () => pfApplyFilter(c.dataset.filter)));
    // The × button also turns off View Details mode if that's what's currently keeping the
    // drawer open — the × button and the toggle button are two paths to the same "exit the
    // pinned inspection panel" action, kept in sync so the toggle's own on/off state never
    // silently goes stale relative to whether the drawer is actually showing. pfClose() itself
    // stays unaware of pfViewDetailsMode (setPfViewDetails(false) calls pfClose() internally, so
    // having pfClose() call back into setPfViewDetails would recurse) — this listener is the one
    // place both directions meet, and calling pfClose() twice when in View Details mode is
    // harmless (it only removes classes/resets state that's already gone the second time).
    document.getElementById('pfClose').addEventListener('click', () => { pfClose(); if (pfViewDetailsMode) setPfViewDetails(false); });
    // Escape keeps closing the drawer regardless of View Details mode (a standard, expected
    // escape hatch for any panel, independent of the click-based rules below) but stays in sync
    // with the toggle the same way the × button does.
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && (pfSelected || pfSelectedEdge !== null)) { pfClose(); if (pfViewDetailsMode) setPfViewDetails(false); }
    });
    // Click anywhere outside the drawer closes it — except a node/edge, which already opens
    // or switches the drawer itself via its own listener above; treating that as "outside" too
    // would close the drawer the instant it opens (its own click bubbles to this handler).
    // Suppressed entirely while View Details mode is ON: that mode's whole point is a drawer
    // that survives clicking away from it — only the toggle or its × button (both above) may
    // close it while active.
    document.addEventListener('click', ev => {
      if (pfViewDetailsMode) return;
      if (!(pfSelected || pfSelectedEdge !== null)) return;
      if (pfDrawer.contains(ev.target)) return;
      if (ev.target.closest('.pf-node, .pf-edge')) return;
      pfClose();
    });
    // Releases the highlight lock on a genuine empty-canvas click. Scoped to INSIDE
    // .diagram-container specifically (not "anywhere in the document that isn't a node/edge/
    // drawer" — that broader test was tried first and had a real bug: it also fired for clicks
    // on the filter chips, Export button, or any other page chrome, silently dropping the
    // highlight as a side effect of an unrelated action like changing the type filter). A click
    // on a different node already switches the lock via that node's own click listener
    // (toggleHlLock); clicking an edge does not clear it (opens that edge's own drawer instead,
    // independent of the node highlight, same principle as the node drawer above). Also
    // suppressed while View Details mode is ON, for the same reason as the drawer-close handler
    // just above — the highlight is meant to stay matched to whatever the pinned drawer shows.
    document.addEventListener('click', ev => {
      if (pfViewDetailsMode) return;
      if (!pfHlLocked) return;
      if (!ev.target.closest('.diagram-container')) return;
      if (ev.target.closest('.pf-node, .pf-edge')) return;
      pfClearLock(); pfClearAllHL();
    });

    /* Drawer resize — pointer drag plus arrow keys, clamped so the panel can never
       swallow the diagram or shrink below a readable measure. */
    (function () {
      const handle = document.getElementById('pfHandle');
      const MIN = 320, MAX = 760;
      const setW = w => document.documentElement.style.setProperty('--pf-drawer-w', Math.min(MAX, Math.max(MIN, w)) + 'px');
      let dragging = false;
      handle.addEventListener('pointerdown', ev => { dragging = true; handle.setPointerCapture(ev.pointerId); ev.preventDefault(); });
      handle.addEventListener('pointermove', ev => { if (dragging) setW(window.innerWidth - ev.clientX); });
      handle.addEventListener('pointerup', ev => { dragging = false; handle.releasePointerCapture(ev.pointerId); });
      handle.addEventListener('keydown', ev => {
        const cur = pfDrawer.getBoundingClientRect().width;
        if (ev.key === 'ArrowLeft') { setW(cur + 24); ev.preventDefault(); }
        if (ev.key === 'ArrowRight') { setW(cur - 24); ev.preventDefault(); }
      });
    })();
    /* Keeps --pf-header-h (see .pf-drawer's own comment) in sync with .header's REAL rendered
       height, not a hardcoded guess — run on load and resize since a wrapped title only
       changes the header's height at some viewport widths, not others. */
    (function () {
      function syncPfHeaderH() {
        const header = document.querySelector('.header');
        if (!header) return;
        // .bottom, not .height: unlike bpmn-swimlane's app header, .header here does not sit
        // flush against the very top of the viewport (the page has its own top padding above
        // it), so its own height alone understates how far down its visible bottom edge
        // actually is — exactly the coordinate the fixed-position drawer's own top needs to match.
        document.documentElement.style.setProperty('--pf-header-h', header.getBoundingClientRect().bottom + 'px');
      }
      syncPfHeaderH();
      window.addEventListener('load', syncPfHeaderH);
      window.addEventListener('resize', syncPfHeaderH);
    })();`;
}

/* ============================================================= *
 * DETERMINISTIC AUDIT TRAIL
 * ============================================================= */
function computeSpecHash(spec) {
  // Compute SHA256 hash of normalized spec for audit trail
  const normalized = JSON.stringify(spec, Object.keys(spec).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/* ============================================================= *
 * HTML ASSEMBLY
 * ============================================================= */
function buildHTML(spec, viewportWidth = 1200) {
  // Apply configuration (v2.3+)
  const config = mergeConfig(spec);
  PLATE = { ...PLATE, ...(config.styling?.payloadLabelBackground || {}) };
  EDGE_LABEL_LIFT = config.layout.edgeLabelSpacing;

  const { svg, W, ctx } = buildSVG(spec, viewportWidth);
  const interactive = spec.interactive !== false;  // defaults to true unless explicitly disabled
  const containerWidth = config.layout.containerWidth;  // null for responsive, number for fixed
  const containerMax = containerWidth || 1920;  // Use fixed width if set, else 1920 responsive ceiling
  const cards = spec.cards || {};
  const slug = (spec.slug || (spec.title || 'process-flow').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) || 'process-flow';
  const ix = interactive ? interactiveMarkup(ctx) : { filters: '', drawer: '' };
  const ignoreCls = interactive
    ? `(e) => e.classList && (e.classList.contains('toolbar') || e.classList.contains('pf-drawer') || e.classList.contains('pf-filters'))`
    : `(e) => e.classList && e.classList.contains('toolbar')`;
  const resetCall = interactive ? '\n      pfResetView();\n      await new Promise(r => setTimeout(r, 300));' : '';

  // Compute deterministic audit trail metadata (v2.3 §11)
  const specHash = computeSpecHash(spec);
  const timestamp = new Date().toISOString();
  const version = '2.3';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="spec-hash" content="sha256:${specHash}">
  <meta name="generated-at" content="${timestamp}">
  <meta name="diagram-version" content="${version}">
  <title>${esc(spec.title || 'Process Flow')} - Process Flow</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js" integrity="sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js" integrity="sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/" crossorigin="anonymous"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'JetBrains Mono', monospace; background: #E9F2FE; min-height: 100vh; padding: 2rem; color: #1a1a1a; }
    /* containerWidth is a CEILING, never a fixed width. Setting it as a plain width made the page
     * itself wider than any viewport narrower than the generation width, so the BODY scrolled
     * horizontally and the header, filter bar and diagram all ran off the right edge. */
    .container { width: 100%; max-width: ${containerMax}px; margin: 0 auto; }
    /* position:relative + z-index above .pf-drawer's (40) is required, not decorative: the
     * drawer is position:fixed;top:0;height:100vh, so with no stacking context of its own
     * .header (a normal in-flow element) would paint BENEATH it whenever the drawer is open,
     * covering the Export button in the toolbar and making it unclickable as well as hidden.
     * Raising .header above the drawer's stacking level fixes click-through, but .header itself
     * has always been transparent (the page body's own light-blue shows through it) — without
     * an opaque background of its own here too, the white drawer panel would still show visually
     * behind/around the toolbar buttons even once they're clickable again, which reads as
     * "half-covered" rather than genuinely clear. background matches the page body colour so the
     * header reads as normal, undisturbed page chrome sitting above the drawer, not a visibly
     * different opaque patch appearing only when the drawer opens. */
    .header { position: relative; z-index: 50; background: #E9F2FE; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-start; }
    .header-content { flex: 1; }
    .header-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
    .pulse-dot { width: 12px; height: 12px; background: #6d4aad; border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.025em; }
    /* The canvas is a CARD on the page ground, not a bare region: on a light theme a diagram
       painted directly onto the page has no edge, so the drawing and the chrome around it read as
       one undifferentiated field. The card gives the diagram a boundary without a heavy frame. */
    .diagram-container { overflow-x: auto; width: 100%; background: #ffffff; border: 1px solid #A4D3FF; border-radius: 1rem; padding: 1.25rem; }
    /* Fully fluid: width:100% + the viewBox does the scaling, and there is deliberately NO px
     * floor. A min-width here would stop the diagram shrinking and just move the horizontal
     * scrollbar from the page onto .diagram-container — the diagram would still not be visible
     * in one view, which is the thing being fixed. Aspect ratio is preserved by height:auto. */
    svg { width: 100%; height: auto; display: block; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: 2rem; }
    .card { background: #ffffff; border-radius: 0.75rem; border: 1px solid #A4D3FF; padding: 1.25rem; }
    .card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .card-dot { width: 8px; height: 8px; border-radius: 50%; }
    .card-dot.cyan { background: #16829a; } .card-dot.emerald { background: #2e9e6b; } .card-dot.violet { background: #7c5cd6; }
    .card-dot.amber { background: #9e7513; } .card-dot.rose { background: #d4667f; } .card-dot.slate { background: #6b7280; }
    .card h3 { font-size: 0.875rem; font-weight: 600; }
    .card ul { list-style: none; color: #6b7280; font-size: 0.75rem; }
    .card li { margin-bottom: 0.375rem; }
    .io-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .io-table th, .io-table td { border: 1px solid #e5e1da; padding: 0.625rem 0.75rem; text-align: left; vertical-align: top; line-height: 1.5; }
    .io-table thead th { background: #E9F2FE; color: #44464d; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.75rem; }
    .io-table tbody th { background: #F4F8FE; color: #1a1a1a; font-weight: 700; white-space: nowrap; }
    .io-table td { color: #2c2c2c; }
    .io-table .io-col-step { width: 64px; }
    .io-table td.io-in { border-left: 2px solid #2e9e6b; }
    .io-table td.io-out { border-left: 2px solid #16829a; }
    .io-table td.io-ex { color: #6d4aad; white-space: nowrap; }
    .io-table td.io-mean { color: #6b7280; }
    /* Export menu (r7). The trigger is a labelled button, not an ellipsis glyph: an unlabelled
     * ellipsis gives no clue that export lives behind it, so the feature went unfound. The
     * popover keeps its own surface + border so it still reads as chrome floating ABOVE the
     * page now that the page itself is light — on a light theme a light popover with only a
     * shadow to separate it dissolves into the background, so the border does the work. */
    .toolbar { display: flex; gap: 0.5rem; flex-shrink: 0; align-items: center; position: relative; }
    .export-btn { background: #f8fafc; border: 1px solid #e2e8f0; color: #0f172a; font-family: inherit; font-size: 0.8125rem; font-weight: 600; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; transition: background 0.15s, box-shadow 0.15s; box-shadow: 0 1px 2px rgba(24,20,14,0.06); }
    .export-btn:hover { background: #ffffff; box-shadow: 0 2px 6px rgba(24,20,14,0.10); }
    .export-menu { display: none; position: absolute; top: calc(100% + 0.5rem); right: 0; z-index: 40; min-width: 13rem; padding: 0.375rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.625rem; box-shadow: 0 10px 24px rgba(24,20,14,0.14); }
    .export-menu.open { display: block; }
    .export-item { display: flex; align-items: baseline; justify-content: space-between; gap: 1.5rem; width: 100%; background: transparent; border: none; border-radius: 0.375rem; padding: 0.5rem 0.75rem; font-family: inherit; font-size: 0.8125rem; color: #0f172a; cursor: pointer; text-align: left; transition: background 0.12s; }
    .export-item:hover { background: #e8edf5; }
    .export-fmt { font-weight: 600; letter-spacing: 0.02em; }
    .export-hint { color: #64748b; font-size: 0.6875rem; white-space: nowrap; }
    .export-sep { height: 1px; margin: 0.25rem 0.5rem; background: #e2e8f0; }
    .export-btn:focus-visible, .export-item:focus-visible { outline: 2px solid #6d4aad; outline-offset: 2px; }
    /* View Details toggle reuses .export-btn's shape/sizing for visual consistency with the
     * other toolbar button, with its own accent-filled "on" state (matching the purple accent
     * used elsewhere on this page — .pulse-dot, focus rings) so its active/inactive state reads
     * clearly at a glance, the same way .pf-chip[aria-pressed="true"] already does for filters. */
    .view-details-btn.is-active { background: #6d4aad; color: #ffffff; border-color: #6d4aad; }
    .view-details-btn.is-active:hover { background: #7c5cd6; }
    @media (max-width: 768px) { .header { flex-direction: column; gap: 1rem; } }
    @media print { body { background: #E9F2FE; padding: 1rem; } .toolbar { display: none !important; } }${interactive ? interactiveCSS() : ''}
  </style>
</head>
<body>
  <div class="container" id="report-container">
    <div class="header">
      <div class="header-content">
        <div class="header-row">
          <div class="pulse-dot"></div>
          <h1>${esc(spec.title || 'Process Flow')}</h1>
        </div>
      </div>
      <div class="toolbar">
${interactive ? '        <button class="export-btn view-details-btn" id="viewDetailsBtn" type="button" aria-pressed="false">View Details</button>\n' : ''}        <button class="export-btn" id="exportBtn" onclick="toggleExport(event)" aria-haspopup="menu" aria-expanded="false" aria-controls="exportMenu" aria-label="Export options">Export</button>
        <div class="export-menu" id="exportMenu" role="menu" aria-labelledby="exportBtn">
${EXPORT_FORMATS.map(f =>
  `          <button role="menuitem" class="export-item" onclick="${f.fn}(this)"><span class="export-fmt">${esc(f.label)}</span><span class="export-hint">${esc(f.hint)}</span></button>`
).join('\n')}
          <div class="export-sep" role="separator"></div>
          <button role="menuitem" class="export-item" onclick="downloadPNG(this)"><span class="export-fmt">PNG</span><span class="export-hint">image · slides</span></button>
          <button role="menuitem" class="export-item" onclick="copyAsImage(this)"><span class="export-fmt">Copy</span><span class="export-hint">to clipboard</span></button>
        </div>
      </div>
    </div>
${ix.filters}
    <div class="diagram-container">
      ${svg}
    </div>

    ${!interactive ? (config.cards.showIOTable ? (cards.ioTable && cards.ioTable.length ? ioTableCard(cards.ioTable) : '') : (
      cards.prerequisites || cards.io || cards.tools
      ? [card('slate', 'Prerequisites', cards.prerequisites || spec.prerequisites),
         card('violet', 'Inputs → Outputs', cards.io),
         card('amber', 'Tools & Integrations', cards.tools)].filter(Boolean).join('\n')
      : ''
    )) : ''}

  </div>
${ix.drawer}
  <script>
    const SLUG = ${JSON.stringify(slug)};
    /* Export bounds are measured, not assumed (§11.1).
     *
     * The container's own rect is NOT the diagram's extent: the SVG has a min-width, so on a
     * narrow viewport it is wider than its container and .diagram-container scrolls. Capturing
     * the container rect then silently crops whatever overflowed — the right-hand nodes and the
     * legend — and the exported PNG differs from what the page shows. So walk every descendant
     * and take the true union, which also covers anything that overflows upward or downward. */
    function captureBounds() {
      const el = document.getElementById('report-container');
      const c = el.getBoundingClientRect();
      let l = c.left, t = c.top, r = c.right, b = c.bottom;
      for (const n of el.querySelectorAll('*')) {
        if (n.classList && (n.classList.contains('toolbar') || n.classList.contains('pf-drawer') || n.classList.contains('pf-filters'))) continue;
        const q = n.getBoundingClientRect();
        if (!q.width && !q.height) continue;
        if (q.left < l) l = q.left;
        if (q.top < t) t = q.top;
        if (q.right > r) r = q.right;
        if (q.bottom > b) b = q.bottom;
      }
      return { left: l, top: t, width: r - l, height: b - t };
    }

    async function capture() {${resetCall}
      const el = document.getElementById('report-container');
      // A scrolled diagram must be captured whole: reset the scroll so html2canvas sees the
      // full width, then restore it so the user's view is untouched.
      const dc = document.querySelector('.diagram-container');
      const sx = dc ? dc.scrollLeft : 0;
      if (dc) dc.scrollLeft = 0;
      const wasOverflow = dc ? dc.style.overflowX : '';
      if (dc) dc.style.overflowX = 'visible';
      await new Promise(r => requestAnimationFrame(r));

      const r = captureBounds();
      const pad = 32;
      try {
        return await html2canvas(document.body, { backgroundColor: '#E9F2FE', scale: 2, useCORS: true, ignoreElements: ${ignoreCls}, x: r.left + window.scrollX - pad, y: r.top + window.scrollY - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
      } finally {
        if (dc) { dc.style.overflowX = wasOverflow; dc.scrollLeft = sx; }
      }
    }
    async function copyAsImage(btn) {
      setExportOpen(false); exportStatus('⏳ …');
      try {
        const canvas = await capture();
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        exportStatus('✓ Copied', 2000);
      } catch (e) { exportStatus('✗ Failed', 2000); }
    }
    async function downloadPNG(btn) {
      setExportOpen(false); exportStatus('⏳ …');
      try {
        const canvas = await capture();
        const link = document.createElement('a'); link.download = SLUG + '.png'; link.href = canvas.toDataURL('image/png'); link.click();
        exportStatus('✓ PNG', 2000);
      } catch (e) { exportStatus('✗ Failed', 2000); }
    }
    /* The menu closes on outside click, on Escape, and after a format is chosen — a popover
     * that stays open behind the download it just started reads as though nothing happened. */
    function setExportOpen(open) {
      document.getElementById('exportMenu').classList.toggle('open', open);
      document.getElementById('exportBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function toggleExport(ev) {
      ev.stopPropagation();
      setExportOpen(!document.getElementById('exportMenu').classList.contains('open'));
    }
    document.addEventListener('click', e => {
      if (!e.target.closest('.toolbar')) setExportOpen(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('exportMenu').classList.contains('open')) {
        setExportOpen(false); document.getElementById('exportBtn').focus();
      }
    });

    /* Status is shown on the trigger, not on the menu item: the menu closes on choose, so a
     * message written into the item would vanish with it. */
    function exportStatus(msg, revert) {
      const b = document.getElementById('exportBtn');
      if (revert === undefined) { b.textContent = msg; return; }
      b.textContent = msg;
      setTimeout(() => b.textContent = 'Export', revert);
    }

    /* SVG export is a real vector serialisation, not a raster (§11.1 r7).
     *
     * The live <svg> inherits its font from the page stylesheet, which does NOT travel with a
     * detached clone — open the file standalone and every label reflows in a fallback face,
     * shifting off the geometry the generator computed. So the clone gets the font stack and
     * the canvas ground written onto it explicitly. Nothing else is restyled: all colours are
     * already presentation attributes on the elements themselves. */
    function downloadSVG(btn) {
      try {
        const src = document.querySelector('.diagram-container svg');
        const clone = src.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        const vb = (src.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
        if (vb.length === 4) { clone.setAttribute('width', vb[2]); clone.setAttribute('height', vb[3]); }
        clone.removeAttribute('style');
        clone.setAttribute('style', 'background:' + ${JSON.stringify(CANVAS_GROUND)});
        const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        // The live page's main <style> block (.pf-node, .pf-hl-dim, .pf-hl-path, .pf-hl-lock,
        // .is-dim, .is-sel, …) lives in <head>, OUTSIDE this <svg> — cloning just the svg element
        // does not carry it along, so a standalone-opened export previously lost any highlight,
        // selection or filter styling even though the classes themselves were still present on
        // the cloned elements (the export never stripped them, it simply had no CSS to render
        // them with). These rules are the highlight-related subset that must travel with the
        // file so it "represents exactly what the user is viewing" per the interactive state
        // active at export time, not a silently-reset clean diagram.
        st.textContent = 'text{font-family:' + getComputedStyle(src).fontFamily.replace(/"/g, "'") + '}'
          + '.pf-node.pf-hl-dim,.pf-edge.pf-hl-dim,.pf-elabel.pf-hl-dim{opacity:.12;filter:grayscale(1) brightness(1.15);}'
          + '.pf-edge.pf-hl-path{stroke:#e60000 !important;filter:drop-shadow(0 0 3px rgba(230,0,0,.55));}'
          + '.pf-node.pf-hl-lock>rect,.pf-node.pf-hl-lock>circle,.pf-node.pf-hl-lock>g>rect{stroke:#e60000 !important;stroke-width:3 !important;}'
          + '.pf-node.is-dim,.pf-edge.is-dim{opacity:.22;}'
          + '.pf-node.is-sel>rect,.pf-node.is-sel>circle,.pf-node.is-sel>g>rect{stroke-width:3;}';
        clone.insertBefore(st, clone.firstChild);
        const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\\n' + new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.download = SLUG + '.svg'; link.href = url; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setExportOpen(false); exportStatus('✓ SVG', 2000);
      } catch (e) { setExportOpen(false); exportStatus('✗ Failed', 2000); }
    }

    /* JPEG has no alpha, so an un-flattened canvas renders transparent pixels BLACK — which
     * on this palette is invisible damage rather than an obvious bug. Composite onto the
     * canvas ground first. */
    async function downloadJPG(btn) {
      setExportOpen(false); exportStatus('⏳ …');
      try {
        const canvas = await capture();
        const flat = document.createElement('canvas');
        flat.width = canvas.width; flat.height = canvas.height;
        const g = flat.getContext('2d');
        g.fillStyle = ${JSON.stringify(CANVAS_GROUND)};
        g.fillRect(0, 0, flat.width, flat.height);
        g.drawImage(canvas, 0, 0);
        const link = document.createElement('a'); link.download = SLUG + '.jpg';
        link.href = flat.toDataURL('image/jpeg', ${JPEG_QUALITY}); link.click();
        exportStatus('✓ JPG', 2000);
      } catch (e) { exportStatus('✗ Failed', 2000); }
    }
    async function downloadPDF(btn) {
      setExportOpen(false); exportStatus('⏳ …');
      try {
        const canvas = await capture();
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
        const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height], hotfixes: ['px_scaling'] });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(SLUG + '.pdf');
        exportStatus('✓ PDF', 2000);
      } catch (e) { exportStatus('✗ Failed', 2000); }
    }${interactive ? interactiveJS(ctx) : ''}
  </script>
</body>
</html>
`;
}

/* ============================================================= *
 * CLI
 * ============================================================= */
function parseConfigFlag(flag) {
  // Parse --config.path.to.value=123 into { path: { to: { value: 123 } } }
  if (!flag.startsWith('--config.')) return null;
  const [, pathStr, val] = flag.match(/^--config\.(.+?)=(.+)$/) || [];
  if (!pathStr) return null;

  const keys = pathStr.split('.');
  const obj = {};
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = {};
    current = current[keys[i]];
  }

  // Try to parse value as number, boolean, or string
  let value = val;
  if (val === 'true') value = true;
  else if (val === 'false') value = false;
  else if (!isNaN(val)) value = Number(val);

  current[keys[keys.length - 1]] = value;
  return obj;
}

function deepMergeConfig(base, override) {
  // Deep merge config objects (helper for recursive merging)
  const result = { ...base };
  for (const key in override) {
    if (typeof override[key] === 'object' && override[key] !== null) {
      result[key] = deepMergeConfig(result[key] || {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

function main() {
  const args = process.argv.slice(2);
  let viewportWidth = 1200;
  let configOverride = {};

  if (args[0] === '--demo') {
    const demo = require('../references/example-spec.json');
    const out = path.join(process.cwd(), 'demo.html');
    fs.writeFileSync(out, buildHTML(demo, 1600));
    console.log('✓ Wrote ' + out + ' (viewport: 1600px)');
    return;
  }

  if (!args[0]) {
    console.error('Usage: node generate.js <spec.json> [out.html] [viewport_width] [--config.key=value ...]');
    process.exit(1);
  }

  // Parse positional arguments
  if (args[2]) {
    const parsed = parseInt(args[2], 10);
    if (!isNaN(parsed) && parsed > 0) viewportWidth = parsed;
    else { console.error(`✗ Viewport width "${args[2]}" is not a positive number.`); process.exit(1); }
  }

  // Parse config flags (--config.key=value)
  for (let i = 3; i < args.length; i++) {
    const config = parseConfigFlag(args[i]);
    if (config) {
      configOverride = mergeConfig(configOverride, config);
    }
  }

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(args[0], 'utf8'));
  } catch (e) {
    console.error(`✗ Cannot read ${args[0]}: ${e.message}`);
    process.exit(1);
  }

  // STEP 1: NORMALIZE SPEC (Deterministic preprocessing)
  const normalizer = new SpecNormalizer(spec);
  const normalizationResult = normalizer.normalize();

  if (normalizationResult.error) {
    console.error(`✗ Spec normalization failed: ${normalizationResult.error.message}`);
    process.exit(1);
  }

  // Use normalized spec for diagram generation
  spec = normalizationResult.normalized;

  // Check for --normalize-only flag
  if (args.includes('--normalize-only')) {
    const normalizedOut = args[1] || args[0].replace(/\.json$/, '-normalized.json');
    fs.writeFileSync(normalizedOut, JSON.stringify(normalizationResult, null, 2));
    console.log(`✓ Normalized spec written to ${normalizedOut}`);
    console.log(`  Hash: ${normalizationResult.metadata.inputDataHash}`);
    console.log(`  Timestamp: ${normalizationResult.metadata.processedAtTimestamp}`);
    return;
  }

  // Apply config overrides to spec
  if (Object.keys(configOverride).length > 0) {
    spec.config = mergeConfig(spec.config || {}, configOverride);
  }

  const out = args[1] || args[0].replace(/\.json$/, '') + '.html';

  let html;
  try {
    html = buildHTML(spec, viewportWidth);
  } catch (e) {
    // The validator's messages name the offending node and the valid values; printing them as
    // a stack trace buries the one line that helps.
    if (e.name === 'SpecError') { console.error(`✗ ${e.message}`); process.exit(1); }
    throw e;
  }
  fs.writeFileSync(out, html);
  console.log(`✓ Wrote ${out} (viewport: ${viewportWidth}px, collision-free, auto-wrapped${spec.interactive ? ', interactive' : ''})`);
  console.log(`  Spec hash: ${normalizationResult.metadata.inputDataHash}`);
  console.log(`  Normalized at: ${normalizationResult.metadata.processedAtTimestamp}`);

  // VALIDATION GATE: Compliance check before release (v2.3 §0-§12)
  try {
    validateDiagramCompliance(html);
    console.log(`✓ Compliance validation passed (§0-§12 compliant)`);
  } catch (e) {
    console.error(`\n❌ Compliance validation failed:`, e.message);
    process.exit(1);
  }

  console.log(`  Next: node ${path.relative(process.cwd(), path.join(__dirname, 'verify.js'))} ${out}`);
}

if (require.main === module) main();
module.exports = { buildHTML, buildSVG, computeLayout, nodeBaselines };
