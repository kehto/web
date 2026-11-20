/**
 * Resource-hint lock (kehto/web#381, napplet/evil `evil-02` "prefetch hints"): browsers act on
 * `<link rel="dns-prefetch|preconnect|prerender">` outside the napplet CSP, so the opt-in `resourceHintLock`
 * closes every scripted way to add one. Measured channels and the cross-engine table live in
 * docs/policies/NIP-5D-CONFORMANCE.md ("Resource hints"). Chromium sends a `rel=prerender` GET even in Playwright's
 * default context, which gives this spec a real-egress control; the dns-prefetch / preconnect channels only fire
 * with network prediction on, so for those this spec asserts that no live hint link can be created.
 */
import { createServer } from 'node:http';
import { expect, test, type Page } from '@playwright/test';
import { prepareNappletSrcdoc, renderNappletFramePolicyMeta } from '../../packages/shell/dist/index.js';

const hits: string[] = [];
const server = createServer((request, response) => {
  if (request.url?.startsWith('/collect')) hits.push(request.url);
  response.setHeader('Content-Type', 'text/html');
  response.end(`<!doctype html><html><head>${renderNappletFramePolicyMeta()}</head><body></body></html>`);
});
let origin: string;

test.beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('hint test server did not bind');
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const battery = (collector: string) => `<!doctype html><html><head></head><body><pre id="result">pending</pre><div id="h"></div><div id="ce" contenteditable></div><script>
  (() => {
    const C = ${JSON.stringify(collector)};
    const out = {};
    const hint = (l) => /(^|\\s)(dns-prefetch|preconnect|prerender)(\\s|$)/i.test(l.getAttribute('rel') || '');
    const live = () => { const found = [...document.querySelectorAll('link')].filter(hint); found.forEach((l) => l.remove()); return found.length; };
    const t = (name, fn) => { try { fn(); } catch {} out[name] = live() ? 'HINT' : 'blocked'; };
    const h = document.getElementById('h');
    const link = (rel) => { const l = document.createElement('link'); l.href = C + '/' + rel; return l; };
    t('relProperty', () => { const l = link('a'); l.rel = 'prerender'; document.head.append(l); });
    t('setAttribute', () => { const l = link('b'); l.setAttribute('REL', 'preconnect'); document.head.append(l); });
    t('setAttributeNS', () => { const l = link('c'); l.setAttributeNS(null, 'rel', 'dns-prefetch'); document.head.append(l); });
    t('relListAdd', () => { const l = link('d'); l.relList.add('prerender'); document.head.append(l); });
    t('relListToggle', () => { const l = link('e'); l.relList.toggle('preconnect'); document.head.append(l); });
    t('relListReplace', () => { const l = link('f'); l.rel = 'icon'; l.relList.replace('icon', 'prerender'); document.head.append(l); });
    t('relListValue', () => { const l = link('g'); l.relList.value = 'prerender'; document.head.append(l); });
    t('setAttributeNode', () => { const l = link('h'); const a = document.createAttribute('rel'); a.value = 'prerender'; l.setAttributeNode(a); document.head.append(l); });
    t('setNamedItem', () => { const l = link('i'); const a = document.createAttribute('rel'); a.nodeValue = 'prerender'; l.attributes.setNamedItem(a); document.head.append(l); });
    t('attachedAttrValue', () => { const l = link('j'); l.setAttribute('rel', 'icon'); l.getAttributeNode('rel').value = 'prerender'; document.head.append(l); });
    t('attachedAttrTextContent', () => { const l = link('k'); l.setAttribute('rel', 'icon'); l.getAttributeNode('rel').textContent = 'prerender'; document.head.append(l); });
    t('innerHTML', () => { h.innerHTML = '<link rel="prerender" href="' + C + '/l">'; });
    t('innerHTMLEntity', () => { h.innerHTML = '<link rel="pre&#114;ender" href="' + C + '/m">'; });
    t('insertAdjacentHTML', () => h.insertAdjacentHTML('beforeend', '<link rel=preconnect href="' + C + '/n">'));
    t('outerHTML', () => { const d = document.createElement('div'); h.append(d); d.outerHTML = '<link rel="prerender" href="' + C + '/o">'; });
    t('createContextualFragment', () => h.append(document.createRange().createContextualFragment('<link rel="prerender" href="' + C + '/p">')));
    t('domParserAdopt', () => { const d = new DOMParser().parseFromString('<link rel="prerender" href="' + C + '/q">', 'text/html'); h.append(document.adoptNode(d.querySelector('link'))); });
    t('setHTMLUnsafe', () => { if (!h.setHTMLUnsafe) throw 0; h.setHTMLUnsafe('<link rel="prerender" href="' + C + '/r">'); });
    t('nestedTemplateClone', () => { h.innerHTML = '<template><template><link rel="prerender" href="' + C + '/s"></template></template>'; const inner = h.querySelector('template').content.querySelector('template'); h.append(inner.content.cloneNode(true)); });
    t('documentWriteSplit', () => { document.write('<link rel="pre'); document.write('render" href="' + C + '/t">'); });
    t('execCommand', () => { const ce = document.getElementById('ce'); ce.focus(); document.execCommand('insertHTML', false, '<link rel="prerender" href="' + C + '/u">'); });
    t('xmlPrefixedAdopt', () => { const d = new DOMParser().parseFromString('<h:div xmlns:h="http://www.w3.org/1999/xhtml"><h:link rel="prerender" href="' + C + '/w"/></h:div>', 'application/xml'); document.head.append(document.adoptNode(d.documentElement.firstChild)); });
    t('xslt', () => {
      const XSL = 'http://www.w3.org/1999/XSL/Transform';
      const doc = document.implementation.createDocument(XSL, 'xsl:stylesheet', null);
      doc.documentElement.setAttribute('version', '1.0');
      const tpl = doc.createElementNS(XSL, 'xsl:template'); tpl.setAttribute('match', '/');
      const el = doc.createElementNS(XSL, 'xsl:element'); el.setAttribute('name', 'link');
      for (const [k, v] of [['rel', 'prerender'], ['href', C + '/v']]) { const a = doc.createElementNS(XSL, 'xsl:attribute'); a.setAttribute('name', k); a.textContent = v; el.append(a); }
      tpl.append(el); doc.documentElement.append(tpl);
      const p = new XSLTProcessor(); p.importStylesheet(doc);
      document.head.append(p.transformToFragment(document.implementation.createDocument(null, 'r', null), document));
    });
    // Canonical link relations and HTML still work.
    let canonical = 'threw';
    try {
      const s = document.createElement('link'); s.rel = 'icon'; s.setAttribute('rel', 'stylesheet'); s.relList.add('alternate');
      h.insertAdjacentHTML('beforeend', '<p id="benign">ok</p><link rel="next" href="#n">');
      canonical = document.getElementById('benign') && s.rel === 'stylesheet alternate' ? 'ok' : 'broken';
    } catch (e) { canonical = String(e); }
    const created = Object.entries(out).filter(([, v]) => v === 'HINT').map(([k]) => k);
    document.getElementById('result').textContent = JSON.stringify({ created, vectors: Object.keys(out).length, canonical, xslt: typeof XSLTProcessor });
  })();
</script></body></html>`;

