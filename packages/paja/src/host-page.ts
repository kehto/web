import type { PajaHostConfig } from './options.js';
import { summarizePajaSimulation } from './simulation.js';

export function renderPajaHtml(config: PajaHostConfig): string {
  const configJson = escapeJsonForHtml(JSON.stringify(config));
  const targetUrl = escapeAttribute(config.target.url);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Kehto Paja</title>
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
      label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); white-space: nowrap; }
      select, input { border: 1px solid var(--line); color: var(--text); background: #20241f; height: 26px; border-radius: 4px; font: inherit; }
      main { min-height: 0; display: grid; grid-template-columns: minmax(320px, 380px) minmax(0, 1fr); }
      .console { min-height: 0; overflow: auto; border-right: 1px solid var(--line); background: #121512; padding: 10px; display: flex; flex-direction: column; gap: 12px; }
      .section { display: grid; gap: 8px; }
      .section-title { color: var(--accent); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0; }
      .switch-grid, .acl-grid { display: flex; flex-wrap: wrap; gap: 6px; }
      .toggle { height: 24px; padding: 0 8px; color: var(--muted); }
      .toggle[data-enabled="true"] { color: var(--text); border-color: #5f724f; background: #24301f; }
      .toggle[data-enabled="false"] { color: #8d9187; border-color: #453536; background: #241d1d; }
      .signer { color: var(--muted); word-break: break-all; font-size: 12px; }
      .signer-controls { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; gap: 6px; }
      .signer-controls button[data-active="true"] { border-color: var(--accent); color: var(--text); background: #2a2a1d; }
      .signer-controls input { min-width: 0; padding: 0 8px; }
      .log-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
      .log-list { min-height: 160px; max-height: 38vh; overflow: auto; border: 1px solid var(--line); border-radius: 4px; background: #0b0d0b; }
      .log-row { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 6px; padding: 5px 7px; border-bottom: 1px solid #1b1f1a; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
      .log-row[data-error="true"] { background: #1d1414; }
      .log-row:last-child { border-bottom: 0; }
      .log-dir { color: var(--muted); }
      .log-body { min-width: 0; display: grid; gap: 2px; }
      .log-type { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .log-detail { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e6a5a5; }
      .stage { min-width: 0; min-height: 0; }
      iframe { width: 100%; height: 100%; border: 0; background: white; display: block; }
      code { color: var(--text); }
      @media (max-width: 900px) {
        main { grid-template-columns: 1fr; grid-template-rows: minmax(240px, 40vh) minmax(0, 1fr); }
        .console { border-right: 0; border-bottom: 1px solid var(--line); }
      }
    </style>
  </head>
  <body>
    <header class="bar top">
      <div class="brand">Kehto</div>
      <div class="target" title="${targetUrl}">${targetUrl}</div>
      <div class="spacer"></div>
      <label>theme
        <select id="simulation-theme" aria-label="Simulation theme">
          <option value="dark"${config.simulation.theme.mode === 'dark' ? ' selected' : ''}>dark</option>
          <option value="light"${config.simulation.theme.mode === 'light' ? ' selected' : ''}>light</option>
        </select>
      </label>
      <button type="button" id="reload-target">Reload</button>
    </header>
    <main>
      <aside class="console" aria-label="Paja development controls">
        <section class="section">
          <div class="section-title">Interfaces</div>
          <div class="switch-grid" id="interface-toggles"></div>
        </section>
        <section class="section">
          <div class="section-title">ACL</div>
          <div class="acl-grid" id="acl-controls"></div>
        </section>
        <section class="section">
          <div class="section-title">Signer</div>
          <div class="signer" id="signer-status">loading</div>
          <div class="signer-controls" id="signer-controls"></div>
        </section>
        <section class="section">
          <div class="section-title">Messages</div>
          <div class="log-tools">
            <input id="message-filter" type="search" autocomplete="off" placeholder="filter messages" aria-label="Filter message log">
            <button type="button" id="clear-log">Clear</button>
          </div>
          <div class="log-list" id="message-log" aria-live="polite"></div>
        </section>
      </aside>
      <section class="stage">
        <iframe id="napplet-frame" title="Napplet development target" sandbox="allow-scripts" data-target-url="${targetUrl}"></iframe>
      </section>
    </main>
    <footer class="bar bottom">
      <span>mode: <code>${config.target.command ? 'managed-command' : 'external-target'}</code></span>
      <span>hmr: <code>${config.target.hmrStrategy}</code></span>
      <span>runtime: <code>${escapeHtml(config.runtime.host)}:${config.runtime.port}</code></span>
      <span>sim: <code id="simulation-status">${escapeHtml(summarizePajaSimulation(config.simulation))}</code></span>
      <span>state: <code id="lifecycle-status">booting</code></span>
    </footer>
    <script type="application/json" id="kehto-paja-config">${configJson}</script>
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
