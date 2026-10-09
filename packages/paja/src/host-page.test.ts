import { describe, expect, it } from 'vitest';
import { createPajaHostConfig, createPajaRuntimeHostConfig, normalizePajaOptions } from './options.js';
import { renderPajaHtml } from './host-page.js';

describe('@kehto/paja host page', () => {
  it('renders the same accessible resource settings in both target modes', () => {
    const configs = [
      createPajaHostConfig(normalizePajaOptions({ targetUrl: 'http://127.0.0.1:5173' })),
      createPajaRuntimeHostConfig({}),
    ];
    for (const config of configs) {
      const html = renderPajaHtml(config);
      expect(html.match(/id="paja-resource-servers-form"/g)).toHaveLength(1);
      expect(html).toContain('for="paja-resource-servers-input">Resource servers</label>');
      expect(html).toContain('aria-describedby="paja-resource-servers-help paja-resource-servers-status"');
      expect(html).toContain('id="paja-resource-servers-save">Save</button>');
      expect(html).toContain('id="paja-resource-servers-status" role="status" aria-live="polite"');
      expect(html).toContain('<small id="paja-resource-servers-help">Extra Blossom lookup servers, one per line. Domains use HTTPS.</small>');
      const aside = html.match(/<aside\b[^>]*>([\s\S]*?)<\/aside>/)?.[1];
      expect(aside).toBeDefined();
      expect(aside!.indexOf('id="paja-resource-servers-form"')).toBeLessThan(aside!.indexOf('id="message-log"'));
      const keys = [...aside!.matchAll(/data-paja-section="([^"]+)"/g)].map((match) => match[1]);
      expect(keys).toEqual(config.target.mode === 'runtime-pointer'
        ? ['pointer', 'interfaces', 'acl', 'signer', 'resource-servers', 'messages']
        : ['interfaces', 'acl', 'signer', 'resource-servers', 'messages']);
      expect(aside!.match(/<details[^>]* open>/g)).toHaveLength(keys.length);
      expect(aside!.match(/<summary class="section-title">/g)).toHaveLength(keys.length);
      expect(aside).not.toMatch(/<details[^>]* name=/);
      expect(aside).toMatch(/id="message-log"[^>]*><\/div>\s*<\/div><\/details>\s*$/);
    }
  });
  it('renders minimal top and bottom bars with one sandboxed iframe', () => {
    const options = normalizePajaOptions({ targetUrl: 'http://127.0.0.1:5173' });
    const config = createPajaHostConfig(options, new Date('2026-06-21T00:00:00.000Z'));
    const html = renderPajaHtml(config);

    expect(html).toContain('<title>@kehto/paja</title>');
    expect(html).toContain('<div class="brand">@kehto/<span class="brand-product">paja</span></div>');
    expect(html).toContain('<header class="bar top">');
    expect(html).toContain('--paja-console-column: minmax(320px, 380px);');
    expect(html).toContain('.top { display: grid; grid-template-columns: var(--paja-console-column) minmax(0, 1fr);');
    expect(html).toContain('main { min-height: 0; display: grid; grid-template-columns: var(--paja-console-column) minmax(0, 1fr); }');
    expect(html).toContain('.console-toggle-glyph::before { content: \'\\00ab\'; }');
    expect(html).toContain('html[data-paja-console="collapsed"] .console-toggle-glyph::before { content: \'\\00bb\'; }');
    expect(html).toContain('html[data-paja-console="collapsed"] .top,');
    expect(html).toContain('html[data-paja-console="collapsed"] main { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }');
    expect(html).toContain('html[data-paja-console="collapsed"] .top-console,');
    expect(html).toContain('html[data-paja-console="collapsed"] .console { display: none; }');
    expect(html).toContain('.tabs { display: flex; align-items: stretch; align-self: flex-end;');
    expect(html).toContain('<div class="top-stage">');
    expect(html).toContain('id="napplet-tabs"');
    expect(html).toContain('<footer class="bar bottom">');
    expect(html).toContain('<iframe id="napplet-frame"');
    expect(html).toContain('sandbox="allow-scripts"');
    expect(html).toContain('data-target-url="http://127.0.0.1:5173/"');
    expect(html).toContain('id="simulation-theme"');
    expect(html).toContain('id="simulation-status"');
    expect(html).toContain('id="paja-confirmation-dialog"');
    expect(html).toContain('aria-labelledby="paja-confirmation-title"');
    expect(html).toContain('id="paja-confirmation-deny"');
    expect(html).toContain('id="paja-confirmation-approve"');
    expect(html).toContain('id="paja-signer-consent-kind"');
    expect(html).toContain('Always sign kind');
    expect(html).toContain('id="paja-signer-consent-napplet"');
    expect(html).toContain('Trust <strong id="paja-signer-consent-napplet-value"');
    expect(html).toContain('Warning: Paja will sign any event this napplet identity requests');
    expect(html).toContain('Direct-target trust survives code reloads at the same URL');
    expect(html).toContain('id="signer-consent-clear"');
    expect(html).toContain('id="paja-notification-center"');
    expect(html).toContain('id="paja-console-toggle"');
    expect(html).toContain('class="console-toggle"');
    expect(html).toContain('aria-controls="paja-console"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-label="Collapse the Paja development console"');
    expect(html).toContain('title="Collapse the Paja development console"');
    expect(html).toContain('<span class="console-toggle-glyph" aria-hidden="true"></span>');
    expect(html).toContain('id="paja-notification-badges"');
    expect(html).toContain('id="paja-config-dialog"');
    expect(html).toContain('id="paja-config-fields"');
    expect(html).toContain('id="paja-config-save"');
    expect(html).not.toContain('window.confirm');
    expect(html).toContain('identity:anon relay:live:4 storage:local upload:memory:simulator theme:dark off:none');
    expect(html).not.toContain('src="http://127.0.0.1:5173/"');
    expect(html).toContain('src="./__kehto/browser-host.js"');
    expect(html).not.toContain('id="runtime-pointer-form"');
    expect(html).not.toContain('side-panel');
    expect(html).not.toContain('playground');
  });

  it('renders one directional toggle that owns the console column and starts expanded', () => {
    const options = normalizePajaOptions({ targetUrl: 'http://127.0.0.1:5173' });
    const config = createPajaHostConfig(options, new Date('2026-06-21T00:00:00.000Z'));
    const html = renderPajaHtml(config);
    const toggle = html.match(/<button[^>]+id="paja-console-toggle"[^>]*>/)?.[0] ?? '';

    expect(html).toContain('<aside class="console" id="paja-console" aria-label="Paja development controls">');
    expect(html.match(/id="paja-console-toggle"/g)).toHaveLength(1);
    expect(toggle).toContain('class="console-toggle"');
    expect(toggle).toContain('aria-controls="paja-console"');
    expect(toggle).toContain('aria-expanded="true"');
    expect(toggle).toContain('aria-label="Collapse the Paja development console"');
    expect(html).not.toMatch(/<html[^>]*data-paja-console/);
  });

  it('embeds escaped host config JSON for browser bootstrap', () => {
    const options = normalizePajaOptions({ targetUrl: 'https://example.test/<napplet>' });
    const config = createPajaHostConfig(options, new Date('2026-06-21T00:00:00.000Z'));
    const html = renderPajaHtml(config);

    expect(html).toContain('id="kehto-paja-config"');
    expect(html).toContain('https://example.test/%3Cnapplet%3E');
    expect(html).not.toContain('https://example.test/<napplet>');
    expect(html).not.toContain('id="runtime-local-file"');
    expect(html).not.toContain('id="runtime-local-open"');
  });

  it('renders runtime pointer controls without target-url HMR', () => {
    const config = createPajaRuntimeHostConfig({ pointer: 'nevent1test' }, new Date('2026-06-30T00:00:00.000Z'));
    const html = renderPajaHtml(config);

    expect(html).toContain('id="runtime-pointer-form"');
    expect(html).toContain('id="runtime-pointer-input"');
    expect(html).toContain('id="napplet-tabs"');
    expect(html).toContain('grid-template-columns: minmax(0, 1fr) 24px 24px;');
    expect(html).toContain('.tab-share, .tab-close');
    expect(html).toContain('id="napplet-stage"');
    expect(html).toContain('id="empty-runtime-stage"');
    expect(html).toContain('id="duplicate-pointer-dialog"');
    expect(html).toContain('this napplet is already running.');
    expect(html).toContain('id="duplicate-load-again"');
    expect(html).toContain('id="duplicate-open-tab"');
    expect(html).toContain('id="duplicate-cancel"');
    expect(html).toContain('id="duplicate-cancel">cancel</button>');
    expect(html).not.toContain('cancel &lt;do nothing&gt;');
    expect(html).toContain('value="nevent1test"');
    expect(html).toContain('<button type="button" id="runtime-local-open"');
    expect(html).toContain('<input id="runtime-local-file" type="file" accept=".html,.htm,text/html"');
    expect(html).toContain('.pointer-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 6px; }');
    expect(html).toContain('.stage.drop-active { outline: 2px dashed var(--accent);');
    expect(html).toContain('.tab[data-source="local"] { grid-template-columns: minmax(0, 1fr) 24px; }');
    expect(html).toContain('Load a napplet pointer or drop an index.html to start a runtime tab.');
    expect(html).toContain('mode: <code>runtime-pointer</code>');
    expect(html).toContain('hmr: <code>none</code>');
    expect(html).not.toContain('<iframe id="napplet-frame"');
    expect(html).not.toContain('data-target-url="nevent1test"');
    expect(html).toContain('src="./__kehto/browser-host.js"');
    expect(html).not.toContain('src="about:blank"');
  });
});
