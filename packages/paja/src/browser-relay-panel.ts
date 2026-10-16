/**
 * browser-relay-panel.ts — Paja's relay receipt counter and sidebar panel.
 *
 * The counter lives outside the host state object so relay fetches that Paja
 * starts before the host state exists (signer probes, social cache, relay
 * lists) are counted rather than dropped, and it keeps each receipt grouped by
 * why Paja opened the read and how the relay was routed inside it, which relay
 * served the event, and which kind it was.
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
 * Cumulative receipt counters for one relay inside one box.
 *
 * Counts are receipts, not distinct events: a relay that hands Paja the same
 * event twice is credited twice, because the panel reports what was fetched.
 */
export interface PajaRelayReceipt {
  /** Relay URL. */
  readonly relayUrl: string;
  /** Events received from this relay in this box. */
  readonly count: number;
  /** Reads Paja started against this relay in this box. */
  readonly readCount: number;
  /** Events per kind received from this relay in this box. */
  readonly kinds: PajaEventKindCount[];
  /** Whether this relay is configured rather than only observed. */
  readonly configured: boolean;
}

/**
 * How one box of relay receipts was chosen.
 *
 * A box is a routing decision, not a relay set, so the same relay appears in
 * two boxes when two reads reached it for different reasons.
 *
 * - `nip65` — outbox reads routed to the requested authors' NIP-65 write relays.
 * - `hint` — outbox reads the napplet pointed at relays with an `outbox.*` hint.
 * - `fallback` — the host's configured relays, read when no list or hint resolved.
 * - `unattributed` — an outbox read that arrived without a router origin.
 * - `scoped` — a read the napplet pinned itself with NAP-RELAY `relay.subscribe`.
 * - `host` — Paja's own reads through its configured read pool.
 */
export type PajaRelayBoxKind = 'nip65' | 'hint' | 'fallback' | 'unattributed' | 'scoped' | 'host';

/** One box of relay receipts, labelled by how its reads were chosen. */
export interface PajaRelayBox {
  /** Which box this is. */
  readonly kind: PajaRelayBoxKind;
  /** Header text for the box. */
  readonly label: string;
  /** Read reason whose relays this box holds. */
  readonly reason: PajaRelayReadReason;
  /** Router origin this box holds, when the box is origin-scoped. */
  readonly origin?: PajaRelayReadOrigin;
  /** Events received in this box, counting every relay sighting. */
  readonly count: number;
  /** Relays in this box, including configured relays with no traffic yet. */
  readonly relays: PajaRelayReceipt[];
  /** Rendered in the header when the box holds no relays but the session has receipts. */
  readonly emptyNote?: string;
}

/** Configured relay inventory per box, so idle relays still render. */
export type PajaRelayInventory = Partial<Record<PajaRelayBoxKind, readonly string[]>>;

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
  /** Receipts grouped into boxes, including configured relays with no traffic. */
  snapshot(inventory?: PajaRelayInventory): PajaRelayBox[];
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

interface PajaRelayBoxSpec {
  kind: PajaRelayBoxKind;
  label: string;
  reason: PajaRelayReadReason;
  origin?: PajaRelayReadOrigin;
  /** Whether configured relays seed this box before it serves anything. */
  configured: boolean;
  /** Rendered in the header when the box holds no relays and the session has receipts. */
  emptyNote?: string;
}

/**
 * Boxes in the fixed precedence Paja routes reads in: author-routed outbox
 * relays first, then the hints a napplet supplied, then the host's configured
 * fallback set, then Paja's own traffic. Counts sort relays inside a box, never
 * the boxes themselves, so boxes do not reorder while the session is running.
 */
const RELAY_BOXES: readonly PajaRelayBoxSpec[] = [
  {
    kind: 'nip65',
    label: 'outbox relays (NIP-65)',
    reason: 'outbox',
    origin: 'nip65',
    configured: false,
    emptyNote: 'no author-routed reads',
  },
  { kind: 'hint', label: 'relay hints', reason: 'outbox', origin: 'hint', configured: false },
  { kind: 'fallback', label: 'fallback relays', reason: 'outbox', origin: 'fallback', configured: true },
  { kind: 'unattributed', label: 'outbox relays (unattributed)', reason: 'outbox', configured: false },
  { kind: 'scoped', label: 'scoped relay', reason: 'hint', configured: false },
  { kind: 'host', label: 'host pool', reason: 'host', configured: false },
];

/**
 * Which box one observation belongs to.
 *
 * Outbox reads carry the router's origin; scoped reads and Paja's own reads have
 * one reason each. An outbox read that arrives without an origin is reported as
 * unattributed rather than credited to the authors' NIP-65 relays.
 */
function boxKindFor(reason: PajaRelayReadReason, origin?: PajaRelayReadOrigin): PajaRelayBoxKind {
  if (reason === 'outbox') return origin ?? 'unattributed';
  return reason === 'hint' ? 'scoped' : 'host';
}

interface MutableRelayReceipt {
  relayUrl: string;
  count: number;
  kinds: Map<number, number>;
}

