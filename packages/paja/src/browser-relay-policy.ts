import type { NostrEvent } from '@napplet/core';
import type { RelayConfigHooks, RelayPoolHooks, RelayPoolLike } from '@kehto/shell';
import { verifyEvent } from 'nostr-tools/pure';

import { getPajaRelayUrls } from './browser-relay-runtime.js';
import type { PajaSimulation } from './simulation.js';

const PAJA_STORAGE_PROBE_KEY = 'kehto:paja:storage-probe';
type PajaRelayTier = 'discovery' | 'super' | 'outbox';

/** Mutable relay tiers shared by Paja's live transport adapters. */
export interface PajaRelayConfigRuntime extends RelayConfigHooks {
  readonly allRelays: string[];
  readonly outboxRelays: string[];
  getRelayUrls(tiers?: readonly PajaRelayTier[]): string[];
}

function normalizeRelayUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if ((url.protocol !== 'wss:' && url.protocol !== 'ws:') || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function isVerifiedNostrEvent(value: unknown): value is NostrEvent {
  if (typeof value !== 'object' || value === null) return false;
  try {
    return verifyEvent(value as Parameters<typeof verifyEvent>[0]);
  } catch {
    return false;
  }
}

/**
 * Apply Paja's scoped-relay policy to a napplet-supplied URL.
 *
 * Explicit host configuration may include development relays. Other URLs must
 * use public-looking WSS hosts; obvious local and private literals fail closed.
 */
export function isPajaRelayAllowed(value: string, getConfiguredRelays: () => string[]): boolean {
  const normalized = normalizeRelayUrl(value);
  if (!normalized) return false;
  if (getConfiguredRelays().some((url) => normalizeRelayUrl(url) === normalized)) return true;
  const url = new URL(normalized);
  if (url.protocol !== 'wss:') return false;
  const hostname = url.hostname.replace(/^\[|\]$/gu, '').toLowerCase();
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || !hostname.includes('.')
  ) return false;
  if (hostname.includes(':')) {
    return hostname !== '::'
      && hostname !== '::1'
      && !/^(?:fc|fd|fe[89ab])/iu.test(hostname);
  }
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;
  const [first, second] = octets as [number, number, number, number];
  return first !== 0
    && first !== 10
    && first !== 127
    && first < 224
    && !(first === 100 && second >= 64 && second <= 127)
    && !(first === 169 && second === 254)
    && !(first === 172 && second >= 16 && second <= 31)
    && !(first === 192 && second === 168)
    && !(first === 198 && (second === 18 || second === 19));
}

/** Create stateful host relay tiers whose stable arrays update live consumers. */
export function createPajaRelayConfig(getSimulation: () => PajaSimulation): PajaRelayConfigRuntime {
  const tierNames: readonly PajaRelayTier[] = ['discovery', 'super', 'outbox'];
  const additions = new Map<PajaRelayTier, Map<string, string>>();
  const removals = new Map<PajaRelayTier, Set<string>>();
  const current: Record<PajaRelayTier, string[]> = { discovery: [], super: [], outbox: [] };
  const allRelays: string[] = [];

  function isTier(value: string): value is PajaRelayTier {
    return tierNames.includes(value as PajaRelayTier);
  }

  function refresh(): void {
    for (const tier of tierNames) {
      const seen = new Set<string>();
      const values: string[] = [];
      const removed = removals.get(tier);
      for (const url of [...getPajaRelayUrls(getSimulation()), ...(additions.get(tier)?.values() ?? [])]) {
        const normalized = normalizeRelayUrl(url);
        if (!normalized || seen.has(normalized) || removed?.has(normalized)) continue;
        seen.add(normalized);
        values.push(url);
      }
      current[tier].splice(0, current[tier].length, ...values);
    }
    const combined = [...new Set(tierNames.flatMap((tier) => current[tier]))];
    allRelays.splice(0, allRelays.length, ...combined);
  }

  const runtime: PajaRelayConfigRuntime = {
    allRelays,
    outboxRelays: current.outbox,
    addRelay(tier, url) {
      const normalized = normalizeRelayUrl(url);
      if (!isTier(tier) || !normalized) return;
      const entries = additions.get(tier) ?? new Map<string, string>();
      entries.set(normalized, url);
      additions.set(tier, entries);
      removals.get(tier)?.delete(normalized);
      refresh();
    },
    removeRelay(tier, url) {
      const normalized = normalizeRelayUrl(url);
      if (!isTier(tier) || !normalized) return;
      additions.get(tier)?.delete(normalized);
      const entries = removals.get(tier) ?? new Set<string>();
      entries.add(normalized);
      removals.set(tier, entries);
      refresh();
    },
    getRelayConfig() {
      refresh();
      return {
        discovery: [...current.discovery],
        super: [...current.super],
        outbox: [...current.outbox],
      };
    },
    getNip66Suggestions: () => [],
    getRelayUrls(tiers = tierNames) {
      refresh();
      return [...new Set(tiers.flatMap((tier) => current[tier]))];
    },
  };
  refresh();
  return runtime;
}

