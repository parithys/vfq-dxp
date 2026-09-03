#!/usr/bin/env node
/**
 * process-flow — conformance verifier
 * ------------------------------------------------------------------
 * Mechanically checks a generated diagram against the §0 quick-checklist in
 * references/conformance-standard.md, with the r2 canvas defaults as the baseline.
 *
 * Why this exists: the §0 checklist is a list of things a human is supposed to eyeball
 * before delivery, and the ones that matter most — a 10-unit gutter, a 15/17/12 text
 * rhythm, a legend that lists exactly the styles in use — are precisely the ones the eye
 * cannot judge. Drift here is invisible per-diagram and obvious across a set. So the
 * checklist is executed rather than read.
 *
 * Usage:
 *   node verify.js <diagram.html> [more.html ...] [--json] [--quiet]
 *
 * Exit code 0 = conformant (warnings allowed), 1 = one or more ERRORs, 2 = bad usage.
 *
 * Every finding names the section of the standard it came from, so a failure is a
 * pointer into the spec rather than a verdict.
 */

'use strict';
const fs = require('fs');

/* Theme-coupled token: the neutral grey used for meta text, payload labels and legend labels.
 * Several checks locate their subject BY THIS COLOUR, so it must track NEUTRAL in
 * generate.js. A mismatch does not fail — it makes the affected checks match nothing and
 * vanish from the report, which is far worse than a red line. */
const NEUTRAL_TEXT = '#6b7280';
const vm = require('vm');
const { nodeBaselines } = require('./generate.js');

/* ---------- tiny SVG/CSS scrapers (no DOM, no deps) ---------- */

const MONO_ADVANCE = 0.62;   // must match generate.js — see §5.5 text-advance note

function attrs(tag) {
  const out = {};
  // Attribute names contain digits (x1, y1, x2, y2) — a letters-only class silently
  // drops every line endpoint and takes the extent maths down with it.
  const re = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tag))) out[m[1]] = m[2];
  return out;
}
function num(v, d = NaN) { const n = parseFloat(v); return isNaN(n) ? d : n; }
function findTags(svg, name) {
  const re = new RegExp(`<${name}\\b[^>]*?/?>`, 'g');
  return (svg.match(re) || []);
}
// Strip HTML/XML comments so a commented-out grid rect is not mistaken for a painted one.
function stripComments(s) { return s.replace(/<!--[\s\S]*?-->/g, ''); }

/* SVG coordinates are relative to every enclosing `<g transform="translate(...)">`, and
 * those groups nest — §5.4's rail gutter wraps the whole flow in translate(40,0), and a
 * decision diamond sits in its own translate() inside that. A flat regex reads the outer
 * wrapper as the diamond's centre and puts the node 57 units off-canvas, so the walk below
 * tracks a real offset stack instead. */
function walk(svg) {
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*?)(\/?)>/g;
  const stack = [{ dx: 0, dy: 0 }];
  const out = [];
  let m;
  while ((m = tagRe.exec(svg))) {
    const [full, closing, name, attrStr, selfClose] = m;
    if (closing) { if (name === 'g' && stack.length > 1) stack.pop(); continue; }
    const top = stack[stack.length - 1];
    if (name === 'g' && !selfClose) {
      const tr = /translate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(attrStr);
      stack.push(tr
        ? { dx: top.dx + parseFloat(tr[1]), dy: top.dy + parseFloat(tr[2]) }
        : { dx: top.dx, dy: top.dy });
      continue;
    }
    // A translate can also ride on the element itself (the legend's decision swatch is
    // `translate(...) rotate(45)` on a bare rect), so fold that in too.
    const own = /translate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(attrStr);
    out.push({
      name, attrStr, full, index: m.index, end: m.index + full.length,
      dx: top.dx + (own ? parseFloat(own[1]) : 0),
      dy: top.dy + (own ? parseFloat(own[2]) : 0),
      a: attrs(full),
      rotated: /rotate\(\s*45\b/.test(attrStr)
    });
  }
  return out;
}

function textNodes(svg) {
  return walk(svg).filter(e => e.name === 'text').map(e => {
    const close = svg.indexOf('</text>', e.end);
    const raw = close === -1 ? '' : svg.slice(e.end, close);
    return {
      x: num(e.a.x) + e.dx, y: num(e.a.y) + e.dy, size: num(e.a['font-size']),
      fill: e.a.fill || '', anchor: e.a['text-anchor'] || 'start',
      weight: e.a['font-weight'] || '', text: raw.trim(), index: e.index
    };
  });
}

/* Node geometry. Steps and pills are plain rects; a decision is a rect rotated 45° about
 * its group origin, so the diamond's centre IS the group's accumulated offset. */
function nodeBoxes(svg) {
  const boxes = [];
  for (const e of walk(svg)) {
    if (e.name !== 'rect') continue;
    const w = num(e.a.width), h = num(e.a.height), rx = num(e.a.rx);
    if (isNaN(w) || isNaN(h)) continue;
    if (e.rotated) {
      // A square of side S rotated 45° about its centre reaches S·√2/2 — 56.57 for the
      // 80×80 diamond (§13's ±57 tips), 7.07 for the 10×10 legend swatch. Using a constant
      // here sizes the legend swatch like a node and drags the content bounds off-canvas.
      if (w === 80 && h === 80) {
        const cx = e.dx + num(e.a.x, 0) + w / 2, cy = e.dy + num(e.a.y, 0) + h / 2;
        const half = (w * Math.SQRT2) / 2;
        boxes.push({ kind: 'decision', x: cx - half, y: cy - half, w: half * 2, h: half * 2, cx, cy, stroke: e.a.stroke });
      }
      continue;
    }
    if (w === 16 && h === 10) continue;                         // legend swatch
    const x = num(e.a.x) + e.dx, y = num(e.a.y) + e.dy;
    // r5: node height varies with content, so identify a step box by rx, not by h === 80.
    if (rx === 8 && h >= 40) boxes.push({ kind: 'step', x, y, w, h, stroke: e.a.stroke, fill: e.a.fill });
    else if (rx === 20) boxes.push({ kind: 'pill', x, y, w, h, stroke: e.a.stroke, fill: e.a.fill });
  }
  return boxes;
}

/* Everything drawn, as a bounding box — the basis for the gutter check (§5.5).
 * <defs> is excluded: marker and pattern geometry is authored at the origin and is never
 * painted at those coordinates, so counting it would peg the content bounds at 0,0. */
function contentExtents(svgRaw) {
  const svg = svgRaw.replace(/<defs>[\s\S]*?<\/defs>/g, '');
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const add = (x, y, w = 0, h = 0) => {
    if (isNaN(x) || isNaN(y)) return;
    b.minX = Math.min(b.minX, x); b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x + w); b.maxY = Math.max(b.maxY, y + h);
  };
  for (const e of walk(svg)) {
    const a = e.a;
    if (e.name === 'rect') {
      if (a.width === '100%') continue;
      if (e.rotated) {
        const cx = e.dx + num(a.x, 0) + num(a.width, 0) / 2, cy = e.dy + num(a.y, 0) + num(a.height, 0) / 2;
        const half = (Math.max(num(a.width, 0), num(a.height, 0)) * Math.SQRT2) / 2;
        add(cx - half, cy - half, half * 2, half * 2);
        continue;
      }
      add(num(a.x) + e.dx, num(a.y) + e.dy, num(a.width, 0), num(a.height, 0));
    } else if (e.name === 'circle') {
      const r = num(a.r, 0);
      add(num(a.cx) + e.dx - r, num(a.cy) + e.dy - r, r * 2, r * 2);
    } else if (e.name === 'line') {
      add(Math.min(num(a.x1), num(a.x2)) + e.dx, Math.min(num(a.y1), num(a.y2)) + e.dy,
        Math.abs(num(a.x2) - num(a.x1)), Math.abs(num(a.y2) - num(a.y1)));
    } else if (e.name === 'path') {
      const coords = (a.d || '').match(/-?[\d.]+\s+-?[\d.]+/g) || [];
      for (const c of coords) { const [x, y] = c.split(/\s+/).map(Number); add(x + e.dx, y + e.dy); }
    }
  }
  for (const t of textNodes(svg)) {
    if (isNaN(t.x) || isNaN(t.y)) continue;
    const w = t.text.length * t.size * MONO_ADVANCE;
    const x0 = t.anchor === 'middle' ? t.x - w / 2 : t.anchor === 'end' ? t.x - w : t.x;
    add(x0, t.y - t.size, w, t.size * 1.25);
  }
  return b;
}

