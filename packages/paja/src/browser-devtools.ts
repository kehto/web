import type { NappletMessage } from '@napplet/core';
import {
  ALL_CAPABILITIES,
  type Capability,
  type ShellBridge,
  type ShellEnvironment,
} from '@kehto/shell';

import type { PajaRelayReadReason } from './browser-relay-runtime.js';
import type { PajaHostConfig } from './options.js';
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

/** One aggregated relay-event counter row in Paja's browser devtools. */
export interface PajaEventKindCount {
  /** Nostr event kind. */
  kind: number;
  /** Number of times an event of this kind was received from a live relay. */
  count: number;
}

/**
 * Cumulative receipt counters for one relay inside one read-reason group.
 *
 * Counts are receipts, not distinct events: a relay that hands Paja the same
 * event twice is credited twice, because the panel reports what was fetched.
 */
export interface PajaRelayReceipt {
  /** Relay URL. */
  readonly relayUrl: string;
  /** Events received from this relay under this reason. */
  readonly count: number;
  /** Reads Paja started against this relay under this reason. */
  readonly readCount: number;
  /** Events per kind received from this relay under this reason. */
  readonly kinds: PajaEventKindCount[];
  /** Whether this relay is configured rather than only observed. */
  readonly configured: boolean;
}

/** One read-reason group of relay receipts. */
export interface PajaRelayGroup {
  /** How the relay sets in this group were chosen. */
  readonly reason: PajaRelayReadReason;
  /** Events received under this reason, counting every relay sighting. */
  readonly count: number;
  /** Relays in this group, including configured relays with no traffic yet. */
  readonly relays: PajaRelayReceipt[];
}

/** Configured relay inventory per read reason, so idle relays still render. */
export type PajaRelayInventory = Partial<Record<PajaRelayReadReason, readonly string[]>>;

/**
 * Cumulative per-reason, per-relay counter for events received from live relays.
 *
 * The counter lives outside the host state object so relay fetches that Paja
 * starts before `__KEHTO_PAJA__` exists (signer probes, social cache, relay
 * lists) are counted rather than dropped.
 */
export interface PajaRelayEventCounter {
  /** Relay receipts recorded this session. */
  readonly total: number;
  /** Distinct event ids seen this session. */
  readonly uniqueEvents: number;
  /** Counts grouped by read reason, including configured relays with no traffic. */
  snapshot(inventory?: PajaRelayInventory): PajaRelayGroup[];
  /**
   * Count one relay read Paja started.
   *
   * @param reason - How the read's relay set was chosen.
   * @param relayUrls - Relay URLs the read runs against.
   */
  recordRead(reason: PajaRelayReadReason, relayUrls: readonly string[]): void;
  /**
   * Count one event received from a live relay.
   *
   * @param reason - How the producing read's relay set was chosen.
   * @param event - Event as received from the live relay.
   * @param sightedOn - Relays the read saw this event on.
   */
  recordEvent(reason: PajaRelayReadReason, event: unknown, sightedOn: readonly string[]): void;
}

const RELAY_REASON_ORDER: readonly PajaRelayReadReason[] = ['outbox', 'hint', 'host'];

const RELAY_REASON_LABELS: Record<PajaRelayReadReason, string> = {
  outbox: 'outbox',
  hint: 'relay hints',
  host: 'host pool',
};

/** Human label for one read reason. */
export function relayReasonLabel(reason: PajaRelayReadReason): string {
  return RELAY_REASON_LABELS[reason];
}

function emptyReasonGroup(): { count: number; reads: Map<string, number>; relays: Map<string, { count: number; kinds: Map<number, number> }> } {
  return { count: 0, reads: new Map(), relays: new Map() };
}

/**
 * Create a cumulative relay-receipt counter grouped by read reason.
 *
 * Only well-formed events with a non-negative integer `kind` are counted, and
 * every relay a read saw the event on is credited, so one event fetched through
 * two reasons appears in both groups.
 *
 * @param onChange - Called after a counted read or event.
 * @returns Counter suitable for the relay observation hooks and sidebar rendering.
 * @example
 * const counter = createPajaRelayEventCounter(() => renderPajaEventKindCounts(state));
 */
