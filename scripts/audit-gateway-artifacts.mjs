#!/usr/bin/env node
/**
 * scripts/audit-gateway-artifacts.mjs -- napplet artifact drift guard.
 *
 * Enforces the playground's NIP-5D content-addressed srcdoc invariant: each
 * built demo napplet must emit exactly one self-contained /index.html (plus its
 * signed NIP-5A manifest) with no external assets, and the shell loader must
 * resolve + verify the bytes and inject them via iframe.srcdoc on an opaque
 * origin — never the retired gateway htmlUrl/metadata navigation.
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

const rel = relative.bind(null, repoRoot);

function fail(message) {
  violations.push(message);
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function assertSourceInvariants() {
  const shellHost = read(join(repoRoot, 'apps', 'playground', 'src', 'shell-host.ts'));
  // NIP-5D content-addressed srcdoc loading (v1.20): the runtime resolves a
  // signed manifest, verifies the bytes, computes identity, and injects the
  // verified bytes via iframe.srcdoc. The gateway htmlUrl/metadata navigation
  // model is retired and the gateway is never trusted.
  if (!shellHost.includes('iframe.srcdoc =') || !shellHost.includes('injectCspMeta(')) {
    fail('shell-host.ts does not inject verified bytes via iframe.srcdoc');
  }
  if (!shellHost.includes('originRegistry.register(iframe.contentWindow, windowId, { dTag, aggregateHash });')) {
    fail('shell-host.ts does not register creation-time computed identity');
  }
  if (
    !shellHost.includes("(event.data as NappletMessage).type === 'shell.ready'")
    || !shellHost.includes('markEnvelopeIdentityBinding(windowId);')
  ) {
    fail('shell-host.ts does not bind computed identity after shell.ready');
  }
  if (shellHost.includes('iframe.src = metadata.htmlUrl') || shellHost.includes('/napplet-gateway/')) {
    fail('shell-host.ts still uses the retired gateway htmlUrl/metadata navigation');
  }
  if (!shellHost.includes("iframe.sandbox.add('allow-scripts')")) {
    fail("shell-host.ts does not explicitly add sandbox allow-scripts");
  }
  if (shellHost.includes('allow-same-origin')) {
    fail('shell-host.ts contains allow-same-origin; napplets must stay opaque-origin');
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
  if (!html.includes('__kehtoHostedShellBootstrap')) {
    fail(`${rel(indexPath)} missing hosted shell bootstrap marker`);
  }
  // NAP-SHELL is runtime-owned. The verified artifact need not bundle a shim:
  // Kehto prepends the mandatory receiver and handshake outside these bytes.
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
