import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { buildApprovedNappletCsp } from '../../packages/shell/src/napplet-csp.js';

test.use({ ignoreHTTPSErrors: true });
const requests: string[] = [];
const host = createHttpServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html', 'access-control-allow-origin': '*' });
  if (request.url === '/data') requests.push('http');
  response.end(request.url === '/data' ? 'approved destination' : '<!doctype html><html><body></body></html>');
});
let tls: ReturnType<typeof createHttpsServer>;
let certificateDir: string;
let hostUrl: string;
let tlsUrl: string;

test.beforeAll(async () => {
  certificateDir = mkdtempSync(join(tmpdir(), 'kehto-csp-'));
  const key = join(certificateDir, 'key.pem');
  const cert = join(certificateDir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', key, '-out', cert, '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1'],
  { stdio: 'ignore' });
  tls = createHttpsServer({ key: readFileSync(key), cert: readFileSync(cert) }, (_request, response) => {
    requests.push('https');
    response.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
    response.end('approved destination');
  });
  await new Promise<void>((resolve) => host.listen(0, '127.0.0.1', resolve));
  await new Promise<void>((resolve) => tls.listen(0, '127.0.0.1', resolve));
  const address = host.address();
  const tlsAddress = tls.address();
  if (!address || typeof address === 'string' || !tlsAddress || typeof tlsAddress === 'string') {
    throw new Error('CSP fixtures did not bind');
  }
  hostUrl = `http://127.0.0.1:${address.port}`;
  tlsUrl = `https://127.0.0.1:${tlsAddress.port}`;
});

test.afterAll(async () => {
  for (const server of [host, tls]) {
    if (!server) continue;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
  if (certificateDir) rmSync(certificateDir, { recursive: true, force: true });
});

async function probe(page: Page, source: string, allowed: string, blocked: string): Promise<string[]> {
  const csp = buildApprovedNappletCsp({
    mode: 'direct-network', remoteSources: [{ directive: 'connect-src', origin: source }],
  });
  const srcdoc = `<!doctype html><html><head>
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    </head><body><output id="result">pending</output><output id="violations"></output><script>
      const violations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        violations.push({ blockedURI: event.blockedURI, directive: event.effectiveDirective,
          policy: event.originalPolicy });
        document.getElementById('violations').textContent = JSON.stringify(violations);
      });
      (async () => {
        const results = [];
        for (const url of ${JSON.stringify([allowed, blocked])}) {
          try { results.push(await (await fetch(url, { signal: AbortSignal.timeout(2000) })).text()); }
          catch { results.push('failed'); }
        }
        document.getElementById('result').textContent = JSON.stringify(results);
      })();
    </script></body></html>`;
  await page.goto(hostUrl);
  await page.evaluate((html) => {
    const frame = document.createElement('iframe');
    frame.sandbox.value = 'allow-scripts';
    frame.srcdoc = html;
    document.body.appendChild(frame);
  }, srcdoc);
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#result')).not.toHaveText('pending');
  await expect(frame.locator('#violations')).not.toBeEmpty();
  expect(JSON.parse(await frame.locator('#violations').innerText())).toEqual([{
    blockedURI: blocked, directive: 'connect-src', policy: csp,
  }]);
  return JSON.parse(await frame.locator('#result').innerText());
}

test('default-port HTTP sources permit HTTPS under Chromium CSP', async ({ page }) => {
  // The reserved .invalid destination cannot serve a response. The exact
  // violation list proves HTTPS:443 passes CSP, while the other port does not;
  // actual HTTP and HTTPS transport are exercised by the next two tests.
  expect(await probe(page, 'http://csp-upgrade.invalid', 'https://csp-upgrade.invalid/data',
    'https://csp-upgrade.invalid:9443/data')).toEqual(['failed', 'failed']);
});

test('Chromium does not upgrade an HTTP source on the same non-default port', async ({ page }) => {
  const before = requests.length;
  expect(await probe(page, hostUrl, `${hostUrl}/data`, `${hostUrl.replace('http:', 'https:')}/data`))
    .toEqual(['approved destination', 'failed']);
  expect(requests.slice(before)).toEqual(['http']);
});

test('an HTTPS source reaches its approved TLS port and blocks a different port', async ({ page }) => {
  const before = requests.length;
  expect(await probe(page, tlsUrl, `${tlsUrl}/data`, `${hostUrl.replace('http:', 'https:')}/data`))
    .toEqual(['approved destination', 'failed']);
  expect(requests.slice(before)).toEqual(['https']);
});
