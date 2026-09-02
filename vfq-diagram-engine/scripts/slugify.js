#!/usr/bin/env node
'use strict';

/**
 * Single source of truth for BRSD filename -> {brsd-slug} conversion.
 * Extraction commands and render-all.js both require() this so they can
 * never disagree on a folder name.
 *
 * Rule: basename without extension, lowercased, any run of
 * non-alphanumeric characters collapsed to a single hyphen, leading/
 * trailing hyphens trimmed.
 *
 * Examples:
 *   VFQ_Fibre_BRSD_v1.0.xlsx        -> vfq-fibre-brsd-v1-0
 *   VFQ_Mobile_Postpaid_Activation_BRSD_v1.1.xlsx
 *                                    -> vfq-mobile-postpaid-activation-brsd-v1-1
 */

const path = require('path');

function slugify(brsdPath) {
  const base = path.basename(brsdPath, path.extname(brsdPath));
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { slugify };

if (require.main === module) {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node slugify.js <path-or-filename>');
    process.exit(1);
  }
  console.log(slugify(input));
}
