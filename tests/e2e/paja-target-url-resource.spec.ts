import { createServer, type Server } from 'node:http';
import { expect, test, type Page } from '@playwright/test';
import { startPajaServer, type PajaServer } from '../../packages/paja/dist/index.js';
import { installPajaApprovalDriver } from './paja-approval-driver.js';

// kehto/web#447. Authority: NAP-RESOURCE PR #80 at
// ae5b9c64ab8a4d8909f288829a01e99d6bd713bc and its web resource binding: a
// frame may receive `window.napplet.resource` only while the browser denies it
// direct fetch, XHR, WebSocket, EventSource, beacon, and external subresource
// loads. These cases prove that in a real browser against real sockets, for
// the dev origin itself and for an unrelated third origin.

interface RecordingServer {
  readonly url: string;
  /** Paths requested under /probe/, including WebSocket upgrades. */
  readonly probes: string[];
  /** Number of times the document itself was served. */
  documentLoads(): number;
  close(): Promise<void>;
}

interface ProbeReport {
  readonly resource: string;
  readonly results: Record<string, string>;
  readonly violations: string[];
}

const PROBE_SCRIPT = `
const params = new URLSearchParams(document.currentScript.dataset.config);
const dev = params.get('dev');
const third = params.get('third');
const violations = [];
document.addEventListener('securitypolicyviolation', (event) => {
  violations.push(event.effectiveDirective + ' ' + event.blockedURI);
});
const settle = (run) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve('timeout'), 4000);
  const done = (value) => { clearTimeout(timer); resolve(value); };
  try { run(done); } catch (error) { done('blocked'); }
});
const element = (tag, attribute, url) => settle((done) => {
  const node = document.createElement(tag);
  node.onload = () => done('loaded');
  node.onerror = () => done('blocked');
  node[attribute] = url;
  if (tag !== 'img') document.head.appendChild(node);
});
const socket = (url) => settle((done) => {
  const ws = new WebSocket(url);
  ws.onopen = () => { ws.close(); done('loaded'); };
  ws.onerror = () => done('blocked');
});
const probes = (origin, label) => {
  const ws = origin.replace(/^http/, 'ws');
  return {
    [label + ':fetch']: () => fetch(origin + '/probe/fetch').then(() => 'loaded', () => 'blocked'),
    [label + ':xhr']: () => settle((done) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => done('loaded');
      xhr.onerror = () => done('blocked');
      xhr.open('GET', origin + '/probe/xhr');
      xhr.send();
    }),
    [label + ':websocket']: () => socket(ws + '/probe/websocket'),
    [label + ':eventsource']: () => settle((done) => {
      const source = new EventSource(origin + '/probe/eventsource');
      source.onopen = () => { source.close(); done('loaded'); };
      source.onerror = () => { source.close(); done('blocked'); };
    }),
    [label + ':beacon']: async () => {
      try { navigator.sendBeacon(origin + '/probe/beacon', 'x'); } catch (error) { /* reported by the server log */ }
      return 'sent';
    },
    [label + ':img']: () => element('img', 'src', origin + '/probe/img'),
    [label + ':script']: () => element('script', 'src', origin + '/probe/script'),
    [label + ':style']: () => settle((done) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.onload = () => done('loaded');
      link.onerror = () => done('blocked');
      link.href = origin + '/probe/style';
      document.head.appendChild(link);
    }),
    [label + ':media']: () => settle((done) => {
      const audio = document.createElement('audio');
      audio.onloadeddata = () => done('loaded');
      audio.onerror = () => done('blocked');
      audio.src = origin + '/probe/media';
    }),
    [label + ':worker']: () => settle((done) => {
      const worker = new Worker(origin + '/probe/worker');
      worker.onmessage = () => done('loaded');
      worker.onerror = () => done('blocked');
    }),
  };
};
(async () => {
  const results = {};
  for (const [name, run] of Object.entries({ ...probes(dev, 'dev'), ...probes(third, 'third') })) {
    results[name] = await run();
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  document.getElementById('out').textContent = JSON.stringify({
    resource: typeof window.napplet?.resource, results, violations,
  });
  document.getElementById('out').dataset.done = '1';
})();
`;