async function mount(page: Page, html: string, experimental?: { resourceHintLock?: boolean }): Promise<Record<string, unknown>> {
  await page.goto(origin);
  const srcdoc = prepareNappletSrcdoc(html, { domains: ['shell'], experimental });
  await page.evaluate((documentHtml) => {
    const iframe = document.createElement('iframe');
    iframe.sandbox.value = 'allow-scripts';
    iframe.srcdoc = documentHtml;
    document.body.appendChild(iframe);
  }, srcdoc);
  const output = page.frameLocator('iframe').locator('#result');
  await expect(output).not.toHaveText('pending');
  return JSON.parse(await output.innerText()) as Record<string, unknown>;
}

test('without the lock, a napplet prerender hint reaches the network despite the CSP (control)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only Chromium implements rel=prerender (measured: no request in Firefox 148 / WebKit 26.4).');
  hits.length = 0;
  const control = `<!doctype html><html><head><script>
    const l = document.createElement('link'); l.rel = 'prerender'; l.href = ${JSON.stringify(`${origin}/collect?ev=control`)};
    document.head.append(l);
  </script></head><body><pre id="result">{}</pre></body></html>`;
  await mount(page, control);
  await expect.poll(() => hits.length, { timeout: 5_000 }).toBeGreaterThan(0);
});

test('without the lock, every battery vector creates a live hint link (sensitivity control)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The exact live-vector list is Chromium-specific (Firefox also honors execCommand).');
  const probed = await mount(page, battery(`${origin}/collect`)) as { created: string[]; vectors: number; canonical: string };
  expect(probed.vectors).toBe(23);
  // Every vector is live without the lock except execCommand, whose insertHTML drops a lone <link> in Chromium.
  expect(probed.created).toEqual([
    'relProperty', 'setAttribute', 'setAttributeNS', 'relListAdd', 'relListToggle', 'relListReplace', 'relListValue',
    'setAttributeNode', 'setNamedItem', 'attachedAttrValue', 'attachedAttrTextContent', 'innerHTML', 'innerHTMLEntity',
    'insertAdjacentHTML', 'outerHTML', 'createContextualFragment', 'domParserAdopt', 'setHTMLUnsafe',
    'nestedTemplateClone', 'documentWriteSplit', 'xmlPrefixedAdopt', 'xslt',
  ]);
  expect(probed.canonical).toBe('ok');
});

test('with the resource-hint lock, no scripted path creates a live hint link and nothing reaches the network', async ({ page }) => {
  hits.length = 0;
  const probed = await mount(page, battery(`${origin}/collect`), { resourceHintLock: true }) as { created: string[]; vectors: number; canonical: string; xslt: string };
  expect(probed.vectors).toBe(23);
  expect(probed.created).toEqual([]);
  expect(probed.canonical).toBe('ok');
  expect(probed.xslt).toBe('undefined');
  await page.waitForTimeout(1_500);
  expect(hits).toEqual([]);
});
