import type { NappletMessage } from '@napplet/core';
import {
  ALL_CAPABILITIES,
  type Capability,
  type ShellBridge,
  type ShellDomainState,
} from '@kehto/shell';

import {
  renderPajaEventKindCounts,
  type PajaRelayEventCounter,
  type PajaRelayInventory,
} from './browser-relay-panel.js';
import type { PajaHostConfig } from './options.js';
import { browserPickers } from './browser-fs-support.js';
import type { PajaSignerState } from './browser-signers.js';
import { getTargetIdentity } from './browser-target-frame.js';
import type { PajaRuntimeTarget } from './local-target.js';
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
  /** Resolver-verified identity of the active runtime-pointer target. */
  resolvedTarget: PajaRuntimeTarget | null;
  /** Current simulation model. */
  simulation: PajaSimulation;
  /** Registered host service names, independently of ACL grants. */
  readonly services?: readonly string[];
  /**
   * Host-facing advertisement state per domain. `unconfigured` marks a domain
   * that is injected but still needs user setup (NAP-LLM connections).
   */
  readonly domainState?: (domain: PajaCapabilityDomain) => ShellDomainState;
  /** Current signer state. */
  signer: PajaSignerState;
  /** Number of remembered exact-identity signer decisions. */
  signerConsentCount: number;
  /** Lowercase text filter for message log rows. */
  messageFilter: string;
  /** Accumulated message log rows. */
  messageLog: PajaMessageLogEntry[];
  /** Cumulative relay receipts by routing box and relay. */
  relayEventCounts: PajaRelayEventCounter;
  /** Configured relays per box, read at render time so idle relays show. */
  relayInventory?: () => PajaRelayInventory | undefined;
  /** Enable or disable an injected domain. */
  setDomainEnabled(domain: PajaCapabilityDomain, enabled: boolean): void;
  /** Enable or disable an ACL capability. */
  setAclCapability(capability: Capability, enabled: boolean): void;
  /** Host-registered identity of the currently executing frame. */
  getActiveIdentity?(): Pick<ReturnType<typeof getTargetIdentity>, 'pubkey' | 'dTag' | 'aggregateHash'>;
  /** Switch signer controls to the dev signer. */
  useDevSigner(): void;
  /** Disconnect the selected signer. */
  useNoSigner(): void;
  /** Connect signer controls to a NIP-07 signer. */
  connectNip07(): Promise<void>;
  /** Connect signer controls to a bunker URI. */
  connectBunker(uri: string): Promise<void>;
  /** Revoke every remembered signer decision. */
  clearSignerConsent(): void;
}

const PAJA_LOG_LIMIT = 500;
const FS_PICKER_METHODS: Readonly<Partial<Record<string, keyof ReturnType<typeof browserPickers>>>> = {
  'fs.pickFile.result': 'showOpenFilePicker',
  'fs.pickFiles.result': 'showOpenFilePicker',
  'fs.pickDirectory.result': 'showDirectoryPicker',
  'fs.pickSaveFile.result': 'showSaveFilePicker',
};

interface PajaDevtoolsRenderOptions {
  readonly bridge: ShellBridge | null;
  readonly devSignerPubkey: string;
}

interface OriginRegistryLike {
  unregister?(windowId: string): void;
  postToNapplet(windowId: string, message: unknown): boolean;
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
    if (typeof detail === 'string' && detail.length > 0) {
      if (detail === 'unsupported') {
        const picker = FS_PICKER_METHODS[raw.type];
        if (picker && !browserPickers()[picker]) {
          return `unsupported: this browser does not provide ${picker}. Workspace FS may still be available; ACL permission does not add browser APIs.`;
        }
      }
      return detail;
    }
  }
  return raw.type.endsWith('.error') ? compactMessageDetail(value) : '';
}

