#!/usr/bin/env node
/**
 * PFD Spec Normalizer v2.3
 * ------------------------------------------------------------------
 * Deterministic data processor for PFD specs.
 *
 * SYSTEM ROLE:
 * Ingest structured PFD specification data (JSON) and produce
 * consistent, auditable, deterministically normalized output.
 *
 * CRITICAL CONSTRAINTS:
 * • Temperature: 0 (deterministic)
 * • MUST produce only valid JSON output
 * • MUST NOT invent, infer, extrapolate, or assume data
 * • MUST follow exact rules and schema
 * • MUST produce identical output for identical inputs
 *
 * Usage:
 *   node normalize-spec.js <input-spec.json> [output-normalized.json]
 */

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ============================================================= *
 * NORMALIZATION RULES (DETERMINISTIC)
 * ============================================================= */

const NORMALIZATION_RULES = {
  numeric: {
    description: 'Round to exactly 2 decimal places, no scientific notation',
    process: (val) => {
      if (val === null || val === undefined) return null;
      const num = parseFloat(val);
      if (isNaN(num)) return null;
      // Always 2 decimals, standard rounding
      return Math.round(num * 100) / 100;
    },
    format: (val) => {
      if (val === null) return null;
      // Check if it's a whole number
      if (Number.isInteger(val)) return val;
      // Otherwise format with exactly 2 decimals
      return parseFloat(val.toFixed(2));
    }
  },
  string: {
    description: 'Trim leading/trailing whitespace, normalize internal spaces, preserve casing',
    process: (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val !== 'string') val = String(val);
      // Trim and normalize internal whitespace
      return val.trim().replace(/\s+/g, ' ');
    }
  },
  date: {
    description: 'Convert to ISO 8601 format: YYYY-MM-DD',
    process: (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'string') val = val.trim();

      // Try to parse date
      let date;

      // ISO format (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        date = new Date(val + 'T00:00:00Z');
      }
      // US format (MM/DD/YYYY)
      else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) {
        const [m, d, y] = val.split('/');
        date = new Date(y, parseInt(m) - 1, d);
      }
      // EU format (DD.MM.YYYY or DD-MM-YYYY)
      else if (/^\d{1,2}[.\-]\d{1,2}[.\-]\d{4}$/.test(val)) {
        const parts = val.split(/[.\-]/);
        date = new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
      }
      else {
        return null;
      }

      // Validate date
      if (isNaN(date.getTime())) return null;

      // Return ISO format
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  },
  boolean: {
    description: 'Convert to true/false (lowercase)',
    process: (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val !== 0;
      if (typeof val === 'string') {
        const s = val.toLowerCase().trim();
        if (['true', 'yes', 'y', '1', 'on'].includes(s)) return true;
        if (['false', 'no', 'n', '0', 'off'].includes(s)) return false;
      }
      return null;
    }
  },
  array: {
    description: 'Maintain original order, normalize each element',
    process: (val, elementNormalizer) => {
      if (val === null || val === undefined) return null;
      if (!Array.isArray(val)) return null;
      return val.map(elem => elementNormalizer ? elementNormalizer(elem) : elem);
    }
  }
};

/* ============================================================= *
 * SPEC SCHEMA & FIELD TYPES
 * ============================================================= */