export function createPajaRelayEventCounter(onChange?: () => void): PajaRelayEventCounter {
  const groups = new Map<PajaRelayReadReason, ReturnType<typeof emptyReasonGroup>>();
  const eventIds = new Set<string>();
  let total = 0;

  const groupFor = (reason: PajaRelayReadReason) => {
    let group = groups.get(reason);
    if (!group) {
      group = emptyReasonGroup();
      groups.set(reason, group);
    }
    return group;
  };
  const relayFor = (reason: PajaRelayReadReason, relayUrl: string) => {
    const group = groupFor(reason);
    let relay = group.relays.get(relayUrl);
    if (!relay) {
      relay = { count: 0, kinds: new Map() };
      group.relays.set(relayUrl, relay);
    }
    return relay;
  };

  return {
    get total() {
      return total;
    },
    get uniqueEvents() {
      return eventIds.size;
    },
    snapshot(inventory) {
      const out: PajaRelayGroup[] = [];
      for (const reason of RELAY_REASON_ORDER) {
        const group = groups.get(reason);
        const configured = inventory?.[reason] ?? [];
        const seen = new Set<string>();
        const relays: PajaRelayReceipt[] = [];
        const push = (relayUrl: string, isConfigured: boolean): void => {
          if (seen.has(relayUrl)) return;
          seen.add(relayUrl);
          const relay = group?.relays.get(relayUrl);
          relays.push({
            relayUrl,
            count: relay?.count ?? 0,
            readCount: group?.reads.get(relayUrl) ?? 0,
            configured: isConfigured,
            kinds: [...(relay?.kinds.entries() ?? [])]
              .sort(([left], [right]) => left - right)
              .map(([kind, count]) => ({ kind, count })),
          });
        };
        const observed = [...(group?.relays.keys() ?? [])].filter((url) => !configured.includes(url));
        for (const url of configured) push(url, true);
        for (const url of observed) push(url, false);
        if (relays.length === 0) continue;
        relays.sort((left, right) => right.count - left.count);
        out.push({ reason, count: group?.count ?? 0, relays });
      }
      return out;
    },
    recordRead(reason, relayUrls) {
      const group = groupFor(reason);
      let changed = false;
      for (const relayUrl of new Set(relayUrls)) {
        if (relayUrl.length === 0) continue;
        group.reads.set(relayUrl, (group.reads.get(relayUrl) ?? 0) + 1);
        relayFor(reason, relayUrl);
        changed = true;
      }
      if (changed) onChange?.();
    },
    recordEvent(reason, event, sightedOn) {
      if (typeof event !== 'object' || event === null) return;
      const kind = (event as { kind?: unknown }).kind;
      if (typeof kind !== 'number' || !Number.isSafeInteger(kind) || kind < 0) return;
      const relays = [...new Set(sightedOn)].filter((url) => url.length > 0);
      if (relays.length === 0) return;
      const group = groupFor(reason);
      for (const relayUrl of relays) {
        const relay = relayFor(reason, relayUrl);
        relay.count += 1;
        relay.kinds.set(kind, (relay.kinds.get(kind) ?? 0) + 1);
        group.count += 1;
        total += 1;
      }
      const id = (event as { id?: unknown }).id;
      if (typeof id === 'string' && id.length > 0) eventIds.add(id);
      onChange?.();
    },
  };
}

/** Mutable browser devtools state for the Paja host page. */
export interface PajaDevtoolsState {
  /** Current host config. */
  readonly config: PajaHostConfig;
  /** Resolver-verified identity of the active runtime-pointer target. */
  resolvedTarget: PajaRuntimeTarget | null;
  /** Current simulation model. */
  simulation: PajaSimulation;
  /** Current signer state. */
  signer: PajaSignerState;
  /** Number of remembered exact-identity signer decisions. */
  signerConsentCount: number;
  /** Lowercase text filter for message log rows. */
  messageFilter: string;
  /** Accumulated message log rows. */
  messageLog: PajaMessageLogEntry[];
  /** Cumulative relay receipts by read reason and relay. */
  relayEventCounts: PajaRelayEventCounter;
  /** Configured relays per read reason, read at render time so idle relays show. */
  relayInventory?: () => PajaRelayInventory | undefined;
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
  /** Revoke every remembered signer decision. */
  clearSignerConsent(): void;
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
            redactPajaMessageForLog(msg),
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
  renderPajaEventKindCounts(state);
}

/**
 * Render Paja's relay receipts grouped by read reason, relay, and kind.
 *
 * Bars are scaled against the busiest relay of the session so cross-group
 * comparison stays honest, and configured relays with no traffic still render
 * so idle or silent relays are visible.
 *
 * @param state - Current devtools state.
 */
