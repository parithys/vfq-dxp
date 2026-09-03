/**
 * User Flow Diagram Generator — v4.0
 * Orthogonal-Routing Layout Engine (Domain-Agnostic)
 *
 * Rewrite goals (fixes over v3.1):
 *  - Nodes are sized from their own text (measured + word-wrapped) — never
 *    fixed-width-regardless-of-content, so labels can never clip/truncate.
 *  - Every connector is built from straight vertical/horizontal segments only
 *    (elbow / straight connectors). No diagonals, no curves, no freeform paths.
 *  - A 3-column trunk/left/right grid plus greedily-assigned outer "lanes"
 *    for long-jump / loop-back edges, so bypass connectors route AROUND the
 *    diagram instead of cutting diagonally through nodes.
 *  - Canvas size is derived from the actual computed geometry (auto-fit),
 *    never fixed/clipped.
 *  - A post-layout validator checks overlaps, clipped text, and connectors
 *    crossing node boxes, and throws with an actionable message rather than
 *    silently shipping a broken diagram.
 */

'use strict';

// ============================================================================
// PART 1: DESIGN TOKENS
// ============================================================================

const THEME = {
  font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif`,
  canvasBg: '#f7f8fa',

  node: {
    start:    { fill: '#1fa971', stroke: '#0e7a4d', text: '#ffffff', shape: 'circle' },
    end:      { fill: '#1fa971', stroke: '#0e7a4d', text: '#ffffff', shape: 'circle' },
    action:   { fill: '#2f80ed', stroke: '#1c5fc4', text: '#ffffff', shape: 'rect' },
    screen:   { fill: '#2f80ed', stroke: '#1c5fc4', text: '#ffffff', shape: 'rect' },
    process:  { fill: '#f2994a', stroke: '#c96f22', text: '#ffffff', shape: 'rect' },
    decision: { fill: '#eb5757', stroke: '#b83a3a', text: '#ffffff', shape: 'diamond' },
    error:    { fill: '#eb5757', stroke: '#b83a3a', text: '#ffffff', shape: 'rect' }
  },

  // Connector "kind" -> visual style. Any edge `type` not listed here falls
  // back to the `default` style, so the skill still works for arbitrary
  // domain vocabularies.
  edge: {
    default:  { color: '#5b6570', dash: '0' },
    success:  { color: '#1fa971', dash: '0' },
    granted:  { color: '#1fa971', dash: '0' },
    valid:    { color: '#1fa971', dash: '0' },
    approved: { color: '#1fa971', dash: '0' },
    yes:      { color: '#1fa971', dash: '0' },
    failure:  { color: '#eb5757', dash: '6,4' },
    denied:   { color: '#eb5757', dash: '6,4' },
    rejected: { color: '#eb5757', dash: '6,4' },
    blocked:  { color: '#eb5757', dash: '6,4' },
    no:       { color: '#eb5757', dash: '6,4' },
    escalate: { color: '#eb5757', dash: '6,4' },
    fallback: { color: '#f2994a', dash: '6,4' },
    alternate:{ color: '#f2994a', dash: '6,4' },
    reference:{ color: '#f2994a', dash: '6,4' }
  },

  typography: {
    label:   { size: 12.5, weight: 700, lineHeight: 16 },
    sublabel:{ size: 10.5, weight: 500, lineHeight: 13 },
    edge:    { size: 10.5, weight: 700 },
    title:   { size: 26, weight: 800 },
    section: { size: 16, weight: 700 },
    stat:    { size: 28, weight: 800 }
  }
};

// Types treated as "negative / terminal" for side-placement + coloring.
const NEGATIVE_EDGE_TYPES = new Set([
  'failure', 'denied', 'rejected', 'blocked', 'no', 'escalate', 'error'
]);
// Types treated as the "happy path" continuation when a node has >1 outgoing edge.
const PRIMARY_EDGE_TYPES = new Set([
  'default', 'success', 'granted', 'valid', 'approved', 'yes'
]);

// ============================================================================
// PART 2: GEOMETRY / SPACING CONSTANTS
// ============================================================================

const G = {
  margin: 48,
  colGap: 96,       // horizontal gap between columns/lanes (must fit an edge label)
  rowGap: 64,       // vertical gap between rows (must fit a connector + label)
  laneGap: 40,       // spacing between stacked outer lanes
  nodePadX: 18,
  nodePadY: 12,
  minRectW: 160,
  maxRectW: 230,
  rectH1: 46,        // single-line rect height
  lineH: 15,
  minDiamond: 130,
  maxDiamond: 240,
  circleD: 68,
  arrow: 9
};

// ============================================================================
// PART 3: TEXT MEASUREMENT + WRAPPING (no canvas/DOM dependency)
// ============================================================================

// These constants intentionally over-estimate real glyph widths (measured
// against bold system-UI fonts). Text wrapping/node-sizing must NEVER clip,
// so it is always safer to size a node slightly too wide than too narrow —
// there is no DOM/canvas available at generation time to measure exactly.
function charWidth(ch, size) {
  if (ch === ' ') return size * 0.34;
  if ('iIl.,:;\'|!'.includes(ch)) return size * 0.34;
  if ('mMW@%'.includes(ch)) return size * 1.0;
  if (/[A-Z0-9]/.test(ch)) return size * 0.72;
  return size * 0.62;
}

const TEXT_WIDTH_SAFETY = 1.08; // extra headroom on top of the per-char estimate

function textWidth(str, size) {
  let w = 0;
  for (const ch of String(str)) w += charWidth(ch, size);
  return w * TEXT_WIDTH_SAFETY;
}

function wrapToWidth(text, maxWidth, size) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (textWidth(test, size) <= maxWidth || !cur) {
      cur = test;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Wrap text to fit within `maxWidth`, growing the width (up to `hardCap`) if
// wrapping would otherwise exceed `maxLines`. Guarantees text is NEVER
// truncated — worst case the node simply becomes wider.
function fitText(text, { startWidth, hardCap, size, maxLines }) {
  let width = startWidth;
  let lines = wrapToWidth(text, width, size);
  while (lines.length > maxLines && width < hardCap) {
    width = Math.min(hardCap, width * 1.15);
    lines = wrapToWidth(text, width, size);
  }
  const measuredWidth = Math.max(...lines.map(l => textWidth(l, size)), 0);
  return { lines, width: Math.max(measuredWidth, Math.min(width, hardCap)) };
}

// ============================================================================
// PART 4: INPUT NORMALIZATION + VALIDATION
// ============================================================================

function normalizeInput(input) {
  if (!input || !Array.isArray(input.nodes) || !Array.isArray(input.paths)) {
    throw new Error('Input must have `nodes` (array) and `paths` (array).');
  }
  const nodeIds = new Set(input.nodes.map(n => n.id));
  if (nodeIds.size !== input.nodes.length) {
    throw new Error('Duplicate node ids detected.');
  }
  for (const p of input.paths) {
    if (!nodeIds.has(p.from)) throw new Error(`Path references unknown source node "${p.from}"`);
    if (!nodeIds.has(p.to)) throw new Error(`Path references unknown target node "${p.to}"`);
  }
  const starts = input.nodes.filter(n => n.type === 'start');
  if (starts.length === 0) throw new Error('No node with type "start" found.');

  const nodes = input.nodes.map(n => ({
    id: n.id,
    label: n.label != null ? String(n.label) : n.id,
    code: n.code || null,
    type: THEME.node[n.type] ? n.type : 'action'
  }));
  const paths = input.paths.map(p => ({
    from: p.from,
    to: p.to,
    type: THEME.edge[p.type] ? p.type : 'default',
    label: p.label || null
  }));
  return { nodes, paths, metadata: input.metadata || {} };
}

// ============================================================================
// PART 5: GRAPH LAYOUT ENGINE
// ============================================================================

class LayoutEngine {
  constructor(nodes, paths) {
    this.nodes = new Map(nodes.map(n => [n.id, { ...n }]));
    this.paths = paths;
    this.out = new Map(nodes.map(n => [n.id, []]));
    this.in = new Map(nodes.map(n => [n.id, []]));
    for (const p of paths) {
      this.out.get(p.from).push(p);
      this.in.get(p.to).push(p);
    }
  }

  // Pick, for a node with multiple outgoing edges, which one continues the
  // trunk (main flow) vs. which are side branches.
  _primaryEdge(nodeId) {
    const edges = this.out.get(nodeId) || [];
    if (edges.length <= 1) return edges[0] || null;
    const primary = edges.find(e => PRIMARY_EDGE_TYPES.has(e.type));
    if (primary) return primary;
    const nonNegative = edges.find(e => !NEGATIVE_EDGE_TYPES.has(e.type));
    return nonNegative || edges[0];
  }

  build() {
    const start = [...this.nodes.values()].find(n => n.type === 'start');
    const placed = new Map(); // id -> { row, col: -1|0|1, laneCol? }
    const trunkAssigned = new Set();
    const order = []; // render/traverse order

    // 1) Walk the trunk (primary edges only) to assign the main column.
    let cursor = start.id;
    let row = 0;
    const visitedTrunk = new Set();
    while (cursor && !visitedTrunk.has(cursor)) {
      visitedTrunk.add(cursor);
      placed.set(cursor, { row, col: 0 });
      trunkAssigned.add(cursor);
      order.push(cursor);
      const primary = this._primaryEdge(cursor);
      if (!primary) break;
      cursor = primary.to;
      row += 1;
    }

    // 2) Walk side-branch chains for every node that has non-primary
    //    outgoing edges. Each branch keeps its own column (left/right) and
    //    increments its own row as it goes, until it dead-ends or reaches a
    //    node already placed on the trunk (a "merge" — handled at render
    //    time as a normal elbow, not a lane).
    const branchQueue = [];
    for (const id of trunkAssigned) {
      const primary = this._primaryEdge(id);
      for (const e of this.out.get(id)) {
        if (primary && e === primary) continue;
        branchQueue.push({ edge: e, parentRow: placed.get(id).row });
      }
    }

    while (branchQueue.length) {
      const { edge, parentRow } = branchQueue.shift();
      if (placed.has(edge.to)) continue; // already on trunk or another branch
      const side = NEGATIVE_EDGE_TYPES.has(edge.type) ? -1 : 1;
      let r = parentRow + 1;
      let node = edge.to;
      let firstInChain = true;
      while (node && !placed.has(node)) {
        placed.set(node, { row: r, col: side });
        order.push(node);
        const outs = this.out.get(node) || [];
        if (outs.length === 0) break; // dead end (terminal branch node)
        // Continue the same branch chain only via its own primary edge;
        // any additional edges off this branch node get queued too.
        const primaryHere = this._primaryEdge(node);
        for (const e2 of outs) {
          if (e2 === primaryHere) continue;
          branchQueue.push({ edge: e2, parentRow: r });
        }
        if (!primaryHere) break;
        if (placed.has(primaryHere.to)) break; // merges back into trunk/branch
        node = primaryHere.to;
        r += 1;
        firstInChain = false;
      }
    }

    // 3) Any node still unplaced (disconnected from primary walks, e.g. an
    //    isolated component) gets appended to the trunk at the bottom so
    //    nothing is ever silently dropped from the diagram.
    let tailRow = Math.max(...[...placed.values()].map(p => p.row), 0) + 1;
    for (const id of this.nodes.keys()) {
      if (!placed.has(id)) {
        placed.set(id, { row: tailRow++, col: 0 });
        order.push(id);
      }
    }

    // 4) Classify every path as trunk | branch | jump.
    //    trunk/branch: row(to) === row(from)+1 and col relationship simple.
    //    jump: everything else (back-edges, skips, cross-column reconnects
    //    that are not a direct parent->child in the walks above).
    const placedRowCol = placed;
    const isDirectChild = (p) => {
      const a = placedRowCol.get(p.from), b = placedRowCol.get(p.to);
      if (!a || !b) return false;
      if (b.row !== a.row + 1) return false;
      // same column (trunk-trunk, branch-branch) or trunk<->branch (col 0 <-> ±1)
      return true;
    };

    const classified = this.paths.map(p => {
      const direct = isDirectChild(p);
      return { ...p, kind: direct ? 'direct' : 'jump' };
    });

    // Only the FIRST edge discovered into a given "direct child" during the
    // build walks should stay "direct"; if two edges both point at the same
    // row+1 target (e.g. a duplicate), later ones become jumps to avoid two
    // overlapping direct connectors. (Rare edge case safeguard.)
    const claimedDirectTargets = new Set();
    for (const p of classified) {
      if (p.kind === 'direct') {
        const key = p.to;
        if (claimedDirectTargets.has(key)) p.kind = 'jump';
        else claimedDirectTargets.add(key);
      }
    }

    return { placed: placedRowCol, paths: classified, order };
  }
}

// ============================================================================
// PART 6: SIZING — turn every node into a concrete box
// ============================================================================

function sizeNode(node) {
  const style = THEME.node[node.type];
  const t = THEME.typography.label;

  if (style.shape === 'circle') {
    // Usable inscribed box for text inside a circle is ~0.7 of the diameter.
    let d = G.circleD;
    let fit = fitText(node.label, {
      startWidth: d * 0.72,
      hardCap: d * 0.72,
      size: t.size,
      maxLines: 2
    });
    const textH = fit.lines.length * t.lineHeight;
    // Grow the circle until both wrapped width and height fit inscribed.
    while ((fit.width > d * 0.72 || textH > d * 0.72) && d < 160) {
      d += 8;
      fit = fitText(node.label, { startWidth: d * 0.72, hardCap: d * 0.72, size: t.size, maxLines: 2 });
    }
    return { w: d, h: d, shape: 'circle', lines: fit.lines };
  }

  if (style.shape === 'diamond') {
    // A diamond's usable width TAPERS with distance from its own vertical centre, reaching zero
    // at the top/bottom tips — the previous formula summed the label's FULL height and its
    // single widest line into one flat budget against the diagonal (tw/s + th/s <= 1), which
    // treats a 3-line block as if every line sat at the diamond's widest point. Only the middle
    // line actually does; the outer lines sit where the diamond is narrower AND are usually
    // narrower themselves, so that sum badly over-estimates the diamond a multi-line label
    // needs — for a typical 3-line question, it was demanding more diagonal budget than even
    // the 240px hard cap could supply, so the diamond just pinned at the ceiling, mostly empty.
    // Wrap against each line's own real per-line width instead (the same fix already applied to
    // the pfd engine's fixed-size diamonds, adapted here since THIS diamond grows to fit rather
    // than the reverse), and grow s only as far as that tighter, more accurate fit needs.
    const FILL = 0.78;   // fraction of the true geometric edge actually used — the rest is
                          // intentional clearance from the diamond's own boundary, not slop
    const widthBudget = (s, dy) => Math.max(0, (s - 2 * Math.abs(dy)) * FILL);
    const words = String(node.label || '').split(/\s+/).filter(Boolean);
    function attempt(n, s) {
      const lines = [];
      let cur = '';
      for (const w of words) {
        const trial = cur ? cur + ' ' + w : w;
        const dy = (lines.length - (n - 1) / 2) * t.lineHeight;
        if (textWidth(trial, t.size) <= widthBudget(s, dy) || !cur) cur = trial;
        else {
          lines.push(cur);
          if (lines.length >= n) return null;
          cur = w;
        }
      }
      if (cur) lines.push(cur);
      return lines.length === n ? lines : null;
    }
    // Fewer lines read better than more (a 2-line wrap beats a fragmented 4-line one even if
    // both technically fit), so search line counts outer, diamond size inner: for each candidate
    // line count, grow s from the floor until that exact count fits, and take the FIRST (fewest
    // lines, then smallest s) combination that works — never settle for more lines than the
    // diamond actually needs just because the floor size happened to fit them.
    let s = G.maxDiamond, lines = [words.join(' ')];
    outer:
    for (let n = 1; n <= 4; n++) {
      if (n * t.lineHeight > G.maxDiamond * FILL) continue;   // this many lines can't fit even at the cap
      for (let cand = G.minDiamond; cand <= G.maxDiamond; cand += 6) {
        if (n * t.lineHeight > cand * FILL) continue;   // block too tall for this size yet
        const found = attempt(n, cand);
        if (found) { s = cand; lines = found; break outer; }
      }
    }
    return { w: s, h: s, shape: 'diamond', lines };
  }

  // rect (action/screen/process/error)
  // node.code (the reference/requirement code) is no longer rendered on canvas —
  // always an empty array now, not conditional on node.code being present. This is
  // the single point that decides it: the render function below reads codeLines
  // back off this sized box (`box.codeLines || []`) and skips its own code-text
  // rendering whenever that array is empty, so leaving it empty here is enough —
  // node.code itself is untouched (still present on the node object, harmless
  // pass-through) in case a future consumer other than this renderer wants it.
  const codeLines = [];
  const fit = fitText(node.label, {
    startWidth: G.minRectW - 2 * G.nodePadX,
    hardCap: G.maxRectW - 2 * G.nodePadX,
    size: t.size,
    maxLines: 3
  });
  const w = Math.max(G.minRectW, fit.width + 2 * G.nodePadX);
  const labelH = fit.lines.length * t.lineHeight;
  const codeH = codeLines.length * THEME.typography.sublabel.lineHeight + (codeLines.length ? 4 : 0);
  const h = Math.max(G.rectH1, labelH + codeH + 2 * G.nodePadY);
  return { w, h, shape: 'rect', lines: fit.lines, codeLines };
}

// ============================================================================
// PART 7: COORDINATE ASSIGNMENT
// ============================================================================

function assignCoordinates(layoutResult, sizedNodes) {
  const { placed, paths } = layoutResult;
  const maxRow = Math.max(...[...placed.values()].map(p => p.row));

  // --- Row heights (tallest node in that row, across all columns) ---
  const rowHeight = new Array(maxRow + 1).fill(0);
  for (const [id, pos] of placed) {
    rowHeight[pos.row] = Math.max(rowHeight[pos.row], sizedNodes.get(id).h);
  }
  const rowCenterY = new Array(maxRow + 1);
  const rowTop = new Array(maxRow + 1);
  const rowBottom = new Array(maxRow + 1);
  let y = G.margin;
  for (let r = 0; r <= maxRow; r++) {
    rowTop[r] = y;
    rowCenterY[r] = y + rowHeight[r] / 2;
    rowBottom[r] = y + rowHeight[r];
    y += rowHeight[r] + G.rowGap;
  }
  const totalHeight = y - G.rowGap + G.margin;
  // The empty band strictly between row r and row r+1 — safe for ANY
  // horizontal connector segment to cross, regardless of column, because no
  // node ever occupies this y-range.
  // Each row-gap is split into two sub-bands so a trunk/branch label and a
  // jump-lane transit line that both originate from the same row can never
  // sit on top of each other: branchY hosts direct/branch-out elbow turns
  // and their labels (closer to the node they just left); jumpY hosts the
  // long-haul lane transit legs (further into the gap).
  const branchY = new Array(maxRow);
  const jumpY = new Array(maxRow);
  for (let r = 0; r < maxRow; r++) {
    branchY[r] = rowBottom[r] + G.rowGap * 0.32;
    jumpY[r] = rowBottom[r] + G.rowGap * 0.68;
  }

  // --- Column widths (widest node ever placed in that column) ---
  const colWidth = { '-1': 0, '0': 0, '1': 0 };
  for (const [id, pos] of placed) {
    colWidth[pos.col] = Math.max(colWidth[pos.col], sizedNodes.get(id).w);
  }
  const leftW = colWidth['-1'], trunkW = colWidth['0'], rightW = colWidth['1'];
  const leftX = leftW > 0 ? G.margin + leftW / 2 : null;
  const trunkX = G.margin + (leftW > 0 ? leftW + G.colGap : 0) + trunkW / 2;
  const rightX = rightW > 0 ? trunkX + trunkW / 2 + G.colGap + rightW / 2 : null;
  const outerEdge = (rightX != null ? rightX + rightW / 2 : trunkX + trunkW / 2);

  const colX = { '-1': leftX, '0': trunkX, '1': rightX };

  const boxes = new Map();
  for (const [id, pos] of placed) {
    const size = sizedNodes.get(id);
    const cx = colX[pos.col];
    const cy = rowCenterY[pos.row];
    boxes.set(id, {
      id, cx, cy, w: size.w, h: size.h, shape: size.shape,
      lines: size.lines, codeLines: size.codeLines,
      left: cx - size.w / 2, right: cx + size.w / 2,
      top: cy - size.h / 2, bottom: cy + size.h / 2,
      row: pos.row, col: pos.col
    });
  }

  // --- Lane assignment for "jump" edges (greedy interval packing, smallest
  //     span first so short bypasses hug the diagram and long ones nest
  //     outward around them — never through a node). ---
  const jumps = paths.filter(p => p.kind === 'jump').map(p => {
    const a = placed.get(p.from), b = placed.get(p.to);
    const lo = Math.min(a.row, b.row);
    const hi = Math.max(a.row, b.row);
    return { ...p, lo, hi, span: hi - lo };
  }).sort((a, b) => a.span - b.span);

  const lanes = []; // each lane: { end: lastHiRowOccupied }
  for (const j of jumps) {
    let laneIdx = lanes.findIndex(l => l.hi < j.lo || l.lo > j.hi);
    if (laneIdx === -1) {
      lanes.push({ lo: j.lo, hi: j.hi });
      laneIdx = lanes.length - 1;
    } else {
      lanes[laneIdx] = { lo: Math.min(lanes[laneIdx].lo, j.lo), hi: Math.max(lanes[laneIdx].hi, j.hi) };
    }
    j.laneIndex = laneIdx;
  }
  const laneX = lanes.map((_, i) => outerEdge + G.colGap + i * G.laneGap + G.laneGap / 2);
  const totalWidth = (laneX.length ? laneX[laneX.length - 1] : outerEdge) + G.margin;

  return { boxes, rowCenterY, branchY, jumpY, colX, jumps, laneX, totalWidth, totalHeight };
}

// ============================================================================
// PART 8: SVG RENDERING (elbow/straight connectors only)
// ============================================================================

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nodeSVG(box, node) {
  const style = THEME.node[node.type];
  const t = THEME.typography.label;
  const st = THEME.typography.sublabel;
  let shape = '';

  if (box.shape === 'circle') {
    shape = `<circle cx="${box.cx}" cy="${box.cy}" r="${box.w / 2}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2"/>`;
  } else if (box.shape === 'diamond') {
    const pts = [
      [box.cx, box.top], [box.right, box.cy], [box.cx, box.bottom], [box.left, box.cy]
    ].map(p => p.join(',')).join(' ');
    shape = `<polygon points="${pts}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2" stroke-linejoin="round"/>`;
  } else {
    shape = `<rect x="${box.left}" y="${box.top}" width="${box.w}" height="${box.h}" rx="8" ry="8" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2"/>`;
  }

  const lines = box.lines || [node.label];
  const codeLines = box.codeLines || [];
  const totalTextH = lines.length * t.lineHeight + (codeLines.length ? codeLines.length * st.lineHeight + 4 : 0);
  let startY = box.cy - totalTextH / 2 + t.lineHeight * 0.78;
  let textEls = lines.map((line, i) =>
    `<text x="${box.cx}" y="${startY + i * t.lineHeight}" text-anchor="middle" font-family="${THEME.font}" font-size="${t.size}" font-weight="${t.weight}" fill="${style.text}">${esc(line)}</text>`
  ).join('');
  if (codeLines.length) {
    const codeStartY = startY + lines.length * t.lineHeight + st.lineHeight * 0.4 + 2;
    textEls += codeLines.map((line, i) =>
      `<text x="${box.cx}" y="${codeStartY + i * st.lineHeight}" text-anchor="middle" font-family="${THEME.font}" font-size="${st.size}" font-weight="${st.weight}" fill="${style.text}" opacity="0.85">${esc(line)}</text>`
    ).join('');
  }

  return `<g class="flow-node" data-id="${esc(node.id)}">${shape}${textEls}</g>`;
}

