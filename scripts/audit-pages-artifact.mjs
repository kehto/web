#!/usr/bin/env node
/**
 * Verify the static GitHub Pages artifact route contract.
 *
 * The uploaded artifact root maps to https://kehto.github.io/. Kehto's public
 * site intentionally lives under /web/, with playground and docs below it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const outputRoot = resolve(repoRoot, process.env.PAGES_OUT_DIR || '.pages');
const webRoot = join(outputRoot, 'web');
const nappletsDir = join(repoRoot, 'apps', 'playground', 'napplets');

const PLAYGROUND_BASE = '/web/playground/';
const DOCS_BASE = '/web/docs/';

/** @type {string[]} */
const violations = [];

function rel(path) {
  return relative(repoRoot, path);
}

function fail(message) {
  violations.push(message);
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
}

function assertFile(path, context) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    fail(`${context}: missing file ${rel(path)}`);
    return false;
  }
  return true;
}

function assertContains(path, content, needle, context) {
  if (!content.includes(needle)) {
    fail(`${context}: ${rel(path)} missing ${needle}`);
  }
}

function nappletNames() {
  if (!existsSync(nappletsDir)) {
    fail(`napplet directory missing: ${rel(nappletsDir)}`);
    return [];
  }
  return readdirSync(nappletsDir)
    .filter((name) => statSync(join(nappletsDir, name)).isDirectory())
    .sort();
}

function checkPortal() {
  const portalPath = join(webRoot, 'index.html');
  if (!assertFile(portalPath, 'portal route')) return;
  const portal = read(portalPath);
  assertContains(portalPath, portal, 'href="/web/playground/"', 'portal route');
  assertContains(portalPath, portal, 'href="/web/docs/"', 'portal route');
}

function checkPlayground() {
  const indexPath = join(webRoot, 'playground', 'index.html');
  if (assertFile(indexPath, 'playground route')) {
    assertContains(indexPath, read(indexPath), `${PLAYGROUND_BASE}assets/`, 'playground route');
  }

  const names = nappletNames();
  for (const name of names) {
    const manifestPath = join(webRoot, 'playground', 'napplet-gateway', name, 'manifest.json');
    if (!assertFile(manifestPath, `${name} gateway manifest`)) continue;
    const manifest = readJson(manifestPath);
    const htmlUrl = manifest.htmlUrl;
    if (typeof htmlUrl !== 'string' || !htmlUrl.startsWith(`${PLAYGROUND_BASE}napplet-gateway/${name}/`)) {
      fail(`${rel(manifestPath)} htmlUrl does not use ${PLAYGROUND_BASE}napplet-gateway/${name}/`);
      continue;
    }
    const routePath = join(outputRoot, htmlUrl.replace(/^\/+/, ''));
    assertFile(routePath, `${name} gateway html route`);
  }
}

function checkDocs() {
  const docsIndex = join(webRoot, 'docs', 'index.html');
  if (assertFile(docsIndex, 'docs route')) {
    assertContains(docsIndex, read(docsIndex), `${DOCS_BASE}assets/`, 'docs route');
  }

  const requiredDocsRoutes = [
    ['package docs', join(webRoot, 'docs', 'packages', 'shell.html')],
    ['policy docs', join(webRoot, 'docs', 'policies', 'NIP-5D-CONFORMANCE.html')],
    ['migration docs', join(webRoot, 'docs', 'migrations', 'index.html')],
    ['API reference page', join(webRoot, 'docs', 'reference', 'api.html')],
    ['TypeDoc module', join(webRoot, 'docs', 'api', 'modules', '_kehto_shell.html')],
  ];

  for (const [label, path] of requiredDocsRoutes) {
    assertFile(path, label);
  }
}

assertFile(join(outputRoot, '.nojekyll'), 'Pages root');
checkPortal();
checkPlayground();
checkDocs();

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`audit:pages FAILED - ${violation}`);
  }
  console.error(`\n[audit:pages] ${violations.length} violation(s)`);
  process.exit(1);
}

console.log('[audit:pages] OK - verified /web/, /web/playground/, /web/docs/, gateway routes, and TypeDoc output');
