import type { PajaHostConfig } from './options.js';
import { summarizePajaSimulation } from './simulation.js';

/**
 * Render the browser host page for a Paja runtime config.
 *
 * @param config - Serializable host-page config.
 * @returns Complete HTML document served by Paja.
 */
export function renderPajaHtml(config: PajaHostConfig): string {
  const configJson = escapeJsonForHtml(JSON.stringify(config));
  const targetLabel = escapeAttribute(getTargetLabel(config));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@kehto/paja</title>
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
      .brand-product { color: var(--text); }
      .target { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
      .spacer { flex: 1; min-width: 0; }
      .tabs { display: flex; align-items: stretch; gap: 4px; min-width: 120px; max-width: min(58vw, 760px); overflow-x: auto; scrollbar-width: thin; }
      .tabs:empty { display: none; }
      .tab { min-width: 96px; max-width: 220px; height: 30px; display: grid; grid-template-columns: minmax(0, 1fr) 24px; align-items: center; gap: 2px; border: 1px solid var(--line); border-bottom-color: transparent; background: #151815; color: var(--muted); border-radius: 5px 5px 0 0; padding: 0 2px 0 9px; }
      .tab[data-active="true"] { color: var(--text); border-color: var(--accent); border-bottom-color: #151815; background: #20241f; }
      .tab-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; text-align: left; }
      .tab-close { width: 20px; height: 20px; padding: 0; border: 0; background: transparent; color: var(--muted); display: inline-grid; place-items: center; }
      .tab-close:hover { color: var(--text); background: #2d302b; border-color: transparent; }
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
      .pointer-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
      .pointer-status { min-width: 0; color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
      .log-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
      .log-list { min-height: 160px; max-height: 38vh; overflow: auto; border: 1px solid var(--line); border-radius: 4px; background: #0b0d0b; }
      .log-row { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 6px; padding: 5px 7px; border-bottom: 1px solid #1b1f1a; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
      .log-row[data-error="true"] { background: #1d1414; }
      .log-row:last-child { border-bottom: 0; }
      .log-dir { color: var(--muted); }
      .log-body { min-width: 0; display: grid; gap: 2px; }
      .log-type { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .log-detail { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e6a5a5; }
      .stage { min-width: 0; min-height: 0; position: relative; background: #050705; }
      .empty-stage { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: 12px; }
      .empty-stage[hidden] { display: none; }
      .tab-panel { position: absolute; inset: 0; min-width: 0; min-height: 0; }
      .tab-panel[hidden] { display: none; }
      iframe { width: 100%; height: 100%; border: 0; background: white; display: block; }
      code { color: var(--text); }
      .dialog-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 24px; background: rgb(0 0 0 / 0.58); }
      .dialog-backdrop[hidden] { display: none; }
      .dialog { width: min(420px, 100%); border: 1px solid var(--line); border-radius: 6px; background: #181b19; box-shadow: 0 18px 60px rgb(0 0 0 / 0.45); padding: 16px; display: grid; gap: 14px; }
      .dialog-title { font-weight: 700; color: var(--text); }
      .dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
      @media (max-width: 900px) {
        main { grid-template-columns: 1fr; grid-template-rows: minmax(240px, 40vh) minmax(0, 1fr); }
        .console { border-right: 0; border-bottom: 1px solid var(--line); }
      }
    </style>
  </head>
  <body>
    <header class="bar top">
      <div class="brand">@kehto/<span class="brand-product">paja</span></div>
      <div class="target" title="${targetLabel}">${targetLabel}</div>
      <div class="tabs" id="napplet-tabs" role="tablist" aria-label="Loaded napplets"></div>
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
        ${renderPointerControls(config)}
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
      ${renderStage(config, targetLabel)}
    </main>
    ${renderDuplicateDialog()}
    <footer class="bar bottom">
      <span>mode: <code>${escapeHtml(getModeLabel(config))}</code></span>
      <span>hmr: <code>${config.target.hmrStrategy}</code></span>
      <span>runtime: <code>${escapeHtml(config.runtime.host)}:${config.runtime.port}</code></span>
      <span>sim: <code id="simulation-status">${escapeHtml(summarizePajaSimulation(config.simulation))}</code></span>
      <span>state: <code id="lifecycle-status">booting</code></span>
    </footer>
    <script type="application/json" id="kehto-paja-config">${configJson}</script>
    <script type="module" src="./__kehto/browser-host.js"></script>
  </body>
</html>`;
}

function renderStage(config: PajaHostConfig, targetLabel: string): string {
  if (config.target.mode === 'runtime-pointer') {
    return `<section class="stage" id="napplet-stage" aria-label="Loaded napplet runtimes">
        <div class="empty-stage" id="empty-runtime-stage">Load a napplet pointer to start a runtime tab.</div>
      </section>`;
  }
  return `<section class="stage" id="napplet-stage">
        <iframe id="napplet-frame" title="Napplet development target" sandbox="allow-scripts" data-target-url="${targetLabel}"></iframe>
      </section>`;
}

function renderDuplicateDialog(): string {
  return `<div class="dialog-backdrop" id="duplicate-pointer-dialog" hidden>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="duplicate-pointer-title">
        <div class="dialog-title" id="duplicate-pointer-title">this napplet is already running.</div>
        <div class="dialog-actions">
          <button type="button" id="duplicate-load-again">load it again</button>
          <button type="button" id="duplicate-open-tab">open it in tab</button>
          <button type="button" id="duplicate-cancel">cancel &lt;do nothing&gt;</button>
        </div>
      </div>
    </div>`;
}

function renderPointerControls(config: PajaHostConfig): string {
  if (config.target.mode !== 'runtime-pointer') return '';
  const value = escapeAttribute(config.target.pointer?.value ?? '');
  return `<section class="section" id="runtime-pointer-section">
          <div class="section-title">Pointer</div>
          <form class="pointer-controls" id="runtime-pointer-form">
            <input id="runtime-pointer-input" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="naddr or nevent" aria-label="Runtime napplet pointer" value="${value}">
            <button type="submit" id="runtime-pointer-load">Load</button>
          </form>
          <div class="pointer-status" id="runtime-pointer-status" aria-live="polite">idle</div>
        </section>`;
}

function getModeLabel(config: PajaHostConfig): string {
  if (config.target.mode === 'runtime-pointer') return 'runtime-pointer';
  return config.target.command ? 'managed-command' : 'external-target';
}

function getTargetLabel(config: PajaHostConfig): string {
  if (config.target.mode === 'runtime-pointer') {
    return config.target.pointer?.value ?? 'runtime pointer';
  }
  return config.target.url;
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
