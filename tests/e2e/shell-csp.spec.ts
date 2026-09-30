import { test, expect, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { prepareNappletSrcdoc, type NappletCspOptions } from '../../packages/shell/dist/index.js';

const server = createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Content-Type', request.url === '/data' ? 'text/plain' : 'text/html');
  response.end(request.url === '/data' ? 'granted' : '<!doctype html><html><body></body></html>');
});
let origin: string;

test.beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('CSP test server did not bind');
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

const probe = `<body><pre id="result">pending</pre><script>
  (async () => {
    const result = {
      shell: typeof window.napplet?.shell?.ready,
      first: document.head.firstElementChild?.getAttribute('http-equiv'),
      wasm: false, stringEval: false, network: false, worker: false,
    };
    try {
      await WebAssembly.instantiate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
      result.wasm = true;
    } catch {}
    try { result.stringEval = Function('return true')(); } catch {}
    try { result.network = (await fetch('https://network.example/data')).ok; } catch {}
    const url = URL.createObjectURL(new Blob(['postMessage(true)'], { type: 'text/javascript' }));
    result.worker = await new Promise((resolve) => {
      try {
        const worker = new Worker(url);
        worker.onmessage = () => { worker.terminate(); resolve(true); };
        worker.onerror = () => { worker.terminate(); resolve(false); };
      } catch { resolve(false); }
    });
    URL.revokeObjectURL(url);
    document.getElementById('result').textContent = JSON.stringify(result);
  })();
</script></body>`;

async function mount(page: Page, html: string, csp?: NappletCspOptions): Promise<void> {
  await page.goto(origin);
  const srcdoc = prepareNappletSrcdoc(html.replaceAll('https://network.example', origin), { domains: [], csp });
  await page.evaluate((documentHtml) => {
    const iframe = document.createElement('iframe');
    iframe.sandbox.value = 'allow-scripts';
    iframe.srcdoc = documentHtml;
    document.body.appendChild(iframe);
  }, srcdoc);
}

async function result(page: Page): Promise<Record<string, unknown>> {
  const output = page.frameLocator('iframe').locator('#result');
  await expect(output).not.toHaveText('pending');
  return JSON.parse(await output.innerText()) as Record<string, unknown>;
}

test('public shell package enforces the default policy in a real opaque iframe', async ({ page }) => {
  await mount(page, `<!doctype html><html><head></head>${probe}</html>`);
  expect(await result(page)).toEqual({
    shell: 'function', first: 'Content-Security-Policy',
    wasm: true, stringEval: false, network: false, worker: false,
  });

});

test('host overrides grant exact connections and can restrict WASM', async ({ page }) => {
  await mount(page, probe, {
    connectOrigins: [origin],
    directives: { 'script-src': ["'unsafe-inline'"], 'img-src': ["'none'"] },
  });
  expect(await result(page)).toMatchObject({
    shell: 'function', wasm: false, stringEval: false, network: true, worker: false,
  });
});

test('authored CSP remains an additional restriction', async ({ page }) => {
  await mount(page, `<html><head><meta http-equiv="Content-Security-Policy"
    content="script-src 'unsafe-inline'; connect-src 'none'"></head>${probe}</html>`, {
    connectOrigins: [origin],
  });
  expect(await result(page)).toMatchObject({ wasm: false, stringEval: false, network: false });
});

for (const [name, prefix] of [
  ['comment', '<!-- <head> decoy -->'],
  ['abrupt comment', '<!--><script>window.sawShell = typeof window.napplet.shell.ready</script><!-- <head> -->'],
  ['script', '<script>window.sawShell = typeof window.napplet.shell.ready; const decoy = "<head>"</script>'],
  ['attributes', '<html lang="en"><head data-name="head > decoy"></head>'],
  ['template', '<template><head></head></template>'],
]) {
  test(`CSP and bootstrap precede authored ${name}`, async ({ page }) => {
    await mount(page, prefix + probe);
    expect(await result(page)).toMatchObject({
      shell: 'function', first: 'Content-Security-Policy', wasm: true, network: false,
    });
    if (name === 'script' || name === 'abrupt comment') {
      const value = await page.frameLocator('iframe').locator('body').evaluate(() =>
        (window as Window & { sawShell?: string }).sawShell);
      expect(value).toBe('function');
    }
  });
}
