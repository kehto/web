#!/usr/bin/env node
/**
 * scripts/audit-gateway-artifacts.mjs -- gateway artifact drift guard.
 *
 * Enforces the playground's production-equivalent NIP-5A gateway invariant:
 * each built demo napplet must expose exactly one served HTML artifact plus
 * its manifest metadata, and the active shell loader must keep opaque-origin
 * iframes on /napplet-gateway/<dTag>/<aggregateHash>/index.html.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const nappletsDir = join(repoRoot, 'apps', 'playground', 'napplets');

const LOCAL_SCRIPT_SRC_RE = /<script\b[^>]*\bsrc\s*=/i;
const LOCAL_STYLESHEET_RE = /<link\b[^>]*\brel\s*=\s*["'][^"']*\bstylesheet\b/i;
const LOCAL_MODULEPRELOAD_RE = /<link\b[^>]*\brel\s*=\s*["'][^"']*\bmodulepreload\b/i;

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

function assertSourceInvariants() {
  const shellHost = read(join(repoRoot, 'apps', 'playground', 'src', 'shell-host.ts'));
  if (!shellHost.includes('/napplet-gateway/${encodeURIComponent(name)}/manifest.json')) {
    fail('shell-host.ts does not fetch gateway manifest metadata');
  }
  if (!shellHost.includes('iframe.src = metadata.htmlUrl')) {
    fail('shell-host.ts does not navigate iframes with gateway metadata htmlUrl');
  }
  if (!shellHost.includes("iframe.sandbox.add('allow-scripts')")) {
    fail("shell-host.ts does not explicitly add sandbox allow-scripts");
  }
  if (shellHost.includes('allow-same-origin')) {
    fail('shell-host.ts contains allow-same-origin; gateway napplets must stay opaque-origin');
  }
  if (shellHost.includes('`/napplets/${name}/index.html`')) {
    fail('shell-host.ts contains the legacy active /napplets iframe URL');
  }
}

function nappletNames() {
  if (!existsSync(nappletsDir)) {
    fail(`napplet directory not found: ${rel(nappletsDir)}`);
    return [];
  }
  return readdirSync(nappletsDir)
    .filter((name) => statSync(join(nappletsDir, name)).isDirectory())
    .sort();
}

function assertBuildConfig(name) {
  const configPath = join(nappletsDir, name, 'vite.config.ts');
  if (!existsSync(configPath)) {
    fail(`${rel(configPath)} missing`);
    return;
  }
  const config = read(configPath);
  if (!config.includes("import { definePlaygroundNappletConfig } from '../shared-vite-config';")) {
    fail(`${rel(configPath)} does not import shared-vite-config`);
  }
  const dTagPattern = new RegExp(
    `export\\s+default\\s+definePlaygroundNappletConfig\\(\\s*['"]${name}['"]\\s*(?:,|\\))`,
  );
  if (!dTagPattern.test(config)) {
    fail(`${rel(configPath)} does not use route-aligned dTag '${name}'`);
  }
}

function assertDist(name) {
  const dist = join(nappletsDir, name, 'dist');
  const indexPath = join(dist, 'index.html');
  const manifestPath = join(dist, '.nip5a-manifest.json');

  if (!existsSync(dist)) {
    fail(`${rel(dist)} missing; run pnpm build before audit`);
    return;
  }
  if (!existsSync(indexPath)) fail(`${rel(indexPath)} missing`);
  if (!existsSync(manifestPath)) fail(`${rel(manifestPath)} missing`);
  if (!existsSync(indexPath) || !existsSync(manifestPath)) return;

  const files = readdirSync(dist).sort();
  const extras = files.filter((file) => file !== 'index.html' && file !== '.nip5a-manifest.json');
  if (extras.length > 0) {
    fail(`${rel(dist)} contains extra files: ${extras.join(', ')}`);
  }

  const html = read(indexPath);
  if (LOCAL_SCRIPT_SRC_RE.test(html)) {
    fail(`${rel(indexPath)} contains external script src`);
  }
  if (LOCAL_STYLESHEET_RE.test(html)) {
    fail(`${rel(indexPath)} contains external stylesheet link`);
  }
  if (LOCAL_MODULEPRELOAD_RE.test(html)) {
    fail(`${rel(indexPath)} contains modulepreload link`);
  }

  const manifest = JSON.parse(read(manifestPath));
  const aggregateHash = manifest.aggregateHash;
  if (typeof aggregateHash !== 'string' || !/^[a-f0-9]{64}$/.test(aggregateHash)) {
    fail(`${rel(manifestPath)} has invalid aggregateHash`);
  }
  const dTag = Array.isArray(manifest.tags)
    ? manifest.tags.find((tag) => Array.isArray(tag) && tag[0] === 'd')?.[1]
    : undefined;
  if (dTag !== name) {
    fail(`${rel(manifestPath)} d tag mismatch: expected ${name}, got ${dTag ?? '(missing)'}`);
  }
}

assertSourceInvariants();

const names = nappletNames();
for (const name of names) {
  assertBuildConfig(name);
  assertDist(name);
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`audit:gateway-artifacts FAILED — ${violation}`);
  }
  console.error(`\n[audit:gateway-artifacts] ${violations.length} violation(s)`);
  process.exit(1);
}

console.log(`[audit:gateway-artifacts] OK — checked ${names.length} napplet gateway artifact(s)`);
process.exit(0);
