import { defineConfig, type Plugin } from 'vite';
import { injectNappletNamespacePrelude } from '@kehto/shell';
import path from 'node:path';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

const nappletFixturesDir = path.resolve(__dirname, '../../fixtures/napplets');

const RESOURCE_CORS_REDIRECT_PATH = '/resource-cors/redirect.png';
const RESOURCE_CORS_FINAL_PATH = '/resource-cors/final.png';
const RESOURCE_CORS_FINAL_URL = `http://localhost:4173${RESOURCE_CORS_FINAL_PATH}`;
const RESOURCE_CORS_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

const fixtureDomains: Readonly<Record<string, readonly string[]>> = {
  'nap-identity': ['identity'],
  'nap-inc': ['inc'],
  'nap-notify': ['notify'],
  'nap-relay': ['relay'],
  'nap-storage': ['storage'],
  'nap-theme': ['theme'],
};

function serveNappletFile(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const urlPath = (req.url?.split('?')[0] || '').replace(/^\//, '');
  const parts = urlPath.split('/').filter(Boolean);
  if (parts.length < 1) { next(); return; }

  const nappletName = parts[0];
  const filePath = parts.slice(1).join('/') || 'index.html';
  const fullPath = path.join(nappletFixturesDir, nappletName, 'dist', filePath);

  if (fs.existsSync(fullPath)) {
    const ext = path.extname(fullPath);
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    // CORS headers required for sandboxed iframes (origin: null) to load scripts
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    if (ext === '.html') {
      const html = fs.readFileSync(fullPath, 'utf8');
      res.end(injectNappletNamespacePrelude(html, {
        domains: fixtureDomains[nappletName] ?? [],
      }));
      return;
    }
    fs.createReadStream(fullPath).pipe(res);
  } else {
    res.statusCode = 404;
    res.end(`Napplet file not found: ${fullPath}`);
  }
}

/**
 * Custom Vite plugin to serve pre-built test napplets at /napplets/{name}/
 */
function serveNapplets(): Plugin {
  return {
    name: 'serve-napplets',
    configureServer(server) {
      server.middlewares.use('/napplets', serveNappletFile);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/napplets', serveNappletFile);
    },
  };
}

function serveResourceCorsFixture(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void {
  const urlPath = req.url?.split('?')[0];
  if (urlPath === RESOURCE_CORS_REDIRECT_PATH) {
    res.statusCode = 302;
    res.setHeader('Location', RESOURCE_CORS_FINAL_URL);
    res.removeHeader('Access-Control-Allow-Origin');
    res.end();
    return;
  }
  if (urlPath === RESOURCE_CORS_FINAL_PATH) {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', RESOURCE_CORS_PNG.byteLength);
    res.end(RESOURCE_CORS_PNG);
    return;
  }
  next();
}

/**
 * Reproduce a displayable cross-origin image whose redirect is not CORS-readable.
 */
function resourceCorsFixture(): Plugin {
  return {
    name: 'resource-cors-fixture',
    configureServer(server) {
      server.middlewares.use(serveResourceCorsFixture);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveResourceCorsFixture);
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [resourceCorsFixture(), serveNapplets()],
  resolve: {
    alias: {
      '@test/helpers': path.resolve(__dirname, '../../helpers'),
    },
  },
  server: {
    port: 4173,
    strictPort: true,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
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
