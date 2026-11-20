/**
 * Find NAP-INTENT handlers that are not installed in Paja yet.
 *
 * NAP-INTENT (napplet/naps master `377bf939`, "Recommended handler resolution")
 * lets a shell resolve a handler that is not installed and offer to install it.
 * The NIP-5D manifest catalog is made of `z` (archetype) and `i` (convention)
 * tags, so this asks relays for manifests whose `i` tag is the exact requested
 * convention. Kind-based NIP-89 routing is not used: NAP-INTENT forbids reading
 * a convention as an event-kind restriction.
 *
 * Every result is an untrusted offer. It is never added to the installed
 * catalog, never shown to napplets, and never selects a handler by itself.
 * When the user picks one, Paja runs the ordinary verified pointer load
 * (signature, exact coordinate, NIP-5A artifact hash). The resolver then
 * checks the installed entry's verified contracts before anything is delivered.
 *
 * @module
 */

import type { NostrEvent } from 'nostr-tools';
import { naddrEncode, neventEncode, npubEncode } from 'nostr-tools/nip19';
import { SimplePool } from 'nostr-tools/pool';
import { verifyEvent } from 'nostr-tools/pure';
import {
  NAPPLET_KIND_NAMED,
  NAPPLET_KIND_ROOT,
  NAPPLET_KINDS,
  isNappletManifestKind,
  parseNappletManifest,
} from '@kehto/nip/5d';
import type { IntentHandlerHint } from '@kehto/services';

import { queryPointerRelays, type PajaPointerRelayPool, type PointerRelayQueryResult } from './runtime-resolver.js';
import { getPajaSetting } from './settings.js';

/**
 * A manifest found on relays that advertises the requested convention but is
 * not installed.
 *
 * @example
 * ```ts
 * const offer: PajaDiscoveredIntentHandler = {
 *   catalogId: 'nip5d:35129:<pubkey>:note-viewer',
 *   pointer: 'naddr1…', publisher: 'npub1…', convention: 'napplet:note/open',
 *   createdAt: 1_700_000_000, recommended: false,
 * };
 * ```
 */
export interface PajaDiscoveredIntentHandler {
  /** The NIP-5D catalog identity the handler gets once it is installed. */
  readonly catalogId: string;
  /** `naddr` (named or root manifest) or `nevent` (snapshot) for a verified load. */
  readonly pointer: string;
  /** Manifest `title`, when present. */
  readonly title?: string;
  /** Publisher `npub`. */
  readonly publisher: string;
  /** The exact convention the manifest advertises. */
  readonly convention: string;
  /** Newest `created_at` seen for this identity. */
  readonly createdAt: number;
  /** True when it came from the request's `handlerHint`. */
  readonly recommended: boolean;
}

/** Options for {@link findPajaIntentHandlers}. */
export interface FindPajaIntentHandlersOptions {
  /** The user's configured relays, which are searched for the convention. */
  readonly relays: readonly string[];
  /** Relay pool override; defaults to a `nostr-tools` `SimplePool`. */
  readonly pool?: PajaPointerRelayPool;
  /** Search deadline in milliseconds; defaults to `target.runtimeWaitMs`. */
  readonly maxWaitMs?: number;
  /** The request's `handlerHint`, looked up only as part of the same search. */
  readonly hint?: IntentHandlerHint;
  /** Catalog identities that are already installed and must not be offered. */
  readonly installed?: (catalogId: string) => boolean;
}

/** The search could not reach any relay, as opposed to finding nothing. */
export class PajaIntentDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PajaIntentDiscoveryError';
  }
}

const COORDINATE = /^(?<kind>\d+):(?<pubkey>[0-9a-f]{64}):(?<identifier>.*)$/u;

function hintFilter(hint: IntentHandlerHint | undefined): { kinds: number[]; authors: string[]; '#d': string[] } | undefined {
  const parts = hint ? COORDINATE.exec(hint.address)?.groups : undefined;
  if (!parts || Number(parts.kind) !== NAPPLET_KIND_NAMED || parts.identifier === '') return undefined;
  return { kinds: [NAPPLET_KIND_NAMED], authors: [parts.pubkey], '#d': [parts.identifier] };
}

function pointerFor(event: NostrEvent, dTag: string, relays: readonly string[]): string {
  if (event.kind === NAPPLET_KIND_NAMED || event.kind === NAPPLET_KIND_ROOT) {
    return naddrEncode({ kind: event.kind, pubkey: event.pubkey, identifier: dTag, relays: [...relays] });
  }
  return neventEncode({ id: event.id, author: event.pubkey, kind: event.kind, relays: [...relays] });
}

