#!/usr/bin/env node
'use strict';

/**
 * build-dashboards.js — pure Node, zero AI calls. Regenerates
 * output/bpmn-swimlane-dashboard.html and output/process-flow-dashboard.html
 * — one central "browse everything" entry point per diagram type.
 *
 * Reads exactly the same sources every other pure-Node script here already
 * trusts: manifest.json (which BRSDs have a rendered output, and when) and
 * each BRSD's own data/{slug}/bpmn-swimlane.model.json (title, node count,
 * phase count — the SAME structural file both engines render from, so a
 * dashboard entry's numbers can never disagree with what the diagram
 * itself shows). Never re-parses the generated HTML output.
 *
 * "Automatically detect new diagrams" doesn't mean this file watches the
 * filesystem — nothing in this project does, by design (see README.md).
 * It means: run this after render-all.js (or let render-all.js call it,
 * which it does by default) and the dashboards are back in sync, with no
 * hand-edit ever required — the exact same guarantee render-all.js itself
 * already gives every individual diagram.
 *
 * Usage:
 *   node scripts/build-dashboards.js
 */

const fs = require('fs');
const path = require('path');

const manifestStore = require('./manifest');
const { TYPES, listSlugs } = require('./render-all');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUTPUT_DIR = path.join(ROOT, 'output');

const DASHBOARD_META = {
  'bpmn-swimlane': {
    outFile: 'bpmn-swimlane-dashboard.html',
    eyebrow: 'Diagram Library',
    title: 'BPMN Swimlane Dashboard',
    blurb: 'Actor-lane process diagrams — every BRSD that has been extracted and rendered, in one place.',
    accent: '#2b6cb0',
  },
  'process-flow': {
    outFile: 'process-flow-dashboard.html',
    eyebrow: 'Diagram Library',
    title: 'Process Flow Dashboard',
    blurb: 'Single-spine flowchart diagrams — every BRSD that has been extracted and rendered, in one place.',
    accent: '#2A1B9E',
  },
};

// ----------------------------------------------------------------- data collection

function collectEntries(typeName) {
  const spec = TYPES[typeName];
  const manifest = manifestStore.load();
  const entries = [];

  for (const slug of listSlugs()) {
    const brsd = manifest.brsds && manifest.brsds[slug];
    const diag = brsd && brsd.diagrams && brsd.diagrams[typeName];
    if (!diag || !diag.renderedAt) continue; // never rendered for this type — nothing to link to

    const outputFileName = `${slug}-${spec.outputSuffix}`;
    const outputPath = path.join(OUTPUT_DIR, slug, outputFileName);
    if (!fs.existsSync(outputPath)) continue; // manifest says rendered, file's actually missing — skip, don't link a 404

    const dataPath = path.join(DATA_DIR, slug, spec.dataFile);
    let model = null;
    if (fs.existsSync(dataPath)) {
      try {
        model = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      } catch (e) {
        model = null; // malformed data file — degrade to slug-derived fields below, don't crash the whole dashboard build
      }
    }

    const titleRaw = (model && model.meta && model.meta.title) || slug;
    const parts = String(titleRaw).split(/\s*—\s*/);
    const title = parts[0].trim();
    const subtitle = parts.slice(1).join(' — ').trim();
    const sourceFile = (model && model.meta && model.meta.source) ||
      (brsd && brsd.sourcePath && path.basename(brsd.sourcePath)) || '';

    entries.push({
      slug,
      title,
      subtitle,
      fileName: outputFileName,
      relPath: `${slug}/${outputFileName}`,
      sourceFile,
      nodeCount: model && Array.isArray(model.nodes) ? model.nodes.length : null,
      phaseCount: model && model.layout && Array.isArray(model.layout.phases) ? model.layout.phases.length : null,
      renderedAt: diag.renderedAt,
    });
  }

  entries.sort((a, b) => a.title.localeCompare(b.title));
  return entries;
}

