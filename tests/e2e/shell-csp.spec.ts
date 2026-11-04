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
      wasm: false, stringEval: false, network: false, worker: false, rtc: false,
    };
    try {
      await WebAssembly.instantiate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
      result.wasm = true;
    } catch {}
    try {
      const pc = new RTCPeerConnection();
      pc.createDataChannel('probe');
      pc.close();
      result.rtc = true;
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

async function mount(page: Page, html: string, csp?: NappletCspOptions, experimental?: { nestedContextLock?: boolean }): Promise<void> {
  await page.goto(origin);
  const srcdoc = prepareNappletSrcdoc(html.replaceAll('https://network.example', origin), { domains: ['shell'], csp, experimental });
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
    wasm: true, stringEval: false, network: false, worker: false, rtc: false,
  });

});

test('neuters direct WebRTC egress in the napplet realm (no CSP directive covers it)', async ({ page }) => {
  // napplet/evil finding #1: RTCPeerConnection data channels bypass connect-src.
  // The injected prelude removes the constructor, so the napplet realm cannot
  // open one directly; NAP-WEBRTC still works because it runs in the shell realm.
  await mount(page, `<!doctype html><html><head></head>${probe}</html>`);
  const probed = await result(page);
  expect(probed.rtc).toBe(false);
  expect(probed.shell).toBe('function');
  const rtc = await page.frameLocator('iframe').locator('body').evaluate(() => {
    const realm = window as unknown as Record<string, unknown>;
    return {
      remaining: Object.getOwnPropertyNames(window)
        .filter((name) => /^(?:webkit|moz)?RTC/.test(name) && realm[name] !== undefined),
      dataChannel: typeof realm.RTCDataChannel,
      sessionDescription: typeof realm.RTCSessionDescription,
      iceCandidate: typeof realm.RTCIceCandidate,
    };
  });
  expect(rtc).toEqual({
    remaining: [], dataChannel: 'undefined', sessionDescription: 'undefined', iceCandidate: 'undefined',
  });
});

const frameBattery = `<body><pre id="result">pending</pre><div id="h"></div><div id="ce" contenteditable></div><svg id="svg"></svg><style id="st"></style><script>
  (() => {
    const out = {};
    const live = () => { const a = document.querySelectorAll('iframe,frame,object,embed,portal,fencedframe'); let n = 0; for (const e of a) { try { if (e.contentWindow) n++; } catch {} } for (const e of a) e.remove(); return n; };
    const t = (name, fn) => { try { fn(); out[name] = live() ? 'FRAME' : 'blocked'; } catch (e) { out[name] = live() ? 'FRAME-despite-throw' : 'blocked'; } };
    const h = document.getElementById('h');
    t('createElement', () => h.append(document.createElement('iframe')));
    t('createElementUpper', () => h.append(document.createElement('IFRAME')));
    t('createElementNS', () => h.append(document.createElementNS('http://www.w3.org/1999/xhtml', 'iframe')));
    t('innerHTML', () => { h.innerHTML = '<iframe></iframe>'; });
    t('innerHTMLSplitCase', () => { h.innerHTML = '<IfRaMe></IfRaMe>'; });
    t('outerHTML', () => { const d = document.createElement('div'); h.append(d); d.outerHTML = '<iframe></iframe>'; });
    t('insertAdjacentHTML', () => h.insertAdjacentHTML('beforeend', '<iframe></iframe>'));
    t('styleContext', () => { document.getElementById('st').innerHTML = '<svg><style><!--</style><iframe>'; });
    t('svgContext', () => { document.getElementById('svg').innerHTML = '<p><iframe></iframe>'; });
    t('domParserAdopt', () => { const d = new DOMParser().parseFromString('<iframe></iframe>', 'text/html'); h.append(document.adoptNode(d.querySelector('iframe'))); });
    t('createContextualFragment', () => h.append(document.createRange().createContextualFragment('<iframe></iframe>')));
    t('setHTMLUnsafe', () => { if (!h.setHTMLUnsafe) throw 0; h.setHTMLUnsafe('<iframe></iframe>'); });
    t('documentWrite', () => { document.write('<ifr'); document.write('ame></iframe>'); });
    t('templateClone', () => { const tp = document.createElement('template'); tp.innerHTML = '<iframe></iframe>'; h.append(tp.content.cloneNode(true)); });
    t('execCommand', () => { const ce = document.getElementById('ce'); ce.focus(); document.execCommand('insertHTML', false, '<iframe></iframe>'); });
    t('createDocumentRoot', () => { const d = document.implementation.createDocument('http://www.w3.org/1999/xhtml', 'iframe'); h.append(document.adoptNode(d.documentElement)); });
    t('recoverFactory', () => { const d = Object.getOwnPropertyDescriptor(Document.prototype, 'createElement'); h.append(d.value.call(document, 'iframe')); });
    t('freshRealm', () => { const d = new Document(); h.append(document.adoptNode(d.createElement('iframe'))); });
    t('object', () => { const o = document.createElement('object'); o.data = 'about:blank'; h.append(o); });
    t('embed', () => h.append(document.createElement('embed')));
    // Canonical, frameless HTML must still work through the pass-through policy.
    let benign = 'threw';
    try { h.insertAdjacentHTML('beforeend', '<p id="benign">ok</p>'); benign = document.getElementById('benign') ? 'ok' : 'missing'; } catch {}
    const created = Object.entries(out).filter(([, v]) => /FRAME/.test(v)).map(([k]) => k);
    document.getElementById('result').textContent = JSON.stringify({ created, windowLength: window.length, benign });
  })();
</script></body>`;

test('napplet realm cannot create a nested browsing context by any scripted path (experimental lock on)', async ({ page }) => {
  await mount(page, `<!doctype html><html><head></head>${frameBattery}</html>`, undefined, { nestedContextLock: true });
  const probed = await result(page) as { created: string[]; windowLength: number; benign: string };
  expect(probed.created).toEqual([]);
  expect(probed.windowLength).toBe(0);
  // Canonical frameless HTML still works through the pass-through default policy.
  expect(probed.benign).toBe('ok');
});

test('without the experimental lock, a napplet can create a frame (opinion not imposed)', async ({ page }) => {
  // A minimal, non-destructive probe: no document.write, which would reset the
  // document when not blocked. Proves the default behavior is unchanged.
  const body = `<body><pre id="result">pending</pre><div id="h"></div><script>
    (() => {
      const h = document.getElementById('h');
      let created = 0;
      try { h.append(document.createElement('iframe')); } catch {}
      try { const d = document.createElement('div'); d.innerHTML = '<iframe></iframe>'; h.append(d); } catch {}
      for (const f of document.querySelectorAll('iframe')) { try { if (f.contentWindow) created++; } catch {} }
      document.getElementById('result').textContent = JSON.stringify({ created, windowLength: window.length });
    })();
  </script></body>`;
  await mount(page, `<!doctype html><html><head></head>${body}</html>`);
  const probed = await result(page) as { created: number; windowLength: number };
  // The lock is opt-in, so creation is not blocked by default.
  expect(probed.created).toBeGreaterThan(0);
  expect(probed.windowLength).toBeGreaterThan(0);
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
