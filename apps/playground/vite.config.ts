import { defineConfig, type Plugin } from 'vite';
import UnoCSS from 'unocss/vite';
import fs from 'node:fs';
import path from 'node:path';
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

// ─── v1.7 Phase 39 (CONNECT-02) ─────────────────────────────────────────────
// serveNappletCsp: per-napplet Content-Security-Policy connect-src header
// authority. Dev + preview modes both install middleware that:
//
//   1. Accepts POST /__connect-grants { dTag, aggregateHash, origins } to
//      sync grant state from the shell-side connectStore. In-memory only
//      (D2 volatile). Origin-allowlisted (D3 -- Vite's own base URL only).
//
//   2. Emits Content-Security-Policy: connect-src <origins> on
//      /napplets/<dTag>/index.html responses. Strict default
//      'none' when no grants exist (D4).
//
// See .planning/phases/39-nub-connect-nub-config/39-03-PLAN.md for the
// full rationale and SHELL-CONNECT-POLICY.md (Plan 39-05) for the policy.

/** In-memory grants Map keyed '<dTag>:<aggregateHash>'. Volatile per D2. */
function createGrantsMap(): Map<string, readonly string[]> {
  return new Map<string, readonly string[]>();
}

/** Compose the composite key (mirror of @kehto/shell connectGrantKey). */
function grantKey(dTag: string, aggregateHash: string): string {
  return `${dTag}:${aggregateHash}`;
}

/** D3: origins allowed to POST /__connect-grants. */
const GRANT_SYNC_ORIGIN_ALLOWLIST: readonly string[] = [
  'http://localhost:5174',
  'http://localhost:4174',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:4174',
];

/** D4: strict default CSP when no grants exist. */
const CSP_NO_GRANTS = "connect-src 'none'";

/** Build `connect-src <origins>` header value; origins are deterministically sorted. */
function buildCspHeader(origins: readonly string[]): string {
  if (origins.length === 0) return CSP_NO_GRANTS;
  return `connect-src ${[...origins].sort().join(' ')}`;
}

/**
 * POST /__connect-grants handler. Accepts a JSON body syncing grant state
 * from the shell-side connectStore. Origin-allowlisted per D3.
 */
function handleGrantSync(
  grants: Map<string, readonly string[]>,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  // D3 origin allowlist check
  const origin = req.headers.origin;
  if (!origin || !GRANT_SYNC_ORIGIN_ALLOWLIST.includes(origin)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain');
    res.end('forbidden -- origin not on allowlist');
    return;
  }

  // Collect body
  let body = '';
  req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body) as {
        dTag: unknown;
        aggregateHash: unknown;
        origins: unknown;
      };
      if (
        typeof parsed.dTag !== 'string' ||
        typeof parsed.aggregateHash !== 'string' ||
        !Array.isArray(parsed.origins) ||
        !parsed.origins.every((o) => typeof o === 'string')
      ) {
        res.statusCode = 400;
        res.end('malformed body -- expected { dTag: string, aggregateHash: string, origins: string[] }');
        return;
      }
      const key = grantKey(parsed.dTag, parsed.aggregateHash);
      const origins = parsed.origins as string[];
      if (origins.length === 0) {
        grants.delete(key); // revoke path
      } else {
        grants.set(key, [...origins].sort());
      }
      res.statusCode = 204;
      res.end();
    } catch {
      res.statusCode = 400;
      res.end('malformed body -- JSON parse failed');
    }
  });
  req.on('error', () => {
    res.statusCode = 400;
    res.end('malformed body -- read error');
  });
}

/**
 * Middleware that sets the CSP header on /napplets/<dTag>/ and
 * /napplets/<dTag>/index.html responses, then calls next() so
 * serveDemoNapplets' file-streaming middleware can complete the response.
 */
function makeCspMiddleware(grants: Map<string, readonly string[]>) {
  return function cspMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    const urlPath = (req.url?.split('?')[0] || '').replace(/^\//, '');
    const parts = urlPath.split('/').filter(Boolean);

    // Only set CSP on the HTML document response (path exactly '<dTag>' or
    // '<dTag>/' or '<dTag>/index.html'). Subresources (.js/.css/.svg under
    // the napplet dir) get the default Vite response -- CSP scopes the
    // iframe's origin policy, not per-asset.
    const isHtmlDoc =
      parts.length === 1 ||
      (parts.length === 2 && (parts[1] === '' || parts[1] === 'index.html'));
    if (!isHtmlDoc || parts.length < 1) {
      next();
      return;
    }

    const dTag = parts[0];
    // Demo convention: aggregateHash is '' -- so the key we look up is '<dTag>:'.
    // Future-proof: also try any key starting with '<dTag>:' for multi-hash scenarios.
    let origins: readonly string[] = [];
    const directKey = grantKey(dTag, '');
    if (grants.has(directKey)) {
      origins = grants.get(directKey)!;
    } else {
      for (const [k, v] of grants) {
        if (k.startsWith(`${dTag}:`)) {
          origins = v;
          break;
        }
      }
    }

    res.setHeader('Content-Security-Policy', buildCspHeader(origins));
    next();
  };
}

/**
 * Vite plugin emitting per-napplet CSP headers (dev + preview) and
 * accepting POST /__connect-grants from the shell-side connectStore.
 * Volatile in-memory state (D2).
 */
function serveNappletCsp(): Plugin {
  const grants = createGrantsMap();
  const cspMiddleware = makeCspMiddleware(grants);

  return {
    name: 'serve-napplet-csp',
    configureServer(server) {
      // POST /__connect-grants -- grant sync from shell.
      server.middlewares.use('/__connect-grants', (req, res, next) => {
        if (req.method === 'POST') {
          handleGrantSync(grants, req, res);
          return;
        }
        next();
      });
      // CSP header on /napplets/<dTag>/index.html -- runs BEFORE serveDemoNapplets.
      server.middlewares.use('/napplets', cspMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/__connect-grants', (req, res, next) => {
        if (req.method === 'POST') {
          handleGrantSync(grants, req, res);
          return;
        }
        next();
      });
      server.middlewares.use('/napplets', cspMiddleware);
    },
  };
}

export default defineConfig({
  root: __dirname,
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'window',
      },
    },
  },
  plugins: [
    UnoCSS(),
    serveNappletCsp(),   // NOTE: must register BEFORE serveDemoNapplets so CSP header sets first
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
