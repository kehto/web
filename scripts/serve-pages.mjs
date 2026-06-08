#!/usr/bin/env node
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const artifactRoot = resolve(repoRoot, process.env.PAGES_OUT_DIR || '.pages');
const publicBase = '/web/';
const defaultHost = process.env.HOST || '127.0.0.1';
const defaultPort = Number.parseInt(process.env.PORT || process.env.PAGES_PREVIEW_PORT || '4175', 10);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function sendText(response, status, body, headers = {}) {
  response.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    ...headers,
  });
  response.end(body);
}

function redirect(response, location, status = 302) {
  response.writeHead(status, { location });
  response.end();
}

function artifactPathFromRequest(pathname) {
  const publicPath = decodeURIComponent(pathname.slice(publicBase.length));
  const requestedPath = publicPath === '' ? 'index.html' : publicPath;
  const normalizedPath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  return resolve(artifactRoot, normalizedPath);
}

function serveFile(response, filePath) {
  response.writeHead(200, {
    'content-type': contentTypes.get(extname(filePath)) || 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
}

function handleRequest(request, response) {
  const url = new URL(request.url || '/', `http://${defaultHost}`);

  if (url.pathname === '/') {
    redirect(response, publicBase);
    return;
  }

  if (url.pathname === '/web') {
    redirect(response, publicBase, 301);
    return;
  }

  if (!url.pathname.startsWith(publicBase)) {
    sendText(response, 404, 'Not found\n');
    return;
  }

  let filePath = artifactPathFromRequest(url.pathname);
  const relativePath = relative(artifactRoot, filePath);

  if (relativePath.startsWith('..') || relativePath === '' || relativePath.includes(`..${sep}`)) {
    sendText(response, 403, 'Forbidden\n');
    return;
  }

  if (!existsSync(filePath)) {
    sendText(response, 404, 'Not found\n');
    return;
  }

  if (statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    sendText(response, 404, 'Not found\n');
    return;
  }

  serveFile(response, filePath);
}

function listen(port) {
  const server = createServer(handleRequest);

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      listen(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, defaultHost, () => {
    console.log(`Kehto web preview: http://${defaultHost}:${port}${publicBase}`);
  });
}

if (!existsSync(artifactRoot)) {
  throw new Error(`Pages artifact missing: ${relative(repoRoot, artifactRoot)}. Run pnpm site:build first.`);
}

listen(Number.isNaN(defaultPort) ? 4175 : defaultPort);
