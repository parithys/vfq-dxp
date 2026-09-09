#!/usr/bin/env node
'use strict';

/**
 * Shared read/update helper for manifest.json. Both the extraction
 * commands and render-all.js load and save through this module so the
 * shape stays consistent (see Task 5 in the build prompt).
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, '..', 'manifest.json');

// The full set of diagram types manifest.json tracks per BRSD — must stay
// in sync with render-all.js's own TYPES registry keys. Kept as one
// canonical list (not duplicated as separate object literals in two
// places) specifically so adding a new diagram type is a one-line change
// here, backfilled automatically onto every existing manifest entry by
// ensureBrsd() below, rather than a silent `entry.diagrams[type]` crash
// the first time recordRender()/recordExtraction() is called for it.
//
// Two diagram types are generated per BRSD: bpmn-swimlane and
// process-flow — both rendered from the SAME extracted
// data/{slug}/bpmn-swimlane.model.json (see render-all.js's own TYPES
// registry and engines/process-flow/reference/MODEL_SCHEMA.md). Because
// process-flow has no extraction step of its own — it shares
// bpmn-swimlane's — recordExtraction() is only ever called with type
// 'bpmn-swimlane'; process-flow's diagrams.process-flow.extractedAt stays
// null permanently by design, while renderedAt/engineHash are populated
// normally by recordRender() on every render-all.js run. See README.md.
const DIAGRAM_TYPES = ['bpmn-swimlane', 'process-flow'];

function load() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { brsds: {} };
  }
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const parsed = raw.trim() ? JSON.parse(raw) : {};
  if (!parsed.brsds) parsed.brsds = {};
  return parsed;
}

function save(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

function ensureBrsd(manifest, slug, sourcePath, sourceSha256) {
  if (!manifest.brsds[slug]) {
    manifest.brsds[slug] = { sourcePath, sourceSha256, diagrams: {} };
  } else {
    manifest.brsds[slug].sourcePath = sourcePath;
    manifest.brsds[slug].sourceSha256 = sourceSha256;
    if (!manifest.brsds[slug].diagrams) manifest.brsds[slug].diagrams = {};
  }
  // Backfill any diagram type not yet present on this entry — covers both
  // a brand-new slug (every type missing) and an existing slug that
  // predates a newly-added type (only the new one missing).
  for (const type of DIAGRAM_TYPES) {
    if (!manifest.brsds[slug].diagrams[type]) {
      manifest.brsds[slug].diagrams[type] = { extractedAt: null, renderedAt: null, engineHash: null };
    }
  }
  return manifest.brsds[slug];
}

function recordExtraction(slug, type, sourcePath, sourceSha256, timestamp) {
  const manifest = load();
  const entry = ensureBrsd(manifest, slug, sourcePath, sourceSha256);
  entry.diagrams[type].extractedAt = timestamp;
  save(manifest);
  return manifest;
}

function recordRender(slug, type, timestamp, engineHash) {
  const manifest = load();
  const entry = ensureBrsd(manifest, slug, manifest.brsds[slug] ? manifest.brsds[slug].sourcePath : null, manifest.brsds[slug] ? manifest.brsds[slug].sourceSha256 : null);
  entry.diagrams[type].renderedAt = timestamp;
  entry.diagrams[type].engineHash = engineHash;
  save(manifest);
  return manifest;
}

module.exports = { MANIFEST_PATH, load, save, ensureBrsd, recordExtraction, recordRender };

// CLI: node scripts/manifest.js record-extraction <slug> <type> <sourcePath> <sourceSha256>
// Used by the /extract-* slash commands so they update manifest.json through
// this shared module instead of hand-editing JSON.
if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'record-extraction') {
    const [slug, type, sourcePath, sourceSha256] = rest;
    if (!slug || !type || !sourcePath || !sourceSha256) {
      console.error('Usage: node scripts/manifest.js record-extraction <slug> <type> <sourcePath> <sourceSha256>');
      process.exit(1);
    }
    recordExtraction(slug, type, sourcePath, sourceSha256, new Date().toISOString());
    console.log(`Recorded extraction: ${slug} / ${type}`);
  } else {
    console.error('Usage: node scripts/manifest.js record-extraction <slug> <type> <sourcePath> <sourceSha256>');
    process.exit(1);
  }
}
