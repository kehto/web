#!/usr/bin/env node
/**
 * Build the unified GitHub Pages artifact.
 *
 * GitHub Pages serves the uploaded artifact at the domain root. The public
 * Kehto site lives below /web/, so this script creates:
 *
 *   .pages/web/index.html
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const outputRoot = resolve(repoRoot, process.env.PAGES_OUT_DIR || '.pages');
const webRoot = join(outputRoot, 'web');
const portalSource = join(repoRoot, 'web', 'index.html');
const portalOutput = join(webRoot, 'index.html');

function rel(path) {
  return relative(repoRoot, path);
}

function ensureFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${label} missing: ${rel(path)}`);
  }
}

rmSync(outputRoot, { recursive: true, force: true });
ensureFile(portalSource, 'portal source');
mkdirSync(dirname(portalOutput), { recursive: true });
copyFileSync(portalSource, portalOutput);

console.log(`[build:pages] OK - wrote ${rel(webRoot)} portal root`);
