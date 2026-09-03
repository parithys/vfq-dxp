#!/usr/bin/env node
/**
 * Self-test for scripts/verify.js
 * ------------------------------------------------------------------
 * A conformance verifier that never fails is indistinguishable from no verifier at all,
 * and it fails silently: every diagram comes back green and the standard quietly stops
 * being enforced. So this generates a known-good diagram, confirms it passes, then breaks
 * one rule at a time and confirms each break is caught.
 *
 * Run after any change to verify.js or generate.js:
 *   node scripts/selftest.js
 *
 * Exit 0 = the verifier is doing its job. Exit 1 = a rule is no longer enforced.
 */

'use strict';

/* Theme-coupled render tokens. The mutation suite locates the text it corrupts BY FILL COLOUR,
 * so these must track INK / NEUTRAL in generate.js. If they drift, mutations stop applying and
 * the suite reports vacuous passes instead of failures. */
// Values below appear as LITERALS in the regexes (a regex literal cannot interpolate):
//   node titles / pill / decision text -> #1a1a1a   |   meta, payload, legend text -> #6b7280
// Grep for those two hexes here whenever the palette in generate.js changes.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildHTML } = require('./generate.js');
const { verify } = require('./verify.js');

const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'references', 'example-spec.json'), 'utf8'));

/* Each mutation breaks exactly one rule. The label names the rule, so a failure here reads
 * as "nobody is checking X any more" rather than as an opaque assertion. */
