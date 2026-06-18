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
const SHORT_NAP_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
// NIP-5D named napplet manifest kind (branch-HEAD: 35129 named / 15129 root / 5129 snapshot).
const NAPPLET_MANIFEST_KIND = 35129;
// Hosted-shell bootstrap marker + handshake nudge.
//
// The real @napplet/shim@0.13 now natively owns capability resolution: on
// `shell.init` it sets `window.napplet.shell.supports = makeSupports(env)` from
// the conformant `capabilities.{domains,protocols}` shape the @kehto shell emits,
// and it auto-posts `{type:'shell.ready'}` on load. The previous hand-rolled
// `supports()` override (which read a flat capabilities array and
// clobbered the shim's `shell.supports`) is therefore redundant and was removed —
// it must NOT overwrite the shim's correct resolver.
//
// What remains is intentionally minimal: set the `__kehtoHostedShellBootstrap`
// marker (the playground host + single-file artifact tests assert it is injected)
// and post `shell.ready`. The shim also posts `shell.ready`; per SHELL-01 the
// runtime treats a duplicate `shell.ready` from the same window as idempotent
// (one `shell.init`), so both posts are safe.
const HOSTED_SHELL_BOOTSTRAP = String.raw`
;(() => {
  window.__kehtoHostedShellBootstrap = true;
  window.parent.postMessage({ type: 'shell.ready' }, '*');
})();`;

/** An archetype the napplet fulfills, optionally with its recommended NAP-N protocol. */
export interface PlaygroundArchetype {
  slug: string;
  nap?: string;
}

export interface PlaygroundNappletConfigOptions {
  requires?: readonly string[];
  archetypes?: ReadonlyArray<PlaygroundArchetype>;
}

const NAP_PROTOCOL_PATTERN = /^NAP-\d+$/;

function validateRequires(nappletType: string, requires: readonly string[]): string[] {
  return requires.map((name) => {
    if (!SHORT_NAP_NAME_PATTERN.test(name) || name.startsWith('nap-')) {
      throw new Error(
        `${nappletType} manifest requires must use short NAP names, got "${name}"`,
      );
    }
    return name;
  });
}

