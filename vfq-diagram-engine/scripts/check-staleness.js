#!/usr/bin/env node
'use strict';

/**
 * Reports which BRSDs have rendered output that no longer matches the
 * CURRENT engine source under engines/ — i.e. an engine file (template,
 * generator, schema/design-system doc counted in its hashFiles) was
 * edited after that BRSD's diagram was last rendered, so the on-disk
 * output/{slug}/{type}.html no longer reflects the canonical engine.
 *
 * Report only — never re-renders anything. Run
 *   node scripts/render-all.js --brsd <slug> --type <type>
 * (or with no flags, for everything) to bring stale output back in sync.
 *
 * This checks engine-vs-render drift only (is output/{slug}/{type}.html
 * built from the current engine source), not manual-edit status. Manual
 * edits to output/*.html ARE supported and are preserved automatically by
 * render-all.js's baseline/3-way-merge reconciliation — see its file header
 * and README.md "Canonical sources vs. generated output" — so a file being
 * "stale" here says nothing about whether it also carries hand-edits.
 *
 * Usage: node scripts/check-staleness.js [--json]
 */

const path = require('path');
const { TYPES, computeEngineHash, listSlugs } = require('./render-all');
const manifestStore = require('./manifest');

function main() {
  const asJson = process.argv.includes('--json');
  const manifest = manifestStore.load();
  const dataSlugs = new Set(listSlugs());
  const manifestSlugs = new Set(Object.keys(manifest.brsds || {}));
  const slugs = [...new Set([...dataSlugs, ...manifestSlugs])].sort();

  // Current engine hash per type, computed once — the whole point is that
  // this reflects engines/ as it is RIGHT NOW, regardless of what any BRSD
  // was rendered against.
  const currentHash = {};
  for (const [typeName, spec] of Object.entries(TYPES)) {
    currentHash[typeName] = computeEngineHash(spec.engineDir, spec.hashFiles);
  }

  const report = {};
  let staleCount = 0;
  let freshCount = 0;
  let neverRenderedCount = 0;

  for (const slug of slugs) {
    const entry = manifest.brsds && manifest.brsds[slug];
    report[slug] = {};
    for (const typeName of Object.keys(TYPES)) {
      const diag = entry && entry.diagrams && entry.diagrams[typeName];
      if (!diag || !diag.renderedAt) {
        report[slug][typeName] = { status: 'never-rendered' };
        neverRenderedCount++;
        continue;
      }
      const stale = diag.engineHash !== currentHash[typeName];
      report[slug][typeName] = {
        status: stale ? 'stale' : 'fresh',
        renderedAt: diag.renderedAt,
        renderedEngineHash: diag.engineHash,
        currentEngineHash: currentHash[typeName]
      };
      if (stale) staleCount++;
      else freshCount++;
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ report, staleCount, freshCount, neverRenderedCount }, null, 2));
    process.exit(staleCount > 0 ? 1 : 0);
  }

  if (slugs.length === 0) {
    console.log('No BRSDs found under data/ or manifest.json.');
    process.exit(0);
  }

  for (const slug of slugs) {
    console.log(`[${slug}]`);
    for (const [typeName, r] of Object.entries(report[slug])) {
      if (r.status === 'fresh') {
        console.log(`  ✓ ${typeName}: fresh (rendered ${r.renderedAt})`);
      } else if (r.status === 'stale') {
        console.log(`  ✗ ${typeName}: STALE — engine changed since ${r.renderedAt}`);
        console.log(`      rendered against ${r.renderedEngineHash}, engine is now ${r.currentEngineHash}`);
      } else {
        console.log(`  · ${typeName}: never rendered`);
      }
    }
  }

  console.log(`\n${freshCount} fresh, ${staleCount} stale, ${neverRenderedCount} never rendered.`);
  console.log(staleCount > 0
    ? 'Re-render stale entries with: node scripts/render-all.js --brsd <slug> --type <type>'
    : 'All rendered output matches the current engine source.');
  process.exit(staleCount > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { main };
