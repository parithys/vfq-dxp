#!/usr/bin/env node
'use strict';

/**
 * Compares every file under engines/ against the live copy in the actual
 * installed skill on this machine, and reports which files have diverged
 * in either direction (edited here, or updated upstream). Report only —
 * never auto-merges. You decide which direction to pull.
 *
 * Usage: node scripts/check-drift.js [--json]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const ENGINES_DIR = path.join(ROOT, 'engines');

// Live skill source locations on this machine, keyed the same as engines/.
// Populated by locating each plugin's skill directory at setup time
// (see README.md "Updating engine sources" for how to re-detect these if
// the machine's plugin cache path changes).
const RPM_BASE = path.join(
  process.env.HOME || '',
  'Library/Application Support/Claude/local-agent-mode-sessions',
  'dc6bd27a-9850-4316-8096-52cb89001e4c/57c8ecb3-3705-47bf-91ca-12cc077808db/rpm'
);

const LIVE_SOURCES = {
  // Keyed by our LOCAL engines/ folder name (bpmn-swimlane, process-flow) — the `dir` path
  // below still points at the upstream plugin's own skill directory, which is named `bpnm`/`pfd`
  // on disk regardless of what we call our local copy; do not rename those path segments.
  'bpmn-swimlane': {
    dir: path.join(RPM_BASE, 'plugin_01LWfNTm8qwbSkHdsdPut1Ax', 'skills', 'bpnm'),
    subpaths: ['reference', 'scripts']
  },
  'customer-journey-map': {
    dir: path.join(RPM_BASE, 'plugin_01VW2tCAvpnGnDfHmtNATJcb', 'skills', 'customer-journey-map'),
    subpaths: ['assets', 'references']
  },
  'process-flow': {
    dir: path.join(RPM_BASE, 'plugin_019xQE3SRU7KZWW2jbsb1cHx', 'skills', 'pfd'),
    subpaths: ['scripts', 'references', 'assets/reference']
  },
  'user-flow-diagram': {
    dir: path.join(RPM_BASE, 'plugin_018fLGkobgXmcbDNg4QwdwvR', 'skills', 'user-flow-diagram'),
    subpaths: ['user-flow-diagram-v4.0.js']
  }
};

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function walkFiles(baseDir, subpath) {
  const full = path.join(baseDir, subpath);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [subpath];
  const out = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(subpath, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(baseDir, rel));
    else out.push(rel);
  }
  return out;
}

function checkEngine(name, engineLocalDir, live) {
  const findings = [];
  if (!fs.existsSync(live.dir)) {
    findings.push({ file: null, status: 'live-source-unreachable', detail: `Live skill directory not found: ${live.dir}` });
    return findings;
  }

  const allLocal = new Set();
  const allLive = new Set();
  for (const sub of live.subpaths) {
    for (const f of walkFiles(engineLocalDir, sub)) allLocal.add(f);
    for (const f of walkFiles(live.dir, sub)) allLive.add(f);
  }

  const allRel = new Set([...allLocal, ...allLive]);
  for (const rel of [...allRel].sort()) {
    const localPath = path.join(engineLocalDir, rel);
    const livePath = path.join(live.dir, rel);
    const localExists = fs.existsSync(localPath);
    const liveExists = fs.existsSync(livePath);

    if (localExists && !liveExists) {
      findings.push({ file: rel, status: 'local-only', detail: 'Exists in engines/ copy but not in the live skill (removed upstream, or an engines/-only addition).' });
    } else if (!localExists && liveExists) {
      findings.push({ file: rel, status: 'upstream-only', detail: 'Exists in the live skill but was never copied into engines/, or was deleted here.' });
    } else if (localExists && liveExists) {
      const localHash = sha256(localPath);
      const liveHash = sha256(livePath);
      if (localHash !== liveHash) {
        findings.push({ file: rel, status: 'diverged', detail: `engines/ copy and live skill differ (local sha256 ${localHash.slice(0, 12)}… vs live ${liveHash.slice(0, 12)}…).` });
      }
    }
  }
  return findings;
}

function main() {
  const asJson = process.argv.includes('--json');
  const report = {};
  let totalFindings = 0;

  for (const [name, live] of Object.entries(LIVE_SOURCES)) {
    const engineLocalDir = path.join(ENGINES_DIR, name);
    const findings = checkEngine(name, engineLocalDir, live);
    report[name] = findings;
    totalFindings += findings.length;
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(totalFindings > 0 ? 1 : 0);
  }

  for (const [name, findings] of Object.entries(report)) {
    if (findings.length === 0) {
      console.log(`[${name}] in sync with live skill.`);
      continue;
    }
    console.log(`[${name}] ${findings.length} drift finding(s):`);
    for (const f of findings) {
      console.log(`  - ${f.status}${f.file ? ` :: ${f.file}` : ''}`);
      console.log(`      ${f.detail}`);
    }
  }

  console.log(`\n${totalFindings} total drift finding(s) across ${Object.keys(report).length} engines.`);
  console.log(totalFindings > 0
    ? 'Report only — nothing was changed. Decide per-finding which direction to pull, then copy manually.'
    : 'No drift detected.');
  process.exit(totalFindings > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { checkEngine, LIVE_SOURCES };
