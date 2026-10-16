/**
 * browser-relay-panel.ts — Paja's relay receipt counter and sidebar panel.
 *
 * The counter lives outside the host state object so relay fetches that Paja
 * starts before the host state exists (signer probes, social cache, relay
 * lists) are counted rather than dropped, and it keeps each receipt grouped by
 * why Paja opened the read, which relay served it, and which kind it was.
 *
 * @module
 */

import { normalizeURL } from 'nostr-tools/utils';

import type {
  PajaRelayReadOrigin,
  PajaRelayReadReason,
} from './browser-relay-runtime.js';

/** Id of the host-page button that clears the relay receipt counters. */
export const PAJA_EVENT_COUNTER_RESET_ID = 'event-counter-reset';
/** Visible text and accessible name of the counter reset button. */
export const PAJA_EVENT_COUNTER_RESET_LABEL = 'reset';
/** Tooltip explaining what the reset button clears. */
export const PAJA_EVENT_COUNTER_RESET_TITLE = 'reset counter';

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
  /** How this relay was routed inside an outbox plan, when the router said so. */
  readonly origins: PajaRelayReadOrigin[];
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
   * @param origin - How a relay was routed inside an outbox plan, when known.
   */
  recordRead(reason: PajaRelayReadReason, relayUrls: readonly string[], origin?: PajaRelayReadOrigin): void;
  /**
   * Count one event received from a live relay.
   *
   * @param reason - How the producing read's relay set was chosen.
   * @param event - Event as received from the live relay.
   * @param sightedOn - Relays the read saw this event on.
   * @param origin - How a relay was routed inside an outbox plan, when known.
   */
  recordEvent(
    reason: PajaRelayReadReason,
    event: unknown,
    sightedOn: readonly string[],
    origin?: PajaRelayReadOrigin,
  ): void;
  /**
   * Clear every receipt, read, and unique event so counting restarts empty.
   *
   * Configured relays still render afterwards, exactly as they do at boot,
   * because the panel always renders the inventory it was handed.
   */
  reset(): void;
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

interface MutableRelayReceipt {
  relayUrl: string;
  count: number;
  kinds: Map<number, number>;
  origins: Set<PajaRelayReadOrigin>;
}

function emptyReasonGroup(): {
  count: number;
  reads: Map<string, number>;
  relays: Map<string, MutableRelayReceipt>;
} {
  return { count: 0, reads: new Map(), relays: new Map() };
}

/** Coalesce equivalent relay identities within one observation batch. */
function distinctRelayUrls(urls: readonly string[]): string[] {
  const unique = new Map<string, string>();
  for (const url of urls) {
    if (url.length === 0) continue;
    const key = normalizeURL(url);
    if (!unique.has(key)) unique.set(key, url);
  }
  return [...unique.values()];
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
    const key = normalizeURL(relayUrl);
    let relay = group.relays.get(key);
    if (!relay) {
      relay = { relayUrl, count: 0, kinds: new Map(), origins: new Set() };
      group.relays.set(key, relay);
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
          const key = normalizeURL(relayUrl);
          if (seen.has(key)) return;
          seen.add(key);
          const relay = group?.relays.get(key);
          relays.push({
            relayUrl,
            count: relay?.count ?? 0,
            readCount: group?.reads.get(key) ?? 0,
            configured: isConfigured,
            origins: [...(relay?.origins ?? [])].sort(),
            kinds: [...(relay?.kinds.entries() ?? [])]
              .sort(([left], [right]) => left - right)
              .map(([kind, count]) => ({ kind, count })),
          });
        };
        const observed = [...(group?.relays.values() ?? [])].map((relay) => relay.relayUrl);
        for (const url of configured) push(url, true);
        for (const url of observed) push(url, false);
        if (relays.length === 0) continue;
        relays.sort((left, right) => right.count - left.count);
        out.push({ reason, count: group?.count ?? 0, relays });
      }
      return out;
    },
    recordRead(reason, relayUrls, origin) {
      const group = groupFor(reason);
      let changed = false;
      for (const relayUrl of distinctRelayUrls(relayUrls)) {
        const key = normalizeURL(relayUrl);
        group.reads.set(key, (group.reads.get(key) ?? 0) + 1);
        const relay = relayFor(reason, relayUrl);
        if (origin) relay.origins.add(origin);
        changed = true;
      }
      if (changed) onChange?.();
    },
    recordEvent(reason, event, sightedOn, origin) {
      if (typeof event !== 'object' || event === null) return;
      const kind = (event as { kind?: unknown }).kind;
      if (typeof kind !== 'number' || !Number.isSafeInteger(kind) || kind < 0) return;
      const relays = distinctRelayUrls(sightedOn);
      if (relays.length === 0) return;
      const group = groupFor(reason);
      for (const relayUrl of relays) {
        const relay = relayFor(reason, relayUrl);
        relay.count += 1;
        if (origin) relay.origins.add(origin);
        relay.kinds.set(kind, (relay.kinds.get(kind) ?? 0) + 1);
        group.count += 1;
        total += 1;
      }
      const id = (event as { id?: unknown }).id;
      if (typeof id === 'string' && id.length > 0) eventIds.add(id);
      onChange?.();
    },
    reset() {
      groups.clear();
      eventIds.clear();
      total = 0;
      onChange?.();
    },
  };
}

/**
 * Wire the Events section's reset button to a relay receipt counter.
 *
 * The button sits inside the Events summary, so its click is kept away from the
 * disclosure control and only clears the counters.
 *
 * @param counter - Counter the button clears.
 * @returns Disposer for the click listener.
 * @example
 * const disposeCounterReset = installPajaEventCounterReset(counter);
 * window.addEventListener('pagehide', disposeCounterReset, { once: true });
 */
export function installPajaEventCounterReset(counter: PajaRelayEventCounter): () => void {
  const button = document.getElementById(PAJA_EVENT_COUNTER_RESET_ID);
  const onClick = (event: Event): void => {
    // Never let the reset click reach the summary and toggle the section.
    event.stopPropagation();
    counter.reset();
  };
  button?.addEventListener('click', onClick);
  return () => button?.removeEventListener('click', onClick);
}

/**
 * Render Paja's relay receipts grouped by read reason, relay, and kind.
 *
 * Bars are scaled against the busiest relay of the session so cross-group
 * comparison stays honest, and configured relays with no traffic still render
 * so idle or silent relays are visible.
 *
 * @param counter - Cumulative relay receipts to render.
 * @param inventory - Configured relays per read reason, so idle relays render.
 */
export function renderPajaEventKindCounts(
  counter: PajaRelayEventCounter,
  inventory?: PajaRelayInventory,
): void {
  const container = document.getElementById('event-kind-counts');
  const total = document.getElementById('event-kind-total');
  const groups = counter.snapshot(inventory);
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
      for (const origin of relay.origins) {
        const chip = document.createElement('span');
        chip.className = 'event-relay-origin';
        chip.dataset.relayOrigin = origin;
        chip.textContent = origin === 'hint' ? 'plan hint' : origin;
        chip.title = origin === 'nip65'
          ? 'Relay discovered from the requested authors NIP-65 write relays'
          : origin === 'hint'
            ? 'Relay supplied as a hint for this outbox read'
            : 'Configured fallback relay, used because no list or hint resolved';
        rowHead.append(chip);
      }
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
