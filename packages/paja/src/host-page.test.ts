import { describe, expect, it } from 'vitest';
import { createPajaHostConfig, createPajaRuntimeHostConfig, normalizePajaOptions } from './options.js';
import { renderPajaHtml } from './host-page.js';

describe('@kehto/paja host page', () => {
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
    expect(html).toContain('.tabs { display: flex; align-items: stretch; align-self: flex-end;');
    expect(html).toContain('<div class="top-stage">');
    expect(html).toContain('id="napplet-tabs"');
    expect(html).toContain('<footer class="bar bottom">');
    expect(html).toContain('<iframe id="napplet-frame"');
    expect(html).toContain('sandbox="allow-scripts"');
    expect(html).toContain('data-target-url="http://127.0.0.1:5173/"');
    expect(html).toContain('id="simulation-theme"');
    expect(html).toContain('id="simulation-status"');
    expect(html).toContain('identity:anon relay:live:4 storage:local upload:memory:simulator theme:dark off:none');
    expect(html).not.toContain('src="http://127.0.0.1:5173/"');
    expect(html).toContain('src="./__kehto/browser-host.js"');
    expect(html).not.toContain('id="runtime-pointer-form"');
    expect(html).not.toContain('side-panel');
    expect(html).not.toContain('playground');
  });

  it('embeds escaped host config JSON for browser bootstrap', () => {
    const options = normalizePajaOptions({ targetUrl: 'https://example.test/<napplet>' });
    const config = createPajaHostConfig(options, new Date('2026-06-21T00:00:00.000Z'));
    const html = renderPajaHtml(config);

    expect(html).toContain('id="kehto-paja-config"');
    expect(html).toContain('https://example.test/%3Cnapplet%3E');
    expect(html).not.toContain('https://example.test/<napplet>');
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
    expect(html).toContain('mode: <code>runtime-pointer</code>');
    expect(html).toContain('hmr: <code>none</code>');
    expect(html).not.toContain('<iframe id="napplet-frame"');
    expect(html).not.toContain('data-target-url="nevent1test"');
    expect(html).toContain('src="./__kehto/browser-host.js"');
    expect(html).not.toContain('src="about:blank"');
  });
});
