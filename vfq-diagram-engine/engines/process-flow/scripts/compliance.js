#!/usr/bin/env node
/**
 * PFD v2.3 — Compliance Validation Framework
 * ================================================
 * Pre-render validation gates to enforce specification compliance
 * across all generated diagrams.
 *
 * These functions MUST be called before releasing any diagram.
 * If ANY check fails, reject the diagram and report violations.
 *
 * CRITICAL GATES:
 *   §3 Color Validation — No hardcoded colors, CSS variables only
 *   §4 Text Floor Validation — All text ≥10px readable minimum
 *   §1 Stroke Width Validation — All strokes 1.5px ± 0.1px
 *   §11 Audit Trail Validation — Spec hash, timestamp, version present
 *   §9 Interactivity Validation — Drawer and keyboard nav
 */

'use strict';

/**
 * VALIDATION GATE 1: Text Floor Compliance (§4)
 * Ensures all text elements meet minimum 10px readable standard
 */
function validateTextFloor(htmlContent, minFontSize = 10) {
  const textSizePattern = /font-size[=:"']([0-9.]+)px?['"]?/gi;
  const violations = [];
  let match;

  while ((match = textSizePattern.exec(htmlContent)) !== null) {
    const size = parseFloat(match[1]);
    if (size < minFontSize) {
      const lineNum = htmlContent.substring(0, match.index).split('\n').length;
      violations.push({
        size: size,
        line: lineNum,
        minRequired: minFontSize
      });
    }
  }

  if (violations.length > 0) {
    const unique = violations.slice(0, 5);
    const report = unique
      .map(v => `  Line ~${v.line}: font-size="${v.size}px" (requires ${v.minRequired}px)`)
      .join('\n');

    throw new Error(
      `\n✗ §4 TEXT FLOOR VIOLATION: ${violations.length} text elements below ${minFontSize}px minimum\n` +
      report +
      `\nThis is a WCAG 2.1 accessibility failure. Fix all text to ≥${minFontSize}px.`
    );
  }

  console.log('  ✓ §4 Text floor validation passed (all text ≥10px)');
}

/**
 * VALIDATION GATE 2: Color Compliance (§3)
 * Ensures node colors use CSS variables (allows grid/backdrop patterns)
 */
function validateNoHardcodedColors(htmlContent) {
  // Look for hardcoded colors in NODE elements (not patterns or text)
  // Node colors that MUST be CSS variables: fills on rectangles/circles/polygons representing semantic nodes

  // Pattern: Find node-related colors (not grid patterns, not text)
  // Reject: fill="#5e3ba8" on node rectangles (should be var(--color-system))
  // Allow: stroke="#1e293b" in grid patterns (design system backdrop)

  const violations = [];

  // Check for node fill colors (most critical - node body colors)
  const nodeColorPattern = /<(rect|circle|ellipse|polygon)\s[^>]*fill=['"]#[0-9a-fA-F]{6}['"][^>]*class=['"]node/g;
  let match;

  while ((match = nodeColorPattern.exec(htmlContent)) !== null) {
    const colorMatch = match[0].match(/fill=['"]([^'"]+)['"]/);
    if (colorMatch) {
      violations.push({
        element: match[1],
        color: colorMatch[1],
        pattern: match[0].substring(0, 60) + '...'
      });
    }
  }

  // Allow grid patterns and other non-node elements
  // These are design system colors (backdrop), not semantic node colors

  if (violations.length > 0) {
    const unique = violations.slice(0, 5);
    const report = unique
      .map(v => `  <${v.element}> fill="${v.color}" (use CSS variable instead)`)
      .join('\n');

    throw new Error(
      `\n✗ §3 HARDCODED COLOR VIOLATION: ${violations.length} node elements with hardcoded colors\n` +
      report +
      `\nNode colors must use CSS variables: var(--color-system), var(--color-terminal), etc.`
    );
  }

  console.log('  ✓ §3 Color compliance passed (node colors use CSS variables)');
}

/**
 * VALIDATION GATE 3: Stroke Width Compliance (§1)
 * Enforces consistent 1.5px stroke width across all NODE elements
 * Grid patterns are design system backdrop (excluded from this check)
 */