function validateArchetypes(
  nappletType: string,
  archetypes: ReadonlyArray<PlaygroundArchetype>,
): PlaygroundArchetype[] {
  return archetypes.map(({ slug, nap }) => {
    if (!SHORT_NAP_NAME_PATTERN.test(slug) || slug.startsWith('nap-')) {
      throw new Error(
        `${nappletType} manifest archetype slug must be a short NAP name, got "${slug}"`,
      );
    }
    if (nap !== undefined && !NAP_PROTOCOL_PATTERN.test(nap)) {
      throw new Error(
        `${nappletType} manifest archetype "${slug}" nap must match NAP-<n>, got "${nap}"`,
      );
    }
    return nap === undefined ? { slug } : { slug, nap };
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

// NIP-5A aggregate hash: per published file the line `"<sha256> <abs-path>\n"`,
// sorted ascending, concatenated UTF-8, SHA-256 → lowercase hex.
function computeAggregateHash(pathEntries: Array<[string, string]>): string {
  const lines = pathEntries.map(([absPath, hash]) => `${hash} ${absPath}\n`);
  lines.sort();
  return sha256Bytes(lines.join(''));
}

function resetAggregateHashMeta(html: string): string {
  return html.replace(
    /<meta name="napplet-aggregate-hash" content="[^"]*">/,
    '<meta name="napplet-aggregate-hash" content="">',
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForPublishedManifest(distPath: string): Promise<void> {
  const manifestPath = join(distPath, '.nip5a-manifest.json');
  const indexPath = join(distPath, 'index.html');
  // @napplet/vite-plugin >=0.8 no longer injects a `napplet-aggregate-hash`
  // <meta> into the served HTML (a self-contained file cannot reference its own
  // hash; the aggregate now lives in the manifest `x` tag). The signed
  // `.nip5a-manifest.json` written by the upstream plugin's `closeBundle` is the
  // readiness signal — this plugin's `closeBundle` is `order: 'post'`, so the
  // manifest already exists when we run, but we poll briefly to stay robust.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(manifestPath) && existsSync(indexPath)) {
      return;
    }
    await sleep(20);
  }
  throw new Error('[playground-single-file] timed out waiting for published manifest plugin output');
}

function recomputeManifest(
  distPath: string,
  inlinedHtml: string,
  archetypes: ReadonlyArray<PlaygroundArchetype> = [],
): void {
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
      tag[0] !== 'x' &&
      tag[0] !== 'path',
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

  // NIP-5A: the aggregate covers `path` tags only — the real published files,
  // each at its absolute path. The served bytes are exactly the bytes that hash
  // to the `path` tag (no aggregate-hash <meta> rewrite), so a content-addressed
  // runtime can fetch each blob by hash and verify it.
  const pathEntries: Array<[string, string]> = []; // [absPath, sha256]
  for (const relativePath of walkDir(distPath)) {
    if (relativePath === '.nip5a-manifest.json') continue;
    const filePath = join(distPath, relativePath);
    const hash = relativePath === 'index.html'
      ? sha256Bytes(htmlForHash)
      : sha256Bytes(readFileSync(filePath));
    pathEntries.push([`/${relativePath.split(sep).join('/')}`, hash]);
  }

  const aggregateHash = computeAggregateHash(pathEntries);
  const pathTags = pathEntries.map(([absPath, hash]) => ['path', absPath, hash]);
  // Upstream @napplet/vite-plugin 0.4.0 does NOT emit `archetype` tags, so the
  // playground injects them here from the validated config. They are not d/x/path,
  // so any re-parse retains them; `retainedTags` is filtered to avoid duplicates.
  const archetypeTags = archetypes.map((a) =>
    a.nap ? ['archetype', a.slug, a.nap] : ['archetype', a.slug],
  );
  const tags = [
    ['d', dTag],
    ...pathTags,
    ['x', aggregateHash, 'aggregate'],
    ...retainedTags.filter((tag) => tag[0] !== 'archetype'),
    ...archetypeTags,
  ];
  const event = {
    kind: NAPPLET_MANIFEST_KIND,
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
}

function playgroundSingleFileArtifact(
  archetypes: ReadonlyArray<PlaygroundArchetype> = [],
): Plugin {
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
    closeBundle: {
      order: 'post',
      async handler() {
        const distPath = isAbsolute(outDir) ? outDir : resolve(root, outDir);
        const indexPath = join(distPath, 'index.html');
        if (!existsSync(indexPath) || !statSync(indexPath).isFile()) return;

        await waitForPublishedManifest(distPath);
        const html = readFileSync(indexPath, 'utf8');
        const inlinedHtml = inlineSingleFileBuildAssets(html, distPath, base);
        assertSingleFileArtifact(inlinedHtml, distPath);
        recomputeManifest(distPath, inlinedHtml, archetypes);
      },
    },
  };
}

export function definePlaygroundNappletConfig(
  nappletType: string,
  options: PlaygroundNappletConfigOptions = {},
) {
  process.env.VITE_DEV_PRIVKEY_HEX ??= PLAYGROUND_MANIFEST_PRIVKEY_HEX;
  const requires = validateRequires(nappletType, options.requires ?? []);
  const archetypes = validateArchetypes(nappletType, options.archetypes ?? []);

  return defineConfig({
    base: './',
    plugins: [
      playgroundSingleFileArtifact(archetypes),
      nip5aManifest({
        nappletType,
        // Let the upstream plugin validate and sign Vite's normal external-asset
        // graph first. The playground plugin below owns the final single-file
        // rewrite because it also injects the hosted-shell bootstrap and
        // recomputes the manifest over those bytes.
        artifactMode: 'external-assets',
        requires,
      }),
    ],
    build: {
      outDir: 'dist',
      emptyDirBeforeWrite: true,
    },
  });
}
