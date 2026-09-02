#!/usr/bin/env node

/**
 * validate-spec.js
 *
 * Pre-generation validation for process-flow diagram specifications.
 * Catches errors early without full rendering, useful for CI/CD pipelines.
 *
 * Usage:
 *   node scripts/validate-spec.js spec.json
 *   node scripts/validate-spec.js spec.json --strict
 *
 * Exit codes:
 *   0 = Valid spec
 *   1 = Invalid spec (errors found)
 *   2 = Warning (use --strict to fail)
 */

const fs = require('fs');
const path = require('path');

class SpecValidator {
  constructor(spec, opts = {}) {
    this.spec = spec;
    this.opts = opts;
    this.errors = [];
    this.warnings = [];
  }

  validate() {
    this.validateTopLevel();
    this.validateFlow();
    this.validateLoops();
    this.validateCards();
    this.validateSemantics();
    return { valid: this.errors.length === 0, errors: this.errors, warnings: this.warnings };
  }

  validateTopLevel() {
    if (!this.spec.title) this.errors.push('Missing required field: title');
    if (!this.spec.flow || !Array.isArray(this.spec.flow)) {
      this.errors.push('Missing or invalid field: flow (must be array)');
      return;
    }
    if (this.spec.flow.length < 2) {
      this.errors.push('flow must contain at least 2 elements (start/end)');
    }
  }

  validateFlow() {
    if (!this.spec.flow) return;

    const ids = new Set();
    const nodes = [];

    this.spec.flow.forEach((node, idx) => {
      if (!node.type) {
        this.errors.push(`flow[${idx}]: missing type`);
        return;
      }

      const validTypes = ['start', 'end', 'step', 'decision', 'rowbreak'];
      if (!validTypes.includes(node.type)) {
        this.errors.push(`flow[${idx}]: invalid type "${node.type}". Must be one of: ${validTypes.join(', ')}`);
      }

      if (node.id) {
        if (ids.has(node.id)) {
          this.errors.push(`flow[${idx}]: duplicate id "${node.id}"`);
        }
        ids.add(node.id);
        nodes.push(node);
      }

      // Type-specific validation
      if (node.type === 'step') {
        if (!node.title) this.errors.push(`flow[${idx}]: step must have title`);
        const validKinds = ['manual', 'automated', 'integration'];
        if (node.kind && !validKinds.includes(node.kind)) {
          this.errors.push(`flow[${idx}]: invalid kind "${node.kind}". Must be: ${validKinds.join(', ')}`);
        }
      }

      if (node.type === 'decision') {
        if (!node.title) this.errors.push(`flow[${idx}]: decision must have title`);
        if (!node.yesLabel) this.warnings.push(`flow[${idx}]: decision missing yesLabel`);
        if (!node.noLabel) this.warnings.push(`flow[${idx}]: decision missing noLabel`);
      }
    });

    this.nodeIds = ids;
  }

  validateLoops() {
    if (!this.spec.loops || !Array.isArray(this.spec.loops)) return;

    this.spec.loops.forEach((loop, idx) => {
      if (!loop.from) this.errors.push(`loops[${idx}]: missing from`);
      if (!loop.to) this.errors.push(`loops[${idx}]: missing to`);
      if (loop.from && !this.nodeIds.has(loop.from)) {
        this.errors.push(`loops[${idx}]: "from" node id "${loop.from}" not found in flow`);
      }
      if (loop.to && !this.nodeIds.has(loop.to)) {
        this.errors.push(`loops[${idx}]: "to" node id "${loop.to}" not found in flow`);
      }
      const validStyles = ['plain', 'cycle', 'revision', 'exception'];
      if (loop.style && !validStyles.includes(loop.style)) {
        this.warnings.push(`loops[${idx}]: unknown style "${loop.style}"`);
      }
    });
  }

  validateCards() {
    if (!this.spec.cards) return;

    if (this.spec.cards.ioTable && Array.isArray(this.spec.cards.ioTable)) {
      this.spec.cards.ioTable.forEach((row, idx) => {
        if (!row.input) this.warnings.push(`cards.ioTable[${idx}]: missing input`);
        if (!row.output) this.warnings.push(`cards.ioTable[${idx}]: missing output`);
      });
    }

    if (this.spec.cards.prerequisites && !Array.isArray(this.spec.cards.prerequisites)) {
      this.errors.push('cards.prerequisites must be an array');
    }
  }