function emptyBox(): {
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
 * Create a cumulative relay-receipt counter grouped into routing boxes.
 *
 * Only well-formed events with a non-negative integer `kind` are counted, and
 * every relay a read saw the event on is credited, so one event fetched through
 * two boxes appears in both of them.
 *
 * @param onChange - Called after a counted read or event.
 * @returns Counter suitable for the relay observation hooks and sidebar rendering.
 * @example
 * const counter = createPajaRelayEventCounter(() => renderPajaEventKindCounts(state));
 */
export function createPajaRelayEventCounter(onChange?: () => void): PajaRelayEventCounter {
  const boxes = new Map<PajaRelayBoxKind, ReturnType<typeof emptyBox>>();
  const eventIds = new Set<string>();
  let total = 0;

  const boxFor = (kind: PajaRelayBoxKind) => {
    let box = boxes.get(kind);
    if (!box) {
      box = emptyBox();
      boxes.set(kind, box);
    }
    return box;
  };
  const relayFor = (kind: PajaRelayBoxKind, relayUrl: string) => {
    const box = boxFor(kind);
    const key = normalizeURL(relayUrl);
    let relay = box.relays.get(key);
    if (!relay) {
      relay = { relayUrl, count: 0, kinds: new Map() };
      box.relays.set(key, relay);
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
      const out: PajaRelayBox[] = [];
      for (const spec of RELAY_BOXES) {
        const box = boxes.get(spec.kind);
        const configured = spec.configured ? inventory?.[spec.kind] ?? [] : [];
        const seen = new Set<string>();
        const relays: PajaRelayReceipt[] = [];
        const push = (relayUrl: string, isConfigured: boolean): void => {
          const key = normalizeURL(relayUrl);
          if (seen.has(key)) return;
          seen.add(key);
          const relay = box?.relays.get(key);
          relays.push({
            relayUrl,
            count: relay?.count ?? 0,
            readCount: box?.reads.get(key) ?? 0,
            configured: isConfigured,
            kinds: [...(relay?.kinds.entries() ?? [])]
              .sort(([left], [right]) => left - right)
              .map(([kind, count]) => ({ kind, count })),
          });
        };
        for (const url of configured) push(url, true);
        for (const relay of box?.relays.values() ?? []) push(relay.relayUrl, false);
        // An empty box only earns a header when there is other traffic to
        // contrast with; at boot the panel stays quiet instead of listing the
        // routing decisions that never happened.
        if (relays.length === 0 && !(spec.emptyNote && total > 0)) continue;
        relays.sort((left, right) => right.count - left.count);
        out.push({
          kind: spec.kind,
          label: spec.label,
          reason: spec.reason,
          ...(spec.origin ? { origin: spec.origin } : {}),
          count: box?.count ?? 0,
          relays,
          ...(relays.length === 0 && spec.emptyNote ? { emptyNote: spec.emptyNote } : {}),
        });
      }
      return out;
    },
    recordRead(reason, relayUrls, origin) {
      const kind = boxKindFor(reason, origin);
      const box = boxFor(kind);
      let changed = false;
      for (const relayUrl of distinctRelayUrls(relayUrls)) {
        const key = normalizeURL(relayUrl);
        box.reads.set(key, (box.reads.get(key) ?? 0) + 1);
        relayFor(kind, relayUrl);
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
      const box = boxFor(boxKindFor(reason, origin));
      for (const relayUrl of relays) {
        const relay = relayFor(boxKindFor(reason, origin), relayUrl);
        relay.count += 1;
        relay.kinds.set(kind, (relay.kinds.get(kind) ?? 0) + 1);
        box.count += 1;
        total += 1;
      }
      const id = (event as { id?: unknown }).id;
      if (typeof id === 'string' && id.length > 0) eventIds.add(id);
      onChange?.();
    },
    reset() {
      boxes.clear();
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
 * Render Paja's relay receipts grouped into routing boxes, relay, and kind.
 *
 * Bars are scaled against the busiest relay of the session so cross-box
 * comparison stays honest, and configured relays with no traffic still render
 * so idle or silent relays are visible.
 *
 * @param counter - Cumulative relay receipts to render.
 * @param inventory - Configured relays per box, so idle relays render.
 */
export function renderPajaEventKindCounts(
  counter: PajaRelayEventCounter,
  inventory?: PajaRelayInventory,
): void {
  const container = document.getElementById('event-kind-counts');
  const total = document.getElementById('event-kind-total');
  const boxes = counter.snapshot(inventory);
  if (total) {
    total.textContent = boxes.length === 0 ? '' : `${counter.total}`;
    total.title = `${counter.total} relay receipt${counter.total === 1 ? '' : 's'} · ${counter.uniqueEvents} unique event${counter.uniqueEvents === 1 ? '' : 's'}`;
  }
  if (!container) return;
  if (boxes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'event-empty';
    empty.textContent = 'no relay events yet';
    container.replaceChildren(empty);
    return;
  }

  const busiest = Math.max(1, ...boxes.flatMap((box) => box.relays.map((relay) => relay.count)));
  container.replaceChildren(...boxes.map((box) => {
    const section = document.createElement('div');
    section.className = 'event-box';
    section.dataset.relayBox = box.kind;
    section.dataset.relayReason = box.reason;

    const head = document.createElement('div');
    head.className = 'event-box-head';
    const name = document.createElement('span');
    name.className = 'event-box-name';
    name.textContent = box.label;
    // A box with no traffic says why it is empty instead of showing a bare zero.
    const boxCount = document.createElement('span');
    boxCount.className = box.relays.length === 0 ? 'event-box-note' : 'event-box-count';
    boxCount.textContent = box.relays.length === 0 ? box.emptyNote ?? '0' : String(box.count);
    head.append(name, boxCount);
    section.append(head);

    for (const relay of box.relays) {
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
          : 'configured for this box and not used yet this session';
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
