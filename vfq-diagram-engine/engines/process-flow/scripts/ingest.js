#!/usr/bin/env node
/**
 * Dataset → spec adapter for the process-flow skill.
 * ------------------------------------------------------------------
 * Reads a CSV / TSV / JSON dataset, auto-detects its graph shape, and emits a
 * spec.json conforming to references/schema.json plus a markdown inference
 * report listing every decision made and every ambiguity left unresolved.
 *
 * Design rules (why this file looks the way it does):
 * - Zero dependencies: the skill must run anywhere `node` exists, so the CSV
 *   parser below is a hand-written RFC-4180 reader rather than an npm package.
 * - Never fabricate. A missing required field falls back to another *observed*
 *   value or aborts with the offending row number. Anything the adapter could
 *   not resolve is emitted as an omission plus a report entry, never a guess.
 * - Semantic type (`kind`) is resolved by what a node DOES — explicit type
 *   column first, role/actor column second, then unset (§2.1). The title string
 *   is never consulted: the same token means different types in different
 *   contexts, so title matching produces confidently wrong colours.
 *
 * Usage:
 *   node ingest.js <input.csv|.tsv|.json> [-o spec.json] [--report report.md]
 *                  [--title "..."] [--subtitle "..."]
 */

'use strict';
const fs = require('fs');
const path = require('path');

/* ============================================================= *
 * 1. CLI
 * ============================================================= */

function parseArgs(argv) {
  const opts = { input: null, out: null, report: null, title: null, subtitle: null, vocab: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') opts.out = argv[++i];
    else if (a === '--report') opts.report = argv[++i];
    else if (a === '--title') opts.title = argv[++i];
    else if (a === '--subtitle') opts.subtitle = argv[++i];
    // Caller-supplied term vocabulary — see loadVocab. Without it, inference is English-only.
    else if (a === '--vocab') opts.vocab = argv[++i];
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('-')) fail(`Unknown option ${a}`);
    else if (!opts.input) opts.input = a;
    else fail(`Unexpected extra argument ${a}`);
  }
  return opts;
}

function fail(msg) {
  process.stderr.write('ingest: ' + msg + '\n');
  process.exit(1);
}

const USAGE = `Usage: node ingest.js <input.csv|.tsv|.json> [-o spec.json] [--report report.md]
                     [--title "..."] [--subtitle "..."]

Accepts an edge list, a node list with an order column, a node list with a
"depends on" column, or a JSON object holding {nodes, edges|links}. Emits a
spec for scripts/generate.js and a markdown inference report.`;

/* ============================================================= *
 * 2. RFC-4180 delimited-text parser (no dependencies)
 * ============================================================= */

// Full RFC-4180: quoted fields, embedded delimiters, embedded newlines,
// "" escapes. Also tolerates a UTF-8 BOM, CRLF, and a trailing newline.
function parseDelimited(text, delim) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let sawField = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }   // "" → literal quote
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === '') { inQuotes = true; sawField = true; continue; }
    if (c === delim) { row.push(field); field = ''; sawField = true; continue; }
    if (c === '\r') continue;                              // CRLF → LF
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; sawField = false; continue; }
    field += c;
    sawField = true;
  }
  if (sawField || field !== '' || row.length) { row.push(field); rows.push(row); }
  // Drop blank trailing lines but keep genuinely empty in-table rows out too.
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}

function sniffDelimiter(text) {
  const candidates = [',', '\t', ';', '|'];
  // Count only outside quotes on the first physical line — a header row never
  // legitimately contains an embedded newline in practice, and if it does the
  // comma count still dominates.
  const line = text.replace(/^﻿/, '').split(/\r?\n/)[0] || '';
  let best = ',', bestN = -1;
  for (const d of candidates) {
    const n = line.split(d).length - 1;
    if (n > bestN) { best = d; bestN = n; }
  }
  return bestN > 0 ? best : ',';
}

// Delimited text → { headers: [...], rows: [{header: value}], rowNums: [] }
function tableFromDelimited(text, delim) {
  const grid = parseDelimited(text, delim);
  if (!grid.length) fail('input file contains no rows');
  const headers = grid[0].map(h => String(h).trim());
  const rows = [];
  for (let r = 1; r < grid.length; r++) {
    const o = {};
    headers.forEach((h, c) => { o[h] = String(grid[r][c] == null ? '' : grid[r][c]).trim(); });
    o.__row = r + 1;                                       // 1-based file line for error messages
    rows.push(o);
  }
  return { headers, rows };
}

// Array of JSON objects → the same table shape. Header order = first-seen key order.
function tableFromObjects(arr, label) {
  const headers = [];
  for (const o of arr) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) fail(`${label}: every entry must be a JSON object`);
    for (const k of Object.keys(o)) if (!headers.includes(k)) headers.push(k);
  }
  const rows = arr.map((o, i) => {
    const r = { __row: i + 1 };
    for (const h of headers) r[h] = o[h] == null ? '' : (typeof o[h] === 'object' ? JSON.stringify(o[h]) : String(o[h]).trim());
    return r;
  });
  return { headers, rows };
}

/* ============================================================= *
 * 3. Fuzzy header → field matching
 * ============================================================= */

// Headers are normalised to lowercase alphanumerics so "Depends On", "depends_on"
// and "DependsOn" all collapse to one token. Synonyms below are stored normalised.
function normHeader(h) { return String(h).toLowerCase().replace(/[^a-z0-9]+/g, ''); }

