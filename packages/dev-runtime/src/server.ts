import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import {
  createDevRuntimeHostConfig,
  formatDevRuntimeUrl,
  normalizeDevRuntimeOptions,
  type DevRuntimeHostConfig,
  type DevRuntimeOptions,
  type DevRuntimeRawOptions,
} from './options.js';
import { renderDevRuntimeHtml } from './host-page.js';

export interface DevRuntimeServerOptions {
  readonly options: DevRuntimeRawOptions;
  readonly now?: Date;
}

export interface DevRuntimeServer {
  readonly url: string;
  readonly hostConfig: DevRuntimeHostConfig;
  close(): Promise<void>;
}

export async function startDevRuntimeServer(input: DevRuntimeServerOptions): Promise<DevRuntimeServer> {
  const options = normalizeDevRuntimeOptions(input.options);
  let hostConfig = createDevRuntimeHostConfig(options, input.now);
  let html = renderDevRuntimeHtml(hostConfig);
  let configJson = JSON.stringify(hostConfig, null, 2);

  const server = createServer((request, response) => {
    const requestUrl = request.url ?? '/';

    if (requestUrl === '/' || requestUrl.startsWith('/?')) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }

    if (requestUrl === '/__kehto/config.json') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(configJson);
      return;
    }

    if (requestUrl === '/__kehto/browser-host.js') {
      const browserScript = readBrowserHostScript();
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end(browserScript);
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });

  await listen(server, options.host, options.port);
  const servedOptions = withBoundPort(options, getBoundPort(server, options.port));
  hostConfig = createDevRuntimeHostConfig(servedOptions, input.now);
  html = renderDevRuntimeHtml(hostConfig);
  configJson = JSON.stringify(hostConfig, null, 2);

  return {
    url: formatDevRuntimeUrl(servedOptions),
    hostConfig,
    close: () => close(server),
  };
}

function readBrowserHostScript(): string {
  return readFileSync(new URL('./browser-host.js', import.meta.url), 'utf8');
}

function listen(server: HttpServer, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

interface HttpServer {
  listen(port: number, host: string, callback: () => void): void;
  once(event: 'error', callback: (error: Error) => void): void;
  off(event: 'error', callback: (error: Error) => void): void;
  close(callback: (error?: Error) => void): void;
  address(): string | { port: number } | null;
}

function getBoundPort(server: HttpServer, fallback: number): number {
  const address = server.address();
  return typeof address === 'object' && address !== null ? address.port : fallback;
}

function withBoundPort(options: DevRuntimeOptions, port: number): DevRuntimeOptions {
  return port === options.port ? options : { ...options, port };
}
