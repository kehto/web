#!/usr/bin/env node
import { cpSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const docsApi = join(repoRoot, 'docs', 'api');
const vitepressDist = join(repoRoot, 'docs', '.vitepress', 'dist');
const distApi = join(vitepressDist, 'api');

const rel = relative.bind(null, repoRoot);

function ensureDirectory(path, label) {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new Error(`${label} missing: ${rel(path)}`);
  }
}

function ensureFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${label} missing: ${rel(path)}`);
  }
}

ensureDirectory(docsApi, 'TypeDoc API output');
ensureFile(join(docsApi, 'modules', '_kehto_shell.html'), 'TypeDoc module output');
ensureDirectory(vitepressDist, 'VitePress docs build');

cpSync(docsApi, distApi, { recursive: true });

console.log(`[copy-docs-api] OK - copied ${rel(docsApi)} into ${rel(distApi)}`);
