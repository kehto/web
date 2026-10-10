/** Publisher-safe catalog identities for verified NIP-5D manifest events. */

import type { NostrEvent } from 'nostr-tools';
import {
  NAPPLET_KIND_NAMED,
  NAPPLET_KIND_ROOT,
  NAPPLET_KIND_SNAPSHOT,
} from './kinds.js';

const PUBKEY = /^[a-f0-9]{64}$/;

/**
 * Derive the runtime catalog identity for a verified NIP-5D manifest event.
 *
 * Named and root manifests retain a stable publisher-scoped identity while a
 * snapshot is identified by its immutable signed event id. Call this only after
 * the event has passed signature and manifest verification.
 *
 * @param event - A verified NIP-5D manifest event.
 * @returns The opaque publisher/kind-safe catalog ID.
 *
 * @example
 * ```ts
 * getNappletCatalogId(namedManifest);
 * // → 'nip5d:35129:<publisher>:<literal-d-tag>'
 * ```
 */
export function getNappletCatalogId(event: Pick<NostrEvent, 'id' | 'kind' | 'pubkey' | 'tags'>): string {
  if (!PUBKEY.test(event.pubkey)) throw new TypeError('napplet manifest pubkey is invalid');
  if (event.kind === NAPPLET_KIND_SNAPSHOT) {
    if (!/^[a-f0-9]{64}$/.test(event.id)) throw new TypeError('napplet snapshot id is invalid');
    return `nip5d:${NAPPLET_KIND_SNAPSHOT}:${event.id}`;
  }
  if (event.kind === NAPPLET_KIND_ROOT) return `nip5d:${NAPPLET_KIND_ROOT}:${event.pubkey}`;
  if (event.kind === NAPPLET_KIND_NAMED) {
    const dTags = event.tags.filter((tag) => tag[0] === 'd');
    if (dTags.length !== 1 || dTags[0].length !== 2 || !dTags[0][1]) {
      throw new TypeError('named napplet manifest must have one non-empty d tag');
    }
    // `d` is opaque and case-sensitive: deliberately preserve it byte-for-byte.
    return `nip5d:${NAPPLET_KIND_NAMED}:${event.pubkey}:${dTags[0][1]}`;
  }
  throw new TypeError(`unsupported napplet manifest kind: ${event.kind}`);
}
