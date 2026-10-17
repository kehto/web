import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@napplet/core';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { useWebSocketImplementation } from 'nostr-tools/pool';

import { createPajaAdapter, type PajaSignerProvider } from './browser-adapter.js';
import type { PajaRelayBackend } from './browser-relay-runtime.js';
import { normalizePajaSimulation } from './simulation.js';
import { createPajaRuntimeHostConfig } from './options.js';

const ACCOUNT_SK = generateSecretKey();
const ACCOUNT = getPublicKey(ACCOUNT_SK);
const FOLLOW_SK = generateSecretKey();
const FOLLOW = getPublicKey(FOLLOW_SK);
const FALLBACK = 'e'.repeat(64);
const FOLLOW_WRITE_RELAYS = ['wss://follow-one.example', 'wss://follow-two.example'];
const BOOTSTRAP_RELAYS = ['wss://bootstrap-one.example', 'wss://bootstrap-two.example'];

const createdAt = Math.floor(Date.now() / 1_000);
const sign = (sk: Uint8Array, template: Record<string, unknown>): NostrEvent => finalizeEvent({
  created_at: createdAt,
  tags: [],
  content: '',
  ...template,
} as never, sk) as NostrEvent;

/** Relay payloads Paja's own warming loop is allowed to discover. */
const cannedEvents: NostrEvent[] = [
  sign(ACCOUNT_SK, { kind: 3, tags: [['p', FOLLOW]] }),
  sign(FOLLOW_SK, { kind: 0, content: JSON.stringify({ name: 'followed' }) }),
  sign(FOLLOW_SK, { kind: 10002, tags: FOLLOW_WRITE_RELAYS.map((url) => ['r', url]) }),
];

interface SentFilter {
  readonly relayUrl: string;
  readonly kinds: readonly number[];
  readonly authors: readonly string[];
}

interface TrafficSink {
  readonly sockets: RecordingRelaySocket[];
  readonly sent: SentFilter[];
}

/** Traffic recorded by the sockets one test created. */
let sink: TrafficSink = { sockets: [], sent: [] };

/**
 * Minimal nostr relay stand-in.
 *
 * The socket records every filter Paja sends and answers REQ with matching
 * canned events plus EOSE, which drives Paja's real outbox router without any
 * network access. Each socket reports into the sink that was current when the
 * connection opened, so a test never sees traffic from an earlier adapter.
 */
class RecordingRelaySocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readonly url: string;
  readyState = 0;
  protocol = '';
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  private readonly target: TrafficSink;

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    this.target = sink;
    this.target.sockets.push(this);
    setTimeout(() => {
      this.readyState = RecordingRelaySocket.OPEN;
      this.onopen?.({ type: 'open' });
    }, 0);
  }

  send(raw: string): void {
    let message: unknown;
    try { message = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(message)) return;
    const [verb, subId, ...rest] = message as [string, string, ...unknown[]];
    if (verb !== 'REQ') return;
    const filters = rest.filter((filter): filter is Record<string, unknown> =>
      typeof filter === 'object' && filter !== null);
    this.target.sent.push({
      relayUrl: this.url,
      kinds: filters.flatMap((filter) => (Array.isArray(filter.kinds) ? filter.kinds as number[] : [])),
      authors: filters.flatMap((filter) => (Array.isArray(filter.authors) ? filter.authors as string[] : [])),
    });
    const matched = cannedEvents.filter((event) => filters.some((filter) =>
      (!Array.isArray(filter.authors) || filter.authors.includes(event.pubkey))
      && (!Array.isArray(filter.kinds) || filter.kinds.includes(event.kind))));
    setTimeout(() => {
      for (const event of matched) this.deliver(['EVENT', subId, event]);
      this.deliver(['EOSE', subId]);
    }, 0);
  }

  deliver(payload: unknown[]): void {
    if (this.readyState === RecordingRelaySocket.CLOSED) return;
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  close(): void {
    this.readyState = RecordingRelaySocket.CLOSED;
    this.onclose?.({ type: 'close' });
  }
}

/** Reset recorded traffic for one test. */
function resetTraffic(): void {
  sink = { sockets: [], sent: [] };
}