// ----------------------------------------------------------------- rendering

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderDashboard(typeName, entries) {
  const meta = DASHBOARD_META[typeName];
  const otherType = typeName === 'bpmn-swimlane' ? 'process-flow' : 'bpmn-swimlane';
  const otherMeta = DASHBOARD_META[otherType];
  const generatedAt = new Date().toISOString();

  const cardsJson = JSON.stringify(entries.map((e) => ({
    slug: e.slug, title: e.title, subtitle: e.subtitle, fileName: e.fileName, relPath: e.relPath,
    sourceFile: e.sourceFile, nodeCount: e.nodeCount, phaseCount: e.phaseCount, renderedAt: e.renderedAt,
  })));

  return `<meta charset="utf-8">
<title>${esc(meta.title)}</title>
<style>
:root{
  --accent:${meta.accent}; --ink:#14171c; --mute:#5b6270; --faint:#8990a0;
  --bg:#f3f4f6; --panel:#ffffff; --line:#e2e5ea;
  --charcoal:#25282b; --charcoal-2:#1a1c1e;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:-apple-system,"Segoe UI","Helvetica Neue",Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;line-height:1.5}
header{position:sticky;top:0;z-index:10;background:linear-gradient(180deg,var(--charcoal),var(--charcoal-2));
  color:#fff;padding:28px 40px 22px}
.hrow{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;flex-wrap:wrap}
.eyebrow{font-size:11px;font-weight:700;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px}
h1{font-size:26px;font-weight:800;margin:0 0 6px;letter-spacing:-.01em}
.blurb{font-size:13.5px;color:rgba(255,255,255,.68);margin:0;max-width:56ch}
.switcher{font-size:12px;color:rgba(255,255,255,.6);white-space:nowrap;padding-top:4px}
.switcher a{color:#fff;text-decoration:none;font-weight:600;border-bottom:1px solid rgba(255,255,255,.4)}
.switcher a:hover{border-color:#fff}
.controls{display:flex;gap:10px;align-items:center;margin-top:20px;flex-wrap:wrap}
.searchbox{flex:1;min-width:240px;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:0 14px;height:38px}
.searchbox svg{flex:none;opacity:.6}
.searchbox input{flex:1;border:0;background:none;outline:0;color:#fff;font-size:13.5px;font-family:inherit}
.searchbox input::placeholder{color:rgba(255,255,255,.45)}
.count{font-size:12.5px;color:rgba(255,255,255,.55);white-space:nowrap}
.sortsel{height:38px;border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);
  color:#fff;font-size:12.5px;font-family:inherit;padding:0 10px;cursor:pointer}
.sortsel option{color:#111}

main{max-width:1280px;margin:0 auto;padding:28px 40px 80px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px 22px;
  text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:10px;
  transition:border-color .15s,box-shadow .15s,transform .15s}
.card:hover{border-color:var(--accent);box-shadow:0 8px 24px rgba(20,23,28,.08);transform:translateY(-1px)}
.card:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.card-title{font-size:16px;font-weight:700;letter-spacing:-.005em;color:var(--ink)}
.card-sub{font-size:12.5px;color:var(--mute);margin-top:-6px}
.card-file{font-family:ui-monospace,"SF Mono","Cascadia Code",Consolas,monospace;font-size:11px;color:var(--faint);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stat-row{display:flex;gap:16px;margin-top:2px}
.stat{display:flex;flex-direction:column;gap:1px}
.stat b{font-size:17px;font-variant-numeric:tabular-nums;color:var(--ink);font-weight:700}
.stat span{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);font-weight:600}
.card-foot{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:10px;
  border-top:1px solid var(--line);font-size:11.5px;color:var(--faint)}
.card-foot .open{color:var(--accent);font-weight:700;display:inline-flex;align-items:center;gap:4px}

.empty{text-align:center;padding:80px 20px;color:var(--mute)}
.empty b{display:block;font-size:16px;color:var(--ink);margin-bottom:6px}

@media (max-width:640px){
  header,main{padding-left:20px;padding-right:20px}
  .grid{grid-template-columns:1fr}
}
</style>
<header>
  <div class="hrow">
    <div>
      <p class="eyebrow">${esc(meta.eyebrow)}</p>
      <h1>${esc(meta.title)}</h1>
      <p class="blurb">${esc(meta.blurb)}</p>
    </div>
    <div class="switcher">Viewing ${esc(meta.title)} &middot; <a href="./${esc(otherMeta.outFile)}">Switch to ${esc(otherMeta.title)} &rarr;</a></div>
  </div>
  <div class="controls">
    <div class="searchbox">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.6">
        <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 L14 14" stroke-linecap="round"/></svg>
      <input id="q" type="search" placeholder="Search by journey name, file, or source workbook&hellip;" autocomplete="off">
    </div>
    <select id="sortSel" class="sortsel">
      <option value="title">Sort: Name (A&ndash;Z)</option>
      <option value="nodes">Sort: Node count (high&ndash;low)</option>
      <option value="recent">Sort: Recently generated</option>
    </select>
    <span class="count" id="count"></span>
  </div>
</header>
<main>
  <div class="grid" id="grid"></div>
  <div class="empty" id="empty" style="display:none"><b>No diagrams match your search</b>Try a different journey name or file.</div>
</main>
<script>
const CARDS = ${cardsJson};
const grid = document.getElementById('grid'), q = document.getElementById('q'),
      countEl = document.getElementById('count'), emptyEl = document.getElementById('empty'),
      sortSel = document.getElementById('sortSel');

function fmtDate(iso){
  if(!iso) return '\\u2014';
  const d = new Date(iso);
  if(isNaN(d.getTime())) return '\\u2014';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
function card(c){
  const a = document.createElement('a');
  a.className = 'card'; a.href = c.relPath;
  const nodeStat = c.nodeCount!=null ? c.nodeCount : '\\u2014';
  const phaseStat = c.phaseCount!=null ? c.phaseCount : '\\u2014';
  a.innerHTML =
    '<div class="card-title"></div>' +
    (c.subtitle ? '<div class="card-sub"></div>' : '') +
    '<div class="card-file"></div>' +
    '<div class="stat-row">' +
      '<div class="stat"><b>'+phaseStat+'</b><span>Phases</span></div>' +
      '<div class="stat"><b>'+nodeStat+'</b><span>Nodes</span></div>' +
    '</div>' +
    '<div class="card-foot"><span></span><span class="open">Open &rarr;</span></div>';
  a.querySelector('.card-title').textContent = c.title;
  if(c.subtitle) a.querySelector('.card-sub').textContent = c.subtitle;
  a.querySelector('.card-file').textContent = c.fileName;
  a.querySelector('.card-file').title = c.fileName; // native tooltip for filenames the card's fixed width ellipsis-truncates
  a.title = c.title + (c.subtitle ? ' — ' + c.subtitle : '');
  a.querySelector('.card-foot span').textContent = 'Generated ' + fmtDate(c.renderedAt);
  return a;
}
function render(){
  const term = q.value.trim().toLowerCase();
  let list = CARDS.filter(c => !term ||
    c.title.toLowerCase().includes(term) ||
    c.fileName.toLowerCase().includes(term) ||
    (c.sourceFile||'').toLowerCase().includes(term) ||
    (c.subtitle||'').toLowerCase().includes(term));
  const sortBy = sortSel.value;
  list = list.slice().sort((a,b) => {
    if(sortBy==='nodes') return (b.nodeCount||0)-(a.nodeCount||0);
    if(sortBy==='recent') return new Date(b.renderedAt||0) - new Date(a.renderedAt||0);
    return a.title.localeCompare(b.title);
  });
  grid.innerHTML = '';
  list.forEach(c => grid.appendChild(card(c)));
  countEl.textContent = list.length + ' of ' + CARDS.length + ' diagram' + (CARDS.length===1?'':'s');
  emptyEl.style.display = list.length ? 'none' : 'block';
  grid.style.display = list.length ? 'grid' : 'none';
}
q.addEventListener('input', render);
sortSel.addEventListener('change', render);
render();
</script>
<!-- generated ${esc(generatedAt)} by scripts/build-dashboards.js — do not hand-edit, re-run the script instead -->
`;
}

// ----------------------------------------------------------------- driver

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  let total = 0;
  for (const typeName of Object.keys(DASHBOARD_META)) {
    const entries = collectEntries(typeName);
    const html = renderDashboard(typeName, entries);
    const outPath = path.join(OUTPUT_DIR, DASHBOARD_META[typeName].outFile);
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`[dashboards] ${typeName}: ${entries.length} diagram(s) -> output/${DASHBOARD_META[typeName].outFile}`);
    total += entries.length;
  }
  console.log(`\n${total} total diagram entries across both dashboards.`);
}

if (require.main === module) {
  main();
}

module.exports = { collectEntries, renderDashboard, DASHBOARD_META, main };