// Anchor point on a box's boundary facing a given horizontal direction
// ('left' | 'right' | 'top' | 'bottom'), accounting for shape (diamond tips).
function anchor(box, side) {
  if (box.shape === 'diamond') {
    if (side === 'left') return { x: box.left, y: box.cy };
    if (side === 'right') return { x: box.right, y: box.cy };
    if (side === 'top') return { x: box.cx, y: box.top };
    return { x: box.cx, y: box.bottom };
  }
  if (side === 'left') return { x: box.left, y: box.cy };
  if (side === 'right') return { x: box.right, y: box.cy };
  if (side === 'top') return { x: box.cx, y: box.top };
  return { x: box.cx, y: box.bottom };
}

// Edge labels are centred on their connector's own x — usually the trunk/branch midpoint, but
// for a jump/bypass edge that's an outer lane position computed independently of label width
// (laneX only has to clear the CONNECTOR LINE, via G.margin — a lane near the diagram's right
// edge with a long label can still centre that label past the canvas boundary). canvasWidth, if
// given, both re-centres the label so it never crosses either edge and, for the rarer case where
// the label alone is wider than the whole canvas, wraps it onto multiple lines instead — the
// same fallback fitText() uses for over-wide node text, so a label is never silently clipped.
function edgeLabel(x, y, text, color, canvasWidth) {
  if (!text) return '';
  const size = THEME.typography.edge.size;
  const PAD = 6;   // breathing room from the canvas edge
  let lines = [text];
  let lineWidth = textWidth(text, size);
  if (canvasWidth != null) {
    const maxLineWidth = Math.max(canvasWidth - PAD * 2, 20);
    if (lineWidth > maxLineWidth) {
      lines = wrapToWidth(text, maxLineWidth, size);
      lineWidth = Math.max(...lines.map(l => textWidth(l, size)));
    }
  }
  let cx = x;
  if (canvasWidth != null) {
    const half = lineWidth / 2;
    cx = Math.min(Math.max(x, PAD + half), canvasWidth - PAD - half);
  }
  if (lines.length === 1) {
    return `<text x="${cx}" y="${y + 3}" text-anchor="middle" font-family="${THEME.font}" font-size="${size}" font-weight="${THEME.typography.edge.weight}" fill="${color}" letter-spacing="0.3">${esc(text)}</text>`;
  }
  const lineHeight = size * 1.25;
  const startY = y - (lines.length - 1) * lineHeight / 2 + 3;
  return lines.map((ln, i) =>
    `<text x="${cx}" y="${startY + i * lineHeight}" text-anchor="middle" font-family="${THEME.font}" font-size="${size}" font-weight="${THEME.typography.edge.weight}" fill="${color}" letter-spacing="0.3">${esc(ln)}</text>`
  ).join('\n');
}