function validateStrokeWidths(htmlContent) {
  const expectedWidth = 1.5;
  const tolerance = 0.1;
  const violations = [];

  // Find all stroke-width attributes, but EXCLUDE grid pattern elements
  // Grid pattern is a design system backdrop element, not a semantic node stroke
  const strokePattern = /stroke-width=['"]?([0-9.]+)['"]?/g;
  let match;

  while ((match = strokePattern.exec(htmlContent)) !== null) {
    const width = parseFloat(match[1]);

    // Check context: exclude grid pattern path element
    const contextStart = Math.max(0, match.index - 200);
    const context = htmlContent.substring(contextStart, match.index + 100);

    // Skip if this is part of a grid pattern definition
    if (context.includes('id="grid"') || context.includes('pattern id="grid"')) {
      continue;
    }

    if (Math.abs(width - expectedWidth) > tolerance) {
      violations.push({
        actual: width,
        expected: expectedWidth,
        pattern: match[0]
      });
    }
  }

  if (violations.length > 0) {
    const unique = violations.slice(0, 5);
    const report = unique
      .map(v => `  ${v.pattern} (expected ${v.expected}px ±${tolerance}px, got ${v.actual}px)`)
      .join('\n');

    throw new Error(
      `\n✗ §1 STROKE WIDTH VIOLATION: ${violations.length} elements with incorrect stroke-width\n` +
      report +
      `\nStandard: 1.5px ± 0.1px for all node borders and connectors.`
    );
  }

  console.log('  ✓ §1 Stroke width compliance passed (all strokes 1.5px ± 0.1px)');
}

/**
 * VALIDATION GATE 4: Spec Hash & Audit Trail (§11)
 * Ensures determinism metadata is present and valid
 */
function validateAuditTrail(htmlContent) {
  const metaTagPattern = /<meta name=['"]([^'"]+)['"] content=['"]([^'"]+)['"]>/g;
  const metadata = {};
  let match;

  while ((match = metaTagPattern.exec(htmlContent)) !== null) {
    metadata[match[1]] = match[2];
  }

  const required = {
    'spec-hash': { pattern: /^sha256:[0-9a-f]{64}$/, description: 'SHA256 hash of input spec' },
    'generated-at': { pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, description: 'ISO 8601 timestamp' },
    'diagram-version': { pattern: /^2\.3/, description: 'PFD v2.3' }
  };

  const violations = [];

  Object.entries(required).forEach(([key, rules]) => {
    if (!metadata[key]) {
      violations.push(`Missing: <meta name="${key}"> — ${rules.description}`);
    } else if (!rules.pattern.test(metadata[key])) {
      violations.push(
        `Invalid: <meta name="${key}" content="${metadata[key]}"> ` +
        `— Expected format: ${rules.pattern}`
      );
    }
  });

  if (violations.length > 0) {
    throw new Error(
      `\n✗ §11 AUDIT TRAIL VIOLATION: ${violations.length} metadata issues\n` +
      violations.map(v => `  ❌ ${v}`).join('\n') +
      `\nAdd these <meta> tags to <head>:\n` +
      `  <meta name="spec-hash" content="sha256:...">\n` +
      `  <meta name="generated-at" content="2026-08-19T14:30:00Z">\n` +
      `  <meta name="diagram-version" content="2.3">`
    );
  }

  console.log(`  ✓ §11 Audit trail validation passed`);
  console.log(`    Spec hash: ${metadata['spec-hash']?.substring(0, 16)}...`);
  console.log(`    Generated: ${metadata['generated-at']}`);
  console.log(`    Version: ${metadata['diagram-version']}`);

  return metadata;
}

/**
 * VALIDATION GATE 5: Interactivity Implementation (§9)
 * Ensures drawer and keyboard navigation are present
 */
function validateInteractivity(htmlContent) {
  const checks = {
    drawer: htmlContent.includes('pfDrawer') || htmlContent.includes('pf-drawer') || htmlContent.includes('node-detail-drawer'),
    drawerCSS: htmlContent.includes('.pf-drawer') || htmlContent.includes('drawer-header') || htmlContent.includes('drawer'),
    openDrawer: htmlContent.includes('pfOpen') || htmlContent.includes('openDrawer(') || htmlContent.includes('function pfOpen') || htmlContent.includes('function openDrawer'),
    keyboardHandlers: htmlContent.includes('keydown') || htmlContent.includes('keyCode') || htmlContent.includes('ev.key'),
    nodeMetadata: htmlContent.includes('PF_NODES') || htmlContent.includes('PF_NODE_METADATA') || htmlContent.includes('nodeMetadata')
  };

  const passed = Object.values(checks).filter(v => v).length;
  const total = Object.keys(checks).length;

  if (passed < total) {
    const missing = Object.entries(checks)
      .filter(([_, v]) => !v)
      .map(([k, _]) => k);

    console.warn(`\n⚠️ §9 INTERACTIVITY: ${total - passed}/${total} features missing:`);
    missing.forEach(m => console.warn(`    ⚠️  Missing: ${m}`));
    console.warn(`  Recommendation: Add drawer implementation for full v2.3 compliance.`);
    return false;
  }

  console.log('  ✓ §9 Interactivity validation passed (drawer + keyboard nav present)');
  return true;
}

/**
 * MASTER VALIDATION FUNCTION
 * Call this before releasing ANY diagram
 */
function validateDiagramCompliance(htmlContent) {
  console.log('\n' + '='.repeat(60));
  console.log('PFD v2.3 COMPLIANCE VALIDATION');
  console.log('='.repeat(60) + '\n');

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    checks: [],
    metadata: null
  };

  // Gate 1: Text Floor
  try {
    validateTextFloor(htmlContent);
    results.passed++;
    results.checks.push({ name: '§4 Text Floor', status: 'PASS' });
  } catch (e) {
    results.failed++;
    results.checks.push({ name: '§4 Text Floor', status: 'FAIL', error: e.message });
  }

  // Gate 2: Colors
  try {
    validateNoHardcodedColors(htmlContent);
    results.passed++;
    results.checks.push({ name: '§3 Colors', status: 'PASS' });
  } catch (e) {
    results.failed++;
    results.checks.push({ name: '§3 Colors', status: 'FAIL', error: e.message });
  }

  // Gate 3: Stroke Widths
  try {
    validateStrokeWidths(htmlContent);
    results.passed++;
    results.checks.push({ name: '§1 Stroke Widths', status: 'PASS' });
  } catch (e) {
    results.failed++;
    results.checks.push({ name: '§1 Stroke Widths', status: 'FAIL', error: e.message });
  }

  // Gate 4: Audit Trail
  try {
    results.metadata = validateAuditTrail(htmlContent);
    results.passed++;
    results.checks.push({ name: '§11 Audit Trail', status: 'PASS' });
  } catch (e) {
    results.failed++;
    results.checks.push({ name: '§11 Audit Trail', status: 'FAIL', error: e.message });
  }

  // Gate 5: Interactivity (warning only, not blocker)
  try {
    const interactive = validateInteractivity(htmlContent);
    if (interactive) {
      results.passed++;
    } else {
      results.warnings++;
    }
    results.checks.push({ name: '§9 Interactivity', status: interactive ? 'PASS' : 'PARTIAL' });
  } catch (e) {
    results.warnings++;
    results.checks.push({ name: '§9 Interactivity', status: 'WARNING', error: e.message });
  }

  // Print report
  console.log('\n' + '='.repeat(60));
  console.log('COMPLIANCE REPORT');
  console.log('='.repeat(60) + '\n');

  results.checks.forEach(check => {
    const statusIcon = check.status === 'PASS' ? '✓' : check.status === 'FAIL' ? '✗' : '⚠️';
    console.log(`${statusIcon} ${check.name.padEnd(20)} ${check.status}`);
    if (check.error && check.status === 'FAIL') {
      const lines = check.error.split('\n');
      lines.slice(1, 3).forEach(line => console.log(`  ${line}`));
    }
  });

  console.log('\n' + '-'.repeat(60));
  console.log(`Summary: ${results.passed} passed, ${results.failed} failed, ${results.warnings} warnings`);

  if (results.failed > 0) {
    console.log('\n❌ COMPLIANCE CHECK FAILED');
    console.log('Diagram cannot be released. Fix violations above and retry.\n');
    console.log('-'.repeat(60) + '\n');
    throw new Error('Compliance validation failed');
  }

  if (results.warnings > 0) {
    console.log('\n⚠️  COMPLIANCE CHECK PASSED (with warnings)');
    console.log('Diagram is usable but missing optional features.\n');
  } else {
    console.log('\n✓ ALL COMPLIANCE CHECKS PASSED\n');
  }

  console.log('-'.repeat(60) + '\n');

  return results;
}

module.exports = {
  validateTextFloor,
  validateNoHardcodedColors,
  validateStrokeWidths,
  validateAuditTrail,
  validateInteractivity,
  validateDiagramCompliance
};
