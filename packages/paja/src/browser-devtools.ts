import type { NappletMessage } from '@napplet/core';
import {
  ALL_CAPABILITIES,
  type Capability,
  type ShellBridge,
  type ShellEnvironment,
} from '@kehto/shell';

import type { PajaHostConfig } from './options.js';
import type { PajaSignerState } from './browser-signers.js';
import {
  PAJA_SIMULATION_DOMAINS,
  type PajaCapabilityDomain,
  type PajaSimulation,
} from './simulation.js';

/** One message row in Paja's browser message log. */
export interface PajaMessageLogEntry {
  /** Monotonic row index. */
  index: number;
  /** Timestamp in milliseconds. */
  timestamp: number;
  /** Message direction. */
  direction: 'napplet->shell' | 'shell->napplet' | 'paja';
  /** Message type label. */
  type: string;
  /** Target window id, when known. */
  windowId?: string;
  /** Serialized message preview. */
  preview: string;
  /** Error/detail text, when available. */
  detail: string;
}

/** Mutable browser devtools state for the Paja host page. */
export interface PajaDevtoolsState {
  /** Current host config. */
  readonly config: PajaHostConfig;
  /** Current simulation model. */
  simulation: PajaSimulation;
  /** Current signer state. */
  signer: PajaSignerState;
  /** Lowercase text filter for message log rows. */
  messageFilter: string;
  /** Accumulated message log rows. */
  messageLog: PajaMessageLogEntry[];
  /** Enable or disable an injected domain. */
  setDomainEnabled(domain: PajaCapabilityDomain, enabled: boolean): void;
  /** Enable or disable an ACL capability. */
  setAclCapability(capability: Capability, enabled: boolean): void;
  /** Switch signer controls to the dev signer. */
  useDevSigner(): void;
  /** Connect signer controls to a NIP-07 signer. */
  connectNip07(): Promise<void>;
  /** Connect signer controls to a bunker URI. */
  connectBunker(uri: string): Promise<void>;
}

const PAJA_LOG_LIMIT = 500;
const proxyToReal = new WeakMap<object, Window>();
const realToProxy = new WeakMap<Window, Window>();
const proxyContexts = new WeakMap<Window, {
  state: PajaDevtoolsState | null;
  windowId?: string;
}>();

interface PajaDevtoolsRenderOptions {
  readonly bridge: ShellBridge | null;
  readonly devSignerPubkey: string;
}

interface OriginRegistryLike {
  getIframeWindow(windowId: string): Window | null;
  getWindowId(win: Window): string | undefined;
  getIdentity(win: Window): { dTag: string; aggregateHash: string } | undefined;
  getEnvironment(win: Window): ShellEnvironment | undefined;
  getRegistrationId(win: Window): number | undefined;
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

type MessageWithDetails = NappletMessage & {
  error?: unknown;
  message?: unknown;
  reason?: unknown;
};

function compactMessageDetail(raw: NappletMessage): string {
  const detail: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key !== 'type' && key !== 'id' && value !== undefined) detail[key] = value;
  }
  if (Object.keys(detail).length === 0) return '';
  try {
    return JSON.stringify(detail);
  } catch {
    return '';
  }
}

function describeMessageDetail(raw: unknown): string {
  if (!isNappletMessage(raw)) return '';
  const value = raw as MessageWithDetails;
  for (const key of ['error', 'message', 'reason'] as const) {
    const detail = value[key];
    if (typeof detail === 'string' && detail.length > 0) return detail;
  }
  return raw.type.endsWith('.error') ? compactMessageDetail(value) : '';
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

/**
 * Append a message row to Paja's browser log.
 *
 * @param state - Current devtools state, or null before initialization.
 * @param direction - Message direction label.
 * @param raw - Raw message payload.
 * @param windowId - Optional target window id.
 */
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
    detail: describeMessageDetail(raw),
  });
  if (state.messageLog.length > PAJA_LOG_LIMIT) {
    state.messageLog.splice(0, state.messageLog.length - PAJA_LOG_LIMIT);
  }
  renderPajaMessageLog(state);
}

/**
 * Wrap a target window so outbound postMessage calls are logged.
 *
 * @param realWin - Target iframe window.
 * @param state - Current devtools state, or null before initialization.
 * @param windowId - Optional target window id.
 * @returns Window proxy that preserves normal property access.
 */