// Every horizontal segment below is placed at a `gapY` value — the empty
// band strictly between two rows — so a connector can NEVER sweep across a
// node's body, no matter which columns it passes over. Vertical segments
// only ever run along a single column's (or lane's) fixed x, so they only
// ever touch the two nodes they actually connect. This is what guarantees
// "no connector crosses a node" structurally, not by accident.
function connectorSVG(path, boxes, geo, laneXOf) {
  const a = boxes.get(path.from), b = boxes.get(path.to);
  const style = THEME.edge[path.type];
  const marker = `url(#arrow-${path.type})`;
  let d, labelX, labelY;

  if (path.kind === 'direct' && a.col === b.col) {
    // Same column, adjacent rows: a single straight vertical line. Its
    // label sits in the branch sub-band so it never collides with a jump
    // transit line leaving the same row.
    const start = anchor(a, 'bottom');
    const end = anchor(b, 'top');
    d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    labelX = start.x + (a.col === 0 ? 30 : (a.col < 0 ? -30 : 30));
    labelY = geo.branchY[a.row];
  } else if (path.kind === 'direct') {
    // Branch-out / merge-back between trunk and a side column, exactly one
    // row apart: drop into the branch sub-band below the source, jog
    // sideways there, then drop into the top of the target.
    const gy = geo.branchY[a.row];
    const start = anchor(a, 'bottom');
    const end = anchor(b, 'top');
    d = `M ${start.x} ${start.y} L ${start.x} ${gy} L ${end.x} ${gy} L ${end.x} ${end.y}`;
    labelX = (start.x + end.x) / 2;
    labelY = gy - 8;
  } else {
    // Jump / bypass edge: exit into the jump sub-band, run the long
    // vertical leg in a dedicated outer lane (always clear of every
    // column), then enter the target from its own jump sub-band.
    const laneX = laneXOf(path);
    const forward = b.row > a.row;
    const startAnchor = anchor(a, forward ? 'bottom' : 'top');
    const endAnchor = anchor(b, forward ? 'top' : 'bottom');
    const startGap = forward ? geo.jumpY[a.row] : geo.jumpY[a.row - 1];
    const endGap = forward ? geo.jumpY[b.row - 1] : geo.jumpY[b.row];
    d = `M ${startAnchor.x} ${startAnchor.y} L ${startAnchor.x} ${startGap} L ${laneX} ${startGap} L ${laneX} ${endGap} L ${endAnchor.x} ${endGap} L ${endAnchor.x} ${endAnchor.y}`;
    labelX = laneX;
    labelY = startGap - 8;
  }

  const line = `<path d="${d}" fill="none" stroke="${style.color}" stroke-width="2" stroke-dasharray="${style.dash}" marker-end="${marker}"/>`;
  const label = path.label ? edgeLabel(labelX, labelY, path.label, style.color, geo.totalWidth) : '';
  return { svg: line + label, d, from: path.from, to: path.to };
}