function textWidth(text, size) { return String(text == null ? '' : text).length * size * MONO_ADVANCE; }
function e_x(e) { return num(e.a.cx) + e.dx; }
function e_y(e) { return num(e.a.cy) + e.dy; }

/* ---------- report ---------- */

function Report(file) {
  const findings = [];
  return {
    file, findings,
    error: (section, msg, detail) => findings.push({ level: 'ERROR', section, msg, detail }),
    warn: (section, msg, detail) => findings.push({ level: 'WARN', section, msg, detail }),
    pass: (section, msg) => findings.push({ level: 'PASS', section, msg }),
    get errors() { return findings.filter(f => f.level === 'ERROR'); },
    get warnings() { return findings.filter(f => f.level === 'WARN'); },
    get passes() { return findings.filter(f => f.level === 'PASS'); }
  };
}

/* ---------- the checks ---------- */

function verify(html, file) {
  const R = Report(file);
  // The type scale is configurable (r4), so no check may pin itself to a literal size.
  // "Small text" means anything at or below the median glyph size in this file.
  const smallCeil = (texts) => {
    if (!texts.length) return 9;
    const sizes = texts.map(t => t.size).filter(n => !isNaN(n)).sort((a, b) => a - b);
    return sizes[Math.floor(sizes.length / 2)] + 0.51;
  };
  const clean = stripComments(html);
  // Pick the diagram SVG by its viewBox rather than by first-match: the word "<svg" can
  // legitimately appear in a CSS comment or in prose, and matching that instead yields a
  // baffling "no parseable viewBox" for a perfectly good file.
  const candidates = [...clean.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(m => m[0]);
  const svg = candidates.find(c => /<svg\b[^>]*viewBox=/.test(c)) || candidates[0];
  if (!svg) { R.error('§1', 'No <svg> element found — this is not a process-flow diagram.'); return R; }
  const svgOpen = svg.match(/<svg\b[^>]*>/)[0];
  const sa = attrs(svgOpen);

  /* --- §1 deps, shell, self-containment --- */
  const deps = [
    { name: 'JetBrains Mono', re: /fonts\.googleapis\.com\/css2\?family=JetBrains\+Mono:wght@400;500;600;700/, sri: false },
    { name: 'html2canvas@1.4.1', re: /html2canvas@1\.4\.1[^"]*"\s+integrity="sha384-[^"]+"\s+crossorigin="anonymous"/, sri: true },
    { name: 'jspdf@2.5.2', re: /jspdf@2\.5\.2[^"]*"\s+integrity="sha384-[^"]+"\s+crossorigin="anonymous"/, sri: true }
  ];
  for (const d of deps) {
    if (d.re.test(html)) R.pass('§1', `dependency present${d.sri ? ' with SRI' : ''}: ${d.name}`);
    else R.error('§1', `Missing or altered dependency: ${d.name}`, d.sri ? 'Must keep its integrity + crossorigin attributes.' : null);
  }
  if (/<link[^>]+href="(?!https:\/\/fonts\.googleapis)[^"]*\.css"/.test(html) || /<script[^>]+src="(?!https:\/\/cdn\.jsdelivr)[^"]*"/.test(html))
    R.error('§1', 'Local or unpinned external asset referenced — the file must be self-contained bar the 3 pinned CDN deps.');
  if (/font-family:\s*'JetBrains Mono'/.test(html)) R.pass('§1', "font-family 'JetBrains Mono' applied");
  else R.error('§1', "body font-family is not 'JetBrains Mono'.");
  if (/background:\s*#E9F2FE/.test(html)) R.pass('§1', 'page ground #E9F2FE');
  else R.error('§1', 'Page ground is not #E9F2FE.',
    'The design system is LIGHT: a light page (#E9F2FE) with the diagram on a white card.');

  /* --- r2 #1: the grid pattern is declared but never painted (§1, §13) --- */
  const hasPattern = /<pattern id="grid" width="40" height="40"/.test(svg);
  const painted = /<rect[^>]*fill="url\(#grid\)"/.test(svg);
  if (!hasPattern) R.warn('§1/r2', 'The `grid` pattern is missing from <defs>.', 'r2 keeps it declared so a backdrop can be opted back in without re-deriving it.');
  else R.pass('§1/r2', 'grid pattern declared in <defs>');
  if (painted) R.error('§1/r2', 'A full-canvas grid rect is painted.', 'r2 default is the bare card ground. Paint it back only when a run explicitly asks for a backdrop.');
  else R.pass('§1/r2', 'no grid rect painted — bare ground');

  /* --- r2 #2/#3: trimmed gutters, min-width, container ceiling, bare container (§5.5) --- */
  const vb = (sa.viewBox || '').split(/\s+/).map(Number);
  if (vb.length !== 4 || vb.some(isNaN)) {
    R.error('§5.5', 'The <svg> has no parseable viewBox.');
  } else {
    const [vx, vy, vw, vh] = vb;
    const ext = contentExtents(svg);
    const left = ext.minX - vx;
    const right = (vx + vw) - ext.maxX;
    const fmt = n => Math.round(n * 10) / 10;
    // Measured against estimated text advance widths, so a few units of slack is metric
    // noise rather than drift. Past ~40 it is the r1 fixed-margin habit coming back, and
    // below 8 something is genuinely being clipped — both are real failures.
    for (const [side, g] of [['left', left], ['right', right]]) {
      if (g >= 8 && g <= 14) R.pass('§5.5/r2', `${side} gutter ${fmt(g)} ≈ 10`);
      else if (g < 8) R.error('§5.5/r2', `${side} gutter is ${fmt(g)} — content is clipped by the canvas edge.`,
        'The viewBox must contain every drawn element with 10 units to spare.');
      else if (g > 40) R.error('§5.5/r2', `${side} gutter is ${fmt(g)}, expected 10.`,
        'Canvas is padded with dead space — trim the viewBox to the content bounds rather than adding a fixed margin.');
      else R.warn('§5.5/r2', `${side} gutter is ${fmt(g)}, expected 10.`,
        'Within hand-authoring tolerance, but the generator trims to exactly 10.');
    }
    const topClear = Math.min(...nodeBoxes(svg).filter(b => b.kind === 'step').map(b => b.y - vy));
    if (isFinite(topClear)) {
      if (topClear >= 46) R.pass('§5.5/r2', `top gutter ${fmt(topClear)} ≥ 48 — role and payload labels clear`);
      else R.error('§5.5/r2', `Only ${fmt(topClear)} above the topmost box; need ≥ 48.`,
        'The payload label sits at boxTop−32 and the role label at boxTop−12; both must fit inside the canvas.');
    }

    // Check for either min-width (responsive) or fixed width (fixed-width variance)
    // A fully fluid SVG (width:100% with no px floor) is the most conformant form: the viewBox
    // scales it to whatever width is available, so the diagram is always visible in one view and
    // neither the page nor .diagram-container ever scrolls horizontally. Accept it explicitly —
    // the older rule below only knew about px widths and reported this as a missing rule.
    const svgRule = (html.match(/\bsvg\s*\{([^}]*)\}/) || [, ''])[1];
    if (/width:\s*100%/.test(svgRule) && !/min-width:\s*[\d.]+px/.test(svgRule)) {
      R.pass('§5.5/r2', 'svg is fluid (width:100%, no px floor) — scales to viewport, no h-scroll');
    } else {
    const mw = html.match(/svg\s*\{[^}]*(?:min-width|width):\s*([\d.]+)px/);
    if (!mw) R.error('§5.5/r2', 'No `svg { min-width: <n>px }` or `svg { width: <n>px }` rule found.');
    else if (Math.abs(num(mw[1]) - vw) <= 1) R.pass('§5.5/r2', `svg width/min-width ${mw[1]}px == viewBox width`);
    else R.warn('§5.5/r2', `svg width is ${mw[1]}px but the viewBox is ${vw}.`,
      'This is acceptable for fixed-width layouts (with horizontal scroll) where the SVG maintains a constant width.');
    }

    if (sa.width || sa.height) R.error('§5.5', `The <svg> sets a pixel ${sa.width ? 'width' : 'height'} attribute (${sa.width || sa.height}).`,
      'MUST NOT set an SVG pixel size — `width:100%` + `min-width` is what makes it fluid.');
    else R.pass('§5.5', 'no pixel width/height on <svg> — fluid scaling intact');
  }

  // Accept either max-width (responsive) or width (fixed-width variance)
  const cmax = html.match(/\.container\s*\{[^}]*(?:max-width|width):\s*([\d.]+)px/);
  if (cmax && num(cmax[1]) === 1920) R.pass('§5.5/r2', '.container max-width 1920px');
  // 1600 is a max-width ceiling, not a fixed width — the container is width:100% below it, so
  // narrow viewports shrink rather than scroll. The old wording described the fixed-width layout
  // this replaced and would have told a reader the opposite of what the CSS now does.
  else if (cmax && num(cmax[1]) === 1600) R.pass('§5.5/r2', '.container max-width 1600px — fluid below the ceiling, no horizontal scroll');
  else R.warn('§5.5/r2', `.container width is ${cmax ? cmax[1] + 'px' : 'unset'}, expected 1920px (responsive) or 1600px (fixed-width).`,
    'Variance from r2: fixed-width layouts scroll horizontally instead of scaling.');

  const dc = html.match(/\.diagram-container\s*\{([^}]*)\}/);
  if (!dc) R.error('§5.5/r2', 'No `.diagram-container` rule found.');
  else {
    const body = dc[1];
    // LIGHT THEME: the canvas is a CARD, not a bare region. On a dark ground the diagram had a
    // natural edge and chrome around it would have competed; on a light ground a diagram painted
    // straight onto the page has no boundary at all and the drawing merges with the chrome. So
    // this rule INVERTED with the theme — the card is now required, not forbidden.
    const missing = ['background', 'border', 'padding'].filter(p => !new RegExp(`(^|[;{\\s])${p}(-[a-z]+)?\\s*:`).test(body));
    if (missing.length) R.error('§5.5/r2', `.diagram-container is missing ${missing.join(', ')}.`,
      'The light theme puts the diagram on a white card: background #ffffff, 1px #A4D3FF border, padding.');
    else R.pass('§5.5/r2', '.diagram-container carries the card treatment (background/border/padding)');
    if (!/overflow-x:\s*auto/.test(body)) R.error('§5.5', '.diagram-container is missing `overflow-x: auto`.',
      'Without it the page scrolls instead of the diagram once the viewport drops below min-width.');
  }

  /* --- §6.1 markers, verbatim --- */
  // Must track the KIND/LOOP_STYLE palette in generate.js — these are the same six colours.
  const markerFills = { arrowhead: '#6b7280', 'arrowhead-emerald': '#2e9e6b', 'arrowhead-violet': '#7c5cd6', 'arrowhead-amber': '#9e7513', 'arrowhead-rose': '#d4667f', 'arrowhead-crimson': '#c8365f', 'arrowhead-slate': '#6b7280' };
  const markerRe = /<marker\b([^>]*)>([\s\S]*?)<\/marker>/g;
  const foundMarkers = {};
  let mm;
  while ((mm = markerRe.exec(svg))) {
    const a = attrs('<marker ' + mm[1] + '>');
    foundMarkers[a.id] = { a, inner: mm[2] };
  }
  const usedMarkerIds = new Set((svg.match(/marker-end="url\(#([^)]+)\)"/g) || []).map(s => s.replace(/.*#|\)"/g, '')));
  for (const id of usedMarkerIds) {
    const f = foundMarkers[id];
    if (!f) { R.error('§6.1', `Connector references marker #${id}, which is not defined.`); continue; }
    const geomOK = f.a.markerWidth === '10' && f.a.markerHeight === '7' && f.a.refX === '9' && f.a.refY === '3.5' && f.a.orient === 'auto';
    const polyOK = /points="0 0, 10 3\.5, 0 7"/.test(f.inner);
    const fillOK = !markerFills[id] || new RegExp(`fill="${markerFills[id]}"`, 'i').test(f.inner);
    if (geomOK && polyOK && fillOK) R.pass('§6.1', `marker #${id} verbatim`);
    else R.error('§6.1', `marker #${id} deviates from the verbatim spec.`,
      `Required: markerWidth 10, markerHeight 7, refX 9, refY 3.5, orient auto, polygon "0 0, 10 3.5, 0 7"${markerFills[id] ? `, fill ${markerFills[id]}` : ''}.`);
  }

  /* --- §3.1 node text rhythm + §6.2 label bands --- */
  const boxes = nodeBoxes(svg);
  const texts = textNodes(svg);
  const steps = boxes.filter(b => b.kind === 'step');
  let rhythmChecked = 0, rhythmBad = 0;
  for (const b of steps) {
    const cx = b.x + b.w / 2;
    // A tall block (4 titles + 2 meta) legitimately overhangs the 80px box by a few units
    // once centred, so the collection band extends past the box floor. Clipping at the box
    // edge drops the last line and makes the expectation come out one line short.
    const inside = texts.filter(t => Math.abs(t.x - cx) < 1 && t.y > b.y && t.y < b.y + b.h + 16).sort((p, q) => p.y - q.y);
    // Title vs meta is a colour distinction, not a size one (§3): titles are white, meta
    // lines are the neutral grey. Meta size legitimately varies (7 in the exemplars, 9 in
    // generated output) so classifying by font-size misreads conformant diagrams as broken.
    // Title vs meta is a COLOUR distinction (§3), so this predicate is theme-coupled: titles are
    // the ink token, meta lines the neutral grey. When the palette flipped from dark to light,
    // titles moved from 'white' to #1a1a1a — leaving this matching 'white' silently reclassified
    // every title as meta and made six conformant nodes report a broken text rhythm.
    const isTitle = t => /^(#1a1a1a|#1A1A1A)$/.test(t.fill);
    const nTitle = inside.filter(isTitle).length;
    const nMeta = inside.length - nTitle;
    if (!nTitle && !nMeta) continue;
    rhythmChecked++;
    const expected = nodeBaselines(nTitle, nMeta, b.y);
    const actual = inside.map(t => t.y);
    const off = expected.map((e, i) => Math.abs(e - actual[i])).filter(d => d > 0.26);
    if (off.length) {
      rhythmBad++;
      R.error('§3.1/r2', `Node at (${b.x}, ${b.y}) breaks the 15/17/12 text rhythm.`,
        `expected baselines [${expected.join(', ')}], found [${actual.join(', ')}]`);
    }
    // Role label at boxTop − 12 (§6.2). The exemplars anchor it above-LEFT at boxX+2;
    // the generator centres it. Both read correctly, so accept either and only nudge
    // toward the above-left form §0 actually names.
    // r5: role labels share one baseline per ROW (the row's topmost box − 12), not each box's
    // own top — variable heights otherwise scatter them across the band. Accept any label on
    // the row band at or above this box's own top.
    const rowTop = Math.min(...steps.filter(o => Math.abs(o.y + o.h / 2 - (b.y + b.h / 2)) < 2).map(o => o.y));
    const role = texts.find(t => (Math.abs(t.y - (b.y - 12)) < 0.51 || Math.abs(t.y - (rowTop - 12)) < 0.51)
      && t.x >= b.x - 4 && t.x <= b.x + b.w + 4);
    if (!role) R.error('§6.2/§7', `Node at (${b.x}, ${b.y}) has no \`id: role\` label at boxTop−12.`);
    else if (role.anchor === 'middle') R.warn('§7', `Role label on the node at (${b.x}, ${b.y}) is centred.`,
      'Centring makes the label drift with its own length. Anchor it end at the box right edge (generated output) or start at boxX+2 (the hand-authored exemplars) so labels share one alignment.');
    // The r2 band: nothing may sit between the role line and the payload line.
    // Nothing may crowd the `id: role` line at boxTop − 12. Payload labels moved down onto the
    // connector in r3, so this now guards the band against anything that drifts into it.
    // Exclude anything ON the role line itself (boxTop − 12) — a node may legitimately carry
    // one, and object identity is not enough to exclude it when several share the line.
    // r5: node heights vary, so neighbouring boxes have different tops and one node's role
    // label can sit inside another's band. Scope the band horizontally to THIS box only.
    // Band guard. Nothing may crowd this node's `id: role` line. Scope by OWNERSHIP: a text
    // belongs to whichever step box its x is nearest, so a neighbour's own role label or badge
    // is never counted against this one. (r5 made this necessary — variable heights mean
    // adjacent boxes have different tops, and a naive band caught the wrong node's labels.)
    const owner = t => steps.reduce((best, cand) =>
      Math.abs(t.x - (cand.x + cand.w / 2)) < Math.abs(t.x - (best.x + best.w / 2)) ? cand : best, steps[0]);
    const collide = texts.filter(t => Math.abs(t.y - (rowTop - 12)) > 0.51 &&
      Math.abs(t.y - (b.y - 12)) > 0.51 &&
      t.y > rowTop - 26 && t.y < rowTop - 4 && owner(t) === b);
    if (collide.length) R.error('§6.2/r2', `Text collides with the role label above the node at (${b.x}, ${b.y}).`,
      `Payload labels belong at boxTop−32 (=${b.y - 32}); found "${collide[0].text}" at y=${collide[0].y}.`);
  }
  if (rhythmChecked && !rhythmBad) R.pass('§3.1/r2', `node text rhythm correct on all ${rhythmChecked} nodes`);

  /* --- §6.2 payload labels must fit their connector channel --- */
  // A label wider than the gap between its two boxes overhangs them and collides with the
  // node text underneath. The channel is free space, so it should grow to fit the label
  // rather than the label being silently clipped.
  {
    const ordered = steps.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
    let overflow = 0, checked = 0;
    const SMALL = smallCeil(texts);
    for (const lab of texts.filter(t => t.fill === NEUTRAL_TEXT && t.size <= SMALL)) {
      // NEAREST box either side, not the first found — `find` returns document order, which
      // pairs a label with a box several columns away and measures a gap spanning whole nodes.
      // r3: the payload label sits just above its connector, which runs on the row baseline
      // (boxTop + 40). Matching on boxTop − 32 stopped selecting anything at all, so the
      // check silently passed everything.
      // Flanking boxes only: a label riding on the connector shares its own box's y-range, so
      // exclude any box the label sits horizontally inside.
      // r5: a payload label rides above the connector, which is level with the box's vertical
      // centre — so match on the ROW (the label's y is within the box's vertical span, or just
      // above its top), excluding any box the label sits horizontally inside.
      const sameRow = ordered.filter(b => lab.y > b.y - 60 && lab.y < b.y + b.h &&
        !(lab.x > b.x && lab.x < b.x + b.w));
      const lefts = sameRow.filter(b => b.x + b.w <= lab.x);
      const rights = sameRow.filter(b => b.x >= lab.x);
      if (!lefts.length || !rights.length) continue;
      const left = lefts.reduce((a, b) => (b.x + b.w > a.x + a.w ? b : a));
      const right = rights.reduce((a, b) => (b.x < a.x ? b : a));
      checked++;
      const gap = right.x - (left.x + left.w);
      const need = textWidth(lab.text, lab.size) + 14;
      if (need > gap + 0.5) {
        overflow++;
        R.error('§6.2', `Payload label "${lab.text}" is wider than its connector channel.`,
          `Needs ~${Math.round(need)} units including the arrowhead; the gap is ${Math.round(gap)}. Widen the channel — node boxes are fixed at 160 (§4.1), the space between them is not.`);
      }
    }
    if (checked && !overflow) R.pass('§6.2', `all ${checked} payload labels fit their channel`);
  }

  /* --- §8 decision branches must be legible --- */
  // A diamond with one unlabelled exit is ambiguous: the reader cannot tell which outcome
  // continues the main line, nor what happens on the other one. Both are usually the whole
  // reason the gate is in the diagram.
  {
    const diamonds = boxes.filter(b => b.kind === 'decision');
    let bad = 0;
    for (const d of diamonds) {
      // Look only where a branch label can legitimately sit — a wide window sweeps in the
      // neighbouring node's title and role label and the check passes on their account.
      //   Yes: on the outgoing lane, just right of the diamond, on the row baseline.
      //   No:  in the vertical corridor directly beneath the bottom tip.
      const SMALL8 = smallCeil(texts);
      const yes = texts.filter(t => t.size <= SMALL8 && t.weight === '600' &&
        t.x > d.cx + 40 && t.x < d.cx + 190 && Math.abs(t.y - d.cy) < 24);
      const no = texts.filter(t => t.size <= SMALL8 && t.weight === '600' &&
        Math.abs(t.x - d.cx) < 60 && t.y > d.cy + 50 && t.y < d.cy + 150);
      const labelled = [...yes, ...no];
      if (labelled.length < 1) {
        bad++;
        R.error('§8', `Decision at (${Math.round(d.cx)}, ${Math.round(d.cy)}) has no branch labels.`,
          'Label the outgoing branches (yesLabel / noLabel). An unlabelled diamond forces the reader to guess which outcome continues the flow.');
      }
    }
    if (diamonds.length && !bad) R.pass('§8', `all ${diamonds.length} decision(s) carry branch labels`);
  }

  /* --- §4.1 node text must fit its box --- */
  // Width is fixed at 160 (§4.1); height grows with content (r5). So this checks horizontal
  // fit only — vertical overflow is prevented by growth, and flagged with an ellipsis when
  // the height ceiling is reached. They then overhang into the channel
  // and, at the last column, past the canvas trim itself.
  {
    const INNER = 160 - 12;   // 6 units of breathing room each side
    let over = 0;
    for (const b of steps) {
      const cx = b.x + b.w / 2;
      for (const t of texts.filter(t => Math.abs(t.x - cx) < 1 && t.y > b.y && t.y < b.y + b.h + 16)) {
        const w = textWidth(t.text, t.size);
        if (w > INNER + 0.5) {
          over++;
          R.error('§4.1', `Node text overflows its box: "${t.text}".`,
            `Needs ~${Math.round(w)} units, the box holds ${INNER}. Shorten the line, or lower spec.type.meta — the 160px box is a hard rule.`);
        }
      }
    }
    if (steps.length && !over) R.pass('§4.1', `all node text fits inside the 160px box`);
  }

  /* --- §6.4 connectors must anchor to node boundaries --- */
  // Guards against fixed coordinates creeping in. Every primary connector endpoint has to
  // land on a real node boundary — a box edge mid-line or a diamond tip — computed from that
  // node's own geometry. A hardcoded x1/x2 passes visual review at one node size and
  // detaches silently at the next.
  {
    const anchorable = boxes.filter(b => b.kind !== 'decision');
    const diamonds = boxes.filter(b => b.kind === 'decision');
    // The target end stops short of the box by the arrowhead's own length — the marker draws
    // into that space, so the arrow tip touches the boundary even though the line does not
    // (§6.4). Allow the marker's reach; beyond it the connector is genuinely floating.
    const MARKER = 12;
    const onEdge = (x, y, side) => {
      if (anchorable.some(b => {
        if (Math.abs(b.y + b.h / 2 - y) > 1) return false;
        const edge = side === 'out' ? b.x + b.w : b.x;
        const d = side === 'out' ? x - edge : edge - x;   // positive = short of the box
        return d >= -1 && d <= MARKER;
      })) return true;
      // Diamond tips sit half a diagonal either side of centre.
      return diamonds.some(d => Math.abs(d.cy - y) < 2 &&
        Math.abs(Math.abs(d.cx - x) - d.w / 2) < MARKER + 2);
    };
    let floating = 0, checked = 0;
    for (const e of walk(svg)) {
      if (e.name !== 'line' || !/opacity="0\.75"/.test(e.attrStr)) continue;
      checked++;
      const x1 = num(e.a.x1) + e.dx, y1 = num(e.a.y1) + e.dy;
      const x2 = num(e.a.x2) + e.dx, y2 = num(e.a.y2) + e.dy;
      if (!onEdge(x1, y1, 'out') || !onEdge(x2, y2, 'in')) {
        floating++;
        R.error('§6.4', `Connector (${Math.round(x1)},${Math.round(y1)})→(${Math.round(x2)},${Math.round(y2)}) does not anchor to a node boundary.`,
          'Derive endpoints from the node (sourceNode right edge → targetNode left edge), not from fixed coordinates.');
      }
    }
    if (checked && !floating) R.pass('§6.4', `all ${checked} connectors anchored to node boundaries`);
  }

  /* --- §6.3 routed paths must not cross a node --- */
  // The wrap/loop corridor overlapping a No-branch pill was invisible to every existing check:
  // gutters were fine, labels were fine, no node overlapped another node. What was missing was
  // a test of routed PATHS against node rectangles. A corridor derived by averaging two row
  // baselines will eventually land on whatever hangs into that band.
  {
    const solids = boxes.filter(b => b.kind === 'step' || b.kind === 'pill');
    let hits = 0, checked = 0;
    for (const e of walk(svg)) {
      if (e.name !== 'path' || !/stroke-dasharray/.test(e.attrStr)) continue;
      const pts = [...(e.a.d || '').matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/g)]
        .map(m => ({ x: num(m[1]) + e.dx, y: num(m[2]) + e.dy }));
      if (pts.length < 2) continue;
      checked++;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b2 = pts[i + 1];
        for (const n of solids) {
          // Axis-aligned segments only, which is what the router emits.
          const horiz = Math.abs(a.y - b2.y) < 0.6, vert = Math.abs(a.x - b2.x) < 0.6;
          if (!horiz && !vert) continue;
          const inY = Math.min(a.y, b2.y) < n.y + n.h - 1 && Math.max(a.y, b2.y) > n.y + 1;
          const inX = Math.min(a.x, b2.x) < n.x + n.w - 1 && Math.max(a.x, b2.x) > n.x + 1;
          if (inY && inX) {
            hits++;
            R.error('§6.3', `A routed path crosses the node at (${Math.round(n.x)}, ${Math.round(n.y)}).`,
              `Segment (${Math.round(a.x)},${Math.round(a.y)})→(${Math.round(b2.x)},${Math.round(b2.y)}). Allocate the corridor below the band's obstructions rather than averaging row baselines.`);
          }
        }
      }
    }
    if (checked && !hits) R.pass('§6.3', `all ${checked} routed path(s) clear of node boxes`);
  }

  /* --- §1 badge draw order --- */
  // The badge sits on the box's top-left corner. If it is emitted before its box, the box's
  // corner paints over the ring and the badge looks chipped — a defect that is obvious at 4x
  // zoom and invisible at 1x, which is exactly the kind the eye should not be responsible for.
  {
    const seq = walk(svg).filter(e => e.name === 'circle' || (e.name === 'rect' && num(e.a.rx) === 8 && num(e.a.height) >= 40));
    let chipped = 0;
    for (const c of seq.filter(e => e.name === 'circle' && num(e.a.r) === 12)) {
      const cx = num(e_x(c)), cy = num(e_y(c));
      const box = seq.find(e => e.name === 'rect' &&
        Math.abs(num(e.a.x) + e.dx - cx) < 1 && Math.abs(num(e.a.y) + e.dy - (cy + 5)) < 1);
      if (box && box.index > c.index) {
        chipped++;
        R.error('§1', `Step badge at (${cx}, ${cy}) is painted before its own box.`,
          'The box corner overlaps the badge ring and cuts an arc through it. Emit the badge after the box so its opaque fill masks the corner.');
      }
    }
    const badges = seq.filter(e => e.name === 'circle' && num(e.a.r) === 12).length;
    if (badges && !chipped) R.pass('§1', `all ${badges} step badges painted after their box`);
  }

  /* --- §5 no overlaps --- */
  let overlaps = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
        overlaps++;
        R.error('§5', `Nodes overlap: (${a.x}, ${a.y}) ${a.w}×${a.h} intersects (${b.x}, ${b.y}) ${b.w}×${b.h}.`);
      }
    }
  }
  if (boxes.length && !overlaps) R.pass('§5', `no node overlaps across ${boxes.length} nodes`);

  /* --- §5.4 rail gutter (only when rails are used) --- */
  const railTags = findTags(svg, 'rect').map(attrs).filter(a => num(a.x) === 9 && num(a.rx) === 4 && num(a.width) >= 70 && num(a.width) <= 78);
  if (railTags.length) {
    const allTies = findTags(svg, 'line').map(attrs).filter(a => a.stroke === '#475569' && num(a.x2) === 95);
    const exactTies = allTies.filter(a => num(a.x1) === 115);
    if (allTies.length < railTags.length)
      R.error('§5.4', `${railTags.length} rail tags but only ${allTies.length} tie lines — a rail tag with no tie floats free of its row.`);
    else if (exactTies.length < railTags.length)
      R.warn('§5.4/r2', `${railTags.length - exactTies.length} rail tie(s) do not start at x=115.`,
        `Found starts at ${[...new Set(allTies.map(a => a.x1))].join(', ')}; r2 fixes the tie run at 115→95.`);
    else R.pass('§5.4/r2', `${railTags.length} rail tags with 115→95 ties`);
    if (/<g transform="translate\(40\s*,\s*0\)"/.test(svg)) R.pass('§5.4/r2', 'flow shifted into the rail gutter via translate(40,0)');
    else R.error('§5.4/r2', 'Rail tags are used but the flow is not shifted by the rail gutter.',
      'Wrap the flow in <g transform="translate(40,0)"> so it starts at x=120; without it the tag and tie run under the first node.');
  }

  /* --- §10 legend mirrors the styles actually used --- */
  // Detect the legend by its swatches, not by a heading: r3 drops the "Legend" title, since
  // a row of keyed swatches is self-evidently a key.
  const swatchRects = walk(svg).filter(e => e.name === 'rect' && num(e.a.width) === 16 && num(e.a.height) === 10);
  const legendBandY = swatchRects.length ? Math.min(...swatchRects.map(e => num(e.a.y) + e.dy)) : null;
  if (texts.some(t => t.text === 'Legend')) {
    R.error('§10/r3', 'The legend still carries a "Legend" heading.',
      'r3 drops it — a row of keyed swatches already reads as a key, and the heading costs a line.');
  }
  if (legendBandY === null) {
    R.error('§10', 'No in-canvas legend.', 'The legend is a §0 delivery gate — a reader decodes the colour system from it.');
  } else {
    const legendHeading = { y: legendBandY - 10 };
    const usedAccents = new Set(steps.map(b => b.stroke).filter(Boolean));
    for (const b of boxes) if (b.kind !== 'step' && b.stroke) usedAccents.add(b.stroke);
    // A dashed full-width band (the optional PREREQUISITES box) is a style the reader has
    // to decode too, so it counts as "in use" for the mirror check.
    for (const e of walk(svg)) {
      if (e.name !== 'rect' || !e.a['stroke-dasharray'] || !e.a.stroke) continue;
      if (num(e.a.width, 0) >= 200) usedAccents.add(e.a.stroke);
    }
    // Legend swatches: the 16×10 chips, plus the small rotated square standing in for a
    // decision. That square is authored either as translate()+rotate(45) or as
    // rotate(45, cx, cy), so match on size rather than on one spelling of the transform.
    const swatchStrokes = new Set();
    for (const e of walk(svg)) {
      if (e.name !== 'rect' || !e.a.stroke) continue;
      const w = num(e.a.width, 0), h = num(e.a.height, 0);
      if ((w === 16 && h === 10) || (e.rotated && w <= 12 && h <= 12)) swatchStrokes.add(e.a.stroke);
    }

    // A legend broken across rows while the canvas still has width to spare makes the reader
    // scan twice for what is really one list. Rows are allowed only when the items genuinely
    // do not fit; the check compares the laid-out width against the canvas, not the nodes.
    const legendLabels = texts.filter(t => t.fill === NEUTRAL_TEXT && t.size <= smallCeil(texts) && t.y >= legendBandY - 2 && t.y <= legendBandY + 60);
    const legendRows = new Set(legendLabels.map(t => Math.round(t.y))).size;
    if (legendRows > 1 && vb.length === 4) {
      const widest = legendLabels.reduce((n, t) => n + 22 + textWidth(t.text, 8) + 22, 0) - 22;
      if (widest <= vb[2]) {
        R.error('§10', `Legend is split across ${legendRows} rows but fits on one.`,
          `Laid out it needs ~${Math.round(widest)} units and the canvas is ${vb[2]}. Wrap only when the items genuinely do not fit.`);
      } else {
        R.pass('§10', `legend wraps to ${legendRows} rows — it does not fit on one`);
      }
    } else if (legendRows === 1) {
      R.pass('§10', 'legend renders on a single row');
    }

    const missing = [...usedAccents].filter(c => !swatchStrokes.has(c));
    const extra = [...swatchStrokes].filter(c => !usedAccents.has(c));
    if (!missing.length && !extra.length) R.pass('§10', `legend mirrors exactly the ${usedAccents.size} styles in use`);
    if (missing.length) R.error('§10', `Legend is missing entries for styles the diagram uses: ${missing.join(', ')}.`);
    if (extra.length) R.error('§10', `Legend lists styles the diagram never uses: ${extra.join(', ')}.`,
      'The legend decodes this diagram; an entry for an absent style is a defect, not a harmless extra.');

    // Centred on the content's own axis (r3). Measured against the node bounds rather than
    // the viewBox so it reads as aligned with the flow above it.
    if (legendLabels.length && steps.length) {
      const left = Math.min(...legendLabels.map(t => t.x)) - 22;
      const right = Math.max(...legendLabels.map(t => t.x + textWidth(t.text, 8)));
      // Measure the same axis the generator centres on: every laid-out node — steps AND the
      // start/end pills. Excluding pills shifts the reference by half a pill width and the
      // check then disagrees with a correctly centred legend. Decisions are excluded because
      // their 114-unit rotated bbox overstates the shape's visual width.
      const nodes = boxes.filter(b => b.kind === 'step' || b.kind === 'pill');
      const contentMid = (Math.min(...nodes.map(b => b.x)) + Math.max(...nodes.map(b => b.x + b.w))) / 2;
      const skew = Math.abs((left + right) / 2 - contentMid);
      if (skew <= 40) R.pass('§10/r3', `legend centred on the content axis (off by ${Math.round(skew)})`);
      else R.error('§10/r3', `Legend is off-centre by ${Math.round(skew)} units.`,
        'Centre each row on the content midpoint; left-aligning it makes the key look attached to the leftmost node.');
    }
  }

  /* --- §9 exactly one card block, fully populated (or zero if interactive with drawer) --- */
  const cardsBlocks = (html.match(/<div class="cards">/g) || []).length;
  const isInteractive = /<div class="pf-drawer"/.test(html);
  if (cardsBlocks === 1) R.pass('§9', 'exactly one card block');
  else if (cardsBlocks === 0 && isInteractive) R.pass('§9', 'no card block — interactive drawer provides details instead');
  else R.error('§9', `Found ${cardsBlocks} \`.cards\` blocks; the standard allows exactly one.`);
  const ioRows = (html.match(/<td class="io-in">/g) || []).length;
  if (ioRows) R.pass('§9.1', `Input→Output table populated with ${ioRows} stage${ioRows === 1 ? '' : 's'}`);
  else if (!isInteractive) R.warn('§9.1', 'No Input→Output table found.', 'If this is intentional (interactive drawer only), this warning is expected.');
  const placeholder = /\b(TBD|TODO|Lorem ipsum|FIXME|XXX|PLACEHOLDER|\[insert|\bN\/A\b)/i.exec(html.replace(/<!--[\s\S]*?-->/g, ''));
  if (placeholder) R.error('§9', `Placeholder text left in the output: "${placeholder[0]}".`,
    'The card must be fully populated from the dataset before delivery.');
  else R.pass('§9', 'no placeholder text');
  const emptyCell = /<td class="io-(in|out|mean)"><\/td>/.test(html);
  if (emptyCell) R.error('§9.1', 'The Input→Output table has an empty cell.');

  /* --- §6.3 a loop label must sit on its OWN stroke (r7) ---
   *
   * The same-row loop label was offset BELOW its channel, so it landed on whatever ran
   * underneath — with a decision's No corridor there, a "re-score" label appeared to name the
   * rejection path. A label that is nearer to a differently-coloured stroke than to its own is
   * mis-attributed, and colour is the only thing telling the reader which path it belongs to. */
  {
    const segs = [];
    for (const m of html.matchAll(/<path d="M ([\d.-]+) ([\d.-]+)((?: L [\d.-]+ [\d.-]+)+)"[^>]*stroke="(#[0-9a-fA-F]{6})"/g)) {
      const pts = [[+m[1], +m[2]], ...m[3].trim().split(' L ').filter(Boolean).map(q => q.trim().split(/\s+/).map(Number))];
      for (let i = 1; i < pts.length; i++) {
        // horizontal runs only: a label rides a horizontal leg
        if (Math.abs(pts[i][1] - pts[i - 1][1]) < 0.6) {
          segs.push({ y: pts[i][1], x1: Math.min(pts[i][0], pts[i - 1][0]), x2: Math.max(pts[i][0], pts[i - 1][0]), stroke: m[4] });
        }
      }
    }
    let mis = 0;
    for (const lab of texts) {
      if (!lab.fill || !/^#[0-9a-fA-F]{6}$/.test(lab.fill)) continue;
      const over = segs.filter(g => lab.x >= g.x1 - 2 && lab.x <= g.x2 + 2 && Math.abs(g.y - lab.y) < 22);
      if (over.length < 2) continue;                       // only ambiguous when strokes compete
      const own = over.filter(g => g.stroke.toLowerCase() === lab.fill.toLowerCase());
      if (!own.length) continue;                           // label colour unrelated to any path here
      const nearestOwn = Math.min(...own.map(g => Math.abs(g.y - lab.y)));
      const nearestOther = Math.min(...over.filter(g => g.stroke.toLowerCase() !== lab.fill.toLowerCase())
        .map(g => Math.abs(g.y - lab.y)));
      if (nearestOther < nearestOwn) {
        mis++;
        R.error('§6.3/r7', `Loop label "${lab.text}" sits closer to a different path than to its own.`,
          `Its own ${lab.fill} stroke is ${nearestOwn.toFixed(1)} away; a foreign stroke is ${nearestOther.toFixed(1)}. Centre the label on its own channel (r7).`);
      }
    }
    if (!mis) R.pass('§6.3/r7', 'every loop label sits on its own stroke');
  }

  /* --- §7 role labels carry no iconography (r7) ---
   *
   * The node's colour and the legend already encode manual/automated/integration, so a glyph in
   * front of the role restates it in a form that renders inconsistently across platforms, eats
   * width the role name needs, and — in the accessible name — gets ANNOUNCED ("high voltage",
   * "bust in silhouette") ahead of the actual role. Glyphs reach the output from two directions,
   * this generator's fallback and caller data with them already baked into `role`, so the check
   * covers the whole document rather than one draw site. The funnel on the filter chip is drawn
   * geometry, not an emoji, and the legend swatches are rects — neither trips this. */
  {
    const GLYPH = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{FE0F}\u{20E3}]/u;
    const offenders = [];
    for (const m of html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) if (GLYPH.test(m[1])) offenders.push(m[1].trim());
    for (const m of html.matchAll(/aria-label="([^"]*)"/g)) if (GLYPH.test(m[1])) offenders.push(m[1].trim());
    if (offenders.length) R.error('§7/r7', `Iconography in ${offenders.length} label(s); colour and the legend already encode type.`,
      `First: "${offenders[0]}". Strip glyphs at render time — caller data carries them too (r7).`);
    else R.pass('§7/r7', 'no iconography in rendered or accessible labels');
  }

  /* --- §11.0 the inline script must actually PARSE (r7) ---
   *
   * Every check below greps for handler names in the source text, which a dead script passes
   * perfectly: one stray token anywhere in the block throws at parse time and the browser
   * defines NONE of the functions, so all of export, filtering and the drawer are inert on a
   * file the verifier just called conformant. This happened — a `\n` inside a generated
   * string literal was interpolated into a raw newline. Parsing the emitted script is the only
   * check that distinguishes "the handler is present" from "the handler exists at runtime". */
  const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (!inlineScripts.length) {
    R.error('§11.0', 'No inline script found; export and interaction cannot work.');
  } else {
    let broke = null;
    for (const src of inlineScripts) {
      try { new vm.Script(src); } catch (e) { broke = e.message.split('\n')[0]; break; }
    }
    if (broke) R.error('§11.0', `The inline script does not parse: ${broke}`,
      'A parse error voids every scripted behaviour at once — export, filters and the drawer are all inert.');
    else R.pass('§11.0', `inline script parses (${inlineScripts.length} block(s))`);
  }

  /* --- §11 export toolbar + capture config --- */
  const inHeader = /<div class="header-row">[\s\S]*?<\/div>\s*<\/div>[\s\S]{0,400}?<div class="toolbar">/.test(html) || /<div class="header">[\s\S]*?<div class="toolbar">[\s\S]*?<\/div>\s*<\/div>/.test(html);
  if (!inHeader) R.warn('§1/§11', 'Could not confirm the toolbar sits inside the header.', 'It must live in .header-row so the capture ignore and print rule reach it.');
  for (const [label, re] of [['Copy', /copyAsImage/], ['PNG', /downloadPNG/], ['PDF', /downloadPDF/],
                             ['SVG', /downloadSVG/], ['JPG', /downloadJPG/]]) {
    if (re.test(html)) R.pass('§11.1', `export action wired: ${label}`);
    else R.error('§11.1', `Export toolbar is missing the ${label} action.`);
  }
  if (/aria-label="Export options"/.test(html)) R.pass('§11.1/§12', 'toolbar toggle has aria-label');
  else R.error('§12', 'The toolbar toggle has no aria-label.');

  /* r7 — the export trigger must be a readable word, not a bare glyph. An unlabelled `⋯`
   * tested fine and was still never found, so discoverability is part of the contract. */
  const trig = /<button[^>]*class="export-btn"[^>]*>([^<]*)</.exec(html);
  if (trig && /[A-Za-z]{3,}/.test(trig[1])) R.pass('§11.1', `export trigger is text-labelled ("${trig[1].trim()}")`);
  else R.error('§11.1', 'The export trigger has no text label.',
    'A glyph-only trigger hides the feature; give the button a word (r7).');
  for (const [re, label] of [
    [/class="export-btn"[^>]*aria-haspopup="menu"/, 'export trigger declares aria-haspopup="menu"'],
    [/class="export-btn"[^>]*aria-expanded="(true|false)"/, 'export trigger declares aria-expanded'],
    [/id="exportMenu"[^>]*role="menu"/, 'export popover has role="menu"'],
    [/role="menuitem"/, 'export formats are menuitems'],
  ]) {
    if (re.test(html)) R.pass('§11.1/§12', label);
    else R.error('§12', `Export menu accessibility: ${label} not found.`);
  }
  /* JPEG has no alpha channel: an un-flattened canvas writes transparent pixels as black,
   * which on this palette is silent damage rather than a visible bug. */
  if (/downloadJPG[\s\S]{0,900}?fillRect\(0, 0/.test(html)) R.pass('§11.1', 'JPG export flattens onto an opaque ground');
  else R.error('§11.1', 'JPG export does not flatten the canvas before encoding.',
    'JPEG has no alpha; transparent pixels encode as black (r7).');
  /* An SVG export that raster-wraps a PNG is not a vector export. */
  if (/downloadSVG[\s\S]{0,900}?XMLSerializer/.test(html)) R.pass('§11.1', 'SVG export serialises vector markup');
  else R.error('§11.1', 'SVG export does not serialise the live SVG.',
    'It must be a vector serialisation, not a raster in a wrapper (r7).');
  // Native tooltips are uncontrollable — OS-styled, delayed, and outside the design system.
  // TWO things produce them and both are banned: a `title` ATTRIBUTE on any element, and a
  // `<title>` CHILD inside the SVG. The latter is the sneaky one: it is a legitimate a11y
  // construct, so it looks correct, but browsers render it as a hover pop-up over the whole
  // canvas. aria-label reaches the same screen readers and paints nothing.
  const tipAttr = /<[a-z]+\b[^>]*\stitle="[^"]*"/i.exec(html);
  if (tipAttr) R.error('§11.1', 'A native browser tooltip (`title` attribute) is present.',
    `Found: ${tipAttr[0].slice(0, 80)}… Use aria-label for the accessible name and drop title.`);
  const tipEl = /<title\b[^>]*>/i.exec(svg);
  if (tipEl) R.error('§11.1/§12', 'The SVG contains a <title> element, which browsers show as a tooltip on hover.',
    'Move the text to aria-label on the <svg>. It is announced identically and renders nothing.');
  if (!tipAttr && !tipEl) R.pass('§11.1', 'no native browser tooltips (no title attributes, no SVG <title>)');
  // Export must measure its own bounds. Capturing #report-container's rect crops anything that
  // overflows it — and the SVG routinely does, because min-width makes it wider than its
  // container on a narrow viewport. A cropped PNG still looks like a complete diagram.
  if (/function captureBounds\(\)/.test(html) && /querySelectorAll\('\*'\)/.test(html)) {
    R.pass('§11.1', 'export bounds measured across all descendants');
  } else {
    R.error('§11.1', 'Export captures a single element rect rather than measured content bounds.',
      'Walk every descendant and take the union, so content overflowing the container is not silently cropped.');
  }
  if (/scrollLeft = 0/.test(html)) R.pass('§11.1', 'scrolled diagram reset before capture');
  else R.warn('§11.1', 'A horizontally scrolled diagram may capture only the visible portion.');

  const capChecks = [
    [/backgroundColor:\s*'#E9F2FE'/, "capture backgroundColor '#E9F2FE'"],
    [/scale:\s*2/, 'capture scale 2'],
    [/const pad = 32/, 'capture pad 32'],
    [/ignoreElements[^\n]*toolbar/, 'capture ignores .toolbar']
  ];
  for (const [re, label] of capChecks) {
    if (re.test(html)) R.pass('§11.1', label);
    else R.error('§11.1', `Capture config deviates: ${label} not found.`);
  }
  if (/@media print[^}]*\{[\s\S]{0,220}?\.toolbar\s*\{\s*display:\s*none/.test(html)) R.pass('§11.1', 'print hides the toolbar');
  else R.error('§11.1', '@media print does not hide the toolbar.');

  /* --- §11.3 interactivity layer, when present --- */
  const interactive = /class="pf-node"/.test(html);
  if (interactive) {
    const ix = [
      [/role="button"[^>]*>|<g class="pf-node"[^>]*role="button"/, 'nodes expose role="button"'],
      [/tabindex="0"/, 'nodes are keyboard focusable'],
      [/aria-label="[^"]+"/, 'nodes carry an accessible name'],
      [/id="pfDrawer"[^>]*role="dialog"/, 'detail drawer is a labelled dialog'],
      [/aria-hidden="true"/, 'drawer starts hidden from assistive tech'],
      [/prefers-reduced-motion/, 'motion is guarded by prefers-reduced-motion'],
      [/@media print \{ \.pf-drawer, \.pf-filters \{ display: none/, 'drawer and filters are hidden in print'],
      [/ignoreElements[^\n]*pf-drawer[\s\S]{0,80}pf-filters|ignoreElements[^\n]*pf-filters/, 'capture ignores the interactive chrome'],
      [/pfResetView\(\);/, 'exports reset filters and selection first'],
      [/:focus-visible/, 'visible focus styling present']
    ];
    for (const [re, label] of ix) {
      if (re.test(html)) R.pass('§11.3', label);
      else R.error('§11.3', `Interactivity layer defect: ${label} — not found.`);
    }
    const dimmed = /\.pf-node\.is-dim[^}]*pointer-events:\s*none/.test(html);
    if (!dimmed) R.warn('§11.3', 'Dimmed nodes remain clickable.', 'A filtered-out node that still opens a drawer reads as a bug to the user.');
  } else {
    R.pass('§11.2', 'static diagram — no interactive chrome (default)');
  }

  /* --- §3.2 readable type floor (r4) --- */
  // Anything the reader has to READ must clear 10px. These diagrams get downscaled into
  // slides, printed to A4, and screenshotted; html2canvas captures at 2× so the export is
  // sharp, but sharpness is not legibility once the image is scaled to fit a frame.
  {
    const FLOOR = 10;
    // The step badge numeral is exempt: one glyph in a 24px ring, found by position not read.
    const badge = new Set(nodeBoxes(svg).filter(b => b.kind === 'step').map(b => `${b.x},${b.y - 1}`));
    const tooSmall = texts.filter(t => t.size < FLOOR - 0.01 && !badge.has(`${t.x},${t.y}`) && t.text);
    if (!tooSmall.length) R.pass('§3.2/r4', `all readable text ≥ ${FLOOR}px`);
    else {
      const worst = [...new Set(tooSmall.map(t => t.size))].sort((a, b) => a - b);
      R.error('§3.2/r4', `${tooSmall.length} text element(s) below the ${FLOOR}px readable floor (smallest ${worst[0]}px).`,
        `e.g. "${tooSmall[0].text.slice(0, 40)}". Raise the type tokens rather than editing draw sites — set spec.type.min.`);
    }
  }

  /* --- §12 accessibility baseline --- */
  if (/<h1>/.test(html)) R.pass('§12', 'semantic h1 present');
  else R.error('§12', 'No <h1> — the diagram title must be a real heading.');
  // The SVG needs an accessible name, but it must come from aria-label — see the tooltip ban.
  if (/<svg\b[^>]*aria-label="[^"]+"/.test(svgOpen)) R.pass('§12', 'SVG carries an accessible name via aria-label');
  else R.error('§12', 'The SVG has no accessible name.', 'Add aria-label to the <svg> (not a <title> child, which renders as a tooltip).');
  if (/<svg\b[^>]*role="(img|group)"/.test(svgOpen)) R.pass('§12', 'SVG has an explicit role');
  else R.warn('§12', 'The SVG has no role="img" (static) or role="group" (interactive).');

  return R;
}

/* ---------- CLI ---------- */

const COLOR = { ERROR: '\x1b[31m', WARN: '\x1b[33m', PASS: '\x1b[32m', dim: '\x1b[2m', reset: '\x1b[0m' };
function paint(s, c) { return process.stdout.isTTY ? c + s + COLOR.reset : s; }

function printReport(R, quiet) {
  console.log(`\n${paint(R.file, COLOR.dim)}`);
  const show = quiet ? [...R.errors, ...R.warnings] : R.findings;
  for (const f of show) {
    if (f.level === 'PASS') {
      console.log(`  ${paint('✓', COLOR.PASS)} ${paint(f.section, COLOR.dim)} ${f.msg}`);
    } else {
      const tag = f.level === 'ERROR' ? paint('✗ ERROR', COLOR.ERROR) : paint('! WARN ', COLOR.WARN);
      console.log(`  ${tag} ${paint(f.section, COLOR.dim)} ${f.msg}`);
      if (f.detail) console.log(`          ${paint(f.detail, COLOR.dim)}`);
    }
  }
  const e = R.errors.length, w = R.warnings.length, p = R.passes.length;
  const verdict = e ? paint(`FAIL — ${e} error${e === 1 ? '' : 's'}`, COLOR.ERROR) : paint('CONFORMANT', COLOR.PASS);
  console.log(`  ${verdict}${w ? `, ${w} warning${w === 1 ? '' : 's'}` : ''}, ${p} checks passed`);
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const quiet = args.includes('--quiet');
  const files = args.filter(a => !a.startsWith('--'));

  if (!files.length) {
    console.error('Usage: node verify.js <diagram.html> [more.html ...] [--json] [--quiet]');
    process.exit(2);
  }

  const reports = [];
  for (const f of files) {
    if (!fs.existsSync(f)) { console.error(`No such file: ${f}`); process.exit(2); }
    reports.push(verify(fs.readFileSync(f, 'utf8'), f));
  }

  if (json) {
    console.log(JSON.stringify(reports.map(R => ({
      file: R.file,
      conformant: R.errors.length === 0,
      errors: R.errors.map(f => ({ section: f.section, message: f.msg, detail: f.detail || null })),
      warnings: R.warnings.map(f => ({ section: f.section, message: f.msg, detail: f.detail || null })),
      passed: R.passes.length
    })), null, 2));
  } else {
    reports.forEach(R => printReport(R, quiet));
  }

  process.exit(reports.some(R => R.errors.length) ? 1 : 0);
}

if (require.main === module) main();
module.exports = { verify };
