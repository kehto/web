#!/usr/bin/env node
/**
 * Verify the static GitHub Pages artifact route contract.
 *
 * For the kehto/web project repository, GitHub Pages maps the uploaded
 * artifact root to https://kehto.github.io/web/. The public URLs include
 * /web/, but the artifact root must contain index.html directly.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const outputRoot = resolve(repoRoot, process.env.PAGES_OUT_DIR || '.pages');

const PUBLIC_SITE_BASE = '/web/';
const PORTAL_GSAP_VENDOR = 'assets/vendor/gsap.min.js';
const PORTAL_LANDING_CSS = 'assets/landing.css';
const PORTAL_LANDING_JS = 'assets/landing.js';
const RETIRED_PLAYGROUND_BASE = '/web/playground/';
const PAJA_BASE = '/web/paja/';
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

function checkPortal() {
  const nestedPortalPath = join(outputRoot, 'web', 'index.html');
  if (existsSync(nestedPortalPath)) {
    fail(`portal is nested under ${rel(nestedPortalPath)}; project Pages expects ${rel(join(outputRoot, 'index.html'))}`);
  }

  const portalPath = join(outputRoot, 'index.html');
  if (!assertFile(portalPath, 'portal route')) return;
  const portal = read(portalPath);
  if (portal.includes('href="playground/"')) {
    fail(`portal route: ${rel(portalPath)} still links the retired playground`);
  }
  assertContains(portalPath, portal, 'href="paja/"', 'portal route');
  assertContains(portalPath, portal, 'href="docs/"', 'portal route');
  assertContains(portalPath, portal, `href="${PORTAL_LANDING_CSS}"`, 'portal route');
  assertContains(portalPath, portal, `src="${PORTAL_GSAP_VENDOR}"`, 'portal route');
  assertContains(portalPath, portal, `src="${PORTAL_LANDING_JS}"`, 'portal route');
  assertContains(portalPath, portal, 'id="hairline-accent"', 'portal hairline accent');
  assertContains(portalPath, portal, 'class="wordmark"', 'portal brand');
  assertContains(portalPath, portal, 'class="notice"', 'portal alpha notice');

  assertFile(join(outputRoot, 'assets', 'landing.css'), 'portal stylesheet asset');
  assertFile(join(outputRoot, 'assets', 'landing.js'), 'portal script asset');
  assertFile(join(outputRoot, 'assets', 'vendor', 'gsap.min.js'), 'portal GSAP vendor asset');
}

function checkPaja() {
  const pajaRoot = artifactPathFromPublicPath(PAJA_BASE);
  const indexPath = join(pajaRoot, 'index.html');
  if (assertFile(indexPath, 'Paja Runtime route')) {
    const html = read(indexPath);
    assertContains(indexPath, html, 'id="runtime-pointer-form"', 'Paja Runtime route');
    assertContains(indexPath, html, 'hmr: <code>none</code>', 'Paja Runtime route');
    assertContains(indexPath, html, 'src="./__kehto/browser-host.js"', 'Paja Runtime route');
  }
  assertFile(join(pajaRoot, '__kehto', 'browser-host.js'), 'Paja Runtime browser host bundle');
  assertFile(join(pajaRoot, '__kehto', 'config.json'), 'Paja Runtime host config');
}

function checkRetiredPlayground() {
  const indexPath = join(artifactPathFromPublicPath(RETIRED_PLAYGROUND_BASE), 'index.html');
  if (!assertFile(indexPath, 'retired playground redirect')) return;
  const html = read(indexPath);
  assertContains(indexPath, html, 'KEHTO_PLAYGROUND_RETIRED', 'retired playground redirect');
  assertContains(indexPath, html, `url=${PAJA_BASE}`, 'retired playground redirect');
  assertContains(indexPath, html, 'console.warn(', 'retired playground redirect');
  if (existsSync(join(outputRoot, 'playground', 'napplet-gateway'))) {
    fail('retired playground route still ships napplet-gateway artifacts');
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
checkRetiredPlayground();
checkPaja();
checkDocs();

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`audit:pages FAILED - ${violation}`);
  }
  console.error(`\n[audit:pages] ${violations.length} violation(s)`);
  process.exit(1);
}

console.log('[audit:pages] OK - verified /web/, the retired /web/playground/ redirect, /web/paja/, /web/docs/, and TypeDoc output');