function buildMarkers() {
  return Object.entries(THEME.edge).map(([kind, style]) => `
    <marker id="arrow-${kind}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${G.arrow}" markerHeight="${G.arrow}" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${style.color}"/>
    </marker>`).join('');
}

// ============================================================================
// PART 9: SELF-VALIDATION (fail loudly instead of shipping a broken diagram)
// ============================================================================

function validateLayout(boxes) {
  const list = [...boxes.values()];
  const errors = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      const overlapX = A.left < B.right && B.left < A.right;
      const overlapY = A.top < B.bottom && B.top < A.bottom;
      if (overlapX && overlapY) {
        errors.push(`Node overlap detected: "${A.id}" and "${B.id}"`);
      }
    }
  }
  if (errors.length) {
    throw new Error('Layout validation failed:\n' + errors.join('\n'));
  }
  return true;
}

// Segment (axis-aligned, since all connectors are orthogonal) vs. box
// intersection test — used to certify that no connector was drawn over a
// node's body. A segment is only allowed to touch a box at the exact anchor
// point it terminates at (its own endpoints), never pass through the middle.
function segmentHitsBox(x1, y1, x2, y2, box, excludeIds) {
  if (excludeIds.has(box.id)) return false;
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const pad = 0.5; // ignore touching exactly at the boundary (anchor points)
  const overlapX = minX < box.right - pad && maxX > box.left + pad;
  const overlapY = minY < box.bottom - pad && maxY > box.top + pad;
  return overlapX && overlapY;
}