export function createPajaPostMessageProxy(
  realWin: Window,
  state: PajaDevtoolsState | null,
  windowId?: string,
): Window {
  const existing = realToProxy.get(realWin);
  if (existing) {
    proxyContexts.set(existing, { state, windowId });
    return existing;
  }
  const proxy = new Proxy(realWin, {
    get(target, prop) {
      if (prop === 'postMessage') {
        return (msg: unknown, targetOrigin: string, transfer?: Transferable[]) => {
          const context = proxyContexts.get(proxy);
          appendPajaMessageLog(
            context?.state ?? state,
            'shell->napplet',
            msg,
            context?.windowId ?? windowId,
          );
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
  realToProxy.set(realWin, proxy);
  proxyContexts.set(proxy, { state, windowId });
  return proxy;
}

/**
 * Install logging proxies into the shell origin registry.
 *
 * @param originRegistry - Registry to wrap.
 * @param stateRef - Lazy state getter used by proxied windows.
 */
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

  const originalGetIdentity = originRegistry.getIdentity.bind(originRegistry);
  originRegistry.getIdentity = (win: Window) => {
    const real = proxyToReal.get(win);
    return originalGetIdentity(win) ?? (real ? originalGetIdentity(real) : undefined);
  };

  const originalGetRegistrationId = originRegistry.getRegistrationId.bind(originRegistry);
  originRegistry.getRegistrationId = (win: Window) => {
    const real = proxyToReal.get(win);
    return originalGetRegistrationId(win) ?? (real ? originalGetRegistrationId(real) : undefined);
  };

  const originalGetEnvironment = originRegistry.getEnvironment.bind(originRegistry);
  originRegistry.getEnvironment = (win: Window) => {
    const real = proxyToReal.get(win);
    return originalGetEnvironment(win) ?? (real ? originalGetEnvironment(real) : undefined);
  };
}

/**
 * Render all Paja browser devtools panels.
 *
 * @param state - Current devtools state.
 * @param options - Bridge and signer metadata for rendering.
 */
export function renderPajaDevtools(
  state: PajaDevtoolsState,
  options: PajaDevtoolsRenderOptions,
): void {
  renderInterfaceControls(state);
  renderAclControls(state, options.bridge);
  renderSignerStatus(state, options.devSignerPubkey);
}

/**
 * Render the filtered Paja message log.
 *
 * @param state - Current devtools state.
 */
export function renderPajaMessageLog(state: PajaDevtoolsState): void {
  const container = document.getElementById('message-log');
  if (!container) return;
  const filter = state.messageFilter.trim().toLowerCase();
  const rows = state.messageLog
    .filter((entry) => filter.length === 0 || `${entry.direction} ${entry.type} ${entry.detail} ${entry.preview}`.toLowerCase().includes(filter))
    .slice(-120)
    .map((entry) => {
      const row = document.createElement('div');
      row.className = 'log-row';
      row.dataset.messageType = entry.type;
      if (entry.type.endsWith('.error')) row.dataset.error = 'true';
      const dir = document.createElement('div');
      dir.className = 'log-dir';
      dir.textContent = entry.direction;
      const body = document.createElement('div');
      body.className = 'log-body';
      const type = document.createElement('div');
      type.className = 'log-type';
      type.title = entry.preview;
      type.textContent = entry.type;
      body.append(type);
      if (entry.detail) {
        const detail = document.createElement('div');
        detail.className = 'log-detail';
        detail.textContent = entry.detail;
        detail.title = entry.preview;
        body.append(detail);
      }
      row.append(dir, body);
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
  const controls = document.getElementById('signer-controls');
  if (!el || !controls) return;

  const fallbackPubkey = state.simulation.identity.pubkey || (state.signer.method === 'dev' ? signerPubkey : '');
  const pubkey = state.simulation.identity.pubkey || state.signer.pubkey || (state.signer.method === 'dev' ? signerPubkey : '');
  const methodLabel = state.signer.method === 'nip07'
    ? 'NIP-07'
    : state.signer.method === 'nip46'
      ? 'bunker'
      : state.signer.method === 'dev'
        ? 'dev'
        : 'none';
  const relay = state.signer.relay ? ` · relay ${state.signer.relay}` : '';
  const prefix = state.signer.status === 'disconnected'
    ? 'no signer connected'
    : state.signer.status === 'error'
    ? `${methodLabel} error: ${state.signer.error ?? 'unknown error'} · fallback pubkey ${fallbackPubkey}`
    : `${methodLabel} ${state.signer.status} · pubkey ${pubkey || '(none)'}${relay}`;
  el.textContent = `${prefix} · every sign/publish request prompts`;

  const previousInput = controls.querySelector<HTMLInputElement>('#signer-bunker-uri')?.value ?? '';
  const devButton = document.createElement('button');
  devButton.type = 'button';
  devButton.id = 'signer-dev';
  devButton.dataset.active = String(state.signer.method === 'dev');
  devButton.textContent = 'Dev';
  devButton.addEventListener('click', () => state.useDevSigner());

  const nip07Button = document.createElement('button');
  nip07Button.type = 'button';
  nip07Button.id = 'signer-nip07';
  nip07Button.dataset.active = String(state.signer.method === 'nip07');
  nip07Button.textContent = 'NIP-07';
  nip07Button.addEventListener('click', () => void state.connectNip07());

  const bunkerInput = document.createElement('input');
  bunkerInput.id = 'signer-bunker-uri';
  bunkerInput.type = 'text';
  bunkerInput.autocomplete = 'off';
  bunkerInput.placeholder = 'bunker://...';
  bunkerInput.setAttribute('aria-label', 'Bunker connection URI');
  bunkerInput.value = previousInput;

  const bunkerButton = document.createElement('button');
  bunkerButton.type = 'button';
  bunkerButton.id = 'signer-bunker';
  bunkerButton.dataset.active = String(state.signer.method === 'nip46');
  bunkerButton.textContent = 'Bunker';
  bunkerButton.addEventListener('click', () => void state.connectBunker(bunkerInput.value));

  controls.replaceChildren(devButton, nip07Button, bunkerInput, bunkerButton);
}
