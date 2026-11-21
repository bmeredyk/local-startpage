#!/usr/bin/env node
// Regenerates icons.js (the Bootstrap Icons name list) from the vendored stylesheet.
// Usage: node tools/gen-bootstrap-icons.mjs   (run from anywhere; paths are relative to the repo root)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'vendor/bootstrap-icons.min.css'), 'utf8');

const version = (css.match(/Bootstrap Icons v([\d.]+)/) || [])[1];
if (!version) throw new Error('Could not read the version from the Bootstrap Icons CSS header.');

const names = [...new Set([...css.matchAll(/\.bi-([a-z0-9-]+)::before/g)].map((m) => m[1]))].sort();
if (names.length < 100) throw new Error('Found only ' + names.length + ' icons; the CSS format may have changed.');

writeFileSync(
  join(root, 'icons.js'),
  `// Bootstrap Icons ${version} names, generated from vendor/bootstrap-icons.min.css.\n` +
  `window.BI_ICONS = ${JSON.stringify(names)};\n`,
);
console.log(`icons.js: ${names.length} icons (Bootstrap Icons ${version})`);
