import { describe, expect, it } from 'vitest';
import { createDevRuntimeHostConfig, normalizeDevRuntimeOptions } from './options.js';
import { renderDevRuntimeHtml } from './host-page.js';

describe('@kehto/dev-runtime host page', () => {
  it('renders minimal top and bottom bars with one sandboxed iframe', () => {
    const options = normalizeDevRuntimeOptions({ targetUrl: 'http://127.0.0.1:5173' });
    const config = createDevRuntimeHostConfig(options, new Date('2026-06-21T00:00:00.000Z'));
    const html = renderDevRuntimeHtml(config);

    expect(html).toContain('<header class="bar top">');
    expect(html).toContain('<footer class="bar bottom">');
    expect(html).toContain('<iframe id="napplet-frame"');
    expect(html).toContain('sandbox="allow-scripts"');
    expect(html).toContain('src="http://127.0.0.1:5173/"');
    expect(html).not.toContain('side-panel');
    expect(html).not.toContain('playground');
  });

  it('embeds escaped host config JSON for browser bootstrap', () => {
    const options = normalizeDevRuntimeOptions({ targetUrl: 'https://example.test/<napplet>' });
    const config = createDevRuntimeHostConfig(options, new Date('2026-06-21T00:00:00.000Z'));
    const html = renderDevRuntimeHtml(config);

    expect(html).toContain('id="kehto-dev-runtime-config"');
    expect(html).toContain('https://example.test/%3Cnapplet%3E');
    expect(html).not.toContain('https://example.test/<napplet>');
  });
});
