import { createHash } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from 'node:path';
import { defineConfig, type Plugin, type UserConfig } from 'vite';
import { nip5aManifest } from '@napplet/vite-plugin';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { hexToBytes } from 'nostr-tools/utils';

const PLAYGROUND_MANIFEST_PRIVKEY_HEX = '11'.repeat(32);
const SHORT_NUB_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const SYNTHETIC_XTAG_PATHS = new Set(['config:schema', 'connect:origins']);
const HOSTED_SHELL_BOOTSTRAP = String.raw`
;(() => {
  const state = {
    capabilities: null,
    fallbackSupports: null,
  };

  const supports = (capability) => {
    if (typeof capability !== 'string') return false;
    const capabilities = state.capabilities;
    if (capabilities) {
      if (capability.startsWith('perm:')) {
        return Array.isArray(capabilities.sandbox) && capabilities.sandbox.includes(capability);
      }
      const nub = capability.startsWith('nub:') ? capability.slice(4) : capability;
      return Array.isArray(capabilities.nubs) && capabilities.nubs.includes(nub);
    }
    return typeof state.fallbackSupports === 'function'
      ? state.fallbackSupports(capability)
      : false;
  };

  const patchNapplet = (value) => {
    if (!value || typeof value !== 'object') return value;
    const napplet = value;
    const shell = napplet.shell && typeof napplet.shell === 'object'
      ? napplet.shell
      : {};
    if (typeof shell.supports === 'function' && shell.supports !== supports) {
      state.fallbackSupports = shell.supports.bind(shell);
    }
    shell.supports = supports;
    napplet.shell = shell;
    return napplet;
  };

  let currentNapplet = window.napplet;
  Object.defineProperty(window, 'napplet', {
    configurable: true,
    enumerable: true,
    get() {
      return currentNapplet;
    },
    set(value) {
      currentNapplet = patchNapplet(value);
    },
  });
  if (currentNapplet) currentNapplet = patchNapplet(currentNapplet);

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || typeof message !== 'object' || message.type !== 'shell.init') return;
    if (message.capabilities && typeof message.capabilities === 'object') {
      state.capabilities = message.capabilities;
      if (currentNapplet) currentNapplet = patchNapplet(currentNapplet);
    }
  });

  window.__kehtoHostedShellBootstrap = true;
  window.parent.postMessage({ type: 'shell.ready' }, '*');
})();`;

export interface PlaygroundNappletConfigOptions {
  requires?: readonly string[];
}

function validateRequires(nappletType: string, requires: readonly string[]): string[] {
  return requires.map((name) => {
    if (!SHORT_NUB_NAME_PATTERN.test(name) || name.startsWith('nub-')) {
      throw new Error(
        `${nappletType} manifest requires must use short NUB names, got "${name}"`,
      );
    }
    return name;
  });
}

function walkDir(dir: string, root = dir): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(path, root));
    } else {
      files.push(relative(root, path));
    }
  }
  return files;
}

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = re.exec(attrs);
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
}

function hasRel(attrs: string, token: string): boolean {
  const rel = getAttr(attrs, 'rel');
  return rel ? rel.split(/\s+/).includes(token) : false;
}

function isLocalAssetReference(reference: string): boolean {
  if (reference.length === 0) return false;
  if (reference.startsWith('#') || reference.startsWith('//')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference)) return false;
  return true;
}

function normalizeViteBase(base: string): string {
  if (base === '' || base === './') return '';
  if (!base.startsWith('/')) return base;
  return base.endsWith('/') ? base : `${base}/`;
}

