#!/usr/bin/env node
/**
 * Build a static GitHub Pages artifact for the playground.
 *
 * The local playground gateway is Vite middleware. GitHub Pages is static, so
 * this script materializes the artifact paths that back the public routes:
 *
 *   /web/playground/napplet-gateway/<dTag>/manifest.json
 *   /web/playground/napplet-gateway/<dTag>/<aggregateHash>/index.html
 *
 * For the kehto/web project site, GitHub Pages maps .pages/ to /web/, so the
 * default artifact output directory is .pages/playground.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const playgroundDist = join(repoRoot, 'apps', 'playground', 'dist');
const nappletsDir = join(repoRoot, 'apps', 'playground', 'napplets');
const outputDir = resolve(
  repoRoot,
  process.env.PLAYGROUND_PAGES_OUT_DIR || '.pages/playground',
);

const SHORT_NUB_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function rel(path) {
  return relative(repoRoot, path);
}

function normalizeBasePath(value) {
  const raw = String(value || '/').trim() || '/';
  if (raw === './') return raw;
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

const pagesBasePath = normalizeBasePath(process.env.PLAYGROUND_BASE_PATH || '/web/playground/');

function withPagesBasePath(pathname) {
  const cleanPath = pathname.replace(/^\/+/, '');
  if (pagesBasePath === './') return cleanPath;
  return `${pagesBasePath}${cleanPath}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ensureFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${label} missing: ${rel(path)}`);
  }
}

function nappletNames() {
  if (!existsSync(nappletsDir)) {
    throw new Error(`napplet directory missing: ${rel(nappletsDir)}`);
  }
  return readdirSync(nappletsDir)
    .filter((name) => statSync(join(nappletsDir, name)).isDirectory())
    .sort();
}

function extractDTag(manifest, expectedName, manifestPath) {
  const dTag = Array.isArray(manifest.tags)
    ? manifest.tags.find((tag) => Array.isArray(tag) && tag[0] === 'd')?.[1]
    : undefined;
  if (dTag !== expectedName) {
    throw new Error(
      `${rel(manifestPath)} d tag mismatch: expected ${expectedName}, got ${dTag || '(missing)'}`,
    );
  }
  return dTag;
}

function extractRequires(manifest, manifestPath) {
  if (!Array.isArray(manifest.tags)) return [];
  return manifest.tags
    .filter((tag) => Array.isArray(tag) && tag[0] === 'requires')
    .map((tag) => tag[1])
    .map((name) => {
      if (typeof name !== 'string' || !SHORT_NUB_NAME_PATTERN.test(name)) {
        throw new Error(`${rel(manifestPath)} has invalid requires tag: ${String(name)}`);
      }
      return name;
    });
}

function assertPlaygroundBuildUsesBase() {
  const indexPath = join(playgroundDist, 'index.html');
  ensureFile(indexPath, 'playground build index');

  if (pagesBasePath === '/' || pagesBasePath === './') return;
  const indexHtml = readFileSync(indexPath, 'utf8');
  if (!indexHtml.includes(`${pagesBasePath}assets/`)) {
    throw new Error(
      `playground dist was not built for PLAYGROUND_BASE_PATH=${pagesBasePath}; ` +
      're-run pnpm build with the same PLAYGROUND_BASE_PATH before packing Pages',
    );
  }
}

function copyPlaygroundDist() {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(dirname(outputDir), { recursive: true });
  cpSync(playgroundDist, outputDir, { recursive: true });
  writeFileSync(join(outputDir, '.nojekyll'), '');
}

function materializeGatewayRoute(name) {
  const dist = join(nappletsDir, name, 'dist');
  const sourceHtmlPath = join(dist, 'index.html');
  const manifestPath = join(dist, '.nip5a-manifest.json');

  ensureFile(sourceHtmlPath, `${name} napplet gateway HTML`);
  ensureFile(manifestPath, `${name} napplet manifest`);

  const manifest = readJson(manifestPath);
  const aggregateHash = manifest.aggregateHash;
  if (typeof aggregateHash !== 'string' || !/^[a-f0-9]{64}$/.test(aggregateHash)) {
    throw new Error(`${rel(manifestPath)} has invalid aggregateHash`);
  }

  const dTag = extractDTag(manifest, name, manifestPath);
  const metadata = {
    dTag,
    aggregateHash,
    requires: extractRequires(manifest, manifestPath),
    htmlUrl: withPagesBasePath(
      `/napplet-gateway/${encodeURIComponent(dTag)}/${aggregateHash}/index.html`,
    ),
  };

  const gatewayRoot = join(outputDir, 'napplet-gateway', dTag);
  const htmlRoute = join(gatewayRoot, aggregateHash, 'index.html');
  mkdirSync(dirname(htmlRoute), { recursive: true });
  cpSync(sourceHtmlPath, htmlRoute);
  writeFileSync(
    join(gatewayRoot, 'manifest.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
}

assertPlaygroundBuildUsesBase();
copyPlaygroundDist();

const names = nappletNames();
for (const name of names) {
  materializeGatewayRoute(name);
}

console.log(
  `[build:playground-pages] OK - wrote ${rel(outputDir)} with ${names.length} gateway napplet(s), ` +
  `base ${pagesBasePath}`,
);