  validateSemantics() {
    // Check for common issues
    if (this.spec.flow.filter(n => n.type === 'start').length > 1) {
      this.warnings.push('Multiple start nodes found; typically one start per diagram');
    }
    if (this.spec.flow.filter(n => n.type === 'end').length === 0) {
      this.warnings.push('No end node found; consider adding one');
    }

    // Check for isolated nodes (node not connected by any edge). A node is connected if it
    // participates in an explicit loops[]/no.to edge, OR sits adjacent to another real node in
    // the flow[] sequence (rowbreak resets adjacency, matching generate.js's own connector logic
    // in drawConnectors()). Only checking spec.loops here under-counts every node reached
    // purely through the implicit flow chain — which is the common case — and would otherwise
    // flag most of a normal diagram as "isolated" the moment it also has one unrelated loop.
    const connected = new Set();
    (this.spec.loops || []).forEach(loop => {
      connected.add(loop.from);
      connected.add(loop.to);
    });
    this.spec.flow.forEach(node => {
      if (node.type === 'decision' && node.no && node.no.to) {
        connected.add(node.id);
        connected.add(node.no.to);
      }
    });
    let prevNode = null;
    this.spec.flow.forEach(node => {
      if (node.type === 'rowbreak') { prevNode = null; return; }
      if (prevNode) {
        if (prevNode.id) connected.add(prevNode.id);
        if (node.id) connected.add(node.id);
      }
      prevNode = node.type === 'end' ? null : node;
    });
    this.spec.flow.forEach(node => {
      if (node.id && !connected.has(node.id) && node.type !== 'start' && node.type !== 'end') {
        this.warnings.push(`Node "${node.id}" is not connected to any edge`);
      }
    });

    /* Redundant singular/plural metadata pairs.
     *
     * The drawer is metadata-driven and renders EVERY field the source carries — that guarantee is
     * deliberate and must not be softened by silently de-duplicating at render time. The cost is
     * that a node carrying both `actor: "X"` and `actors: ["X"]` faithfully shows the same value
     * twice under two headings, which reads as a rendering bug when it is actually a data bug.
     * So the check belongs here: warn the author, keep the renderer honest. */
    this.spec.flow.forEach(node => {
      if (!node || typeof node !== 'object') return;
      Object.keys(node).forEach(k => {
        const plural = k + 's';
        if (!(plural in node)) return;
        const one = node[k], many = node[plural];
        if (typeof one !== 'string' || !Array.isArray(many)) return;
        if (many.length === 1 && String(many[0]).trim() === one.trim()) {
          this.warnings.push(
            `Node "${node.id}" defines both "${k}" and "${plural}" with the same value ` +
            `("${one}"). The drawer renders every field it is given, so this will display twice ` +
            `under two headings. Keep one.`);
        }
      });
    });
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node validate-spec.js <spec.json> [--strict]');
    process.exit(2);
  }

  const specPath = args[0];
  const opts = { strict: args.includes('--strict') };

  if (!fs.existsSync(specPath)) {
    console.error(`File not found: ${specPath}`);
    process.exit(1);
  }

  let spec;
  try {
    const content = fs.readFileSync(specPath, 'utf8');
    spec = JSON.parse(content);
  } catch (err) {
    console.error(`Failed to parse ${specPath}: ${err.message}`);
    process.exit(1);
  }

  const validator = new SpecValidator(spec, opts);
  const result = validator.validate();

  if (result.errors.length > 0) {
    console.error(`✗ ${result.errors.length} error(s) found:`);
    result.errors.forEach(err => console.error(`  ✗ ${err}`));
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn(`! ${result.warnings.length} warning(s):`);
    result.warnings.forEach(warn => console.warn(`  ! ${warn}`));
    if (opts.strict) {
      console.error('Failing due to --strict');
      process.exit(2);
    }
  }

  console.log(`✓ ${path.basename(specPath)} is valid`);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = SpecValidator;