/** Poll until `predicate` holds so assertions never race the warming loop. */
async function waitFor(predicate: () => boolean, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for relay traffic');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Wait until no new read has been recorded for `quietMs`. */
async function waitForQuiet(quietMs = 120, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastCount = -1;
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    if (sink.sent.length !== lastCount) {
      lastCount = sink.sent.length;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= quietMs) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Normalize a relay URL the way nostr-tools reports it back. */
function normalized(relayUrl: string): string {
  return relayUrl.endsWith('/') ? relayUrl : `${relayUrl}/`;
}

function createSimulation(identity: { mode: 'anonymous' } | { mode: 'fixed'; pubkey: string }) {
  return normalizePajaSimulation({
    identity,
    relay: { mode: 'live', urls: BOOTSTRAP_RELAYS },
    capabilities: {
      domains: { fs: false, media: false, keys: false, gamepad: false, notify: false, cvm: false },
    },
  });
}

function createAdapter(
  simulation: ReturnType<typeof createSimulation>,
  signerProvider?: PajaSignerProvider,
) {
  const config = createPajaRuntimeHostConfig({ simulation });
  return createPajaAdapter(
    config,
    () => simulation,
    () => {},
    () => {},
    async () => true,
    signerProvider,
  );
}

/** Signer controller state for a NIP-07 connection the browser refused. */
function failedNip07Signer(): PajaSignerProvider {
  return {
    getSigner: () => null,
    getMethod: () => 'nip07',
    getPubkey: () => null,
  };
}

describe('Paja relay traffic without a connected signer', () => {
  it('starts no author-routed reads while a fixed simulation identity has no signer', async () => {
    useWebSocketImplementation(RecordingRelaySocket);
    resetTraffic();
    const simulation = createSimulation({ mode: 'fixed', pubkey: FALLBACK });
    const adapter = createAdapter(simulation, failedNip07Signer());

    // The relay transport itself is live: it is the account gate, not a
    // disabled relay, that keeps the session quiet.
    const backend = adapter.relayPool.getRelayPool() as PajaRelayBackend | null;
    expect(backend?.isAvailable()).toBe(true);
    // The fixed identity still answers napplet identity requests.
    expect(adapter.auth.getUserPubkey()).toBe(FALLBACK);

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(sink.sockets).toEqual([]);
    expect(sink.sent).toEqual([]);
  });

  it('warms the connected account and routes each followed profile through NIP-65 relays', async () => {
    useWebSocketImplementation(RecordingRelaySocket);
    resetTraffic();
    const simulation = createSimulation({ mode: 'anonymous' });
    createAdapter(simulation, {
      getSigner: () => null,
      getMethod: () => 'nip07',
      getPubkey: () => ACCOUNT,
    });

    // The account's own contact list is read first …
    await waitFor(() => sink.sent.some(({ kinds, authors }) =>
      kinds.includes(3) && authors.includes(ACCOUNT)));
    // … then each followed profile is routed to that author's write relays,
    // which is the traffic the panel reports under "outbox relays (NIP-65)".
    await waitFor(() => sink.sent.some(({ relayUrl, kinds, authors }) =>
      kinds.includes(0) && authors.includes(FOLLOW) && FOLLOW_WRITE_RELAYS.map(normalized).includes(relayUrl)));
  });

  it('keeps the session quiet for an anonymous simulation identity as well', async () => {
    useWebSocketImplementation(RecordingRelaySocket);
    resetTraffic();
    const simulation = createSimulation({ mode: 'anonymous' });
    const adapter = createAdapter(simulation, failedNip07Signer());

    expect(adapter.auth.getUserPubkey()).toBe('');
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(sink.sockets).toEqual([]);
    expect(sink.sent).toEqual([]);
  });

  it('does not restart warming when a connected signer drops out', async () => {
    useWebSocketImplementation(RecordingRelaySocket);
    resetTraffic();
    const listeners = new Set<() => void>();
    let connected = true;
    const simulation = createSimulation({ mode: 'anonymous' });
    createAdapter(simulation, {
      getSigner: () => null,
      getMethod: () => 'nip07',
      getPubkey: () => (connected ? ACCOUNT : null),
      subscribe: (next) => {
        listeners.add(next);
        return () => { listeners.delete(next); };
      },
    });

    await waitFor(() => sink.sent.some(({ kinds, authors }) =>
      kinds.includes(3) && authors.includes(ACCOUNT)));
    await waitForQuiet();

    connected = false;
    resetTraffic();
    for (const listener of listeners) listener();
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Every warming cycle starts by reading the account's contact list, so a
    // restart after the drop would show up as a new kind-3 read.
    expect(sink.sent.filter(({ kinds }) => kinds.includes(3))).toEqual([]);
  });
});
