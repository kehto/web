#!/usr/bin/env node
/**
 * Build the static GitHub Pages artifact for Paja Runtime.
 *
 * GitHub Pages serves .pages/ at /web/, so this writes:
 *
 *   .pages/paja/index.html
 *   .pages/paja/__kehto/browser-host.js
 *   .pages/paja/__kehto/config.json
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPajaRuntimeHostConfig, renderPajaHtml } from '../packages/paja/dist/index.js';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const outputDir = resolve(repoRoot, process.env.PAJA_PAGES_OUT_DIR || '.pages/paja');
const browserHostScript = join(repoRoot, 'packages', 'paja', 'dist', 'browser-host.js');
const browserHostMap = `${browserHostScript}.map`;

const rel = relative.bind(null, repoRoot);

function ensureFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${label} missing: ${rel(path)}`);
  }
}

ensureFile(browserHostScript, 'Paja browser host bundle');
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(join(outputDir, '__kehto'), { recursive: true });
writeFileSync(join(outputDir, '.nojekyll'), '');

const hostConfig = createPajaRuntimeHostConfig({}, new Date('2026-06-30T00:00:00.000Z'));
writeFileSync(join(outputDir, 'index.html'), renderPajaHtml(hostConfig));
writeFileSync(join(outputDir, '__kehto', 'config.json'), `${JSON.stringify(hostConfig, null, 2)}\n`);
copyFileSync(browserHostScript, join(outputDir, '__kehto', 'browser-host.js'));
if (existsSync(browserHostMap)) {
  copyFileSync(browserHostMap, join(outputDir, '__kehto', 'browser-host.js.map'));
}

console.log(`[build:paja-pages] OK - wrote ${rel(outputDir)} Paja Runtime artifact`);
