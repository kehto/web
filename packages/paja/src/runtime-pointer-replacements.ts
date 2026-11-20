import type { NostrEvent } from 'nostr-tools';
import { naddrEncode } from 'nostr-tools/nip19';
import { SimplePool } from 'nostr-tools/pool';
import { verifyEvent } from 'nostr-tools/pure';
import { isNappletManifestKind } from '@kehto/nip/5d';

import {
  decodePajaPointer,
  queryPointerRelays,
  type PajaPointerRelayPool,
} from './runtime-resolver.js';
import { getPajaSetting } from './settings.js';

/**
 * A current addressable manifest from the same author and kind as a `nevent`
 * whose exact event is gone. It is an offer for the user to open, never a
 * substitute: opening it is a fresh, fully verified `naddr` load.
 *
 * @example
 * ```ts
 * const offer: PajaPointerReplacement = { naddr: 'naddr1…', dTag: 'feed', createdAt: 1_700_000_000 };
 * ```
 */
export interface PajaPointerReplacement {
  /** `naddr` for the coordinate `kind:author:d`. */
  readonly naddr: string;
  /** Manifest `d` tag. */
  readonly dTag: string;
  /** Newest `created_at` seen for this coordinate. */
  readonly createdAt: number;
  /** Manifest `title` tag, when present. */
  readonly title?: string;
}

/** Options for {@link findPajaPointerReplacements}. */
export interface FindPajaPointerReplacementsOptions {
  /** Relays to ask; normally the ones that answered the original lookup. */
  readonly relays: readonly string[];
  /** Relay pool override; defaults to a `nostr-tools` `SimplePool`. */
  readonly pool?: PajaPointerRelayPool;
  /** Deadline for the lookup in milliseconds. */
  readonly maxWaitMs?: number;
}

/**
 * List the author's current addressable manifests for a `nevent` whose exact
 * event was not found. A `nevent` carries no `d` tag, so this cannot tell which
 * coordinate the old event belonged to: it returns every current `d` for the
 * author and kind, newest first, and the caller lets the user pick. Nothing is
 * fetched from Blossom, verified, installed, or loaded here.
 *
 * Returns an empty list when the pointer is not a `nevent`, lacks `author` or
 * `kind`, is not an addressable NIP-5D manifest kind, or the lookup fails.
 *
 * @param pointerValue - The original `nevent` string.
 * @param options - Relays, pool, and deadline.
 * @returns Candidate coordinates for a user choice.
 * @example
 * ```ts
 * const offers = await findPajaPointerReplacements(nevent, { relays: error.relays });
 * ```
 */
export async function findPajaPointerReplacements(
  pointerValue: string,
  options: FindPajaPointerReplacementsOptions,
): Promise<PajaPointerReplacement[]> {
  const pointer = decodePajaPointer(pointerValue);
  if (pointer.type !== 'nevent' || !pointer.author || pointer.kind === undefined) return [];
  const { author, kind } = pointer;
  if (!isAddressableKind(kind) || !isNappletManifestKind(kind) || options.relays.length === 0) return [];

  const pool = options.pool ?? new SimplePool();
  const ownsPool = options.pool === undefined;
  const maxReplacements = getPajaSetting('target.pointerReplacementLimit');
  try {
    const result = await queryPointerRelays(
      pool,
      options.relays,
      { kinds: [kind], authors: [author], limit: maxReplacements },
      options.maxWaitMs ?? getPajaSetting('target.runtimeWaitMs'),
    );
    const newest = new Map<string, NostrEvent>();
    for (const event of result.events) {
      if (event.kind !== kind || event.pubkey !== author || event.id === pointer.id) continue;
      const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1];
      if (!dTag || !verifyEvent(event)) continue;
      const seen = newest.get(dTag);
      if (!seen || event.created_at > seen.created_at) newest.set(dTag, event);
    }
    return [...newest.entries()]
      .sort(([, a], [, b]) => b.created_at - a.created_at)
      .slice(0, maxReplacements)
      .map(([dTag, event]) => {
        const title = event.tags.find((tag) => tag[0] === 'title')?.[1];
        return {
          naddr: naddrEncode({ kind, pubkey: author, identifier: dTag, relays: [...pointer.relays] }),
          dTag,
          createdAt: event.created_at,
          ...(title ? { title } : {}),
        };
      });
  } catch {
    return [];
  } finally {
    if (ownsPool) {
      pool.close?.([...options.relays]);
      pool.destroy?.();
    }
  }
}

/** NIP-01 addressable kind range (wire contract, not a setting). */
function isAddressableKind(kind: number): boolean {
  return kind >= 30_000 && kind < 40_000;
}
