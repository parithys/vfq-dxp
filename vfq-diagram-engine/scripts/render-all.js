#!/usr/bin/env node
'use strict';

/**
 * Pure Node orchestrator. Zero AI calls. Renders data/{slug}/*.json through
 * each diagram type's existing engine (copied unmodified under engines/)
 * and reconciles the result into output/{slug}/{brsdId}-{type}.html.
 *
 * Usage:
 *   node scripts/render-all.js                  render everything
 *   node scripts/render-all.js --brsd <slug>     only that BRSD's 4 outputs
 *   node scripts/render-all.js --type <type>     only that diagram type, all BRSDs
 *   node scripts/render-all.js --brsd <slug> --type <type>
 *   node scripts/render-all.js --force ...       discard manual edits, reset to a pure engine render
 *
 * <type> is one of: bpmn-swimlane | journey | process-flow | userflow
 *
 * Fails loudly per-file: a bad data file is skipped and reported, the rest
 * of the batch keeps going. Exits 1 if any file failed OR any merge produced
 * a conflict, 0 otherwise.
 *
 * Output filenames carry the originating BRSD reference: every rendered
 * file is named `{brsdId}-{type}.html` (e.g.
 * `vfq-agent-360-brsd-v1-0-bpmn-swimlane.html`), never a bare `{type}.html`.
 * `brsdId` is the same slug used for the `data/{slug}/` directory and the
 * `manifest.json` key — the canonical, engine-persisted reference to the
 * source BRSD (derived at extraction time from the source document's own
 * filename via `slugify.js`, and recorded durably in `manifest.json`
 * alongside `sourcePath`/`sourceSha256`). This keeps every generated file
 * self-identifying and traceable back to its source artefact even outside
 * its `output/{slug}/` directory. See `computeOutputFileName()` below.
 *
 * Manual-edit reconciliation: output/*.html is allowed to be hand-edited
 * (content, connector routing, node connectivity, layout, diagram-specific
 * behaviour). To keep those edits from being silently clobbered by the next
 * engine-driven render, every successful render is diffed against a stored
 * baseline (`.render-baseline/{slug}/{brsdId}-{type}.html` — the last pure
 * engine render for that file) before being written:
 *   - no baseline / output unchanged since baseline -> plain overwrite.
 *   - output has manual edits -> 3-way merge via `git merge-file`
 *     (base = baseline, ours = your manual edits, theirs = new engine
 *     render). A clean merge folds the engine update in and advances the
 *     baseline. A conflicting merge writes standard `<<<<<<<` markers into
 *     the output file and does NOT advance the baseline, so it's reported
 *     again (and re-attempted) on the next run until resolved by hand.
 * See README.md "Canonical sources vs. generated output" for the full
 * policy this implements.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const manifestStore = require('./manifest');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUTPUT_DIR = path.join(ROOT, 'output');
const ENGINES_DIR = path.join(ROOT, 'engines');
const BASELINE_DIR = path.join(ROOT, '.render-baseline');

// `outputSuffix` is the per-type tail of the filename, e.g. "bpmn-swimlane.html".
// The actual on-disk filename is always `{brsdId}-{outputSuffix}` — see
// computeOutputFileName() — never the bare suffix. This keeps every
// generated file self-identifying back to its source BRSD.
const TYPES = {
  'bpmn-swimlane': {
    dataFile: 'bpmn-swimlane.model.json',
    outputSuffix: 'bpmn-swimlane.html',
    engineDir: path.join(ENGINES_DIR, 'bpmn-swimlane'),
    hashFiles: ['scripts/render.py', 'scripts/validate_model.py', 'reference/engine_template.html'],
    render: renderBpmnSwimlane
  },
  journey: {
    dataFile: 'journey.spec.json',
    outputSuffix: 'journey.html',
    engineDir: path.join(ENGINES_DIR, 'customer-journey-map'),
    hashFiles: ['assets/template.html'],
    render: renderJourney
  },
  'process-flow': {
    dataFile: 'process-flow.spec.json',
    outputSuffix: 'process-flow.html',
    engineDir: path.join(ENGINES_DIR, 'process-flow'),
    hashFiles: ['scripts/generate.js', 'scripts/normalize-spec.js'],
    render: renderProcessFlow
  },
  userflow: {
    dataFile: 'userflow.spec.json',
    outputSuffix: 'userflow.html',
    engineDir: path.join(ENGINES_DIR, 'user-flow-diagram'),
    hashFiles: ['user-flow-diagram-v4.0.js'],
    render: renderUserflow
  }
};

// The originating-BRSD-reference naming convention, applied uniformly across
// all four diagram types: {brsdId}-{outputSuffix}, e.g.
// "vfq-agent-360-brsd-v1-0-bpmn-swimlane.html". `brsdId` is the same slug
// that names the data/{slug}/ directory and the manifest.json key — the
// canonical persisted reference to the source BRSD, so filenames stay
// unique and traceable to their source artefact even outside their own
// output/{slug}/ directory.
function computeOutputFileName(brsdId, spec) {
  return `${brsdId}-${spec.outputSuffix}`;
}

function parseArgs(argv) {
  const args = { brsd: null, type: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--brsd') args.brsd = argv[++i];
    else if (argv[i] === '--type') args.type = argv[++i];
    else if (argv[i] === '--force') args.force = true;
  }
  if (args.type && !TYPES[args.type]) {
    console.error(`Unknown --type "${args.type}". Must be one of: ${Object.keys(TYPES).join(', ')}`);
    process.exit(1);
  }
  return args;
}

// Reconciles a freshly-rendered file (newPath) into the real output path,
// preserving any manual edits found there. Returns one of:
//   'created'   output/baseline didn't exist yet, written fresh
//   'forced'    --force: manual edits (if any) discarded, reset to engine output
//   'updated'   no manual edits detected, plain overwrite
//   'unchanged' manual edits exist but this render is byte-identical to
//               current output, so there's nothing to merge
//   'merged'    manual edits existed and were cleanly folded with the new
//               engine render; baseline advanced
//   'conflict'  manual edits collided with the engine update; conflict
//               markers were written into the output file, baseline NOT
//               advanced (will be re-attempted on the next run)
function reconcileOutput(slug, spec, newPath, outputPath, force, outputFileName) {
  const newContent = fs.readFileSync(newPath, 'utf8');
  const baselineDir = path.join(BASELINE_DIR, slug);
  const baselinePath = path.join(baselineDir, outputFileName);
  fs.mkdirSync(baselineDir, { recursive: true });

  if (force || !fs.existsSync(outputPath)) {
    fs.writeFileSync(outputPath, newContent, 'utf8');
    fs.writeFileSync(baselinePath, newContent, 'utf8');
    return force ? 'forced' : 'created';
  }

  const currentContent = fs.readFileSync(outputPath, 'utf8');
  // No stored baseline yet (file predates this system, or was never diffed
  // before) — bootstrap by assuming the current output is a clean engine
  // render, per the documented default. This does NOT write newContent over
  // it; it only seeds the comparison point for this and future runs.
  const baselineContent = fs.existsSync(baselinePath)
    ? fs.readFileSync(baselinePath, 'utf8')
    : currentContent;

  if (currentContent === baselineContent) {
    fs.writeFileSync(outputPath, newContent, 'utf8');
    fs.writeFileSync(baselinePath, newContent, 'utf8');
    return 'updated';
  }

  if (currentContent === newContent) {
    if (!fs.existsSync(baselinePath)) fs.writeFileSync(baselinePath, baselineContent, 'utf8');
    return 'unchanged';
  }

  // Manual edits exist AND the engine render changed — 3-way merge.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfq-merge-'));
  const oursPath = path.join(tmpDir, 'ours.html');
  const basePath = path.join(tmpDir, 'base.html');
  const theirsPath = path.join(tmpDir, 'theirs.html');
  fs.writeFileSync(oursPath, currentContent, 'utf8');
  fs.writeFileSync(basePath, baselineContent, 'utf8');
  fs.writeFileSync(theirsPath, newContent, 'utf8');

  const mergeRes = spawnSync('git', [
    'merge-file', '--stdout',
    '-L', 'your manual edits',
    '-L', 'baseline (previous engine render)',
    '-L', 'new engine render',
    oursPath, basePath, theirsPath
  ], { encoding: 'utf8' });

  fs.rmSync(tmpDir, { recursive: true, force: true });

  fs.writeFileSync(outputPath, mergeRes.stdout, 'utf8');

  if (mergeRes.status === 0) {
    fs.writeFileSync(baselinePath, newContent, 'utf8');
    return 'merged';
  }
  return 'conflict';
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

function renderBpmnSwimlane(dataPath, outputPath, engineDir) {
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

function renderProcessFlow(dataPath, outputPath, engineDir) {
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
  let conflictCount = 0;
  let mergedCount = 0;

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
      const outputFileName = computeOutputFileName(slug, spec);
      const outputPath = path.join(outDir, outputFileName);
      const tmpPath = outputPath + '.tmp-render';

      const result = spec.render(dataPath, tmpPath, spec.engineDir);
      if (!result.ok) {
        fs.rmSync(tmpPath, { force: true });
        failCount++;
        console.error(`[${slug}] ${typeName}: FAILED\n${indent(result.error)}`);
        continue;
      }

      const status = reconcileOutput(slug, spec, tmpPath, outputPath, args.force, outputFileName);
      fs.rmSync(tmpPath, { force: true });
      const engineHash = computeEngineHash(spec.engineDir, spec.hashFiles);
      manifestStore.recordRender(slug, typeName, new Date().toISOString(), engineHash);

      if (status === 'conflict') {
        conflictCount++;
        console.error(`[${slug}] ${typeName}: MERGE CONFLICT -> output/${slug}/${outputFileName} (manual edits collided with the engine update — conflict markers written, resolve by hand)`);
        continue;
      }
      successCount++;
      if (status === 'merged') mergedCount++;
      const note = status === 'merged' ? ' (manual edits preserved, engine update merged in)'
        : status === 'unchanged' ? ' (manual edits preserved, engine output for this file unchanged)'
        : status === 'forced' ? ' (--force: manual edits discarded)'
        : '';
      console.log(`[${slug}] ${typeName}: OK -> output/${slug}/${outputFileName}${note}`);
    }
  }

  console.log(`\n${successCount} rendered, ${failCount} failed, ${conflictCount} conflict(s), ${mergedCount} merged, ${skippedCount} skipped (no data file).`);
  if (conflictCount > 0) {
    console.log('Resolve conflicts by editing the affected output file(s) directly (look for <<<<<<< markers), then re-run render-all.js to advance the baseline.');
  }
  process.exit(failCount > 0 || conflictCount > 0 ? 1 : 0);
}

function indent(text) {
  return String(text).split('\n').map((l) => '    ' + l).join('\n');
}

if (require.main === module) {
  main();
}

module.exports = { TYPES, computeEngineHash, computeOutputFileName, listSlugs };