const FIELD_TYPES = {
  // Flow nodes
  'flow.*.id': 'string',
  'flow.*.type': 'string',
  'flow.*.title': 'string',
  'flow.*.num': 'string',
  'flow.*.role': 'string',
  'flow.*.desc.*': 'string',
  'flow.*.meaning': 'string',
  'flow.*.inputDesc': 'string',
  'flow.*.outputDesc': 'string',
  'flow.*.example': 'string',
  'flow.*.variant': 'string',
  'flow.*.kind': 'string',

  // Flow edges
  'flow_edges.*.from': 'string',
  'flow_edges.*.to': 'string',
  'flow_edges.*.label': 'string',
  'flow_edges.*.style': 'string',

  // Loops
  'loops.*.from': 'string',
  'loops.*.to': 'string',
  'loops.*.label': 'string',
  'loops.*.style': 'string',

  // Cards (I/O table rows)
  'cards.ioTable.*.input': 'string',
  'cards.ioTable.*.output': 'string',
  'cards.ioTable.*.meaning': 'string',

  // Config (numeric & structural)
  'config.layout.containerWidth': 'numeric',
  'config.layout.edgeLabelSpacing': 'numeric',
  'config.styling.payloadLabelBackground.opacity': 'numeric',
  'config.styling.payloadLabelBackground.fill': 'string',
  'config.drawer.minWidth': 'numeric',
  'config.drawer.maxWidth': 'numeric',
  'config.drawer.defaultWidth': 'numeric',
  'config.drawer.overlayMode': 'boolean',
  'config.cards.showIOTable': 'boolean',
  'config.interactive': 'boolean',

  // Top-level
  'title': 'string',
  'subtitle': 'string'
};

/* ============================================================= *
 * NORMALIZER CLASS
 * ============================================================= */

class SpecNormalizer {
  constructor(spec) {
    this.spec = spec;
    this.errors = [];
    this.warnings = [];
    this.fieldStats = {};
  }

  normalize() {
    // Step 1: Validate input
    if (!this.validate()) {
      return this.errorOutput();
    }

    // Step 2: Normalize data
    const normalized = this.normalizeData(this.spec);

    // Step 3: Sort keys alphabetically
    const sorted = this.sortKeysRecursive(normalized);

    // Step 4: Build output structure
    const output = this.buildOutput(sorted);

    // Step 5: Validate output
    if (!this.validateOutput(output)) {
      return this.errorOutput();
    }

    return output;
  }

  validate() {
    if (typeof this.spec !== 'object' || this.spec === null) {
      this.errors.push({
        code: 'INVALID_INPUT',
        message: 'Spec must be a valid JSON object',
        details: { value: typeof this.spec }
      });
      return false;
    }

    if (!this.spec.title) {
      this.errors.push({
        code: 'MISSING_FIELD',
        message: 'Spec must include a "title" field',
        details: { fieldName: 'title' }
      });
      return false;
    }

    if (!Array.isArray(this.spec.flow)) {
      this.errors.push({
        code: 'MISSING_FIELD',
        message: 'Spec must include a "flow" array',
        details: { fieldName: 'flow' }
      });
      return false;
    }

    return true;
  }

  normalizeData(obj, path = '') {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') {
      // Normalize scalar value
      return this.normalizeScalar(obj, path);
    }

    if (Array.isArray(obj)) {
      return obj.map((elem, idx) =>
        this.normalizeData(elem, `${path}.*`)
      );
    }

    // Object: normalize each field
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;
      result[key] = this.normalizeData(value, fieldPath);

