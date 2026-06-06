#!/usr/bin/env node
/**
 * Build the unified GitHub Pages artifact.
 *
 * GitHub Pages serves a project repository's uploaded artifact at the
 * repository path. For kehto/web, the artifact root maps to:
 *
 *   https://kehto.github.io/web/
 *
 * The public URLs still include /web/, but the uploaded artifact itself must
 * not contain a nested web/ directory:
 *
 *   .pages/index.html
 *   .pages/playground/
 *   .pages/docs/
 */
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const outputRoot = resolve(repoRoot, process.env.PAGES_OUT_DIR || '.pages');
const portalSource = join(repoRoot, 'web', 'index.html');
const portalAssets = join(repoRoot, 'web', 'assets');
const portalOutput = join(outputRoot, 'index.html');
const portalAssetsOutput = join(outputRoot, 'assets');
const gsapSource = join(repoRoot, 'node_modules', 'gsap', 'dist', 'gsap.min.js');
const vendorAssetsOutput = join(portalAssetsOutput, 'vendor');
const playgroundOutput = join(outputRoot, 'playground');
const playgroundBasePath = process.env.PLAYGROUND_BASE_PATH || '/web/playground/';
const docsDist = join(repoRoot, 'docs', '.vitepress', 'dist');
const docsApi = join(repoRoot, 'docs', 'api');
const docsOutput = join(outputRoot, 'docs');

const rel = relative.bind(null, repoRoot);

function ensureFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${label} missing: ${rel(path)}`);
  }
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });
writeFileSync(join(outputRoot, '.nojekyll'), '');

ensureFile(portalSource, 'portal source');
ensureFile(gsapSource, 'GSAP vendor source');
mkdirSync(dirname(portalOutput), { recursive: true });
copyFileSync(portalSource, portalOutput);
cpSync(portalAssets, portalAssetsOutput, { recursive: true });
mkdirSync(vendorAssetsOutput, { recursive: true });
copyFileSync(gsapSource, join(vendorAssetsOutput, 'gsap.min.js'));

execFileSync(process.execPath, [join(scriptDir, 'build-playground-pages.mjs')], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYGROUND_BASE_PATH: playgroundBasePath,
    PLAYGROUND_PAGES_OUT_DIR: playgroundOutput,
  },
});

ensureFile(join(docsDist, 'index.html'), 'VitePress docs build');
ensureFile(join(docsApi, 'modules', '_kehto_shell.html'), 'TypeDoc API output');
cpSync(docsDist, docsOutput, { recursive: true });
cpSync(docsApi, join(docsOutput, 'api'), { recursive: true });

console.log(`[build:pages] OK - wrote ${rel(outputRoot)} portal, playground, and docs roots`);
