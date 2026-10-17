/**
 * Relay-pool contracts for the concrete outbox router.
 *
 * @module
 */

import type { EventTemplate, NostrEvent, NostrFilter } from '@napplet/core';

/** A NIP-65 relay list for a single pubkey. */
export interface RelayListEntry {
  /** Relays the author reads from (their inbox). */
  read: string[];
  /** Relays the author writes to (where their events land). */
  write: string[];
}

/**
 * Why one relay ended up in an outbox read.
 *
 * - `nip65` — discovered from the requested authors' NIP-65 relay lists.
 * - `hint` — supplied by the caller as a relay hint for this read.
 * - `fallback` — the host's configured fallback set, used when neither of the
 *   above produced a relay.
 *
 * The router reports this per relay so hosts can show how a read was routed
 * instead of guessing from the final relay list.
 */
export type OutboxRelayOrigin = 'nip65' | 'hint' | 'fallback';

/**
 * Relay pool contract the router drives. Implementors adapt their pool library
 * while the router retains relay selection and event attribution.
 */
export interface OutboxRelayPool {
  /**
   * Subscribe to `filters` on exactly `relayUrls`.
   *
   * @param filters - NIP-01 filters.
   * @param relayUrls - Relays this call must use.
   * @param callback - Receives matching events or 'EOSE'.
   * @param origin - Why `relayUrls` are in this read, when the router knows.
   */
  subscribe(
    filters: NostrFilter[],
    relayUrls: string[],
    callback: (item: NostrEvent | 'EOSE') => void,
    origin?: OutboxRelayOrigin,
  ): { unsubscribe(): void };
  /** Publish `event` to `relayUrls`, optionally returning per-relay outcomes. */
  publish(
    event: NostrEvent,
    relayUrls: string[],
  ): Promise<Record<string, boolean>> | Record<string, boolean> | void;
  /** Whether the relay pool can handle requests. */
  isAvailable(): boolean;
}

/** Options for the relay-pool-backed outbox router. */
export interface RelayPoolOutboxRouterOptions {
  /** Relay pool the router subscribes and publishes through. */
  relayPool: OutboxRelayPool;
  /** Resolve NIP-65 relay lists for the requested pubkeys. */
  loadRelayLists(pubkeys: string[]): Promise<Map<string, RelayListEntry>> | Map<string, RelayListEntry>;
  /** Relays used when hints and NIP-65 data are unavailable. */
  fallbackRelays: string[];
  /** Sign a template before publish. Omission denies publishing. */
  signEvent?(template: EventTemplate): Promise<NostrEvent>;
  /** Validate an event before delivery. Host pools may pre-verify. */
  verifyEvent?(event: NostrEvent): Promise<boolean> | boolean;
  /** Gate every relay URL, including caller hints. */
  isRelayAllowed?(url: string): boolean;
  /** Default bounded-query and initial-discovery timeout in milliseconds. */
  defaultTimeoutMs?: number;
}

/** Resolved router dependencies threaded into implementation helpers. */
export interface RouterCtx {
  relayPool: OutboxRelayPool;
  loadRelayLists: RelayPoolOutboxRouterOptions['loadRelayLists'];
  fallbackRelays: string[];
  signEvent?: RelayPoolOutboxRouterOptions['signEvent'];
  isRelayAllowed: (url: string) => boolean;
  defaultTimeoutMs: number;
  verify(event: NostrEvent): Promise<boolean>;
}

export interface RequiredRelayResolution {
  relays: string[];
  missingAuthors: string[];
  deniedAuthors: string[];
}

export interface PublishTargetResolution {
  relayUrls: string[];
  requiredRelayUrls: string[];
  error?: string;
}

export interface DiscoveredReadRelays {
  relays: string[];
  missingAuthors: string[];
}

export interface OutboxCollector {
  seen: Map<string, NostrEvent>;
  admitted: Set<string>;
  relayMap: Map<string, Set<string>>;
  pendingVerifications: number;
}

export interface LiveOutboxSubscription {
  handles: Map<string, { unsubscribe(): void }>;
  relays: Set<string>;
  admitted: Set<string>;
  seen: Set<string>;
  closed: boolean;
}
