import type { DevRuntimeHostConfig } from './options.js';

export function renderDevRuntimeHtml(config: DevRuntimeHostConfig): string {
  const configJson = escapeJsonForHtml(JSON.stringify(config));
  const targetUrl = escapeAttribute(config.target.url);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Kehto Dev Runtime</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #101211;
        --bar: #181b19;
        --line: #30352f;
        --text: #f4f0df;
        --muted: #a9ad9f;
        --accent: #d8c36a;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--text); font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { height: 100vh; display: grid; grid-template-rows: 38px minmax(0, 1fr) 30px; overflow: hidden; }
      .bar { display: flex; align-items: center; gap: 14px; min-width: 0; padding: 0 12px; background: var(--bar); border-color: var(--line); }
      .top { border-bottom: 1px solid var(--line); }
      .bottom { border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
      .brand { font-weight: 700; letter-spacing: 0; color: var(--accent); white-space: nowrap; }
      .target { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
      .spacer { flex: 1; min-width: 0; }
      button { border: 1px solid var(--line); color: var(--text); background: #20241f; height: 26px; padding: 0 10px; border-radius: 4px; font: inherit; cursor: pointer; }
      button:hover { border-color: var(--accent); }
      iframe { width: 100%; height: 100%; border: 0; background: white; display: block; }
      code { color: var(--text); }
    </style>
  </head>
  <body>
    <header class="bar top">
      <div class="brand">Kehto</div>
      <div class="target" title="${targetUrl}">${targetUrl}</div>
      <div class="spacer"></div>
      <button type="button" id="reload-target">Reload</button>
    </header>
    <main>
      <iframe id="napplet-frame" title="Napplet development target" sandbox="allow-scripts" data-target-url="${targetUrl}"></iframe>
    </main>
    <footer class="bar bottom">
      <span>mode: <code>${config.target.command ? 'managed-command' : 'external-target'}</code></span>
      <span>hmr: <code>${config.target.hmrStrategy}</code></span>
      <span>runtime: <code>${escapeHtml(config.runtime.host)}:${config.runtime.port}</code></span>
      <span>state: <code id="lifecycle-status">booting</code></span>
    </footer>
    <script type="application/json" id="kehto-dev-runtime-config">${configJson}</script>
    <script type="module" src="/__kehto/browser-host.js"></script>
  </body>
</html>`;
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', '&quot;');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeJsonForHtml(value: string): string {
  return value.replaceAll('<', '\\u003c');
}