function renderTarget(declaration: string, devUrl: string, thirdUrl: string): string {
  const config = new URLSearchParams({ dev: devUrl, third: thirdUrl }).toString();
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Needs resource</title>
  <meta name="description" content="Minimal napplet that declares the resource domain.">
  <meta name="napplet-id" content="needs-resource">
  ${declaration}
</head>
<body><p id="out">booting</p>
<script data-config="${config.replaceAll('&', '&amp;')}">${PROBE_SCRIPT}</script>
</body>
</html>`;
}

const PROBE_BODIES: Record<string, readonly [string, string]> = {
  '/probe/script': ['text/javascript', 'window.__probeScript = 1;'],
  '/probe/style': ['text/css', 'body { color: inherit; }'],
  '/probe/worker': ['text/javascript', 'postMessage(1);'],
  '/probe/eventsource': ['text/event-stream', 'data: 1\n\n'],
  // 1x1 transparent GIF.
  '/probe/img': ['image/gif', Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64').toString('latin1')],
};

async function startRecordingServer(render: (url: string) => string | null): Promise<RecordingServer> {
  const probes: string[] = [];
  let loads = 0;
  let url = '';
  const server: Server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (path.startsWith('/probe/')) {
      probes.push(path);
      const [type, body] = PROBE_BODIES[path] ?? ['text/plain', 'ok'];
      response.writeHead(200, { 'access-control-allow-origin': '*', 'cache-control': 'no-store', 'content-type': type });
      response.end(Buffer.from(body, 'latin1'));
      return;
    }
    const html = path === '/' ? render(url) : null;
    if (html === null) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not found');
      return;
    }
    loads += 1;
    response.writeHead(200, { 'access-control-allow-origin': '*', 'cache-control': 'no-store', 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  server.on('upgrade', (request, socket) => {
    probes.push(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    socket.destroy();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Recording server has no port');
  url = `http://127.0.0.1:${address.port}`;
  return {
    url, probes,
    documentLoads: () => loads,
    close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
}

async function readReport(page: Page): Promise<ProbeReport> {
  const out = page.frameLocator('#napplet-frame').locator('#out[data-done="1"]');
  await expect(out).toBeAttached({ timeout: 60_000 });
  return JSON.parse(await out.textContent() ?? '{}') as ProbeReport;
}

let third: RecordingServer;
const servers: Array<{ close(): Promise<void> }> = [];

async function startScenario(declaration: string): Promise<{ dev: RecordingServer; paja: PajaServer }> {
  const dev = await startRecordingServer((url) => renderTarget(declaration, url, third.url));
  const paja = await startPajaServer({
    options: { targetUrl: dev.url, port: 0, relayMode: 'disabled', storageMode: 'memory' },
  });
  servers.push(paja, dev);
  return { dev, paja };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  third = await startRecordingServer(() => null);
});

test.beforeEach(async ({ page }) => {
  third.probes.length = 0;
  await installPajaApprovalDriver(page);
});

test.afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

test.afterAll(async () => {
  await third.close();
});

test('target-url with required resource exposes it in a frame with no direct network', async ({ page }) => {
  test.setTimeout(120_000);
  const { dev, paja } = await startScenario('<meta name="napplet-requires" content="resource">');
  const warnings: string[] = [];
  page.on('console', (message) => { if (message.type() === 'warning') warnings.push(message.text()); });

  await page.goto(paja.url);
  const report = await readReport(page);

  // The issue's acceptance check: the document loads and the interface is there.
  expect(report.resource).toBe('object');
  await expect(page.locator('#napplet-frame')).toHaveAttribute('sandbox', 'allow-scripts');

  // Every direct channel is refused by the browser, for both origins.
  const outcomes = Object.entries(report.results).filter(([name]) => !name.endsWith(':beacon'));
  expect(outcomes.length).toBe(18);
  expect(outcomes.filter(([, outcome]) => outcome !== 'blocked')).toEqual([]);
  expect(report.violations.some((entry) => entry.startsWith('connect-src'))).toBe(true);
  expect(report.violations.some((entry) => entry.startsWith('img-src'))).toBe(true);
  expect(report.violations.some((entry) => entry.startsWith('script-src-elem'))).toBe(true);

  // Nothing reached either server: only Paja's own server-side document fetches
  // touched the dev origin, and the third origin saw no request at all.
  expect(dev.probes).toEqual([]);
  expect(third.probes).toEqual([]);
  expect(dev.documentLoads()).toBeGreaterThan(0);

  const srcdoc = await page.locator('#napplet-frame').getAttribute('srcdoc') ?? '';
  expect(srcdoc).toContain("connect-src 'none'");
  expect(srcdoc).not.toContain(dev.url);
  expect(srcdoc).not.toContain('<base');
  await expect.poll(() => warnings.join('\n')).toContain('network-isolated snapshot');
});

test('target-url with optional resource stays live and does not expose resource', async ({ page }) => {
  test.setTimeout(120_000);
  const { dev, paja } = await startScenario('<meta name="napplet-optional" content="resource">');
  const warnings: string[] = [];
  page.on('console', (message) => { if (message.type() === 'warning') warnings.push(message.text()); });

  await page.goto(paja.url);
  const report = await readReport(page);

  // Control for the probe itself: a live frame really reaches its dev origin,
  // which is exactly why it cannot carry `resource`.
  expect(report.resource).toBe('undefined');
  expect(report.results['dev:fetch']).toBe('loaded');
  expect(report.results['dev:websocket']).toBe('blocked'); // the server drops the upgrade, after receiving it
  expect(report.results['dev:img']).toBe('loaded');
  expect(dev.probes).toEqual(expect.arrayContaining(['/probe/fetch', '/probe/websocket', '/probe/img', '/probe/script']));

  // The approved dev origin is the only one: the third origin stays closed.
  const thirdOutcomes = Object.entries(report.results)
    .filter(([name]) => name.startsWith('third:') && !name.endsWith(':beacon'));
  expect(thirdOutcomes.filter(([, outcome]) => outcome !== 'blocked')).toEqual([]);
  expect(third.probes).toEqual([]);
  await expect.poll(() => warnings.join('\n')).toContain('leaves `window.napplet.resource` out');
});

// A frame that keeps direct origins still refuses a required `resource`. Paja's
// CLI cannot build one in target-url mode (its host config carries no `csp`),
// so that boundary is covered where it lives: `admitBrowserDocument` in
// packages/shell/src/browser-admission.test.ts and the embedding-host case in
// packages/paja/src/browser-target-frame.test.ts.
