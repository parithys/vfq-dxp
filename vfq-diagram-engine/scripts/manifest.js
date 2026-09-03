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
    manifest.brsds[slug] = {
      sourcePath,
      sourceSha256,
      diagrams: {
        'bpmn-swimlane': { extractedAt: null, renderedAt: null, engineHash: null },
        journey: { extractedAt: null, renderedAt: null, engineHash: null },
        'process-flow': { extractedAt: null, renderedAt: null, engineHash: null },
        userflow: { extractedAt: null, renderedAt: null, engineHash: null }
      }
    };
  } else {
    manifest.brsds[slug].sourcePath = sourcePath;
    manifest.brsds[slug].sourceSha256 = sourceSha256;
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
