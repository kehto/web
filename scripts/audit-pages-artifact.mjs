#!/usr/bin/env node
/**
 * Verify the static GitHub Pages artifact route contract.
 *
 * For the kehto/web project repository, GitHub Pages maps the uploaded
 * artifact root to https://kehto.github.io/web/. The public URLs include
 * /web/, but the artifact root must contain index.html directly.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const outputRoot = resolve(repoRoot, process.env.PAGES_OUT_DIR || '.pages');
const nappletsDir = join(repoRoot, 'apps', 'playground', 'napplets');

const PUBLIC_SITE_BASE = '/web/';
const LANDING_CSS = `${PUBLIC_SITE_BASE}assets/landing.css`;
const LANDING_JS = `${PUBLIC_SITE_BASE}assets/landing.js`;
const PLAYGROUND_BASE = '/web/playground/';
const DOCS_BASE = '/web/docs/';

/** @type {string[]} */
const violations = [];

const rel = relative.bind(null, repoRoot);

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

function artifactPathFromPublicPath(publicPath) {
  const path = String(publicPath || '');
  if (!path.startsWith(PUBLIC_SITE_BASE)) {
    fail(`public path ${path} does not start with ${PUBLIC_SITE_BASE}`);
    return outputRoot;
  }

  const relativePath = path.slice(PUBLIC_SITE_BASE.length);
  return join(outputRoot, relativePath);
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
  const nestedPortalPath = join(outputRoot, 'web', 'index.html');
  if (existsSync(nestedPortalPath)) {
    fail(`portal is nested under ${rel(nestedPortalPath)}; project Pages expects ${rel(join(outputRoot, 'index.html'))}`);
  }

  const portalPath = join(outputRoot, 'index.html');
  if (!assertFile(portalPath, 'portal route')) return;
  const portal = read(portalPath);
  assertContains(portalPath, portal, 'href="/web/playground/"', 'portal route');
  assertContains(portalPath, portal, 'href="/web/docs/"', 'portal route');
  assertContains(portalPath, portal, `href="${LANDING_CSS}"`, 'portal route');
  assertContains(portalPath, portal, `src="${LANDING_JS}"`, 'portal route');
  assertContains(portalPath, portal, 'class="wordmark"', 'portal brand');
  assertContains(portalPath, portal, 'class="notice"', 'portal alpha notice');

  assertFile(join(outputRoot, 'assets', 'landing.css'), 'portal stylesheet asset');
  assertFile(join(outputRoot, 'assets', 'landing.js'), 'portal script asset');
}

function checkPlayground() {
  const indexPath = join(outputRoot, 'playground', 'index.html');
  if (assertFile(indexPath, 'playground route')) {
    assertContains(indexPath, read(indexPath), `${PLAYGROUND_BASE}assets/`, 'playground route');
  }

  const names = nappletNames();
  for (const name of names) {
    const manifestPath = join(outputRoot, 'playground', 'napplet-gateway', name, 'manifest.json');
    if (!assertFile(manifestPath, `${name} gateway manifest`)) continue;
    const manifest = readJson(manifestPath);
    const htmlUrl = manifest.htmlUrl;
    if (typeof htmlUrl !== 'string' || !htmlUrl.startsWith(`${PLAYGROUND_BASE}napplet-gateway/${name}/`)) {
      fail(`${rel(manifestPath)} htmlUrl does not use ${PLAYGROUND_BASE}napplet-gateway/${name}/`);
      continue;
    }
    const routePath = artifactPathFromPublicPath(htmlUrl);
    assertFile(routePath, `${name} gateway html route`);
  }
}

function checkDocs() {
  const docsIndex = join(outputRoot, 'docs', 'index.html');
  if (assertFile(docsIndex, 'docs route')) {
    assertContains(docsIndex, read(docsIndex), `${DOCS_BASE}assets/`, 'docs route');
  }

  const requiredDocsRoutes = [
    ['package docs', join(outputRoot, 'docs', 'packages', 'shell.html')],
    ['policy docs', join(outputRoot, 'docs', 'policies', 'NIP-5D-CONFORMANCE.html')],
    ['migration docs', join(outputRoot, 'docs', 'migrations', 'index.html')],
    ['API reference page', join(outputRoot, 'docs', 'reference', 'api.html')],
    ['TypeDoc module', join(outputRoot, 'docs', 'api', 'modules', '_kehto_shell.html')],
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
