import { defineConfig, type Plugin } from 'vite';
import UnoCSS from 'unocss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { finalizeEvent } from 'nostr-tools/pure';
import type { IncomingMessage, ServerResponse } from 'node:http';

const nappletDirs = path.resolve(__dirname, 'napplets');

const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveNappletFile(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const urlPath = (req.url?.split('?')[0] || '').replace(/^\//, '');
  const parts = urlPath.split('/').filter(Boolean);
  if (parts.length < 1) { next(); return; }

  const nappletName = parts[0];
  const filePath = parts.slice(1).join('/') || 'index.html';
  const fullPath = path.join(nappletDirs, nappletName, 'dist', filePath);

  if (fs.existsSync(fullPath)) {
    const ext = path.extname(fullPath);
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    fs.createReadStream(fullPath).pipe(res);
  } else {
    next();
  }
}

interface GatewayMetadata {
  dTag: string;
  aggregateHash: string;
  htmlUrl: string;
  requires: string[];
}

interface NappletManifest {
  aggregateHash?: unknown;
  tags?: unknown;
}

function normalizePlaygroundBasePath(value: string | undefined): string {
  const raw = value?.trim() || '/';
  if (raw === './') return raw;
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

const playgroundBasePath = normalizePlaygroundBasePath(process.env.PLAYGROUND_BASE_PATH);

function withPlaygroundBasePath(pathname: string): string {
  const cleanPath = pathname.replace(/^\/+/, '');
  if (playgroundBasePath === './') return cleanPath;
  return `${playgroundBasePath}${cleanPath}`;
}

function sendText(res: ServerResponse, statusCode: number, body: string): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain');
  res.end(body);
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function decodePathSegment(segment: string | undefined): string | null {
  if (!segment) return null;
  try {
    const decoded = decodeURIComponent(segment);
    return /^[a-z0-9-]+$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function readGatewayMetadata(dTag: string): GatewayMetadata {
  const manifestPath = path.join(nappletDirs, dTag, 'dist', '.nip5a-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest not found for ${dTag}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as NappletManifest;
  if (typeof manifest.aggregateHash !== 'string' || manifest.aggregateHash.length === 0) {
    throw new Error(`manifest for ${dTag} does not include aggregateHash`);
  }

  const tags = Array.isArray(manifest.tags) ? manifest.tags : [];
  const manifestDTag = tags.find(
    (tag): tag is string[] =>
      Array.isArray(tag) &&
      tag[0] === 'd' &&
      typeof tag[1] === 'string',
  )?.[1];
  if (manifestDTag !== dTag) {
    throw new Error(`manifest d tag mismatch for ${dTag}: got ${manifestDTag ?? '(missing)'}`);
  }

  const aggregateHash = manifest.aggregateHash;
  const requires = tags
    .filter(
      (tag): tag is string[] =>
        Array.isArray(tag) &&
        tag[0] === 'requires' &&
        typeof tag[1] === 'string' &&
        tag[1].length > 0,
    )
    .map((tag) => tag[1]);
  return {
    dTag,
    aggregateHash,
    requires,
    htmlUrl: withPlaygroundBasePath(
      `/napplet-gateway/${encodeURIComponent(dTag)}/${aggregateHash}/index.html`,
    ),
  };
}

function serveGateway(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const urlPath = (req.url?.split('?')[0] || '').replace(/^\//, '');
  const parts = urlPath.split('/').filter(Boolean);
  const dTag = decodePathSegment(parts[0]);
  if (!dTag) {
    next();
    return;
  }

  if (parts.length === 2 && parts[1] === 'manifest.json') {
    try {
      sendJson(res, 200, readGatewayMetadata(dTag));
    } catch (err) {
      sendText(res, 404, err instanceof Error ? err.message : String(err));
    }
    return;
  }

  const requestedHash = parts[1];
  const isIndex =
    parts.length === 2 ||
    (parts.length === 3 && parts[2] === 'index.html');
  if (!requestedHash || !isIndex) {
    next();
    return;
  }

  try {
    const metadata = readGatewayMetadata(dTag);
    if (requestedHash !== metadata.aggregateHash) {
      sendText(res, 404, `aggregateHash mismatch for ${dTag}`);
      return;
    }

    const indexPath = path.join(nappletDirs, dTag, 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) {
      sendText(res, 404, `index.html not found for ${dTag}`);
      return;
    }

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('X-Napplet-DTag', metadata.dTag);
    res.setHeader('X-Napplet-Aggregate-Hash', metadata.aggregateHash);
    fs.createReadStream(indexPath).pipe(res);
  } catch (err) {
    sendText(res, 404, err instanceof Error ? err.message : String(err));
  }
}

/**
 * Vite plugin to serve pre-built demo napplets at /napplets/{name}/
 * Same pattern as tests/e2e/harness/vite.config.ts serveNapplets plugin.
 */
function serveDemoNapplets(): Plugin {
  return {
    name: 'serve-demo-napplets',
    configureServer(server) {
      server.middlewares.use('/napplets', serveNappletFile);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/napplets', serveNappletFile);
    },
  };
}

function serveNappletGateway(): Plugin {
  return {
    name: 'serve-napplet-gateway',
    configureServer(server) {
      server.middlewares.use('/napplet-gateway', serveGateway);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/napplet-gateway', serveGateway);
    },
  };
}

// ---------------------------------------------------------------------------
// NIP-5D content-addressed resolution simulation (dev + preview).
//
// Models the production path the runtime resolver expects: relays serve the
// signed manifest event + the author's NIP-65 relay list; Blossom serves blobs
// by sha256. The runtime verifies everything (signature, aggregate, blob hashes)
// — this sim is never trusted. Static GitHub Pages gets equivalent files from
// scripts/build-playground-pages.mjs.
// ---------------------------------------------------------------------------

const DEV_MANIFEST_PRIVKEY_HEX = '11'.repeat(32);

function hexToBytesNode(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));
}

let cachedRelayListEvent: unknown;
function relayListEvent(): unknown {
  if (cachedRelayListEvent) return cachedRelayListEvent;
  // Relative `r` tag → the shell resolves it base-aware via playgroundPath, so
  // the same sim works in preview ('/') and under the Pages base.
  const event = finalizeEvent(
    {
      kind: 10002,
      created_at: 1_700_000_000,
      tags: [['r', `${playgroundBasePath}napplet-relay/event`, 'write']],
      content: '',
    },
    hexToBytesNode(DEV_MANIFEST_PRIVKEY_HEX),
  );
  cachedRelayListEvent = event;
  return event;
}

// Blob bytes are cached in memory (keyed by sha256) so the hot request path does
// no synchronous file I/O — important because the dev server is single-threaded
// and a demo boot resolves 9 napplets concurrently across parallel test workers.
let blossomBytes: Map<string, Buffer> | null = null;
function buildBlossomCache(): Map<string, Buffer> {
  const cache = new Map<string, Buffer>();
  if (fs.existsSync(nappletDirs)) {
    for (const name of fs.readdirSync(nappletDirs)) {
      const dist = path.join(nappletDirs, name, 'dist');
      if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) continue;
      for (const file of walkFiles(dist)) {
        if (file.endsWith('.nip5a-manifest.json')) continue;
        const bytes = fs.readFileSync(file);
        const hash = createHash('sha256').update(bytes).digest('hex');
        if (!cache.has(hash)) cache.set(hash, bytes);
      }
    }
  }
  return cache;
}
function blossomBlob(sha256: string): Buffer | null {
  // Build once; rebuild at most once on a miss so a dev rebuild is picked up.
  if (!blossomBytes) blossomBytes = buildBlossomCache();
  let hit = blossomBytes.get(sha256);
  if (!hit) {
    blossomBytes = buildBlossomCache();
    hit = blossomBytes.get(sha256);
  }
  return hit ?? null;
}

const manifestEventCache = new Map<string, Buffer | null>();
function manifestEventBytes(dTag: string): Buffer | null {
  if (manifestEventCache.has(dTag)) return manifestEventCache.get(dTag) ?? null;
  const manifestPath = path.join(nappletDirs, dTag, 'dist', '.nip5a-manifest.json');
  const bytes = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath) : null;
  manifestEventCache.set(dTag, bytes);
  return bytes;
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

// Send a buffered response that cannot crash the preview server when a client
// aborts an in-flight fetch (common with the demo's double `goto('/')`): swallow
// socket errors and never write to a closed/finished response.
function safeSend(
  res: ServerResponse,
  status: number,
  contentType: string,
  body: string | Buffer,
): void {
  res.on('error', () => { /* client aborted — ignore */ });
  if (res.writableEnded || res.destroyed || res.headersSent) return;
  try {
    res.statusCode = status;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(body);
  } catch {
    /* socket closed mid-write — ignore */
  }
}

function serveResolutionSim(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  req.on('error', () => { /* client aborted — ignore */ });
  const urlPath = (req.url?.split('?')[0] || '').replace(/^\//, '');
  const parts = urlPath.split('/').filter(Boolean);
  // /napplet-relay/relay-list/<author> → kind-10002 NIP-65 relay list
  if (parts[0] === 'relay-list') {
    safeSend(res, 200, 'application/json', JSON.stringify(relayListEvent()));
    return;
  }
  // /napplet-relay/event/<dTag> → signed kind-35129 manifest event
  if (parts[0] === 'event') {
    const dTag = decodePathSegment(parts[1]);
    if (!dTag) { next(); return; }
    const bytes = manifestEventBytes(dTag);
    if (!bytes) { safeSend(res, 404, 'text/plain', `no manifest for ${dTag}`); return; }
    safeSend(res, 200, 'application/json', bytes);
    return;
  }
  next();
}

function serveBlossom(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  req.on('error', () => { /* client aborted — ignore */ });
  const urlPath = (req.url?.split('?')[0] || '').replace(/^\//, '');
  const sha256 = urlPath.split('/').filter(Boolean)[0];
  if (!sha256 || !/^[a-f0-9]{64}$/.test(sha256)) { next(); return; }
  const bytes = blossomBlob(sha256);
  if (!bytes) { safeSend(res, 404, 'text/plain', `no blob ${sha256}`); return; }
  safeSend(res, 200, 'application/octet-stream', bytes);
}

function serveResolutionSimPlugin(): Plugin {
  return {
    name: 'serve-napplet-resolution-sim',
    configureServer(server) {
      server.middlewares.use('/napplet-relay', serveResolutionSim);
      server.middlewares.use('/napplet-blossom', serveBlossom);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/napplet-relay', serveResolutionSim);
      server.middlewares.use('/napplet-blossom', serveBlossom);
    },
  };
}

export default defineConfig({
  root: __dirname,
  base: playgroundBasePath,
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'window',
      },
    },
  },
  plugins: [
    UnoCSS(),
    serveResolutionSimPlugin(), // NIP-5D relays + Blossom simulation
    serveNappletGateway(),
    serveDemoNapplets(),
  ],
  server: {
    port: 5174,
    strictPort: false,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  build: {
    outDir: 'dist',
    emptyDirBeforeWrite: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
});