function pathToSegments(d) {
  const nums = d.match(/-?[\d.]+/g).map(Number);
  const segs = [];
  for (let i = 0; i + 3 < nums.length; i += 2) {
    segs.push([nums[i], nums[i + 1], nums[i + 2], nums[i + 3]]);
  }
  return segs;
}

function validateConnectors(pathDefs, boxes) {
  const list = [...boxes.values()];
  const errors = [];
  for (const { d, from, to } of pathDefs) {
    const segs = pathToSegments(d);
    for (const [x1, y1, x2, y2] of segs) {
      for (const box of list) {
        if (segmentHitsBox(x1, y1, x2, y2, box, new Set([from, to]))) {
          errors.push(`Connector ${from} -> ${to} crosses node "${box.id}"`);
        }
      }
    }
  }
  if (errors.length) {
    throw new Error('Connector routing validation failed:\n' + [...new Set(errors)].join('\n'));
  }
  return true;
}

// ============================================================================
// PART 10: TOP-LEVEL GENERATE
// ============================================================================

function generate(rawInput) {
  const input = normalizeInput(rawInput);
  const layoutEngine = new LayoutEngine(input.nodes, input.paths);
  const layout = layoutEngine.build();

  const sizedNodes = new Map(input.nodes.map(n => [n.id, sizeNode(n)]));
  const geo = assignCoordinates(layout, sizedNodes);
  validateLayout(geo.boxes);

  const laneXOf = (path) => {
    const j = geo.jumps.find(x => x.from === path.from && x.to === path.to);
    return geo.laneX[j.laneIndex];
  };

  const nodeMap = new Map(input.nodes.map(n => [n.id, n]));
  const nodesSVG = [...geo.boxes.values()].map(box => nodeSVG(box, nodeMap.get(box.id))).join('\n');
  // Draw direct connectors first, jumps on top so bypass lanes read clearly.
  const directPaths = layout.paths.filter(p => p.kind === 'direct');
  const jumpPaths = layout.paths.filter(p => p.kind === 'jump');
  const rendered = [...directPaths, ...jumpPaths].map(p => connectorSVG(p, geo.boxes, geo, laneXOf));
  validateConnectors(rendered, geo.boxes);
  const connectorsSVG = rendered.map(r => r.svg).join('\n');

  const svg = `<svg viewBox="0 0 ${geo.totalWidth} ${geo.totalHeight}" width="${geo.totalWidth}" height="${geo.totalHeight}" xmlns="http://www.w3.org/2000/svg" font-family="${THEME.font}">
    <defs>${buildMarkers()}</defs>
    <g class="connectors">${connectorsSVG}</g>
    <g class="nodes">${nodesSVG}</g>
  </svg>`;

  return { svg, width: geo.totalWidth, height: geo.totalHeight, nodeCount: input.nodes.length, pathCount: input.paths.length, metadata: input.metadata };
}