/** Create Paja's shared and scoped live relay lifecycle hooks. */
export function createPajaRelayHooks(
  pool: RelayPoolLike,
  getSimulation: () => PajaSimulation,
  relayConfig: PajaRelayConfigRuntime,
): RelayPoolHooks {
  const cleanups = new Map<string, () => void>();
  const scoped = new Map<string, { relayUrl: string; unsubscribe(): void }>();

  function closeScopedRelay(windowId: string): void {
    scoped.get(windowId)?.unsubscribe();
    scoped.delete(windowId);
  }

  return {
    getRelayPool: () => pool,
    trackSubscription(subKey, cleanup) {
      cleanups.set(subKey, cleanup);
    },
    untrackSubscription(subKey) {
      cleanups.get(subKey)?.();
      cleanups.delete(subKey);
    },
    openScopedRelay(windowId, relayUrl, subId, filters, sourceWindow) {
      closeScopedRelay(windowId);
      const configured = new Map(relayConfig.getRelayUrls().flatMap((url) => {
        const normalized = normalizeRelayUrl(url);
        return normalized ? [[normalized, url] as const] : [];
      }));
      const requested = normalizeRelayUrl(relayUrl);
      const allowedUrl = requested && isPajaRelayAllowed(relayUrl, () => relayConfig.getRelayUrls())
        ? configured.get(requested) ?? requested
        : undefined;
      if (getSimulation().relay.mode !== 'live' || !allowedUrl) {
        sourceWindow.postMessage({ type: 'relay.closed', subId, reason: 'scoped relay unavailable' }, '*');
        return;
      }
      const subscription = pool.subscription([allowedUrl], filters).subscribe((item) => {
        if (item === 'EOSE') {
          sourceWindow.postMessage({ type: 'relay.eose', subId }, '*');
          return;
        }
        if (!isVerifiedNostrEvent(item)) return;
        sourceWindow.postMessage({
          type: 'relay.event',
          subId,
          result: { event: item, sidecar: { relayHints: [allowedUrl] } },
        }, '*');
      });
      scoped.set(windowId, { relayUrl: allowedUrl, unsubscribe: () => subscription.unsubscribe() });
    },
    closeScopedRelay,
    publishToScopedRelay: async (windowId, event) => {
      const active = scoped.get(windowId);
      if (getSimulation().relay.mode !== 'live' || !active || !verifyEvent(event)) return false;
      try {
        await pool.publish([active.relayUrl], event);
        return true;
      } catch {
        return false;
      }
    },
    selectRelayTier: () => relayConfig.getRelayUrls(['discovery', 'super']),
  };
}

/** Return whether browser localStorage accepts and reads a reversible probe. */
export function hasWritableLocalStorage(): boolean {
  if (typeof localStorage === 'undefined') return false;
  let previous: string | null = null;
  try {
    previous = localStorage.getItem(PAJA_STORAGE_PROBE_KEY);
    localStorage.setItem(PAJA_STORAGE_PROBE_KEY, '1');
    const available = localStorage.getItem(PAJA_STORAGE_PROBE_KEY) === '1';
    if (previous === null) localStorage.removeItem(PAJA_STORAGE_PROBE_KEY);
    else localStorage.setItem(PAJA_STORAGE_PROBE_KEY, previous);
    return available;
  } catch {
    try {
      if (previous === null) localStorage.removeItem(PAJA_STORAGE_PROBE_KEY);
      else localStorage.setItem(PAJA_STORAGE_PROBE_KEY, previous);
    } catch { /* storage is unavailable */ }
    return false;
  }
}
