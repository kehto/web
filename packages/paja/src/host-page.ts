import {
  PAJA_CONSOLE_COLLAPSE_LABEL,
  PAJA_CONSOLE_PANEL_ID,
  PAJA_CONSOLE_TOGGLE_ID,
} from './browser-console-panel.js';
import {
  PAJA_EVENT_COUNTER_RESET_ID,
  PAJA_EVENT_COUNTER_RESET_LABEL,
  PAJA_EVENT_COUNTER_RESET_TITLE,
} from './browser-relay-panel.js';
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
        --paja-console-column: minmax(320px, 380px);
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--text); font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { height: 100vh; display: grid; grid-template-rows: 38px minmax(0, 1fr) 30px; overflow: hidden; }
      .bar { display: flex; align-items: center; gap: 14px; min-width: 0; padding: 0 12px; background: var(--bar); border-color: var(--line); }
      .top { display: grid; grid-template-columns: var(--paja-console-column) minmax(0, 1fr); align-items: stretch; gap: 0; padding: 0; border-bottom: 1px solid var(--line); }
      .top-console { min-width: 0; display: flex; align-items: center; gap: 14px; padding: 0 12px; border-right: 1px solid var(--line); }
      .top-stage { min-width: 0; display: flex; align-items: stretch; gap: 14px; padding: 0 12px 0 10px; overflow: hidden; }
      .bottom { border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
      .brand { font-weight: 700; letter-spacing: 0; color: var(--accent); white-space: nowrap; }
      .brand-product { color: var(--text); }
      .target { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
      .spacer { flex: 1; min-width: 0; }
      .console-toggle { align-self: center; flex: 0 0 auto; width: 28px; height: 24px; padding: 0; display: inline-grid; place-items: center; color: var(--text); }
      .console-toggle-glyph { font-size: 15px; line-height: 1; }
      #paja-gamepads { display: flex; align-items: center; gap: 7px; flex: 0 1 auto; min-width: 0; overflow-x: auto; }
      #paja-gamepads:empty { display: none; }
      .gamepad-indicator { display: inline-flex; align-items: center; flex: 0 0 auto; color: var(--pad-color); opacity: .65; padding: 3px 1px; }
      .gamepad-indicator small { font-size: 10px; font-weight: 700; margin-left: 2px; }
      .gamepad-indicator[data-activity="active"] { opacity: 1; background: color-mix(in srgb, var(--pad-color) 18%, transparent); border-radius: 5px; }
      .gamepad-indicator[data-activity="active"] svg { animation: var(--pad-animation) var(--pad-duration) ease-in-out infinite; }
      @keyframes gamepad-bounce { 50% { transform: translateY(var(--pad-lift)); } }
      @keyframes gamepad-rock {
        25% { transform: rotate(var(--pad-turn)); }
        75% { transform: rotate(calc(-1 * var(--pad-turn))); }
      }
      @keyframes gamepad-pulse { 50% { transform: scale(1.18); } }
      @keyframes gamepad-nudge {
        25% { transform: translateX(var(--pad-lift)); }
        75% { transform: translateX(calc(-1 * var(--pad-lift))); }
      }
      @media (prefers-reduced-motion: reduce) {
        .gamepad-indicator[data-activity="active"] svg { animation: none; }
      }
      .console-toggle-glyph::before { content: '\\00ab'; }
      html[data-paja-console="collapsed"] .console-toggle-glyph::before { content: '\\00bb'; }
      /* Collapsing is presentation-only: the console column, its top-bar cell,
         and the bottom status bar leave the grid and the stage reclaims the
         full width, so the target iframe keeps its identity, generation, and
         loaded napplet. The body track list shrinks with them, because
         display:none alone would leave the footer's 30px row reserved. */
      html[data-paja-console="collapsed"] .top,
      html[data-paja-console="collapsed"] main { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
      html[data-paja-console="collapsed"] body { grid-template-rows: 38px minmax(0, 1fr); }
      html[data-paja-console="collapsed"] .top-console,
      html[data-paja-console="collapsed"] .console,
      html[data-paja-console="collapsed"] .bottom { display: none; }
      .tabs { display: flex; align-items: stretch; align-self: flex-end; gap: 4px; min-width: 120px; max-width: min(100%, 760px); overflow-x: auto; scrollbar-width: thin; }
      .tabs:empty { display: none; }
      .tab { min-width: 116px; max-width: 240px; height: 30px; display: grid; grid-template-columns: minmax(0, 1fr) 24px 24px; align-items: center; gap: 2px; border: 1px solid var(--line); border-bottom-color: transparent; background: #151815; color: var(--muted); border-radius: 5px 5px 0 0; padding: 0 2px 0 9px; }
      .tab[data-source="local"] { grid-template-columns: minmax(0, 1fr) 24px; }
      .tab[data-active="true"] { color: var(--text); border-color: var(--accent); border-bottom-color: #151815; background: #20241f; }
      .tab-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; text-align: left; }
      .tab-share, .tab-close { width: 20px; height: 20px; padding: 0; border: 0; background: transparent; color: var(--muted); display: inline-grid; place-items: center; }
      .tab-share:hover, .tab-close:hover { color: var(--text); background: #2d302b; border-color: transparent; }
      button { border: 1px solid var(--line); color: var(--text); background: #20241f; height: 26px; padding: 0 10px; border-radius: 4px; font: inherit; cursor: pointer; }
      button:hover { border-color: var(--accent); }
      label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); white-space: nowrap; }
      select, input, textarea { border: 1px solid var(--line); color: var(--text); background: #20241f; min-height: 26px; border-radius: 4px; font: inherit; }
      main { min-height: 0; display: grid; grid-template-columns: var(--paja-console-column) minmax(0, 1fr); }
      .console { min-height: 0; overflow: auto; border-right: 1px solid var(--line); background: #121512; padding: 0; display: flex; flex-direction: column; gap: 0; }
      .section { flex-shrink: 0; margin: 0; border-radius: 0; border-bottom: 1px solid var(--line); }
      .section > summary { display: flex; align-items: center; justify-content: space-between; padding: 12px; cursor: pointer; list-style: none; }
      .section > summary::-webkit-details-marker { display: none; }
      .section > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
      .section-chevron { transition: transform 120ms; }
      .section[open] > summary .section-chevron { transform: rotate(90deg); }
      .section-body { padding: 0 12px 12px; display: grid; gap: 8px; }
      .resource-servers { display: grid; gap: 8px; }
      .resource-servers > label { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      .section-title { color: var(--accent); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0; }
      .resource-servers { min-width: 0; }
      .resource-servers label { white-space: normal; }
      .resource-servers textarea { width: 100%; min-width: 0; padding: 6px; resize: vertical; }
      .resource-servers small, .resource-servers [role="status"] { color: var(--muted); overflow-wrap: anywhere; }
      .switch-grid, .acl-grid { display: flex; flex-wrap: wrap; gap: 6px; }
      .hint { margin: 0; color: var(--muted); font-size: 11px; overflow-wrap: anywhere; }
      .toggle { height: 24px; padding: 0 8px; color: var(--muted); }
      .toggle[data-enabled="true"] { color: var(--text); border-color: #5f724f; background: #24301f; }
      .toggle[data-enabled="false"] { color: #8d9187; border-color: #453536; background: #241d1d; }
      .toggle[data-state="unconfigured"] { color: #e8d27a; border-color: #7a6a2a; background: #2d2814; }
      .llm-form { display: grid; gap: 6px; min-width: 0; }
      .llm-form label { display: grid; gap: 2px; color: var(--muted); font-size: 11px; }
      .llm-form label.llm-check { grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 6px; }
      .llm-form input:not([type="checkbox"]), .llm-form select { width: 100%; min-width: 0; padding: 0 8px; height: 24px; }
      .llm-actions { display: flex; flex-wrap: wrap; gap: 6px; }
      .llm-connections { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
      .llm-connection { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px; padding: 4px 6px; border: 1px solid var(--line); border-radius: 4px; background: #0b0d0b; font-size: 11px; }
      .llm-connection-label { min-width: 0; overflow-wrap: anywhere; color: var(--text); }
      .llm-select-dialog select, .llm-vault-dialog input { width: 100%; min-width: 0; padding: 4px 8px; }
      .llm-vault-dialog .config-error:empty { display: none; }
      .signer { color: var(--muted); word-break: break-all; font-size: 12px; }
      .signer-controls { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; gap: 6px; }
      .signer-controls button[data-active="true"] { border-color: var(--accent); color: var(--text); background: #2a2a1d; }
      .signer-controls input { min-width: 0; padding: 0 8px; }
      .signer-consent-clear { width: 100%; margin-top: 6px; }
      .pointer-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 6px; }
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
      .event-list { min-height: 44px; max-height: 34vh; overflow: auto; border: 1px solid var(--line); border-radius: 4px; background: #0b0d0b; padding: 4px 0; }
      .event-box + .event-box { margin-top: 6px; border-top: 1px solid #1b1f1a; }
      .event-box-head { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; padding: 5px 8px 3px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
      .event-box-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
      .event-box-count { color: var(--accent); }
      .event-box-note { color: var(--muted); font-style: italic; text-transform: none; letter-spacing: normal; }
      .event-relay { padding: 1px 0 2px; }
      .event-relay-head { display: grid; grid-template-columns: minmax(0, 1fr) 56px 22px auto; align-items: center; gap: 6px; padding: 2px 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
      .event-relay-url { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
      .event-bar { display: block; height: 5px; border-radius: 3px; background: #1b1f1a; overflow: hidden; }
      .event-bar-fill { display: block; height: 100%; background: var(--accent); }
      .event-relay[data-relay-count="0"] .event-bar { background: #141714; }
      .event-relay-count { color: var(--accent); text-align: right; }
      .event-relay[data-relay-count="0"] .event-relay-count { color: var(--muted); }
      .event-relay-idle { color: var(--muted); font-size: 10px; font-style: italic; }
      .event-kinds { padding-left: 16px; }
      .event-row { display: grid; grid-template-columns: 64px 12px minmax(0, 1fr); align-items: baseline; gap: 6px; padding: 2px 8px 2px 16px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
      .event-kind { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; color: var(--text); }
      .event-separator { color: var(--muted); text-align: center; }
      .event-count { color: var(--accent); text-align: left; }
      .event-empty { padding: 4px 8px; color: var(--muted); font-style: italic; font-size: 11px; }
      .section-total { color: var(--muted); font-size: 11px; margin-left: auto; }
      .section-total:empty { display: none; }
      .section-reset { flex: 0 0 auto; height: 18px; margin-left: 8px; padding: 0 6px; color: var(--muted); font-size: 10px; text-transform: lowercase; }
      .section-total:empty + .section-reset { margin-left: auto; }
      .section-total ~ .section-chevron { margin-left: 8px; }
      .stage { min-width: 0; min-height: 0; position: relative; background: #050705; }
      .empty-stage { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: 12px; }
      .empty-stage[hidden] { display: none; }
      .stage.drop-active { outline: 2px dashed var(--accent); outline-offset: -6px; }
      .intent-link-notice { position: fixed; bottom: 36px; right: 16px; max-width: min(420px, calc(100vw - 32px)); z-index: 30; padding: 12px; background: var(--bar); border: 1px solid var(--line); border-radius: 8px; }
      .intent-link-notice[hidden] { display: none; }
      .tab-panel { position: absolute; inset: 0; min-width: 0; min-height: 0; }
      .tab-panel[hidden] { display: none; }
      iframe { width: 100%; height: 100%; border: 0; background: white; display: block; }
      code { color: var(--text); }
      .dialog-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 24px; background: rgb(0 0 0 / 0.58); }
      .dialog-backdrop[hidden] { display: none; }
      .dialog { width: min(420px, 100%); border: 1px solid var(--line); border-radius: 6px; background: #181b19; box-shadow: 0 18px 60px rgb(0 0 0 / 0.45); padding: 16px; display: grid; gap: 14px; }
      .dialog-title { font-weight: 700; color: var(--text); }
      .dialog-copy { color: var(--muted); }
      .dialog-details { margin: 0; padding: 10px; border: 1px solid var(--line); border-radius: 4px; background: #0b0d0b; color: var(--text); font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
      .dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
      .confirmation-dialog { width: min(520px, calc(100% - 48px)); max-width: none; border: 0; padding: 0; background: transparent; color: var(--text); }
      .confirmation-dialog::backdrop { background: rgb(0 0 0 / 0.68); }
      .llm-select-dialog, .llm-vault-dialog { width: min(520px, calc(100% - 48px)); max-width: none; border: 0; padding: 0; background: transparent; color: var(--text); }
      .llm-select-dialog::backdrop, .llm-vault-dialog::backdrop { background: rgb(0 0 0 / 0.68); }
      .signer-consent { min-width: 0; margin: 0; padding: 10px; border: 1px solid var(--line); border-radius: 4px; display: grid; gap: 8px; }
      .signer-consent[hidden] { display: none; }
      .signer-consent legend { color: var(--accent); padding: 0 5px; }
      .signer-consent label { white-space: normal; overflow-wrap: anywhere; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 8px; }
      .signer-consent input { margin-top: 3px; }
      .signer-consent-trust { padding: 8px; border: 1px solid #9a5d2f; border-radius: 4px; background: #332014; }
      .signer-consent-warning { display: block; margin-top: 4px; color: #ffbd80; font-weight: 700; }
      .config-dialog { width: min(620px, calc(100% - 48px)); max-width: none; max-height: min(760px, calc(100% - 48px)); border: 0; padding: 0; background: transparent; color: var(--text); }
      .config-dialog::backdrop { background: rgb(0 0 0 / 0.68); }
      .config-dialog .dialog { width: 100%; max-height: inherit; grid-template-rows: auto auto minmax(0, 1fr) auto auto; }
      .config-fields { min-height: 0; overflow: auto; display: grid; gap: 12px; }
      .config-field { display: grid; align-items: stretch; gap: 5px; white-space: normal; }
      .config-field-label { color: var(--text); font-weight: 600; }
      .config-field input:not([type="checkbox"]), .config-field select, .config-field textarea { width: 100%; padding: 4px 7px; }
      .config-field textarea { resize: vertical; }
      .config-field small, .config-empty { color: var(--muted); }
      .config-group { margin: 0; padding: 10px; border: 1px solid var(--line); border-radius: 4px; display: grid; gap: 10px; }
      .config-group legend { color: var(--accent); padding: 0 5px; }
      .config-error { min-height: 1.4em; color: #e6a5a5; }
      .paja-notification-center { position: fixed; right: 16px; bottom: 46px; z-index: 10; width: min(360px, calc(100vw - 32px)); display: grid; gap: 8px; pointer-events: none; }
      .paja-notification { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 6px; background: #181b19; box-shadow: 0 10px 30px rgb(0 0 0 / 0.45); pointer-events: auto; }
      .paja-notification[data-priority="high"], .paja-notification[data-priority="urgent"] { border-left-color: #e89b5b; }
      .paja-notification-header { display: flex; align-items: center; gap: 8px; }
      .paja-notification-origin { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 11px; }
      .paja-notification-close { height: 22px; padding: 0 6px; color: var(--muted); font-size: 11px; }
      .paja-notification-body { height: auto; min-height: 28px; padding: 0; border: 0; background: transparent; display: grid; gap: 3px; text-align: left; }
      .paja-notification-body:hover { border-color: transparent; }
      .paja-notification-body span { color: var(--muted); }
      .paja-notification-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 6px; }
      .paja-notification-action { height: 24px; }
      .paja-notification-badges { position: fixed; right: 12px; top: 7px; z-index: 11; display: flex; gap: 6px; pointer-events: none; }
      .paja-notification-badge { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 7px; border: 1px solid #5f724f; border-radius: 999px; background: #24301f; color: var(--text); font-size: 11px; }
      @media (max-width: 900px) {
        .top { grid-template-columns: minmax(0, 1fr); }
        .top-console { display: none; }
        .top-stage { padding-left: 0; }
        .console-toggle { margin-left: 8px; }
        main { grid-template-columns: 1fr; grid-template-rows: minmax(240px, 40vh) minmax(0, 1fr); }
        .console { border-right: 0; border-bottom: 1px solid var(--line); }
      }
    </style>
  </head>
  <body>
    <header class="bar top">
      <div class="top-console">
        <div class="brand">@kehto/<span class="brand-product">paja</span></div>
        <div class="target" title="${targetLabel}">${targetLabel}</div>
      </div>
      <div class="top-stage">
        <button
          type="button"
          id="${PAJA_CONSOLE_TOGGLE_ID}"
          class="console-toggle"
          aria-expanded="true"
          aria-controls="${PAJA_CONSOLE_PANEL_ID}"
          aria-label="${PAJA_CONSOLE_COLLAPSE_LABEL}"
          title="${PAJA_CONSOLE_COLLAPSE_LABEL}"
        ><span class="console-toggle-glyph" aria-hidden="true"></span></button>
        <div id="paja-gamepads" role="group" aria-label="Connected controllers"></div>
        <div class="tabs" id="napplet-tabs" role="tablist" aria-label="Loaded napplets"></div>
        <div class="spacer"></div>
        <label>theme
          <select id="simulation-theme" aria-label="Simulation theme">
            <option value="dark"${config.simulation.theme.mode === 'dark' ? ' selected' : ''}>dark</option>
            <option value="light"${config.simulation.theme.mode === 'light' ? ' selected' : ''}>light</option>
          </select>
        </label>
        <button type="button" id="reload-target">Reload</button>
      </div>
    </header>
    <main>
      <aside class="console" id="${PAJA_CONSOLE_PANEL_ID}" aria-label="Paja development controls">
        ${renderPointerControls(config)}
        <details class="section" id="paja-section-interfaces" data-paja-section="interfaces" open>
          <summary class="section-title">Interfaces<span class="section-chevron" aria-hidden="true">›</span></summary><div class="section-body">
          <div class="switch-grid" id="interface-toggles"></div>
          <p class="hint" id="paja-fs-support" role="status"></p>
        </div></details>
        ${renderExtensionsSection(config)}
        <details class="section" id="paja-section-acl" data-paja-section="acl" open>
          <summary class="section-title">ACL<span class="section-chevron" aria-hidden="true">›</span></summary><div class="section-body">
          <div class="acl-grid" id="acl-controls"></div>
          <p class="hint">ACL grants allow operations; they do not add missing browser APIs. See Interfaces for FS picker support.</p>
        </div></details>
        <details class="section" id="paja-section-signer" data-paja-section="signer" open>
          <summary class="section-title">Signer<span class="section-chevron" aria-hidden="true">›</span></summary><div class="section-body">
          <div class="signer" id="signer-status">loading</div>
          <div class="signer-controls" id="signer-controls"></div>
          <button type="button" class="signer-consent-clear" id="signer-consent-clear" hidden>Forget remembered approvals</button>
        </div></details>
        <details class="section" id="paja-section-resource-servers" data-paja-section="resource-servers" open>
          <summary class="section-title">Resource servers<span class="section-chevron" aria-hidden="true">›</span></summary><div class="section-body">
        <form class="resource-servers" id="paja-resource-servers-form">
          <label class="section-title" for="paja-resource-servers-input">Resource servers</label>
          <textarea id="paja-resource-servers-input" rows="3" aria-describedby="paja-resource-servers-help paja-resource-servers-status" spellcheck="false"></textarea>
          <small id="paja-resource-servers-help">Extra Blossom lookup servers, one per line. Domains use HTTPS.</small>
          <button type="submit" id="paja-resource-servers-save">Save</button>
          <div id="paja-resource-servers-status" role="status" aria-live="polite"></div>
        </form>
        </div></details>
        <details class="section" id="paja-section-llm" data-paja-section="llm" open>
          <summary class="section-title">Language models<span class="section-chevron" aria-hidden="true">›</span></summary><div class="section-body">
          <ul class="llm-connections" id="paja-llm-connections" aria-label="Configured model connections"></ul>
          <form class="llm-form" id="paja-llm-form" autocomplete="off">
            <label>Provider<select id="paja-llm-preset" aria-label="Provider preset"></select></label>
            <label>Name<input id="paja-llm-name" type="text" required maxlength="64" spellcheck="false"></label>
            <label>API base URL<input id="paja-llm-base-url" type="url" required spellcheck="false" placeholder="API root; presets fill this in"></label>
            <label>Model<input id="paja-llm-model" type="text" required maxlength="200" spellcheck="false" list="paja-llm-model-examples"><datalist id="paja-llm-model-examples"></datalist></label>
            <label>API key<input id="paja-llm-credential" type="password" autocomplete="off" spellcheck="false"></label>
            <label class="llm-check"><input id="paja-llm-remember" type="checkbox"><span>Remember the key, encrypted with a vault password</span></label>
            <label class="llm-check"><input id="paja-llm-images" type="checkbox"><span>Accepts image input</span></label>
            <label class="llm-check"><input id="paja-llm-json" type="checkbox" checked><span>Supports JSON-object output</span></label>
            <div class="llm-actions">
              <button type="submit" id="paja-llm-save">Add connection</button>
              <button type="button" id="paja-llm-vault-lock" hidden>Lock vault</button>
            </div>
            <p class="hint" id="paja-llm-status" role="status" aria-live="polite"></p>
          </form>
          <p class="hint">Keys go only to the connection's base URL and never to napplets. Every generation asks for your consent first (draft NAP-LLM).</p>
        </div></details>
        <details class="section" id="paja-section-messages" data-paja-section="messages" open>
          <summary class="section-title">Messages<span class="section-chevron" aria-hidden="true">›</span></summary><div class="section-body">
          <div class="log-tools">
            <input id="message-filter" type="search" autocomplete="off" placeholder="filter messages" aria-label="Filter message log">
            <button type="button" id="clear-log">Clear</button>
          </div>
          <div class="log-list" id="message-log" aria-live="polite"></div>
        </div></details>
        <details class="section" id="paja-section-events" data-paja-section="events" open>
          <summary class="section-title">Events<span class="section-total" id="event-kind-total" aria-hidden="true"></span><button
            type="button"
            id="${PAJA_EVENT_COUNTER_RESET_ID}"
            class="section-reset"
            title="${PAJA_EVENT_COUNTER_RESET_TITLE}"
            aria-label="${PAJA_EVENT_COUNTER_RESET_TITLE}"
          >${PAJA_EVENT_COUNTER_RESET_LABEL}</button><span class="section-chevron" aria-hidden="true">›</span></summary><div class="section-body">
          <div class="event-list" id="event-kind-counts" aria-label="Relay receipts by read reason, relay, and event kind"></div>
        </div></details>
      </aside>
      ${renderStage(config, targetLabel)}
    </main>
    <div class="paja-notification-badges" id="paja-notification-badges" aria-label="Napplet notification badges"></div>
    <section class="paja-notification-center" id="paja-notification-center" aria-label="Napplet notifications" aria-live="polite"></section>
    ${renderConfirmationDialog()}
    ${renderLlmDialogs()}
    ${renderConfigDialog()}
    ${renderIntentLinkDialog()}
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

function renderConfirmationDialog(): string {
  return `<dialog class="confirmation-dialog" id="paja-confirmation-dialog" aria-labelledby="paja-confirmation-title" aria-describedby="paja-confirmation-summary paja-confirmation-details">
      <div class="dialog">
        <div class="dialog-title" id="paja-confirmation-title">Confirm Paja request</div>
        <div class="dialog-copy" id="paja-confirmation-summary"></div>
        <pre class="dialog-details" id="paja-confirmation-details"></pre>
        <fieldset class="signer-consent" id="paja-signer-consent" hidden>
          <legend id="paja-signer-consent-legend">Remember this signing choice</legend>
          <label>
            <input type="radio" name="paja-signer-consent" id="paja-signer-consent-once" value="once" checked>
            <span id="paja-signer-consent-once-label">Sign this event only</span>
          </label>
          <label>
            <input type="radio" name="paja-signer-consent" id="paja-signer-consent-kind" value="kind">
            <span><span id="paja-signer-consent-kind-verb">Always sign kind</span> <code id="paja-signer-consent-kind-value"></code> for this napplet version</span>
          </label>
          <label class="signer-consent-trust">
            <input type="radio" name="paja-signer-consent" id="paja-signer-consent-napplet" value="napplet" aria-describedby="paja-signer-consent-warning">
            <span><span id="paja-signer-consent-napplet-verb">Allow all signing from</span> <strong id="paja-signer-consent-napplet-value"></strong> at this version
              <span class="signer-consent-warning" id="paja-signer-consent-warning">Paja will sign any event this napplet version requests without asking again. A different version or signer needs new approval.</span>
            </span>
          </label>
          <label class="signer-consent-trust">
            <input type="radio" name="paja-signer-consent" id="paja-signer-consent-version" value="version">
            <span>Allow all signing and publishing from this napplet version
              <span class="signer-consent-warning">Future events can be signed and sent to relays without another prompt. Other permissions still require approval.</span>
            </span>
          </label>
        </fieldset>
        <div class="dialog-actions">
          <button type="button" id="paja-confirmation-deny">Deny</button>
          <button type="button" id="paja-confirmation-approve">Approve</button>
        </div>
      </div>
    </dialog>`;
}

function renderLlmDialogs(): string {
  return `<dialog class="llm-select-dialog" id="paja-llm-select-dialog" aria-labelledby="paja-llm-select-title" aria-describedby="paja-llm-select-copy">
      <div class="dialog">
        <div class="dialog-title" id="paja-llm-select-title">Choose a language model connection</div>
        <div class="dialog-copy" id="paja-llm-select-copy"></div>
        <select id="paja-llm-select-options" aria-label="Compatible connections" size="4"></select>
        <div class="dialog-actions">
          <button type="button" id="paja-llm-select-deny">Deny</button>
          <button type="button" id="paja-llm-select-use">Use connection</button>
        </div>
      </div>
    </dialog>
    <dialog class="llm-vault-dialog" id="paja-llm-vault-dialog" aria-labelledby="paja-llm-vault-title" aria-describedby="paja-llm-vault-copy">
      <div class="dialog">
        <div class="dialog-title" id="paja-llm-vault-title">Unlock the credential vault</div>
        <div class="dialog-copy" id="paja-llm-vault-copy"></div>
        <input id="paja-llm-vault-password" type="password" autocomplete="off" aria-label="Vault password">
        <div class="config-error" id="paja-llm-vault-error" role="alert"></div>
        <div class="dialog-actions">
          <button type="button" id="paja-llm-vault-cancel">Cancel</button>
          <button type="button" id="paja-llm-vault-confirm">Unlock</button>
        </div>
      </div>
    </dialog>`;
}

function renderConfigDialog(): string {
  return `<dialog class="config-dialog" id="paja-config-dialog" aria-labelledby="paja-config-title" aria-describedby="paja-config-description">
      <div class="dialog">
        <div class="dialog-title" id="paja-config-title">Napplet settings</div>
        <div class="dialog-copy" id="paja-config-description"></div>
        <div class="config-fields" id="paja-config-fields"></div>
        <div class="config-error" id="paja-config-error" role="alert"></div>
        <div class="dialog-actions">
          <button type="button" id="paja-config-cancel">Cancel</button>
          <button type="button" id="paja-config-save">Save</button>
        </div>
      </div>
    </dialog>`;
}

function renderIntentLinkDialog(): string {
  return `<div class="intent-link-notice" id="paja-intent-link-notice" hidden>
      <div id="paja-intent-link-status" role="status" aria-live="polite"></div>
      <button type="button" id="paja-intent-link-retry" hidden>Try again</button>
      <button type="button" id="paja-intent-link-dismiss">Close</button>
    </div>
    <dialog class="config-dialog" id="paja-intent-link-dialog" aria-labelledby="paja-intent-link-title" aria-describedby="paja-intent-link-copy">
      <div class="dialog">
        <div class="dialog-title" id="paja-intent-link-title">Which app would you like to use?</div>
        <div class="dialog-copy" id="paja-intent-link-copy"></div>
        <div class="dialog-actions" id="paja-intent-link-apps"></div>
        <label><input id="paja-intent-link-save-default" type="checkbox"> Always use this app</label>
        <div class="dialog-actions">
          <button type="button" id="paja-intent-link-cancel">Cancel</button>
        </div>
      </div>
    </dialog>`;
}

function renderStage(config: PajaHostConfig, targetLabel: string): string {
  if (config.target.mode === 'runtime-pointer') {
    return `<section class="stage" id="napplet-stage" aria-label="Loaded napplet runtimes">
        <div class="empty-stage" id="empty-runtime-stage">Load a napplet pointer or drop an index.html to start a runtime tab.</div>
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
          <button type="button" id="duplicate-cancel">cancel</button>
        </div>
      </div>
    </div>`;
}

function renderPointerControls(config: PajaHostConfig): string {
  if (config.target.mode !== 'runtime-pointer') return '';
  const value = escapeAttribute(config.target.pointer?.value ?? '');
  return `<details class="section" id="runtime-pointer-section" data-paja-section="pointer" open>
          <summary class="section-title">Pointer<span class="section-chevron" aria-hidden="true">›</span></summary><div class="section-body">
          <form class="pointer-controls" id="runtime-pointer-form">
            <input id="runtime-pointer-input" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="naddr or nevent" aria-label="Runtime napplet pointer" value="${value}">
            <button type="submit" id="runtime-pointer-load">Load</button>
            <button type="button" id="runtime-local-open" title="Open a self-contained single-file index.html">Open file…</button>
            <input id="runtime-local-file" type="file" accept=".html,.htm,text/html" aria-label="Local napplet index.html" hidden>
          </form>
          <div class="pointer-status" id="runtime-pointer-status" aria-live="polite">idle</div>
        </div></details>`;
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

// Only present when the config lists experimental x- NAP extension modules.
function renderExtensionsSection(config: PajaHostConfig): string {
  if (!config.extensions?.length) return '';
  return `<details class="section" id="paja-section-extensions" data-paja-section="extensions" open>
          <summary class="section-title">Extensions<span class="section-chevron" aria-hidden="true">›</span></summary><div class="section-body">
          <div class="extensions" id="paja-extensions"></div>
          <p class="hint">Experimental x- NAPs from the Paja config. They follow the same ACL, firewall and interface toggles as built-in domains.</p>
        </div></details>`;
}