      // Track field statistics
      if (!this.fieldStats[key]) {
        this.fieldStats[key] = { nullCount: 0, totalCount: 0 };
      }
      this.fieldStats[key].totalCount++;
      if (value === null || value === undefined) {
        this.fieldStats[key].nullCount++;
      }
    }

    return result;
  }

  normalizeScalar(value, path) {
    if (value === null || value === undefined) return null;

    // Determine expected type
    const expectedType = this.getFieldType(path);

    // Apply normalization
    let normalized;
    switch (expectedType) {
      case 'numeric':
        normalized = NORMALIZATION_RULES.numeric.process(value);
        if (normalized !== null) {
          normalized = NORMALIZATION_RULES.numeric.format(normalized);
        }
        break;
      case 'boolean':
        normalized = NORMALIZATION_RULES.boolean.process(value);
        break;
      case 'date':
        normalized = NORMALIZATION_RULES.date.process(value);
        break;
      case 'string':
      default:
        normalized = NORMALIZATION_RULES.string.process(value);
        break;
    }

    return normalized;
  }

  getFieldType(path) {
    // Check exact match
    if (FIELD_TYPES[path]) return FIELD_TYPES[path];

    // Check pattern match (e.g., 'flow.*.id')
    const patterns = Object.keys(FIELD_TYPES);
    for (const pattern of patterns) {
      if (this.matchesPattern(path, pattern)) {
        return FIELD_TYPES[pattern];
      }
    }

    // Default to string
    return 'string';
  }

  matchesPattern(path, pattern) {
    const pathParts = path.split('.');
    const patternParts = pattern.split('.');

    if (pathParts.length !== patternParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] !== '*' && patternParts[i] !== pathParts[i]) {
        return false;
      }
    }

    return true;
  }

  sortKeysRecursive(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(elem => this.sortKeysRecursive(elem));
    }

    // Sort object keys alphabetically
    const sorted = {};
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      sorted[key] = this.sortKeysRecursive(obj[key]);
    }

    return sorted;
  }

  buildOutput(normalized) {
    const inputHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(this.spec))
      .digest('hex');

    const fieldsProcessed = Object.keys(this.fieldStats).sort();
    const nullCounts = {};
    for (const field of fieldsProcessed) {
      nullCounts[field] = this.fieldStats[field].nullCount;
    }

    const processedAtTimestamp = new Date().toISOString();

    return {
      metadata: {
        fieldsProcessed,
        inputDataHash: inputHash,
        nullCounts,
        processingStatus: 'success',
        processedAtTimestamp,
        rowCount: this.getRowCount(normalized),
        version: '2.3'
      },
      normalized: normalized,
      summary: {
        fieldsWithAllNulls: this.getFieldsWithAllNulls(),
        fieldsWithNoNulls: this.getFieldsWithNoNulls(),
        processingNotes: this.warnings.length > 0
          ? this.warnings.join('; ')
          : 'All fields normalized successfully'
      }
    };
  }

  getRowCount(data) {
    if (Array.isArray(data.flow)) return data.flow.length;
    return 0;
  }

  getFieldsWithAllNulls() {
    return Object.entries(this.fieldStats)
      .filter(([_, stats]) => stats.nullCount === stats.totalCount && stats.totalCount > 0)
      .map(([field]) => field)
      .sort();
  }

  getFieldsWithNoNulls() {
    return Object.entries(this.fieldStats)
      .filter(([_, stats]) => stats.nullCount === 0 && stats.totalCount > 0)
      .map(([field]) => field)
      .sort();
  }

  validateOutput(output) {
    // Ensure output is valid JSON
    try {
      JSON.stringify(output);
    } catch (e) {
      this.errors.push({
        code: 'PROCESSING_ERROR',
        message: 'Output is not valid JSON',
        details: { reason: e.message }
      });
      return false;
    }

    return true;
  }

  errorOutput() {
    return {
      error: {
        code: this.errors[0]?.code || 'PROCESSING_ERROR',
        message: this.errors[0]?.message || 'Unknown error',
        details: this.errors[0]?.details || {}
      }
    };
  }
}

/* ============================================================= *
 * CLI INTERFACE
 * ============================================================= */

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node normalize-spec.js <input-spec.json> [output-normalized.json]');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || inputFile.replace(/\.json$/, '-normalized.json');

  try {
    // Read input
    const input = fs.readFileSync(inputFile, 'utf8');
    const spec = JSON.parse(input);

    // Normalize
    const normalizer = new SpecNormalizer(spec);
    const output = normalizer.normalize();

    // Write output
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

    // Print status
    if (output.error) {
      console.error(`✗ Normalization failed: ${output.error.message}`);
      process.exit(1);
    } else {
      console.log(`✓ Normalized ${output.metadata.rowCount} nodes`);
      console.log(`  Fields: ${output.metadata.fieldsProcessed.join(', ')}`);
      console.log(`  Output: ${outputFile}`);
    }
  } catch (e) {
    console.error(`✗ Error: ${e.message}`);
    process.exit(1);
  }
}

module.exports = { SpecNormalizer, NORMALIZATION_RULES };

if (require.main === module) {
  main();
}
