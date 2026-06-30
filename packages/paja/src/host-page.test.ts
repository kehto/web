import { describe, expect, it } from 'vitest';
import { createPajaHostConfig, normalizePajaOptions } from './options.js';
import { renderPajaHtml } from './host-page.js';

describe('@kehto/paja host page', () => {
  it('renders minimal top and bottom bars with one sandboxed iframe', () => {
    const options = normalizePajaOptions({ targetUrl: 'http://127.0.0.1:5173' });
    const config = createPajaHostConfig(options, new Date('2026-06-21T00:00:00.000Z'));
    const html = renderPajaHtml(config);

    expect(html).toContain('<title>@kehto/paja</title>');
    expect(html).toContain('<div class="brand">@kehto/<span class="brand-product">paja</span></div>');
    expect(html).toContain('<header class="bar top">');
    expect(html).toContain('<footer class="bar bottom">');
    expect(html).toContain('<iframe id="napplet-frame"');
    expect(html).toContain('sandbox="allow-scripts"');
    expect(html).toContain('data-target-url="http://127.0.0.1:5173/"');
    expect(html).toContain('id="simulation-theme"');
    expect(html).toContain('id="simulation-status"');
    expect(html).toContain('identity:anon relay:1 storage:local theme:dark off:none');
    expect(html).not.toContain('src="http://127.0.0.1:5173/"');
    expect(html).toContain('src="/__kehto/browser-host.js"');
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
});