const MUTATIONS = [
  ['§1  painted grid rect is rejected', s => s.replace('<pattern id="grid"', '<rect width="100%" height="100%" fill="url(#grid)" opacity="0.5"/><pattern id="grid"')],
  ['§1  stripped SRI is rejected', s => s.replace(/\s+integrity="sha384-[^"]+"/g, '')],
  ['§5.5 container ceiling drift is rejected', s => s.replace('max-width: 1920px', 'max-width: 1300px')],
  ['§5.5 stale svg min-width is rejected', s => s.replace(/(svg \{ width: 100%; min-width: )[\d.]+px/, '$11600px')],
  ['§5.5 panel chrome on .diagram-container is rejected', s => s.replace('.diagram-container { overflow-x: auto; }', '.diagram-container { overflow-x: auto; background: #0f172a; border: 1px solid #1e293b; padding: 1rem; }')],
  ['§5.5 a pixel width on <svg> is rejected', s => s.replace('<svg xmlns=', '<svg width="1200" xmlns=')],
  ['§6.1 tampered marker geometry is rejected', s => s.replace('id="arrowhead-emerald" markerWidth="10" markerHeight="7" refX="9"', 'id="arrowhead-emerald" markerWidth="12" markerHeight="7" refX="6"')],
  ['§9  placeholder text is rejected', s => s.replace('Risk tier classification', 'TBD classification')],
  ['§10 a legend entry for an unused style is rejected', s => mutateFirst(s, /<rect x="[\d.]+" y="[\d.]+" width="16" height="10"[^>]*\/>/, m => m + '<rect x="600" y="900" width="16" height="10" rx="2" fill="none" stroke="#f472b6" stroke-width="1"/>', 1)],
  ['§11 print not hiding the toolbar is rejected', s => s.replace('.toolbar { display: none !important; } }', '} }')],
  ['§3.1 a broken node text rhythm is rejected', s => mutateFirst(s, /y="([\d.]+)" fill="#1a1a1a" font-size="[\d.]+" font-weight="600" text-anchor="middle"/, (m, y) => m.replace(`y="${y}"`, `y="${Number(y) - 5}"`), 3)],
  ['§1  a badge painted before its box is rejected', s => swapBadgeBeforeBox(s)],
  ['§10 a needlessly wrapped legend is rejected', s => wrapLegend(s)],
  // r7 — the regression that motivated §11.0: an escape sequence emitted as a raw newline
  // inside a string literal. Every grep-based check still passed; nothing scripted ran.
  ['§11.0 a script that does not parse is rejected', s => s.replace("SLUG + '.svg'", "SLUG + '.sv\ng'")],
  ['§11.1 a glyph-only export trigger is rejected', s => s.replace(/(<button[^>]*class="export-btn"[^>]*>)Export</, '$1\u22ef<')],
  ['§11.1 an unflattened JPG export is rejected', s => s.replace(/g\.fillRect\(0, 0[^;]*;/, '')],
  ['§11.1 a raster-wrapped SVG export is rejected', s => s.replace('new XMLSerializer().serializeToString(clone)', 'canvas.toDataURL("image/png")')],
  // r7 — the regression this rule exists for: a label nudged off its own channel onto a
  // neighbouring path of a different colour. Built generically from whatever coloured label the
  // baseline actually has, since the example spec's own loop is unlabelled.
  ['§6.3 a loop label on the wrong stroke is rejected', s => {
    // Take any coloured, weighted label (a branch/loop label) and lay a horizontal stroke of
    // ITS colour just above it plus a foreign-coloured stroke nearer to it. That is exactly the
    // ambiguity the rule guards: the nearest stroke is not the one the label belongs to.
    const m = /<text x="([\d.]+)" y="([\d.]+)" fill="(#[0-9a-fA-F]{6})" font-size="[\d.]+" font-weight="600"/.exec(s);
    if (!m) return s;
    const x = Number(m[1]), y = Number(m[2]), own = m[3];
    const other = own.toLowerCase() === '#2e9e6b' ? '#d4667f' : '#2e9e6b';
    const mine = `<path d="M ${x - 200} ${y - 18} L ${x + 200} ${y - 18}" stroke="${own}" stroke-width="1" fill="none" stroke-dasharray="4,3"/>`;
    const foreign = `<path d="M ${x - 200} ${y + 3} L ${x + 200} ${y + 3}" stroke="${other}" stroke-width="1" fill="none" stroke-dasharray="4,3"/>`;
    return s.replace('</svg>', mine + foreign + '</svg>');
  }],
  ['§7  an emoji in a role label is rejected', s => mutateFirst(s, /(text-anchor="end">)([A-Za-z])/, (m, a, b) => a + '\u{1F464} ' + b, 1)],
  ['§11 an SVG <title> tooltip is rejected', s => s.replace(/(<svg\b[^>]*>)/, '$1<title>Tooltip on hover</title>')],
  ['§11 a native title tooltip is rejected', s => s.replace('class="export-btn"', 'class="export-btn" title="Export options"')],
  ['§4.1 node text overflowing its box is rejected', s => mutateFirst(s, /(<text x="[\d.]+" y="[\d.]+" fill="#6b7280" font-size="[\d.]+" text-anchor="middle">)([^<]+)(<\/text>)/, m => m.replace(/>([^<]+)</, '>a description line far too long to fit inside the node box<'), 3)],
  ['§11 capturing a bare container rect is rejected', s => s.replace('function captureBounds()', 'function captureBoundsDisabled()')],
  ['§6.3 a routed path crossing a node is rejected', s => {
    // Re-route a real dashed corridor straight through a node box — what an averaged-midpoint
    // corridor does whenever something hangs into the band it picks. Must match a DASHED path:
    // the first <path> in the file is the grid pattern inside <defs>.
    const box = /<rect x="([\d.]+)" y="([\d.]+)" width="(\d+)" height="([\d.]+)" rx="8"/.exec(s);
    const path = /<path d="[^"]*"[^>]*stroke-dasharray[^>]*\/>/.exec(s);
    if (!box || !path) return s;
    const midY = Number(box[2]) + Number(box[4]) / 2;
    const x1 = Number(box[1]) - 30, x2 = Number(box[1]) + Number(box[3]) + 30;
    const routed = path[0].replace(/d="[^"]*"/, `d="M ${x1} ${midY} L ${x2} ${midY}"`);
    return s.replace(path[0], routed);
  }],
  ['§6.4 a connector with a fixed coordinate is rejected', s => mutateFirst(s, /<line x1="([\d.]+)"([^>]*opacity="0\.75"[^>]*)\/>/, (m, x) => m.replace(`x1="${x}"`, 'x1="100"'), 1)],
  ['§3.2 sub-10px readable text is rejected', s => s.replace(/(<text x="[\d.]+" y="[\d.]+" fill="#6b7280" font-size=")[\d.]+/, '$17')],
  ['§8  an unlabelled decision branch is rejected', s => s.replace(/<text[^>]*font-weight="600"[^>]*>(Yes|No)<\/text>/g, '')],
  ['§6.2 a payload label wider than its channel is rejected', s => mutateFirst(s, /(<text x="[\d.]+" y="-?[\d.]+" fill="#6b7280" font-size="[\d.]+" text-anchor="middle">)([^<]+)(<\/text>)/, (m, g1) => m.replace(/>([^<]+)</, '>this payload label is far too long for its channel<'), 1)],
  // r7 moved payload labels ONTO the connector, so a label must travel further to reach the
  // role band than it did when it floated above the line. Rather than pin a magic offset that
  // goes stale the next time the type scale or the lift moves, compute the target from the
  // band itself: the guarded window is rowTop − 26 .. rowTop − 4, so land the label mid-band.
  ['§6.2 a payload label in the role band is rejected', s => {
    const tops = [...s.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="160" height="[\d.]+"/g)].map(m => Number(m[1]));
    if (!tops.length) return s;
    const target = Math.min(...tops) - 15;
    return mutateFirst(s, /y="(-?[\d.]+)" fill="#6b7280" font-size="[\d.]+" text-anchor="middle"/,
      (m, y) => m.replace(`y="${y}"`, `y="${target}"`), 1);
  }],
];

/* Push the last two legend labels onto a second row, as the old category-break layout did. */
function wrapLegend(s) {
  const first = /<rect x="[\d.]+" y="[\d.]+" width="16" height="10"/.exec(s);
  if (!first) return s;
  const re = /<text x="([\d.]+)" y="([\d.]+)" fill="#6b7280" font-size="[\d.]+">/g;
  re.lastIndex = first.index;
  const hits = [];
  let m;
  while ((m = re.exec(s))) hits.push(m);
  if (hits.length < 3) return s;
  let out = s;
  for (const h of hits.slice(-2)) {
    out = out.replace(h[0], h[0].replace(`y="${h[2]}"`, `y="${Number(h[2]) + 18}"`));
  }
  return out;
}

/* Move the first step badge back above its own box, recreating the pre-fix draw order. */
function swapBadgeBeforeBox(s) {
  const boxRe = /<rect x="([\d.]+)" y="([\d.]+)" width="\d+" height="80" rx="8"[^>]*\/>/;
  const box = boxRe.exec(s);
  if (!box) return s;
  const bx = box[1], by = Number(box[2]);
  const badgeRe = new RegExp(`<circle cx="${bx.replace('.', '\\.')}" cy="${by - 5}" r="12"[^>]*\\/>`);
  const badge = badgeRe.exec(s);
  if (!badge) return s;
  return s.replace(badge[0], '').replace(box[0], badge[0] + '\n' + box[0]);
}

/* Replace the Nth occurrence — the 1st white/11 text is the start pill's label, not a node
 * title, and mutating that would test nothing. */
function mutateFirst(s, re, fn, nth) {
  const g = new RegExp(re.source, 'g');
  let m, count = 0;
  while ((m = g.exec(s))) {
    if (++count < nth) continue;
    return s.slice(0, m.index) + fn(m[0], m[1]) + s.slice(m.index + m[0].length);
  }
  return s;
}

/* Domain-neutral fixtures (r5). The four exemplars share one shape — a single linear row of
 * agent-ecosystem nodes — so passing them proves very little about reusability. These are
 * deliberately unlike them and unlike each other: a 3-node minimum, unbroken dotted tokens,
 * 16 nodes that must wrap, a decision, a rework loop, three simultaneous loop corridors, and
 * every node type at once. Any of them failing means the generator has grown a dependency on
 * the shape of the examples rather than on the data. */
function runFixtures() {
  const dir = path.join(__dirname, '__fixtures__', 'matrix');
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  let bad = 0;
  for (const f of files) {
    const name = f.replace(/\.json$/, '');
    try {
      const fixture = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const html = buildHTML(fixture, 1600);
      const R = verify(html, name);
      if (R.errors.length) {
        bad++;
        console.log(`  ✗ fixture ${name} — ${R.errors.length} error(s)`);
        R.errors.slice(0, 2).forEach(e => console.log(`      ${e.section} ${e.msg}`));
      } else {
        console.log(`  ✓ fixture ${name} (${R.passes.length} checks)`);
      }
    } catch (e) {
      bad++;
      console.log(`  ✗ fixture ${name} — threw: ${e.message.split('\n')[0]}`);
    }
  }
  return bad;
}

/* Non-English ingestion (r6). The type vocabularies and column synonyms decide a node's
 * COLOUR, so an English-only table silently mis-resolves every other language. This proves a
 * caller-supplied vocabulary is sufficient — no source edit. */
function runNonEnglish() {
  const dir = path.join(__dirname, '__fixtures__');
  const csv = path.join(dir, 'non-english.csv');
  const vocab = path.join(dir, 'non-english.vocab.json');
  if (!fs.existsSync(csv) || !fs.existsSync(vocab)) return 0;
  const tmp = path.join(os.tmpdir(), 'pf-nonen-' + process.pid + '.json');
  try {
    require('child_process').execFileSync(process.execPath,
      [path.join(__dirname, 'ingest.js'), csv, '-o', tmp, '--vocab', vocab], { stdio: 'pipe' });
    const spec = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    const steps = spec.flow.filter(n => n.type === 'step');
    const unresolved = steps.filter(n => !n.kind);
    const withGlyph = steps.filter(n => /[\u{1F300}-\u{1FAFF}\u26A1\u{1F517}]/u.test(n.role || ''));
    const R = verify(buildHTML(spec, 1600), 'non-english');
    fs.rmSync(tmp, { force: true });
    if (unresolved.length) { console.log(`  ✗ non-english: ${unresolved.length} node kind(s) unresolved despite a vocabulary`); return 1; }
    if (withGlyph.length) { console.log(`  ✗ non-english: emoji baked into ${withGlyph.length} role field(s) — presentation belongs to the renderer`); return 1; }
    if (R.errors.length) { console.log(`  ✗ non-english: diagram has ${R.errors.length} conformance error(s)`); return 1; }
    console.log(`  ✓ non-english: ${steps.length} nodes typed from a supplied vocabulary, roles clean, diagram conformant`);
    return 0;
  } catch (e) {
    console.log(`  ✗ non-english: ${String(e.message).split('\n')[0]}`);
    return 1;
  }
}

/* Malformed specs must fail with a diagnostic, never a stack trace (r5). */
const BAD_SPECS = [
  ['no flow array', { title: 'X' }],
  ['empty flow', { title: 'X', flow: [] }],
  ['unknown node type', { title: 'X', flow: [{ type: 'wormhole' }] }],
  ['duplicate node id', { title: 'X', flow: [{ type: 'step', id: 'a', title: 'A' }, { type: 'step', id: 'a', title: 'B' }] }],
  ['loop to unknown id', { title: 'X', flow: [{ type: 'step', id: 'a', title: 'A' }], loops: [{ from: 'a', to: 'ghost' }] }],
  ['invalid kind', { title: 'X', flow: [{ type: 'step', id: 'a', title: 'A', kind: 'telepathic' }] }],
];
function runValidation() {
  let bad = 0;
  for (const [label, spec] of BAD_SPECS) {
    try {
      buildHTML(spec, 1600);
      bad++;
      console.log(`  ✗ validation: ${label} — ACCEPTED (should have been rejected)`);
    } catch (e) {
      if (e.name === 'SpecError') console.log(`  ✓ validation: ${label} rejected`);
      else { bad++; console.log(`  ✗ validation: ${label} — threw ${e.name}, not SpecError`); }
    }
  }
  return bad;
}

function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-selftest-'));
  const good = buildHTML(spec, 1600);
  const goodPath = path.join(dir, 'good.html');
  fs.writeFileSync(goodPath, good);

  let failures = 0;

  const base = verify(good, goodPath);
  if (base.errors.length === 0) {
    console.log(`  ✓ baseline diagram is conformant (${base.passes.length} checks passed)`);
  } else {
    failures++;
    console.log('  ✗ baseline diagram FAILS its own verifier — the two have drifted apart:');
    base.errors.forEach(e => console.log(`      ${e.section} ${e.msg}`));
  }

  for (const [label, mutate] of MUTATIONS) {
    const broken = mutate(good);
    if (broken === good) {
      failures++;
      console.log(`  ✗ ${label}  — MUTATION DID NOT APPLY (the test is stale, not the verifier)`);
      continue;
    }
    const R = verify(broken, 'mutant');
    if (R.errors.length > base.errors.length) {
      console.log(`  ✓ ${label}`);
    } else {
      failures++;
      console.log(`  ✗ ${label}  — NOT CAUGHT`);
    }
  }

  fs.rmSync(dir, { recursive: true, force: true });

  console.log('');
  failures += runNonEnglish();
  failures += runValidation();
  console.log('');
  failures += runFixtures();
  const total = MUTATIONS.length + 2 + BAD_SPECS.length +
    (fs.existsSync(path.join(__dirname, '__fixtures__', 'matrix'))
      ? fs.readdirSync(path.join(__dirname, '__fixtures__', 'matrix')).filter(f => f.endsWith('.json')).length : 0);
  if (failures) {
    console.log(`  ${failures} of ${total} checks failed.`);
    process.exit(1);
  }
  console.log(`  All ${total} checks passed — ${MUTATIONS.length} mutations, ${BAD_SPECS.length} malformed specs, and every domain-neutral fixture.`);
}

if (require.main === module) run();