const SYNONYMS = {
  id:       ['id', 'key', 'code', 'ref', 'nodeid', 'stepid', 'activityid', 'uid', 'identifier'],
  title:    ['title', 'name', 'step', 'activity', 'task', 'process', 'stage', 'label', 'node', 'stepname', 'activityname'],
  role:     ['role', 'actor', 'owner', 'responsible', 'performer', 'team', 'department', 'raci', 'accountable', 'system', 'lane', 'swimlane', 'assignee'],
  type:     ['type', 'kind', 'category', 'mode', 'automation', 'channel', 'execution', 'nodetype', 'steptype', 'classification'],
  desc:     ['description', 'detail', 'details', 'notes', 'summary', 'purpose', 'what', 'comment', 'comments', 'remarks'],
  source:   ['source', 'from', 'predecessor', 'prev', 'previous', 'upstream', 'parent', 'dependson', 'dependency', 'dependencies', 'inputfrom', 'sourceid', 'fromid'],
  target:   ['target', 'to', 'successor', 'next', 'downstream', 'child', 'outputto', 'targetid', 'toid', 'nextstep'],
  verb:     ['verb', 'action', 'payload', 'data', 'artifact', 'message', 'label', 'edge', 'relationship', 'via', 'carries', 'edgelabel', 'transition'],
  order:    ['order', 'seq', 'sequence', 'step', 'stepno', 'no', 'num', 'index', 'rank', 'position', 'sortorder', 'serial'],
  decision: ['decision', 'gate', 'condition', 'criteria', 'checkpoint', 'approval', 'isdecision', 'gateway'],
  input:    ['input', 'inputs', 'sourcedata', 'consumes', 'inputdata'],
  output:   ['output', 'outputs', 'result', 'results', 'produces', 'deliverable', 'outputdata'],
  meaning:  ['meaning', 'purpose', 'why', 'rationale', 'businessmeaning', 'explanation', 'significance'],
};

