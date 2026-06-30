import type { NappletMessage } from '@napplet/core';
import {
  ALL_CAPABILITIES,
  type Capability,
  type ShellBridge,
} from '@kehto/shell';

import type { PajaHostConfig } from './options.js';
import {
  PAJA_SIMULATION_DOMAINS,
  type PajaCapabilityDomain,
  type PajaSimulation,
} from './simulation.js';

export interface PajaMessageLogEntry {
  index: number;
  timestamp: number;
  direction: 'napplet->shell' | 'shell->napplet' | 'paja';
  type: string;
  windowId?: string;
  preview: string;
}

export interface PajaDevtoolsState {
  readonly config: PajaHostConfig;
  simulation: PajaSimulation;
  messageFilter: string;
  messageLog: PajaMessageLogEntry[];
  setDomainEnabled(domain: PajaCapabilityDomain, enabled: boolean): void;
  setAclCapability(capability: Capability, enabled: boolean): void;
}

const PAJA_LOG_LIMIT = 500;
const proxyToReal = new WeakMap<object, Window>();

interface PajaDevtoolsRenderOptions {
  readonly bridge: ShellBridge | null;
  readonly signerPubkey: string;
}

interface OriginRegistryLike {
  getIframeWindow(windowId: string): Window | null;
  getWindowId(win: Window): string | undefined;
}

function isNappletMessage(value: unknown): value is NappletMessage {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && typeof (value as { type?: unknown }).type === 'string';
}

function describeMessage(raw: unknown): string {
  if (isNappletMessage(raw)) return raw.type;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return 'unknown';
}

function previewMessage(raw: unknown): string {
  try {
    return JSON.stringify(raw);
  } catch (error) {
    return `unserializable:${error instanceof Error ? error.message : String(error)}`;
  }
}

function domainEnabled(simulation: PajaSimulation, domain: PajaCapabilityDomain): boolean {
  return simulation.capabilities.domains[domain] === true;
}

function getTargetIdentity(config: PajaHostConfig): { pubkey: string; dTag: string; aggregateHash: string } {
  return {
    pubkey: '',
    dTag: config.window.dTag,
    aggregateHash: config.window.aggregateHash,
  };
}

export function appendPajaMessageLog(
  state: PajaDevtoolsState | null,
  direction: PajaMessageLogEntry['direction'],
  raw: unknown,
  windowId?: string,
): void {
  if (!state) return;
  state.messageLog.push({
    index: state.messageLog.length,
    timestamp: Date.now(),
    direction,
    type: describeMessage(raw),
    windowId,
    preview: previewMessage(raw),
  });
  if (state.messageLog.length > PAJA_LOG_LIMIT) {
    state.messageLog.splice(0, state.messageLog.length - PAJA_LOG_LIMIT);
  }
  renderPajaMessageLog(state);
}

export function createPajaPostMessageProxy(
  realWin: Window,
  state: PajaDevtoolsState | null,
  windowId?: string,
): Window {
  const proxy = new Proxy(realWin, {
    get(target, prop) {
      if (prop === 'postMessage') {
        return (msg: unknown, targetOrigin: string, transfer?: Transferable[]) => {
          appendPajaMessageLog(state, 'shell->napplet', msg, windowId);
          return target.postMessage(msg, targetOrigin, transfer);
        };
      }
      try {
        const val = Reflect.get(target, prop, target) as unknown;
        return typeof val === 'function' ? (val as Function).bind(target) : val;
      } catch {
        return undefined;
      }
    },
  });
  proxyToReal.set(proxy, realWin);
  return proxy;
}

export function installPajaOriginRegistryProxy(
  originRegistry: OriginRegistryLike,
  stateRef: () => PajaDevtoolsState | null,
): void {
  const originalGetIframeWindow = originRegistry.getIframeWindow.bind(originRegistry);
  originRegistry.getIframeWindow = (windowId: string) => {
    const win = originalGetIframeWindow(windowId);
    if (!win) return null;
    return createPajaPostMessageProxy(win, stateRef(), windowId);
  };

  const originalGetWindowId = originRegistry.getWindowId.bind(originRegistry);
  originRegistry.getWindowId = (win: Window) => {
    const result = originalGetWindowId(win);
    if (result) return result;
    const real = proxyToReal.get(win);
    return real ? originalGetWindowId(real) : undefined;
  };
}

export function renderPajaDevtools(
  state: PajaDevtoolsState,
  options: PajaDevtoolsRenderOptions,
): void {
  renderInterfaceControls(state);
  renderAclControls(state, options.bridge);
  renderSignerStatus(state, options.signerPubkey);
}

export function renderPajaMessageLog(state: PajaDevtoolsState): void {
  const container = document.getElementById('message-log');
  if (!container) return;
  const filter = state.messageFilter.trim().toLowerCase();
  const rows = state.messageLog
    .filter((entry) => filter.length === 0 || `${entry.direction} ${entry.type} ${entry.preview}`.toLowerCase().includes(filter))
    .slice(-120)
    .map((entry) => {
      const row = document.createElement('div');
      row.className = 'log-row';
      row.dataset.messageType = entry.type;
      const dir = document.createElement('div');
      dir.className = 'log-dir';
      dir.textContent = entry.direction;
      const type = document.createElement('div');
      type.className = 'log-type';
      type.title = entry.preview;
      type.textContent = entry.type;
      row.append(dir, type);
      return row;
    });
  container.replaceChildren(...rows);
  container.scrollTop = container.scrollHeight;
}

function renderInterfaceControls(state: PajaDevtoolsState): void {
  const container = document.getElementById('interface-toggles');
  if (!container) return;
  container.replaceChildren(...PAJA_SIMULATION_DOMAINS.map((domain) => {
    const enabled = domainEnabled(state.simulation, domain);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toggle';
    button.dataset.interfaceDomain = domain;
    button.dataset.enabled = String(enabled);
    button.textContent = domain;
    button.title = `${domain} injection ${enabled ? 'enabled' : 'disabled'}`;
    button.addEventListener('click', () => {
      state.setDomainEnabled(domain, !domainEnabled(state.simulation, domain));
    });
    return button;
  }));
}

function renderAclControls(state: PajaDevtoolsState, bridge: ShellBridge | null): void {
  const container = document.getElementById('acl-controls');
  if (!container) return;
  const identity = getTargetIdentity(state.config);
  container.replaceChildren(...ALL_CAPABILITIES.map((capability) => {
    const allowed = bridge?.runtime.aclState.check(
      identity.pubkey,
      identity.dTag,
      identity.aggregateHash,
      capability,
    ) ?? true;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toggle';
    button.dataset.aclCapability = capability;
    button.dataset.enabled = String(allowed);
    button.textContent = capability;
    button.title = `${capability} ${allowed ? 'allowed' : 'blocked'}`;
    button.addEventListener('click', () => state.setAclCapability(capability, !allowed));
    return button;
  }));
}

function renderSignerStatus(state: PajaDevtoolsState, signerPubkey: string): void {
  const el = document.getElementById('signer-status');
  if (!el) return;
  const pubkey = state.simulation.identity.pubkey || signerPubkey;
  el.textContent = `pubkey ${pubkey} · every sign/publish request prompts`;
}