export function renderPajaEventKindCounts(state: PajaDevtoolsState): void {
  const container = document.getElementById('event-kind-counts');
  const total = document.getElementById('event-kind-total');
  const counter = state.relayEventCounts;
  const groups = counter.snapshot(state.relayInventory?.());
  if (total) {
    total.textContent = groups.length === 0 ? '' : `${counter.total}`;
    total.title = `${counter.total} relay receipt${counter.total === 1 ? '' : 's'} · ${counter.uniqueEvents} unique event${counter.uniqueEvents === 1 ? '' : 's'}`;
  }
  if (!container) return;
  if (groups.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'event-empty';
    empty.textContent = 'no relay events yet';
    container.replaceChildren(empty);
    return;
  }

  const busiest = Math.max(1, ...groups.flatMap((group) => group.relays.map((relay) => relay.count)));
  container.replaceChildren(...groups.map((group) => {
    const section = document.createElement('div');
    section.className = 'event-group';
    section.dataset.relayReason = group.reason;

    const head = document.createElement('div');
    head.className = 'event-group-head';
    const name = document.createElement('span');
    name.className = 'event-group-name';
    name.textContent = relayReasonLabel(group.reason);
    const groupCount = document.createElement('span');
    groupCount.className = 'event-group-count';
    groupCount.textContent = String(group.count);
    head.append(name, groupCount);
    section.append(head);

    for (const relay of group.relays) {
      const row = document.createElement('div');
      row.className = 'event-relay';
      row.dataset.relayUrl = relay.relayUrl;
      row.dataset.relayCount = String(relay.count);
      row.dataset.relayReads = String(relay.readCount);
      if (relay.configured) row.dataset.relayConfigured = 'true';

      const rowHead = document.createElement('div');
      rowHead.className = 'event-relay-head';
      const url = document.createElement('span');
      url.className = 'event-relay-url';
      url.textContent = relay.relayUrl;
      url.title = relay.relayUrl;
      const bar = document.createElement('span');
      bar.className = 'event-bar';
      const fill = document.createElement('span');
      fill.className = 'event-bar-fill';
      fill.style.width = `${Math.round((relay.count / busiest) * 100)}%`;
      bar.append(fill);
      const relayCount = document.createElement('span');
      relayCount.className = 'event-relay-count';
      relayCount.textContent = String(relay.count);
      rowHead.append(url, bar, relayCount);
      if (relay.count === 0) {
        const idle = document.createElement('span');
        idle.className = 'event-relay-idle';
        idle.textContent = relay.readCount > 0 ? 'silent' : 'unused';
        idle.title = relay.readCount > 0
          ? `Paja read from this relay ${relay.readCount} time${relay.readCount === 1 ? '' : 's'} and received no events`
          : 'configured for this read reason and not used yet this session';
        rowHead.append(idle);
      }
      row.append(rowHead);

      if (relay.kinds.length > 0) {
        const kinds = document.createElement('div');
        kinds.className = 'event-kinds';
        kinds.replaceChildren(...relay.kinds.map(({ kind, count }) => {
          const kindRow = document.createElement('div');
          kindRow.className = 'event-row';
          kindRow.dataset.eventKind = String(kind);
          const kindCell = document.createElement('span');
          kindCell.className = 'event-kind';
          kindCell.textContent = String(kind);
          const separator = document.createElement('span');
          separator.className = 'event-separator';
          separator.textContent = '-';
          const countCell = document.createElement('span');
          countCell.className = 'event-count';
          countCell.textContent = String(count);
          kindRow.append(kindCell, separator, countCell);
          return kindRow;
        }));
        row.append(kinds);
      }
      section.append(row);
    }
    return section;
  }));
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
  const identity = getTargetIdentity(state.config, state.resolvedTarget);
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
    ? 'signing asks every time'
    : `${state.signerConsentCount} remembered signing approval${state.signerConsentCount === 1 ? '' : 's'}`;
  el.textContent = `${prefix} · ${consentSummary} · publishing asks every time`;

  clearConsent.hidden = state.signerConsentCount === 0;
  clearConsent.textContent = `Forget ${state.signerConsentCount} remembered approval${state.signerConsentCount === 1 ? '' : 's'}`;
  clearConsent.onclick = () => state.clearSignerConsent();

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
