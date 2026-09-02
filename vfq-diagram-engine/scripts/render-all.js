#!/usr/bin/env node
'use strict';

/**
 * Pure Node orchestrator. Zero AI calls. Renders data/{slug}/*.json through
 * each diagram type's existing engine (copied unmodified under engines/)
 * and writes output/{slug}/{type}.html.
 *
 * Usage:
 *   node scripts/render-all.js                  render everything
 *   node scripts/render-all.js --brsd <slug>     only that BRSD's 4 outputs
 *   node scripts/render-all.js --type <type>     only that diagram type, all BRSDs
 *   node scripts/render-all.js --brsd <slug> --type <type>
 *
 * <type> is one of: bpmn | journey | processflow | userflow
 *
 * Fails loudly per-file: a bad data file is skipped and reported, the rest
 * of the batch keeps going. Exits 1 if any file failed, 0 otherwise.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const manifestStore = require('./manifest');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUTPUT_DIR = path.join(ROOT, 'output');
const ENGINES_DIR = path.join(ROOT, 'engines');

const TYPES = {
  bpmn: {
    dataFile: 'bpmn.model.json',
    outputFile: 'bpmn.html',
    engineDir: path.join(ENGINES_DIR, 'bpnm'),
    hashFiles: ['scripts/render.py', 'scripts/validate_model.py', 'reference/engine_template.html'],
    render: renderBpmn
  },
  journey: {
    dataFile: 'journey.spec.json',
    outputFile: 'journey.html',
    engineDir: path.join(ENGINES_DIR, 'customer-journey-map'),
    hashFiles: ['assets/template.html'],
    render: renderJourney
  },
  processflow: {
    dataFile: 'processflow.spec.json',
    outputFile: 'processflow.html',
    engineDir: path.join(ENGINES_DIR, 'pfd'),
    hashFiles: ['scripts/generate.js', 'scripts/normalize-spec.js'],
    render: renderProcessflow
  },
  userflow: {
    dataFile: 'userflow.spec.json',
    outputFile: 'userflow.html',
    engineDir: path.join(ENGINES_DIR, 'user-flow-diagram'),
    hashFiles: ['user-flow-diagram-v4.0.js'],
    render: renderUserflow
  }
};

function parseArgs(argv) {
  const args = { brsd: null, type: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--brsd') args.brsd = argv[++i];
    else if (argv[i] === '--type') args.type = argv[++i];
  }
  if (args.type && !TYPES[args.type]) {
    console.error(`Unknown --type "${args.type}". Must be one of: ${Object.keys(TYPES).join(', ')}`);
    process.exit(1);
  }
  return args;
}

function computeEngineHash(engineDir, relFiles) {
  const hash = crypto.createHash('sha256');
  for (const rel of relFiles.slice().sort()) {
    const full = path.join(engineDir, rel);
    if (fs.existsSync(full)) {
      hash.update(rel);
      hash.update(fs.readFileSync(full));
    }
  }
  return hash.digest('hex').slice(0, 16);
}

function listSlugs() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

// ---- per-type render functions ----
// Each returns { ok: true } or { ok: false, error: string }

function renderBpmn(dataPath, outputPath, engineDir) {
  const renderScript = path.join(engineDir, 'scripts', 'render.py');
  const result = spawnSync('python3', [renderScript, dataPath, outputPath], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    const msg = (result.stderr || '').trim() || (result.stdout || '').trim() || `python3 exited with status ${result.status}`;
    return { ok: false, error: msg };
  }
  return { ok: true };
}

function renderJourney(dataPath, outputPath, engineDir) {
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e.message}` };
  }
  for (const key of ['meta', 'stages', 'footnote']) {
    if (!(key in spec)) {
      return { ok: false, error: `Spec missing required top-level key "${key}" (see engines/customer-journey-map/references/schema.md)` };
    }
  }
  const templatePath = path.join(engineDir, 'assets', 'template.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const marker = /(<script id="journey-data" type="application\/json">\n)[\s\S]*?(\n<\/script>)/;
  if (!marker.test(template)) {
    return { ok: false, error: 'Engine template.html is missing the "journey-data" injection marker — engine may have drifted, run check-drift.js' };
  }
  const html = template.replace(marker, (_, open, close) => open + JSON.stringify(spec, null, 2) + close);
  fs.writeFileSync(outputPath, html, 'utf8');
  return { ok: true };
}

function renderProcessflow(dataPath, outputPath, engineDir) {
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e.message}` };
  }
  let buildHTML;
  try {
    // eslint-disable-next-line global-require
    ({ buildHTML } = require(path.join(engineDir, 'scripts', 'generate.js')));
  } catch (e) {
    return { ok: false, error: `Failed to load engine generate.js: ${e.message}` };
  }
  const viewportWidth = (spec.config && spec.config.layout && spec.config.layout.viewportWidth) || 1200;
  try {
    const html = buildHTML(spec, viewportWidth);
    fs.writeFileSync(outputPath, html, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.name === 'SpecError' ? e.message : `${e.name || 'Error'}: ${e.message}` };
  }
}

function renderUserflow(dataPath, outputPath, engineDir) {
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e.message}` };
  }
  let renderReport;
  try {
    // eslint-disable-next-line global-require
    ({ renderReport } = require(path.join(engineDir, 'user-flow-diagram-v4.0.js')));
  } catch (e) {
    return { ok: false, error: `Failed to load engine module: ${e.message}` };
  }
  try {
    const html = renderReport(spec);
    fs.writeFileSync(outputPath, html, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ---- driver ----

function main() {
  const args = parseArgs(process.argv.slice(2));
  const slugs = args.brsd ? [args.brsd] : listSlugs();
  const typeNames = args.type ? [args.type] : Object.keys(TYPES);

  if (slugs.length === 0) {
    console.error(args.brsd ? `No such BRSD data directory: data/${args.brsd}` : 'No BRSD data directories found under data/.');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (const slug of slugs) {
    const slugDataDir = path.join(DATA_DIR, slug);
    if (!fs.existsSync(slugDataDir)) {
      console.error(`[${slug}] data directory not found, skipping`);
      continue;
    }
    for (const typeName of typeNames) {
      const spec = TYPES[typeName];
      const dataPath = path.join(slugDataDir, spec.dataFile);
      if (!fs.existsSync(dataPath)) {
        skippedCount++;
        console.log(`[${slug}] ${typeName}: no data file (${spec.dataFile}), skipping`);
        continue;
      }
      const outDir = path.join(OUTPUT_DIR, slug);
      fs.mkdirSync(outDir, { recursive: true });
      const outputPath = path.join(outDir, spec.outputFile);

      const result = spec.render(dataPath, outputPath, spec.engineDir);
      if (result.ok) {
        successCount++;
        const engineHash = computeEngineHash(spec.engineDir, spec.hashFiles);
        manifestStore.recordRender(slug, typeName, new Date().toISOString(), engineHash);
        console.log(`[${slug}] ${typeName}: OK -> output/${slug}/${spec.outputFile}`);
      } else {
        failCount++;
        console.error(`[${slug}] ${typeName}: FAILED\n${indent(result.error)}`);
      }
    }
  }

  console.log(`\n${successCount} rendered, ${failCount} failed, ${skippedCount} skipped (no data file).`);
  process.exit(failCount > 0 ? 1 : 0);
}

function indent(text) {
  return String(text).split('\n').map((l) => '    ' + l).join('\n');
}

if (require.main === module) {
  main();
}

module.exports = { TYPES, computeEngineHash, listSlugs };