function legendHTML() {
  const nodeRows = Object.entries(THEME.node).map(([type, s]) =>
    `<div class="legend-item"><span class="swatch" style="background:${s.fill};border-color:${s.stroke}"></span>${type}</div>`).join('');

  // Group connector types that share the same visual style (color + dash)
  // into a single legend row instead of listing every domain synonym.
  const groups = new Map(); // "color|dash" -> [types]
  for (const [type, s] of Object.entries(THEME.edge)) {
    const key = `${s.color}|${s.dash}`;
    if (!groups.has(key)) groups.set(key, { color: s.color, dash: s.dash, types: [] });
    groups.get(key).types.push(type);
  }
  const edgeRows = [...groups.values()].map(g =>
    `<div class="legend-item"><span class="swatch line" style="background:${g.color}"></span>${g.types.join(' / ')}${g.dash !== '0' ? ' (dashed)' : ''}</div>`).join('');

  return `<div class="legend"><div class="legend-col"><h4>Node types</h4>${nodeRows}</div><div class="legend-col"><h4>Connector types</h4>${edgeRows}</div></div>`;
}

function renderReport(rawInput) {
  const result = generate(rawInput);
  const title = esc(rawInput?.metadata?.title || 'User Flow Diagram');
  const domain = esc(rawInput?.metadata?.domain || '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ${THEME.font}; background:#eef1f4; margin:0; padding:32px; color:#1b1f24; }
  .card { background:#fff; border-radius:12px; box-shadow:0 2px 10px rgba(0,0,0,0.06); padding:28px; margin:0 0 24px; }
  h1 { font-size:${THEME.typography.title.size}px; margin:0 0 4px; }
  .sub { color:#5b6570; margin:0 0 20px; font-size:14px; }
  .diagram-wrap { overflow-x:auto; border-radius:8px; }
  .legend { display:flex; gap:48px; margin-top:20px; flex-wrap:wrap; }
  .legend-col h4 { margin:0 0 8px; font-size:13px; text-transform:uppercase; color:#5b6570; letter-spacing:0.06em; }
  .legend-item { display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:6px; text-transform:capitalize; }
  .swatch { width:14px; height:14px; border-radius:3px; border:2px solid transparent; display:inline-block; }
  .swatch.line { height:3px; border-radius:2px; }
  .stats { display:flex; gap:16px; margin:16px 0 4px; }
  .stat { background:#f7f8fa; border-radius:8px; padding:12px 18px; }
  .stat b { display:block; font-size:${THEME.typography.stat.size}px; }
  .stat span { font-size:12px; color:#5b6570; }
</style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p class="sub">${domain ? domain + ' &middot; ' : ''}${result.nodeCount} nodes &middot; ${result.pathCount} connectors</p>
    <div class="diagram-wrap">${result.svg}</div>
    ${legendHTML()}
  </div>
</body>
</html>`;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  generate,
  renderReport,
  normalizeInput,
  LayoutEngine,
  THEME,
  G
};

// CLI usage: node user-flow-diagram-v4.0.js input.json output.html
if (require.main === module) {
  const fs = require('fs');
  const [, , inPath, outPath] = process.argv;
  if (!inPath || !outPath) {
    console.error('Usage: node user-flow-diagram-v4.0.js <input.json> <output.html>');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const html = renderReport(raw);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`Written ${outPath}`);
}