function stripViteBase(reference: string, base: string): string {
  if (!reference.startsWith('/')) return reference.replace(/^\.\//, '');

  const rootRelative = reference.slice(1);
  const normalizedBase = normalizeViteBase(base);
  if (!normalizedBase.startsWith('/')) return rootRelative;

  const basePath = normalizedBase.slice(1);
  if (basePath.length > 0 && rootRelative.startsWith(basePath)) {
    return rootRelative.slice(basePath.length);
  }
  return rootRelative;
}

function resolveDistAsset(distPath: string, reference: string, base: string): string {
  const cleanReference = reference.split(/[?#]/, 1)[0];
  const relativePath = stripViteBase(cleanReference, base);
  const normalized = normalize(relativePath);
  if (
    normalized === '..' ||
    normalized.startsWith(`..${sep}`) ||
    isAbsolute(normalized)
  ) {
    throw new Error(
      `[playground-single-file] cannot inline asset outside dist/: ${reference}`,
    );
  }
  return join(distPath, normalized);
}

function stripAttrs(attrs: string, names: readonly string[]): string {
  let result = attrs;
  for (const name of names) {
    result = result.replace(
      new RegExp(`\\s*\\b${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'gi'),
      '',
    );
    result = result.replace(new RegExp(`\\s*\\b${name}\\b`, 'gi'), '');
  }
  return result.trim().replace(/\s+/g, ' ');
}

function escapeInlineScriptContent(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script');
}

function removeEmptyParentDirs(filePath: string, stopDir: string): void {
  let current = dirname(filePath);
  const root = resolve(stopDir);
  while (current.startsWith(root) && current !== root) {
    try {
      if (readdirSync(current).length > 0) return;
      rmdirSync(current);
      current = dirname(current);
    } catch {
      return;
    }
  }
}

function inlineSingleFileBuildAssets(html: string, distPath: string, base: string): string {
  const inlinedFiles = new Set<string>();
  let shellBootstrapInjected = html.includes('__kehtoHostedShellBootstrap');

  const withStyles = html.replace(/<link\b([^>]*?)>/gi, (tag, attrs: string) => {
    if (!hasRel(attrs, 'stylesheet')) return tag;
    const href = getAttr(attrs, 'href');
    if (!href || !isLocalAssetReference(href)) return tag;

    const assetPath = resolveDistAsset(distPath, href, base);
    if (!existsSync(assetPath)) {
      throw new Error(`[playground-single-file] missing stylesheet asset: ${href}`);
    }
    inlinedFiles.add(assetPath);
    return `<style>${readFileSync(assetPath, 'utf8')}</style>`;
  });

  const withScripts = withStyles.replace(
    /<script\b([^>]*)\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>\s*<\/script>/gi,
    (tag, before: string, srcDouble: string, srcSingle: string, srcBare: string, after: string) => {
      const src = (srcDouble ?? srcSingle ?? srcBare ?? '').trim();
      if (!isLocalAssetReference(src)) return tag;

      const assetPath = resolveDistAsset(distPath, src, base);
      if (!existsSync(assetPath)) {
        throw new Error(`[playground-single-file] missing script asset: ${src}`);
      }
      inlinedFiles.add(assetPath);

      const attrs = stripAttrs(`${before}${after}`, [
        'src',
        'crossorigin',
        'integrity',
        'async',
        'defer',
      ]);
      const attrText = attrs.length > 0 ? ` ${attrs}` : '';
      let script = readFileSync(assetPath, 'utf8');
      if (!shellBootstrapInjected) {
        script = `${HOSTED_SHELL_BOOTSTRAP}\n${script}`;
        shellBootstrapInjected = true;
      }
      script = escapeInlineScriptContent(script);
      return `<script${attrText}>${script}</script>`;
    },
  );

  for (const filePath of inlinedFiles) {
    rmSync(filePath, { force: true });
    removeEmptyParentDirs(filePath, distPath);
  }

  return withScripts;
}

function assertSingleFileArtifact(html: string, distPath: string): void {
  const violations: string[] = [];

  html.replace(/<link\b([^>]*?)>/gi, (tag, attrs: string) => {
    const href = getAttr(attrs, 'href');
    if (
      href &&
      isLocalAssetReference(href) &&
      (hasRel(attrs, 'stylesheet') || hasRel(attrs, 'modulepreload'))
    ) {
      violations.push(tag);
    }
    return tag;
  });

  html.replace(/<script\b([^>]*?)>/gi, (tag, attrs: string) => {
    const src = getAttr(attrs, 'src');
    if (src && isLocalAssetReference(src)) violations.push(tag);
    return tag;
  });

  for (const relativePath of walkDir(distPath)) {
    if (relativePath === 'index.html' || relativePath === '.nip5a-manifest.json') continue;
    violations.push(relativePath);
  }

  if (violations.length > 0) {
    throw new Error(
      `[playground-single-file] external gateway artifacts remain:\n${violations
        .map((violation) => `  - ${violation}`)
        .join('\n')}`,
    );
  }
}

function singleFileBuildConfig(config: UserConfig): UserConfig {
  const output = config.build?.rollupOptions?.output;
  const inlineOutput = (entry: unknown): Record<string, unknown> => ({
    ...(typeof entry === 'object' && entry !== null ? entry as Record<string, unknown> : {}),
    inlineDynamicImports: true,
  });

  return {
    build: {
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      cssCodeSplit: false,
      rollupOptions: {
        output: Array.isArray(output)
          ? output.map((entry) => inlineOutput(entry))
          : inlineOutput(output),
      },
    },
  };
}

function sha256Bytes(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function computeAggregateHash(xTags: Array<[string, string]>): string {
  const lines = xTags.map(([hash, path]) => `${hash} ${path}\n`);
  lines.sort();
  return sha256Bytes(lines.join(''));
}

function resetAggregateHashMeta(html: string): string {
  return html.replace(
    /<meta name="napplet-aggregate-hash" content="[^"]*">/,
    '<meta name="napplet-aggregate-hash" content="">',
  );
}

function injectAggregateHashMeta(html: string, aggregateHash: string): string {
  return html.replace(
    /<meta name="napplet-aggregate-hash" content="[^"]*">/,
    `<meta name="napplet-aggregate-hash" content="${aggregateHash}">`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForPublishedManifest(distPath: string): Promise<void> {
  const manifestPath = join(distPath, '.nip5a-manifest.json');
  const indexPath = join(distPath, 'index.html');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(manifestPath) && existsSync(indexPath)) {
      const html = readFileSync(indexPath, 'utf8');
      if (/<meta name="napplet-aggregate-hash" content="[a-f0-9]{64}">/.test(html)) {
        return;
      }
    }
    await sleep(20);
  }
  throw new Error('[playground-single-file] timed out waiting for published manifest plugin output');
}

function recomputeManifest(distPath: string, inlinedHtml: string): void {
  const manifestPath = join(distPath, '.nip5a-manifest.json');
  if (!existsSync(manifestPath)) return;

  const existing = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    created_at?: number;
    content?: string;
    tags?: unknown;
  };
  const existingTags = Array.isArray(existing.tags) ? existing.tags : [];
  const retainedTags = existingTags.filter(
    (tag): tag is string[] =>
      Array.isArray(tag) &&
      typeof tag[0] === 'string' &&
      tag[0] !== 'd' &&
      tag[0] !== 'x',
  );
  const dTag = existingTags.find(
    (tag): tag is string[] =>
      Array.isArray(tag) && tag[0] === 'd' && typeof tag[1] === 'string',
  )?.[1];
  if (!dTag) {
    throw new Error('[playground-single-file] existing manifest is missing a d tag');
  }

  const htmlForHash = resetAggregateHashMeta(inlinedHtml);
  writeFileSync(join(distPath, 'index.html'), htmlForHash);

  const xTags: Array<[string, string]> = [];
  for (const relativePath of walkDir(distPath)) {
    if (relativePath === '.nip5a-manifest.json') continue;
    const filePath = join(distPath, relativePath);
    const hash = relativePath === 'index.html'
      ? sha256Bytes(htmlForHash)
      : sha256Bytes(readFileSync(filePath));
    xTags.push([hash, relativePath]);
  }

  const configTag = retainedTags.find((tag) => tag[0] === 'config' && typeof tag[1] === 'string');
  if (configTag?.[1]) {
    xTags.push([sha256Bytes(configTag[1]), 'config:schema']);
  }

  const connectOrigins = retainedTags
    .filter((tag) => tag[0] === 'connect' && typeof tag[1] === 'string')
    .map((tag) => tag[1])
    .sort();
  if (connectOrigins.length > 0) {
    xTags.push([sha256Bytes(connectOrigins.join('\n')), 'connect:origins']);
  }

  const aggregateHash = computeAggregateHash(xTags);
  const manifestXTags = xTags
    .filter(([, path]) => !SYNTHETIC_XTAG_PATHS.has(path))
    .map(([hash, path]) => ['x', hash, path]);
  const tags = [['d', dTag], ...manifestXTags, ...retainedTags];
  const event = {
    kind: 35128,
    created_at: existing.created_at ?? Math.floor(Date.now() / 1e3),
    tags,
    content: existing.content ?? '',
  };
  const privkeyBytes = hexToBytes(process.env.VITE_DEV_PRIVKEY_HEX ?? PLAYGROUND_MANIFEST_PRIVKEY_HEX);
  const signedEvent = finalizeEvent(event, privkeyBytes);
  const pubkey = getPublicKey(privkeyBytes);
  writeFileSync(
    manifestPath,
    JSON.stringify({ ...signedEvent, aggregateHash, pubkey }, null, 2),
  );
  writeFileSync(join(distPath, 'index.html'), injectAggregateHashMeta(htmlForHash, aggregateHash));
}

function playgroundSingleFileArtifact(): Plugin {
  let outDir = 'dist';
  let root = process.cwd();
  let base = './';

  return {
    name: 'playground-single-file-artifact',
    apply: 'build',
    config(config) {
      return singleFileBuildConfig(config);
    },
    configResolved(config) {
      root = config.root;
      outDir = config.build.outDir;
      base = config.base;
    },
    writeBundle() {
      const distPath = isAbsolute(outDir) ? outDir : resolve(root, outDir);
      rmSync(join(distPath, '.nip5a-manifest.json'), { force: true });
    },
    async closeBundle() {
      const distPath = isAbsolute(outDir) ? outDir : resolve(root, outDir);
      const indexPath = join(distPath, 'index.html');
      if (!existsSync(indexPath) || !statSync(indexPath).isFile()) return;

      await waitForPublishedManifest(distPath);
      const html = readFileSync(indexPath, 'utf8');
      const inlinedHtml = inlineSingleFileBuildAssets(html, distPath, base);
      assertSingleFileArtifact(inlinedHtml, distPath);
      recomputeManifest(distPath, inlinedHtml);
      console.log('[playground-single-file] inlined gateway artifact');
    },
  };
}

export function definePlaygroundNappletConfig(
  nappletType: string,
  options: PlaygroundNappletConfigOptions = {},
) {
  process.env.VITE_DEV_PRIVKEY_HEX ??= PLAYGROUND_MANIFEST_PRIVKEY_HEX;
  const requires = validateRequires(nappletType, options.requires ?? []);

  return defineConfig({
    base: './',
    plugins: [
      nip5aManifest({
        nappletType,
        artifactMode: 'single-file',
        requires,
      }),
      playgroundSingleFileArtifact(),
    ],
    build: {
      outDir: 'dist',
      emptyDirBeforeWrite: true,
    },
  });
}