/**
 * Turn one relay event into an offer, or `undefined` when it is not a valid,
 * signed manifest that advertises exactly this archetype and convention.
 */
function offerFor(
  event: NostrEvent,
  request: { readonly archetype: string; readonly convention: string },
  relays: readonly string[],
  recommended: boolean,
): PajaDiscoveredIntentHandler | undefined {
  if (!isNappletManifestKind(event.kind) || !verifyEvent(event)) return undefined;
  let manifest: ReturnType<typeof parseNappletManifest>;
  try {
    manifest = parseNappletManifest(event);
  } catch {
    return undefined;
  }
  const supports = manifest.archetypes.some((entry) =>
    entry.slug === request.archetype && entry.convention === request.convention);
  if (!supports) return undefined;
  return {
    catalogId: manifest.catalogId,
    pointer: pointerFor(event, manifest.dTag, relays),
    ...(manifest.title ? { title: manifest.title } : {}),
    publisher: npubEncode(event.pubkey),
    convention: request.convention,
    createdAt: event.created_at,
    recommended,
  };
}

/** A relay failure is a discovery failure, never "nothing handles this". */
function unreachable(result: PointerRelayQueryResult): boolean {
  if (result.events.length > 0) return false;
  if (result.error !== undefined) return true;
  return result.connections !== undefined && result.connections.connected.length === 0;
}

function collect(
  events: readonly NostrEvent[],
  request: { readonly archetype: string; readonly convention: string },
  relays: readonly string[],
  recommended: boolean,
  into: Map<string, PajaDiscoveredIntentHandler>,
  installed: (catalogId: string) => boolean,
): void {
  for (const event of events) {
    const offer = offerFor(event, request, relays, recommended);
    if (!offer || installed(offer.catalogId)) continue;
    const seen = into.get(offer.catalogId);
    const newest = !seen || offer.createdAt > seen.createdAt ? offer : seen;
    into.set(offer.catalogId, { ...newest, recommended: newest.recommended || (seen?.recommended ?? false) || offer.recommended });
  }
}

/**
 * Search the user's relays for manifests that advertise one exact NAP-INTENT
 * convention, plus the request's `handlerHint` coordinate when there is one.
 * Nothing is fetched from Blossom, installed, or loaded here.
 *
 * @param request - The archetype and exact convention to match.
 * @param options - Relays, pool, deadline, hint, and installed filter.
 * @returns Offers, recommended first, then newest first, capped by `target.intentDiscoveryLimit`.
 * @throws {PajaIntentDiscoveryError} When no relay is configured or none answered.
 * @example
 * ```ts
 * const offers = await findPajaIntentHandlers(
 *   { archetype: 'note', convention: 'napplet:note/open' },
 *   { relays: ['wss://relay.example'] },
 * );
 * ```
 */
export async function findPajaIntentHandlers(
  request: { readonly archetype: string; readonly convention: string },
  options: FindPajaIntentHandlersOptions,
): Promise<PajaDiscoveredIntentHandler[]> {
  const relays = [...new Set(options.relays)];
  const hint = hintFilter(options.hint);
  const hintRelays = [...new Set([...(options.hint?.relays ?? []), ...relays])];
  if (relays.length === 0 && (!hint || hintRelays.length === 0)) {
    throw new PajaIntentDiscoveryError('No relays are configured to search for apps.');
  }
  const limit = getPajaSetting('target.intentDiscoveryLimit');
  const maxWaitMs = options.maxWaitMs ?? getPajaSetting('target.runtimeWaitMs');
  const installed = options.installed ?? (() => false);
  const pool = options.pool ?? new SimplePool();
  const ownsPool = options.pool === undefined;
  try {
    const [search, hinted] = await Promise.all([
      relays.length === 0 ? undefined : queryPointerRelays(pool, relays,
        { kinds: [...NAPPLET_KINDS], '#i': [request.convention], limit }, maxWaitMs),
      hint ? queryPointerRelays(pool, hintRelays, hint, maxWaitMs) : undefined,
    ]);
    const results = [search, hinted].filter((result): result is PointerRelayQueryResult => result !== undefined);
    if (results.every(unreachable)) throw new PajaIntentDiscoveryError('No relay could be reached to search for apps.');
    const offers = new Map<string, PajaDiscoveredIntentHandler>();
    collect(search?.events ?? [], request, [], false, offers, installed);
    collect(hinted?.events ?? [], request, options.hint?.relays ?? [], true, offers, installed);
    return [...offers.values()]
      .sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.createdAt - a.createdAt)
      .slice(0, limit);
  } finally {
    if (ownsPool) {
      pool.close?.([...new Set([...relays, ...hintRelays])]);
      pool.destroy?.();
    }
  }
}