// A value is "numeric-ish" if it is short and contains a number ("3", "3.1",
// "Step 3", "S01"). Used to disambiguate the header `step`, which is a synonym of
// both `title` and `order`: only a numeric column can be an ordering column.
function numericish(v) {
  const s = String(v).trim();
  return s.length > 0 && s.length < 12 && /\d/.test(s);
}
function extractNum(v) {
  const m = String(v).match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
function columnIsNumeric(rows, header) {
  const vals = rows.map(r => r[header]).filter(v => String(v).trim() !== '');
  if (!vals.length) return false;
  return vals.filter(numericish).length / vals.length >= 0.7;
}

const VALIDATORS = {
  order: (rows, header) => columnIsNumeric(rows, header),
};

// Patterns that count as an exact match beyond the synonym list. "<Entity> ID"
// is the commonest identifier header there is ("Task ID", "task_id", "caseId")
// and enumerating every entity noun is impossible, so the shape of the header
// carries the match. Anchored so "valid"/"paid" cannot slip through.
const PATTERNS = {
  id: h => /(?:^|[^A-Za-z])[Ii][Dd]$/.test(h) || /[a-z0-9]Id$/.test(h),
};

/**
 * Claim headers for fields in the given priority order. Each header is claimed at
 * most once, so priority decides shared synonyms: in an edge table `label` means
 * the edge verb, in a node table it means the node title.
 *
 * Two passes — every field gets its EXACT matches before any field gets a fuzzy
 * one. Without that, a high-priority field swallows another field's exact header:
 * "Source Data" contains "source", but it is exactly the `input` synonym
 * `sourcedata`, and the exact reading must win regardless of priority.
 * Fuzzy matching is forward-containment only (header contains synonym), so
 * "Predecessor Node" → source while "Input" never reaches `inputfrom`.
 * Returns { field: {header, synonym, how} }.
 */
function matchFields(headers, rows, priority) {
  const taken = new Set();
  const map = {};
  const claim = (field, exactOnly) => {
    if (map[field]) return;
    const syns = SYNONYMS[field];
    for (const h of headers) {
      if (taken.has(h)) continue;
      const nh = normHeader(h);
      if (!nh) continue;
      let hit = null;
      if (syns.includes(nh)) hit = { synonym: nh, how: 'exact' };
      else if (PATTERNS[field] && PATTERNS[field](h)) hit = { synonym: `<entity> ${field}`, how: 'pattern' };
      else if (!exactOnly) {
        for (const s of syns) {
          if (s.length >= 4 && nh.includes(s)) { hit = { synonym: s, how: 'contains' }; break; }
        }
      }
      if (!hit) continue;
      if (VALIDATORS[field] && !VALIDATORS[field](rows, h)) continue;
      map[field] = { header: h, ...hit };
      taken.add(h);
      return;
    }
  };
  for (const field of priority) claim(field, true);
  for (const field of priority) claim(field, false);
  map.__unmatched = headers.filter(h => !taken.has(h));
  return map;
}

/* ============================================================= *
 * 4. Semantic type inference (§2.1)
 * ============================================================= */

// Role-token → semantic-type vocabulary. §2.1 makes the *rule* normative, not the
// vocabulary, so this table is meant to be extended per corpus — keep it in sync
// with the table in references/data-adapters.md.
const TYPE_TOKENS = {
  manual: ['human', 'manual', 'person', 'people', 'user', 'reviewer', 'review', 'approver', 'approval',
    'analyst', 'committee', 'owner', 'staff', 'team', 'manager', 'officer', 'board', 'operator', 'clerk',
    'specialist', 'lead', 'director', 'head', 'coordinator', 'department', 'dept', 'admin', 'administrator',
    'governance', 'council', 'auditor', 'consultant', 'representative', 'agentdesk', 'desk', 'office',
    'controller', 'supervisor', 'inspector', 'assessor', 'author', 'editor', 'chief', 'vp', 'panel'],
  automated: ['system', 'auto', 'automated', 'automation', 'batch', 'job', 'engine', 'model', 'script',
    'rule', 'rules', 'service', 'bot', 'algorithm', 'pipeline', 'platform', 'application', 'software',
    'database', 'datastore', 'warehouse', 'scheduler', 'daemon', 'compute', 'ml', 'ai'],
  integration: ['api', 'integration', 'webhook', 'event', 'interface', 'feed', 'sync', 'message', 'queue',
    'topic', 'bus', 'stream', 'connector', 'endpoint', 'ftp', 'sftp', 'edi', 'rest', 'soap', 'mq', 'kafka',
    'broker', 'gateway', 'channel', 'contract', 'handoff'],
};

/* Vocabularies are DEFAULTS, not rules (r6).
 *
 * These word lists decide a node's semantic type — and therefore its colour — so an
 * English-only table silently mis-resolves any other language: a German CSV whose actors are
 * "Sachbearbeiter" (a person) and "Pruefsystem" (a system) matches nothing, and every node
 * comes back unresolved. Supply your own with `--vocab vocab.json`; keys merge over these, so
 * a file need only carry the terms it changes.
 *
 * Unresolved is a valid, reported outcome — see inferKind. Guessing is not.
 */
function loadVocab(file) {
  if (!file) return;
  let v;
  try { v = JSON.parse(require('fs').readFileSync(file, 'utf8')); }
  catch (e) { console.error(`✗ Cannot read vocabulary ${file}: ${e.message}`); process.exit(1); }
  const merge = (target, src) => {
    for (const k of Object.keys(src || {})) {
      if (Array.isArray(src[k]) && Array.isArray(target[k])) target[k] = [...new Set([...target[k], ...src[k].map(x => String(x).toLowerCase())])];
      else if (src[k] && typeof src[k] === 'object' && target[k]) merge(target[k], src[k]);
    }
  };
  // Column headers are as language-bound as the type words. Without this, a non-English
  // dataset fails at shape detection before inference is even reached.
  if (v.headers) merge(SYNONYMS, v.headers);
  if (v.kind) merge(TYPE_TOKENS, v.kind);
  if (v.terminal) merge(TERMINAL_TOKENS, v.terminal);
  if (v.decision) DECISION_TOKENS.push(...v.decision.map(x => String(x).toLowerCase()));
  if (v.yesno) merge(YESNO, v.yesno);
  if (v.nullTokens) NULL_TOKENS.push(...v.nullTokens.map(x => String(x).toLowerCase()));
  console.error(`  vocabulary merged from ${file}`);
}

const TERMINAL_TOKENS = { start: ['start', 'begin', 'entry', 'initiate', 'kickoff'], end: ['end', 'complete', 'completed', 'finish', 'done', 'close', 'closed', 'terminal', 'exit'] };
const NULL_TOKENS = ['none', 'n/a', 'na', '-', '—', 'nil', 'null'];
const DECISION_TOKENS = ['decision', 'gate', 'gateway', 'condition', 'checkpoint', 'choice', 'branch', 'approvalgate'];

function tokens(value) {
  return String(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// Match a cell against a token vocabulary. Whole-word match first, then a
// substring pass so "Risk Engine"/"engine-svc"/"Ops Team (EMEA)" all resolve.
function matchTokens(value, vocab) {
  const ts = tokens(value);
  for (const t of ts) if (vocab.includes(t)) return t;
  const flat = ts.join('');
  for (const v of vocab) if (v.length >= 4 && flat.includes(v)) return v;
  return null;
}

function classifyValue(value) {
  if (!String(value).trim()) return null;
  for (const kind of ['manual', 'automated', 'integration']) {
    const t = matchTokens(value, TYPE_TOKENS[kind]);
    if (t) return { kind, token: t };
  }
  return null;
}

function terminalOf(value) {
  if (!String(value).trim()) return null;
  const ts = tokens(value);
  for (const t of ts) {
    if (TERMINAL_TOKENS.start.includes(t)) return 'start';
    if (TERMINAL_TOKENS.end.includes(t)) return 'end';
  }
  return null;
}

function isDecisionValue(value) {
  const v = String(value).trim().toLowerCase();
  if (!v) return false;
  if (['y', 'yes', 'true', '1', 'x', '✓', 'gate', 'decision'].includes(v)) return true;
  return !!matchTokens(v, DECISION_TOKENS);
}

/**
 * Resolve a node's semantic type. Precedence (§2.1):
 *   1. explicit type/kind column   2. role/actor column   3. UNSET.
 * The title is never consulted — a title word describes the subject matter, not
 * whether a human, a system, or a wire message performs the step, and guessing
 * from it yields confidently wrong colours.
 */
function inferKind(typeValue, roleValue) {
  const byType = classifyValue(typeValue);
  if (byType) return { kind: byType.kind, via: 'type column', token: byType.token, evidence: typeValue };
  const byRole = classifyValue(roleValue);
  if (byRole) return { kind: byRole.kind, via: 'role column', token: byRole.token, evidence: roleValue };
  const reason = !String(typeValue || '').trim() && !String(roleValue || '').trim()
    ? 'no type or role value on this row'
    : `no token in TYPE_TOKENS matched type=${JSON.stringify(String(typeValue || ''))} role=${JSON.stringify(String(roleValue || ''))}`;
  return { kind: null, via: null, reason };
}

/* ============================================================= *
 * 5. Ids, titles, description wrapping
 * ============================================================= */

// Any value that lands in SVG text must be a single line: an embedded newline
// from a quoted CSV cell would otherwise be emitted raw into a <text> element.
function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function makeUniqueId(base, used) {
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

// The step box is 160×80 with three 9px meta lines (§3.1, §4.1) — about 30
// monospace characters fit per line. Wrap at word boundaries; anything past the
// third line is reported verbatim rather than silently dropped.
const DESC_LINES = 3;
const DESC_CHARS = 30;

function wrapDesc(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return { lines: [], dropped: '' };
  const words = raw.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length <= DESC_CHARS || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  const kept = lines.slice(0, DESC_LINES);
  const dropped = lines.slice(DESC_LINES).join(' ');
  return { lines: kept, dropped, wrapped: lines.length > 1 };
}

/* ============================================================= *
 * 6. Shape detection & graph construction
 * ============================================================= */

const NODE_PRIORITY  = ['id', 'order', 'decision', 'source', 'target', 'type', 'role', 'title', 'input', 'output', 'meaning', 'desc', 'verb'];
const EDGE_PRIORITY  = ['source', 'target', 'verb', 'id', 'type', 'role', 'order', 'decision', 'title', 'desc'];

function splitList(v) {
  return String(v).split(/[;,|/]+|\s+(?:and|then)\s+/i).map(s => s.trim()).filter(Boolean);
}

function shapeError(headers, tried) {
  const lines = [];
  lines.push('could not detect an input shape.');
  lines.push('');
  lines.push('Headers seen: ' + (headers.length ? headers.map(h => JSON.stringify(h)).join(', ') : '(none)'));
  lines.push('');
  lines.push('It needs ONE of:');
  lines.push('  * an edge list      — a source column AND a target column');
  lines.push('  * a node list       — a numeric order column (plus a title or id column)');
  lines.push('  * an adjacency list — a node table with a delimited predecessor column');
  lines.push('  * a JSON object     — { "nodes": [...], "edges"|"links": [...] }');
  lines.push('');
  lines.push('Synonym sets tried (headers are lowercased, non-alphanumerics stripped):');
  for (const f of tried) lines.push(`  ${f.padEnd(9)} ${SYNONYMS[f].join(', ')}`);
  lines.push('');
  lines.push('Rename a column to any synonym above, or add the header to SYNONYMS in scripts/ingest.js');
  lines.push('and to the table in references/data-adapters.md.');
  return lines.join('\n');
}

/**
 * Build the intermediate graph from a node table (order or adjacency shapes)
 * plus an optional edge table. Returns { nodes, edges, notes }.
 */
function buildNodes(rows, map, ctx) {
  const used = new Set();
  const nodes = [];
  rows.forEach((r, i) => {
    const rawId = map.id ? r[map.id.header] : '';
    const title = map.title ? r[map.title.header] : '';
    if (!String(rawId).trim() && !String(title).trim()) {
      fail(`row ${r.__row}: no id and no title — nothing to name this node with. ` +
        `Add a value to "${map.id ? map.id.header : (map.title ? map.title.header : 'an id or title column')}" or delete the row.`);
    }
    const base = slugify(rawId || title) || `n${i + 1}`;
    const id = makeUniqueId(base, used);
    const typeVal = map.type ? r[map.type.header] : '';
    const roleVal = map.role ? r[map.role.header] : '';
    const k = inferKind(typeVal, roleVal);
    const d = wrapDesc(map.desc ? r[map.desc.header] : '');
    const orderVal = map.order ? extractNum(r[map.order.header]) : null;
    nodes.push({
      rowNum: r.__row,
      id,
      // Honesty rule: a missing title falls back to the observed id, never to a
      // synthesised phrase.
      title: clean(title) || clean(rawId),
      titleFromId: !clean(title),
      role: clean(roleVal),
      typeValue: clean(typeVal),
      kind: k.kind, kindVia: k.via, kindToken: k.token, kindReason: k.reason,
      desc: d.lines, descDropped: d.dropped, descWrapped: d.wrapped && d.lines.length > 1,
      order: orderVal == null ? i : orderVal,
      orderExplicit: orderVal != null,
      terminal: terminalOf(typeVal),
      isDecision: (map.decision && isDecisionValue(r[map.decision.header])) ||
        (!!typeVal && !!matchTokens(typeVal, DECISION_TOKENS)),
      raw: r,
    });
  });
  // Terminal-by-position: only the first/last row, and only when its whole title
  // is a bare terminal word. Structural, not a semantic-type guess (§2.1 governs
  // `kind`, not start/end bookends).
  [nodes[0], nodes[nodes.length - 1]].forEach((n, idx) => {
    if (!n || n.terminal) return;
    const t = terminalOf(n.title);
    if (t && tokens(n.title).length <= 2) {
      n.terminal = t;
      ctx.notes.push(`Row ${n.rowNum} "${n.title}" treated as a ${t} terminal: it is the ${idx === 0 ? 'first' : 'last'} row and its whole title is a terminal word.`);
    }
  });
  return nodes;
}

function nodeFromToken(value, index, byKey, nodes, used) {
  const key = clean(value);
  if (!key) return null;
  if (byKey[key.toLowerCase()]) return byKey[key.toLowerCase()];
  const n = {
    rowNum: index, id: makeUniqueId(slugify(key) || `n${nodes.length + 1}`, used),
    title: key, titleFromId: false, role: '', typeValue: '',
    kind: null, kindVia: null, kindReason: 'node came from an edge endpoint; no type or role column applies to it',
    desc: [], descDropped: '', order: nodes.length, orderExplicit: false,
    terminal: null, isDecision: false, synthetic: true,
  };
  byKey[key.toLowerCase()] = n;
  nodes.push(n);
  return n;
}

// Kahn topological sort with a stable insertion-order tie-break. On a cycle it
// promotes the remaining node with the lowest in-degree so ordering always
// terminates; the edges that end up pointing backwards become loops[].
function topoOrder(nodes, edges) {
  const indeg = new Map(nodes.map(n => [n.id, 0]));
  const out = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) {
    if (!indeg.has(e.from) || !indeg.has(e.to) || e.from === e.to) continue;
    indeg.set(e.to, indeg.get(e.to) + 1);
    out.get(e.from).push(e.to);
  }
  const remaining = new Set(nodes.map(n => n.id));
  const order = [];
  while (remaining.size) {
    let pick = null;
    for (const n of nodes) {
      if (!remaining.has(n.id)) continue;
      if (indeg.get(n.id) === 0) { pick = n.id; break; }
    }
    if (!pick) {
      let min = Infinity;
      for (const n of nodes) {
        if (!remaining.has(n.id)) continue;
        if (indeg.get(n.id) < min) { min = indeg.get(n.id); pick = n.id; }
      }
    }
    order.push(pick);
    remaining.delete(pick);
    for (const t of out.get(pick)) if (remaining.has(t)) indeg.set(t, indeg.get(t) - 1);
  }
  const rank = new Map(order.map((id, i) => [id, i]));
  return nodes.slice().sort((a, b) => rank.get(a.id) - rank.get(b.id));
}

const LOOP_STYLES = [
  { style: 'exception', words: ['reject', 'fail', 'error', 'exception', 'deny', 'decline', 'invalid', 'breach'] },
  { style: 'revision',  words: ['rework', 'revise', 'revision', 'return', 'amend', 'resubmit', 'correct', 'clarify', 'update',
    'retry', 'redo', 'recapture', 'insufficient', 'incomplete', 'missing'] },
  { style: 'cycle',     words: ['monitor', 'refresh', 'recur', 'continuous', 'repeat', 'cycle', 'poll', 'periodic', 'reprocess'] },
];

function loopStyle(label) {
  const ts = tokens(label);
  const flat = ts.join('');
  for (const s of LOOP_STYLES) for (const w of s.words) if (ts.includes(w) || flat.includes(w)) return s.style;
  return 'plain';
}

const YESNO = { yes: ['yes', 'y', 'approved', 'approve', 'pass', 'passed', 'accept', 'accepted', 'true', 'ok'], no: ['no', 'n', 'rejected', 'reject', 'fail', 'failed', 'deny', 'denied', 'false'] };
function yesNoOf(label) {
  const ts = tokens(label);
  for (const t of ts) {
    if (YESNO.yes.includes(t)) return 'yes';
    if (YESNO.no.includes(t)) return 'no';
  }
  return null;
}

/* ============================================================= *
 * 7. Spec assembly
 * ============================================================= */

const GLYPH = { manual: '👤', automated: '⚡', integration: '🔗' };

function buildSpec(graph, opts, ctx) {
  const ordered = graph.nodes;
  const idx = new Map(ordered.map((n, i) => [n.id, i]));

  // Outgoing edges per node, used for decision detection and edge labels.
  const outgoing = new Map(ordered.map(n => [n.id, []]));
  for (const e of graph.edges) if (outgoing.has(e.from)) outgoing.get(e.from).push(e);

  // A node is a decision when a decision column says so, or when it has ≥2
  // outgoing edges whose verbs read yes/no-ish (§8 branch logic).
  for (const n of ordered) {
    if (n.isDecision) continue;
    const outs = outgoing.get(n.id) || [];
    const branchy = outs.filter(e => yesNoOf(e.label)).length;
    if (outs.length >= 2 && branchy >= 2) {
      n.isDecision = true;
      n.decisionVia = 'two or more outgoing edges carrying yes/no-ish verbs';
    }
  }

  const flow = [];
  const steps = ordered.slice();

  // Bookends. A detected terminal is used as-is; when none exists a generic
  // Start/Complete pill is synthesised and disclosed in the report so the
  // operator can delete it.
  let head = null, tail = null;
  if (steps.length && steps[0].terminal === 'start') head = steps.shift();
  if (steps.length && steps[steps.length - 1].terminal === 'end') tail = steps.pop();
  for (const n of steps) {
    if (n.terminal) ctx.notes.push(`Node "${n.id}" carries a ${n.terminal} terminal marker but sits mid-flow; rendered as a step.`);
  }

  // The rendered chain is head → steps… → tail. Each consecutive pair consumes the
  // matching dataset edge as its primary connector (its verb becomes edgeLabel);
  // a pair with no edge behind it is recorded as an implicit connector.
  const seq = [].concat(head ? [head] : [], steps, tail ? [tail] : []);
  const chainFrom = new Map();   // node id → the edge that becomes its outgoing connector
  for (let i = 0; i + 1 < seq.length; i++) {
    const outs = outgoing.get(seq[i].id) || [];
    const e = outs.find(x => x.to === seq[i + 1].id);
    if (e) chainFrom.set(seq[i].id, e);
    else ctx.implicitEdges.push({ from: seq[i].id, to: seq[i + 1].id });
  }

  const startItem = head
    ? { type: 'start', id: head.id, label: head.title }
    : (ctx.synthTerminals.push('start'), { type: 'start', label: 'Start' });
  if (head && chainFrom.get(head.id) && chainFrom.get(head.id).label) startItem.edgeLabel = chainFrom.get(head.id).label;
  flow.push(startItem);

  for (let i = 0; i < steps.length; i++) {
    const n = steps[i];
    const outs = outgoing.get(n.id) || [];
    const chainEdge = chainFrom.get(n.id);

    if (n.isDecision) {
      const item = { type: 'decision', id: n.id, title: n.title };
      const yes = outs.find(e => yesNoOf(e.label) === 'yes');
      const no = outs.find(e => yesNoOf(e.label) === 'no');
      if (yes) item.yesLabel = yes.label;
      if (no) item.noLabel = no.label;
      flow.push(item);
      continue;
    }
    const item = { type: 'step', id: n.id };
    if (n.kind) item.kind = n.kind;
    // §2.1 pairs each semantic type with its glyph; when kind is unset the role
    // is emitted verbatim so nothing implies a colour that was not resolved.
    // Emit the role VERBATIM. Prefixing a glyph here bakes it into the dataset, where it
    // cannot be removed or relabelled without editing the data, and it renders differently on
    // every platform. The renderer owns presentation; the adapter owns content.
    if (n.role) item.role = n.role;
    item.title = n.title;
    if (n.desc.length) item.desc = n.desc;
    if (chainEdge && chainEdge.label) item.edgeLabel = chainEdge.label;
    flow.push(item);
  }
  flow.push(tail
    ? { type: 'end', id: tail.id, label: tail.title }
    : (ctx.synthTerminals.push('end'), { type: 'end', label: 'Complete' }));

  // Every edge that is not the primary chain connector survives as a loops[]
  // entry — back edges (target ordered earlier) and forward skips alike, so no
  // relationship in the dataset is dropped silently.
  const loops = [];
  for (const e of graph.edges) {
    if (!idx.has(e.from) || !idx.has(e.to)) continue;
    if (chainFrom.get(e.from) === e) continue;
    const back = idx.get(e.to) <= idx.get(e.from);
    const loop = { from: e.from, to: e.to };
    if (e.label) loop.label = e.label;
    loop.style = back ? loopStyle(e.label) : 'plain';
    loop.kindHint = back ? 'back edge' : 'forward skip';
    loops.push(loop);
  }

  const spec = {
    title: opts.title || ctx.defaultTitle,
    ...(opts.subtitle ? { subtitle: opts.subtitle } : {}),
    flow,
  };
  if (loops.length) spec.loops = loops.map(l => { const { kindHint, ...rest } = l; return rest; });
  ctx.loopDetail = loops;

  // cards.ioTable only when all three required columns exist (§9.1). Missing
  // meaning ⇒ omit the card rather than invent a sentence.
  const io = ctx.ioRows;
  if (io && io.length) spec.cards = { ioTable: io };

  return spec;
}

function collectIoRows(rows, map, ctx) {
  if (!(map.input && map.output && map.meaning)) {
    if (map.input || map.output || map.meaning) {
      ctx.notes.push('cards.ioTable omitted: §9.1 requires input, output and meaning; found only ' +
        ['input', 'output', 'meaning'].filter(f => map[f]).map(f => `${f} ("${map[f].header}")`).join(', ') + '.');
    }
    return [];
  }
  const out = [];
  for (const r of rows) {
    const input = clean(r[map.input.header]);
    const output = clean(r[map.output.header]);
    const meaning = clean(r[map.meaning.header]);
    if (!input && !output && !meaning) continue;
    if (!input || !output || !meaning) {
      ctx.notes.push(`ioTable row from source row ${r.__row} skipped: input/output/meaning must all be present (§9.1) — no value may be invented.`);
      continue;
    }
    out.push({ input, output, meaning });   // `example` is left to generate.js's leading-term derivation
  }
  return out;
}

/* ============================================================= *
 * 8. Report
 * ============================================================= */

function md(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, '<br>'); }

function buildReport(ctx, spec) {
  const L = [];
  L.push(`# Ingest inference report`);
  L.push('');
  L.push(`- **Source:** \`${ctx.inputPath}\``);
  L.push(`- **Parsed as:** ${ctx.format}${ctx.delimName ? ` (delimiter ${ctx.delimName})` : ''}`);
  L.push(`- **Detected shape:** **${ctx.shape}** — ${ctx.shapeReason}`);
  L.push(`- **Spec title:** "${spec.title}"${ctx.titleSynth ? ' _(derived from the filename — override with `--title`)_' : ''}`);
  L.push('');

  L.push('## Header → field mapping');
  L.push('');
  L.push('| Source header | Matched field | Synonym matched | Match |');
  L.push('|---|---|---|---|');
  for (const tbl of ctx.mappings) {
    for (const f of Object.keys(tbl.map)) {
      if (f === '__unmatched') continue;
      const m = tbl.map[f];
      L.push(`| \`${md(m.header)}\`${tbl.label ? ` _(${tbl.label})_` : ''} | ${f} | \`${m.synonym}\` | ${m.how} |`);
    }
  }
  const unmatched = [].concat(...ctx.mappings.map(t => (t.map.__unmatched || []).map(h => `\`${md(h)}\`${t.label ? ` _(${t.label})_` : ''}`)));
  L.push('');
  L.push(unmatched.length
    ? `**Columns carried no recognised field (ignored):** ${unmatched.join(', ')}`
    : '_Every column matched a field._');
  L.push('');

  L.push('## Counts');
  L.push('');
  const steps = spec.flow.filter(f => f.type === 'step').length;
  const decisions = spec.flow.filter(f => f.type === 'decision').length;
  L.push(`| Nodes (rows) | Steps | Decisions | Terminals | Edges read | Chain connectors | Loops | ioTable rows |`);
  L.push('|---|---|---|---|---|---|---|---|');
  L.push(`| ${ctx.nodeCount} | ${steps} | ${decisions} | ${spec.flow.filter(f => f.type === 'start' || f.type === 'end').length} | ${ctx.edgeCount} | ${ctx.chainCount} | ${(spec.loops || []).length} | ${(spec.cards && spec.cards.ioTable || []).length} |`);
  L.push('');

  L.push('## Semantic type (`kind`) resolution');
  L.push('');
  L.push('Resolved by what each node *does* — explicit type column first, role/actor column second (§2.1). ' +
    'The title string is never consulted.');
  L.push('');
  // Terminals and decisions never carry `kind` (a pill is cyan, a diamond rose by
  // §2.1), so listing them here would invent an ambiguity that does not exist.
  const typed = ctx.nodes.filter(n => !n.terminal && !n.isDecision);
  const resolved = typed.filter(n => n.kind);
  const unresolved = typed.filter(n => !n.kind);
  L.push(`Resolved: **${resolved.length}** · Unresolved: **${unresolved.length}**`);
  L.push('');
  if (resolved.length) {
    L.push('| Node id | kind | Resolved via | Token | Evidence |');
    L.push('|---|---|---|---|---|');
    for (const n of resolved) L.push(`| \`${n.id}\` | ${n.kind} | ${n.kindVia} | \`${n.kindToken}\` | ${md(n.typeValue || n.role)} |`);
    L.push('');
  }
  if (unresolved.length) {
    L.push('### Unresolved — `kind` left unset (needs a human decision)');
    L.push('');
    L.push('These nodes render with the generator default. Set `kind` on each in the spec, **or** add the ' +
      'missing token to `TYPE_TOKENS` in `scripts/ingest.js` and re-run.');
    L.push('');
    L.push('| Node id | Title | type value | role value | Reason |');
    L.push('|---|---|---|---|---|');
    for (const n of unresolved) L.push(`| \`${n.id}\` | ${md(n.title)} | ${md(n.typeValue) || '—'} | ${md(n.role) || '—'} | ${md(n.kindReason)} |`);
    L.push('');
  }

  if ((spec.loops || []).length) {
    L.push('## Loops & extra edges');
    L.push('');
    L.push('| From | To | Label | Style | Classified as |');
    L.push('|---|---|---|---|---|');
    for (const l of ctx.loopDetail) L.push(`| \`${l.from}\` | \`${l.to}\` | ${md(l.label) || '—'} | ${l.style} | ${l.kindHint} |`);
    L.push('');
  }

  const wrapped = ctx.nodes.filter(n => n.descWrapped || n.descDropped);
  L.push('## Text fitting');
  L.push('');
  if (!wrapped.length) L.push('_No description needed wrapping._');
  else {
    L.push(`The step box holds **${DESC_LINES}** description lines of about **${DESC_CHARS}** characters (§3.1, §4.1). ` +
      'Anything past the third line is listed verbatim below — nothing was dropped silently.');
    L.push('');
    L.push('| Node id | Lines kept | Overflow (not rendered) |');
    L.push('|---|---|---|');
    for (const n of wrapped) L.push(`| \`${n.id}\` | ${n.desc.length} | ${md(n.descDropped) || '_none — wrapped only_'} |`);
  }
  L.push('');

  L.push('## Structural decisions');
  L.push('');
  const notes = ctx.notes.slice();
  if (ctx.synthTerminals.length) {
    notes.push(`Synthesised generic ${ctx.synthTerminals.join(' and ')} terminal(s): the dataset declared none. ` +
      'Delete them from `flow` if the process has no bookends.');
  }
  if (!ctx.edgeCount) {
    notes.push('Every connector is sequence-implied: the dataset declares no edges, so the chain follows the ' +
      'row/order sequence. Reorder the `flow` array if the real process branches.');
  } else for (const e of ctx.implicitEdges) {
    notes.push(`Implicit connector \`${e.from}\` → \`${e.to}\`: the sequence puts them adjacent but the dataset has no edge between them.`);
  }
  const fromId = ctx.nodes.filter(n => n.titleFromId);
  if (fromId.length) notes.push(`Title taken from the id column for: ${fromId.map(n => '`' + n.id + '`').join(', ')} (no title value on those rows).`);
  if (!notes.length) L.push('_None — every element came straight from the dataset._');
  else for (const n of notes) L.push(`- ${n}`);
  L.push('');

  L.push('## Review before generating');
  L.push('');
  const review = [];
  if (unresolved.length) review.push(`Set \`kind\` on ${unresolved.length} node(s) listed above, or accept the generator default.`);
  if (ctx.synthTerminals.length) review.push('Confirm or delete the synthesised Start/Complete terminals.');
  if (ctx.edgeCount && ctx.implicitEdges.length) review.push(`Confirm ${ctx.implicitEdges.length} implicit connector(s) — they are sequence, not data.`);
  if (wrapped.some(n => n.descDropped)) review.push('Shorten the descriptions whose overflow is listed above, or accept the loss.');
  if ((spec.loops || []).length) review.push('Check each loop `style` guess (exception / revision / cycle / plain) against the real semantics.');
  if (decisions) review.push(`Check the ${decisions} decision node(s): diamond text, yes/no branch labels, and whether a rejected branch needs a \`no\` terminal.`);
  if (!(spec.cards && spec.cards.ioTable)) review.push('No `cards.ioTable` was derived — add input/output/meaning columns, or author the card by hand (§9.1).');
  if (!spec.subtitle) review.push('No subtitle: add one with `--subtitle` or in the spec.');
  review.push('Then run: `node scripts/generate.js <spec.json> out.html 1600`');
  for (const r of review) L.push(`- [ ] ${r}`);
  L.push('');
  return L.join('\n');
}

/* ============================================================= *
 * 9. Main
 * ============================================================= */

function humanTitle(file) {
  const stem = path.basename(file).replace(/\.[^.]+$/, '');
  const words = stem.replace(/[_\-.]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().split(/\s+/);
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Process Flow';
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  loadVocab(opts.vocab);   // merge caller vocabulary before any inference runs
  if (opts.help || !opts.input) { process.stdout.write(USAGE + '\n'); process.exit(opts.help ? 0 : 1); }
  if (!fs.existsSync(opts.input)) fail(`input file not found: ${opts.input}`);

  const ext = path.extname(opts.input).toLowerCase();
  const text = fs.readFileSync(opts.input, 'utf8');
  const ctx = {
    inputPath: opts.input, notes: [], implicitEdges: [], synthTerminals: [],
    mappings: [], ioRows: [], defaultTitle: opts.title || humanTitle(opts.input),
    titleSynth: !opts.title,
  };

  let nodeTable = null, edgeTable = null;

  if (ext === '.json') {
    let data;
    try { data = JSON.parse(text.replace(/^﻿/, '')); }
    catch (e) { fail(`could not parse JSON: ${e.message}`); }
    ctx.format = 'JSON';
    if (Array.isArray(data)) {
      nodeTable = tableFromObjects(data, 'input array');
    } else if (data && typeof data === 'object') {
      const edgeKey = ['edges', 'links', 'relationships', 'connections'].find(k => Array.isArray(data[k]));
      const nodeKey = ['nodes', 'steps', 'activities', 'tasks'].find(k => Array.isArray(data[k]));
      if (nodeKey && edgeKey) {
        nodeTable = tableFromObjects(data[nodeKey], nodeKey);
        edgeTable = tableFromObjects(data[edgeKey], edgeKey);
        ctx.shape = 'node list + edge list (JSON)';
        ctx.shapeReason = `the object holds a \`${nodeKey}\` array and an \`${edgeKey}\` array`;
      } else if (nodeKey) {
        nodeTable = tableFromObjects(data[nodeKey], nodeKey);
      } else {
        fail(shapeError(Object.keys(data), ['source', 'target', 'order', 'id', 'title']) +
          '\n\nJSON object keys seen: ' + Object.keys(data).map(k => JSON.stringify(k)).join(', '));
      }
    } else fail('JSON input must be an array of rows or an object with nodes/edges arrays');
  } else {
    const delim = ext === '.tsv' ? '\t' : sniffDelimiter(text);
    ctx.format = 'delimited text';
    ctx.delimName = delim === '\t' ? 'TAB' : `"${delim}"`;
    nodeTable = tableFromDelimited(text, delim);
  }

  // ---- shape detection on the primary table -------------------------------
  // `input`/`output` are matched first so an io-table column ("Source Data",
  // "Output Data") cannot be mistaken for an edge endpoint during shape detection.
  const structural = matchFields(nodeTable.headers, nodeTable.rows, ['input', 'output', 'source', 'target', 'order', 'id', 'decision']);
  let graph;

  if (!ctx.shape) {
    if (structural.source && structural.target) {
      ctx.shape = 'edge list';
      ctx.shapeReason = `both a source column ("${structural.source.header}") and a target column ("${structural.target.header}") are present — one row per relationship`;
    } else if (structural.source && !structural.target && (structural.id || nodeTable.headers.length > 1)) {
      ctx.shape = 'adjacency (predecessor list)';
      ctx.shapeReason = `a predecessor column ("${structural.source.header}") is present with no target column — each row is a node whose predecessors are listed in that cell`;
    } else if (structural.order) {
      ctx.shape = 'node list with a sequence column';
      ctx.shapeReason = `a numeric order column ("${structural.order.header}") implies the chain; no source/target columns are present`;
    } else {
      fail(shapeError(nodeTable.headers, ['source', 'target', 'order', 'id', 'title', 'decision']));
    }
  }

  // ---- build the graph ----------------------------------------------------
  if (ctx.shape === 'edge list') {
    const map = matchFields(nodeTable.headers, nodeTable.rows, EDGE_PRIORITY);
    ctx.mappings.push({ label: '', map });
    const used = new Set();
    const byKey = {};
    const nodes = [];
    const edges = [];
    for (const r of nodeTable.rows) {
      const s = String(r[map.source.header] || '').trim();
      const t = String(r[map.target.header] || '').trim();
      if (!s && !t) continue;
      if (!s || !t) fail(`row ${r.__row}: edge list row is missing its ${s ? 'target' : 'source'} value — an edge needs both endpoints.`);
      const sn = nodeFromToken(s, r.__row, byKey, nodes, used);
      const tn = nodeFromToken(t, r.__row, byKey, nodes, used);
      // Node attributes on an edge row describe the SOURCE node of that row.
      if (map.role && clean(r[map.role.header]) && !sn.role) sn.role = clean(r[map.role.header]);
      if (map.type && clean(r[map.type.header]) && !sn.typeValue) sn.typeValue = clean(r[map.type.header]);
      if (map.desc && String(r[map.desc.header] || '').trim() && !sn.desc.length) {
        const d = wrapDesc(r[map.desc.header]);
        sn.desc = d.lines; sn.descDropped = d.dropped; sn.descWrapped = d.wrapped;
      }
      if (map.decision && isDecisionValue(r[map.decision.header])) sn.isDecision = true;
      edges.push({ from: sn.id, to: tn.id, label: map.verb ? clean(r[map.verb.header]) : '' });
    }
    for (const n of nodes) {
      const k = inferKind(n.typeValue, n.role);
      Object.assign(n, { kind: k.kind, kindVia: k.via, kindToken: k.token, kindReason: k.reason });
      n.terminal = terminalOf(n.typeValue);
    }
    graph = { nodes: topoOrder(nodes, edges), edges };
    ctx.ioRows = collectIoRows(nodeTable.rows, matchFields(nodeTable.headers, nodeTable.rows, ['input', 'output', 'meaning']), ctx);

  } else if (ctx.shape === 'adjacency (predecessor list)') {
    const map = matchFields(nodeTable.headers, nodeTable.rows, NODE_PRIORITY);
    ctx.mappings.push({ label: '', map });
    const nodes = buildNodes(nodeTable.rows, map, ctx);
    const byKey = {};
    nodes.forEach((n, i) => {
      byKey[n.id] = n;
      const raw = map.id ? String(nodeTable.rows[i][map.id.header] || '').trim() : '';
      if (raw) byKey[raw.toLowerCase()] = n;
      byKey[String(n.title).toLowerCase()] = n;
    });
    const edges = [];
    nodes.forEach((n, i) => {
      const cell = String(nodeTable.rows[i][map.source.header] || '').trim();
      if (!cell || NULL_TOKENS.includes(String(cell).trim().toLowerCase())) return;
      for (const tok of splitList(cell)) {
        const p = byKey[tok.toLowerCase()] || byKey[slugify(tok)];
        if (!p) { ctx.notes.push(`Row ${n.rowNum}: predecessor "${tok}" does not match any node id or title — edge dropped.`); continue; }
        edges.push({ from: p.id, to: n.id, label: '' });
      }
    });
    const ordered = map.order ? nodes.slice().sort((a, b) => a.order - b.order || a.rowNum - b.rowNum) : topoOrder(nodes, edges);
    graph = { nodes: ordered, edges };
    ctx.ioRows = collectIoRows(nodeTable.rows, map, ctx);

  } else {
    // node list with an order column, or JSON nodes + edges
    const map = matchFields(nodeTable.headers, nodeTable.rows, NODE_PRIORITY);
    ctx.mappings.push({ label: edgeTable ? 'nodes' : '', map });
    if (!map.title && !map.id) {
      fail(shapeError(nodeTable.headers, ['id', 'title']) + '\n\nA node table needs at least an id or a title column.');
    }
    const nodes = buildNodes(nodeTable.rows, map, ctx);
    let edges = [];
    if (edgeTable) {
      const emap = matchFields(edgeTable.headers, edgeTable.rows, EDGE_PRIORITY);
      ctx.mappings.push({ label: 'edges', map: emap });
      if (!emap.source || !emap.target) {
        fail(shapeError(edgeTable.headers, ['source', 'target']) + '\n\nThe edges array needs a source and a target key.');
      }
      const byKey = {};
      nodes.forEach((n, i) => {
        byKey[n.id] = n;
        const raw = map.id ? String(nodeTable.rows[i][map.id.header] || '').trim() : '';
        if (raw) byKey[raw.toLowerCase()] = n;
        byKey[String(n.title).toLowerCase()] = n;
      });
      for (const r of edgeTable.rows) {
        const s = byKey[String(r[emap.source.header] || '').trim().toLowerCase()];
        const t = byKey[String(r[emap.target.header] || '').trim().toLowerCase()];
        if (!s || !t) {
          ctx.notes.push(`Edge row ${r.__row}: endpoint ${!s ? JSON.stringify(String(r[emap.source.header])) : JSON.stringify(String(r[emap.target.header]))} matches no node — edge dropped.`);
          continue;
        }
        edges.push({ from: s.id, to: t.id, label: emap.verb ? clean(r[emap.verb.header]) : '' });
      }
      if (!ctx.shapeReason) { ctx.shape = 'node list + edge list'; ctx.shapeReason = 'a nodes table and an edges table were supplied'; }
    }
    const ordered = map.order || !edges.length
      ? nodes.slice().sort((a, b) => a.order - b.order || a.rowNum - b.rowNum)
      : topoOrder(nodes, edges);
    if (edgeTable && map.order) ctx.notes.push(`Node order came from the "${map.order.header}" column; the edge list was used for connector labels and loops only.`);
    graph = { nodes: ordered, edges };
    ctx.ioRows = collectIoRows(nodeTable.rows, map, ctx);
  }

  ctx.nodes = graph.nodes;
  ctx.nodeCount = graph.nodes.length;
  ctx.edgeCount = graph.edges.length;
  if (!ctx.nodeCount) fail('no nodes could be built from the input.');

  const spec = buildSpec(graph, opts, ctx);
  ctx.chainCount = Math.max(0, spec.flow.length - 1);

  const outPath = opts.out || path.join(path.dirname(opts.input), path.basename(opts.input).replace(/\.[^.]+$/, '') + '.spec.json');
  fs.writeFileSync(outPath, JSON.stringify(spec, null, 2) + '\n');

  const unresolved = ctx.nodes.filter(n => !n.kind && !n.terminal && !n.isDecision).length;
  if (opts.report) {
    fs.writeFileSync(opts.report, buildReport(ctx, spec));
    process.stderr.write(`ingest: report → ${opts.report}\n`);
  }
  process.stderr.write(
    `ingest: shape=${ctx.shape}; nodes=${ctx.nodeCount}; edges=${ctx.edgeCount}; ` +
    `loops=${(spec.loops || []).length}; ioTable=${(spec.cards && spec.cards.ioTable || []).length}; unresolved kinds=${unresolved}\n`);
  if (unresolved && !opts.report) {
    process.stderr.write(`ingest: WARNING ${unresolved} node(s) have no resolved kind. Re-run with --report to see which and why.\n`);
  }
  process.stdout.write(outPath + '\n');
}

main();