function domainEnabled(simulation: PajaSimulation, domain: PajaCapabilityDomain): boolean {
  return simulation.capabilities.domains[domain] === true;
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
 * Remove NAP-CONFIG values from Paja's developer message log.
 *
 * A registered schema may mark individual properties as secrets. Redacting
 * every `config.values` payload avoids retaining those cleartext values in a
 * second host-owned surface without needing to duplicate schema state here.
 *
 * @param message - Outbound runtime message before delivery.
 * @returns The original message or a metadata-only CONFIG log record.
 */
export function redactPajaMessageForLog(message: unknown): unknown {
  if (!isRecord(message) || message.type !== 'config.values') return message;
  return {
    type: 'config.values',
    ...(typeof message.id === 'string' ? { id: message.id } : {}),
    values: '[redacted by host]',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Log shell → napplet traffic and window removal through the shell origin
 * registry. NIP-5D sends every NAP message over the napplet's bound
 * `napplet.hello` port, so Paja observes `postToNapplet` rather than proxying
 * iframe windows.
 *
 * @param originRegistry - Registry to wrap.
 * @param stateRef - Lazy devtools state getter.
 * @param onWindowRemoved - Optional callback before a window is unregistered.
 */
export function installPajaOriginRegistryProxy(
  originRegistry: OriginRegistryLike,
  stateRef: () => PajaDevtoolsState | null,
  onWindowRemoved?: (windowId: string) => void,
): void {
  if (onWindowRemoved && originRegistry.unregister) {
    const unregister = originRegistry.unregister.bind(originRegistry);
    originRegistry.unregister = (windowId) => { onWindowRemoved(windowId); unregister(windowId); };
  }
  const postToNapplet = originRegistry.postToNapplet.bind(originRegistry);
  originRegistry.postToNapplet = (windowId, message) => {
    const delivered = postToNapplet(windowId, message);
    if (delivered) appendPajaMessageLog(stateRef(), 'shell->napplet', redactPajaMessageForLog(message), windowId);
    return delivered;
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
  renderFsSupport(state);
  renderAclControls(state, options.bridge);
  renderSignerStatus(state, options.devSignerPubkey);
  renderPajaEventKindCounts(state.relayEventCounts, state.relayInventory?.());
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
    const domainState = enabled ? state.domainState?.(domain) ?? 'supported' : 'disabled';
    const unconfigured = domainState === 'unconfigured';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toggle';
    button.dataset.interfaceDomain = domain;
    button.dataset.enabled = String(enabled);
    button.dataset.state = domainState;
    button.textContent = unconfigured ? `\u26a0 ${domain}` : domain;
    button.title = unconfigured
      ? `${domain} injection enabled; no connection is configured yet. Add one in Language models, or click to disable the interface.`
      : `${domain} injection ${enabled ? 'enabled' : 'disabled'}`;
    button.addEventListener('click', () => {
      state.setDomainEnabled(domain, !domainEnabled(state.simulation, domain));
    });
    return button;
  }));
}

function renderFsSupport(state: PajaDevtoolsState): void {
  const status = document.getElementById('paja-fs-support');
  if (!status) return;
  if (!domainEnabled(state.simulation, 'fs')) {
    status.textContent = 'FS disabled by host.';
    return;
  }
  if (!state.services?.includes('fs')) {
    status.textContent = 'FS unavailable: browser workspace storage could not be opened.';
    return;
  }
  const pickers = browserPickers();
  const availability = (available: unknown) => available ? 'available' : 'unavailable';
  status.textContent = `FS: Workspace available. Native pickers: open ${availability(pickers.showOpenFilePicker)}, save ${availability(pickers.showSaveFilePicker)}, directory ${availability(pickers.showDirectoryPicker)}.`;
}

function renderAclControls(state: PajaDevtoolsState, bridge: ShellBridge | null): void {
  const container = document.getElementById('acl-controls');
  if (!container) return;
  const identity = state.getActiveIdentity?.() ?? getTargetIdentity(state.config, state.resolvedTarget);
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
    button.title = `${capability} permission ${allowed ? 'allowed' : 'blocked'}; browser support is separate`;
    button.addEventListener('click', () => state.setAclCapability(capability, !allowed));
    return button;
  }));
}

function renderSignerStatus(state: PajaDevtoolsState, signerPubkey: string): void {
  const el = document.getElementById('signer-status');
  const controls = document.getElementById('signer-controls');
  const clearConsent = document.getElementById('signer-consent-clear');
  if (!el || !controls || !(clearConsent instanceof HTMLButtonElement)) return;

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
  const consentSummary = state.signerConsentCount === 0
    ? 'signing and publishing ask every time'
    : `${state.signerConsentCount} remembered signing/publishing approval${state.signerConsentCount === 1 ? '' : 's'}`;
  el.textContent = `${prefix} · ${consentSummary}`;

  clearConsent.hidden = state.signerConsentCount === 0;
  clearConsent.textContent = `Forget ${state.signerConsentCount} remembered approval${state.signerConsentCount === 1 ? '' : 's'}`;
  clearConsent.onclick = () => state.clearSignerConsent();

  const previousInput = controls.querySelector<HTMLInputElement>('#signer-bunker-uri')?.value ?? '';
  const noneButton = document.createElement('button');
  noneButton.type = 'button';
  noneButton.id = 'signer-none';
  noneButton.dataset.active = String(state.signer.method === 'none');
  noneButton.textContent = 'None';
  noneButton.addEventListener('click', () => state.useNoSigner());
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

  controls.replaceChildren(noneButton, devButton, nip07Button, bunkerInput, bunkerButton);
}
