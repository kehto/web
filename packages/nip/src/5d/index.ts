import type { NostrEvent } from 'nostr-tools';
import { verifyEvent } from 'nostr-tools/pure';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { PathEntry } from '../5a/index.js';
import { NappletResolutionError } from './errors.js';
import { parseLegacyManifest, verifyLegacyAggregate, warnLegacyManifest } from './legacy-manifest.js';
import { parseCurrentManifest } from './current-manifest.js';
import {
  NAPPLET_KIND_NAMED,
  NAPPLET_KIND_ROOT,
  NAPPLET_KIND_SNAPSHOT,
  NAPPLET_KINDS,
} from './kinds.js';
import type { NappletArtifactCache } from './artifact-cache.js';
export {
  CacheStorageNappletArtifactCache,
  NAPPLET_ARTIFACT_CACHE_NAME,
  coordinateKey,
  isCoordinateFresh,
  openNappletArtifactCache,
  type CachedCoordinate,
  type CacheStorageNappletArtifactCacheOptions,
  type CoordinateFreshnessOptions,
  type NappletAggregateIndexEntry,
  type NappletArtifactCacheIndex,
  type NappletArtifactCache,
  type NappletBlobIndexEntry,
  type NappletCacheDiagnostic,
  type OpenNappletArtifactCacheOptions,
  type WriteVerifiedResolutionInput,
} from './artifact-cache.js';

/**
 * `@kehto/nip/5d` — verify signed napplet manifests and their content bytes.
 * Current events use one artifact x hash. The isolated legacy adapter accepts
 * path tags plus an aggregate x marker. Both formats share signature checking,
 * blob verification, caching, and verified srcdoc output.
 * @module
 */

/** Snapshot manifest — regular event, immutable point-in-time release. */
export { NAPPLET_KIND_SNAPSHOT, NAPPLET_KIND_ROOT, NAPPLET_KIND_NAMED, NAPPLET_KINDS };
/** Root manifest — replaceable event, an author's latest unnamed napplet. */
/** Named manifest — addressable event (carries a `d` tag identifier). */

/** All three NIP-5D napplet manifest kinds. */
export { getNappletCatalogId } from './catalog-id.js';

/**
 * Whether `kind` is one of the three NIP-5D napplet manifest kinds.
 *
 * @param kind - A Nostr event kind
 * @returns `true` for `5129` / `15129` / `35129`
 */
export function isNappletManifestKind(kind: number): boolean {
  return NAPPLET_KINDS.includes(kind);
}

/**
 * A parsed NIP-5D napplet manifest. All fields are derived from the manifest
 * event. Declarations are untrusted until {@link resolveNapplet} verifies both
 * the signature and the content bytes.
 */
export interface NappletManifest {
  /** Event format selected by the parser. Absent only in older host-created values. */
  format?: 'current' | 'legacy';
  /** Signed artifact hash for current events; legacy aggregate for older events. */
  artifactHash?: string;
  /** Optional domains; absence never prevents loading and presence grants nothing. */
  optional?: string[];
  /** Independent current z declarations, preserved even without accepted intents. */
  archetypeSlugs?: string[];
  /** Accepted queryless intents and advertised parameter names from i tags. */
  intents?: Array<{ identity: string; parameters: string[] }>;
  /** Valid supported icon declaration. Hosts may keep generic artwork. */
  icon?: { sha256: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' };
  /** Snapshot provenance only; never resolved or trusted on its behalf. */
  parent?: string;
  /** Snapshot root provenance only. */
  root?: string;
  /** Manifest event kind (`5129` / `15129` / `35129`). */
  kind: number;
  /** Author hex public key. */
  pubkey: string;
  /** Named-napplet `d` identifier, or `''` for root/snapshot manifests. */
  dTag: string;
  /** Publisher/kind-safe opaque identity for the verified manifest catalog. */
  catalogId: string;
  /** Normalized files: one /index.html for current events, legacy path entries otherwise. */
  paths: PathEntry[];
  /** Compatibility name for the signed content identity (current artifact or legacy aggregate). */
  aggregateHash: string;
  /** Blossom server URL hints from `server` tags. */
  servers: string[];
  /** Required bare domains from current R tags or legacy requires tags. */
  requires: string[];
  /**
   * Routing projection: independent current z/i sets, or exact legacy archetype pairs.
   */
  archetypes: Array<{ slug: string; convention: string; params: string[] }>;
  /** Optional human title. */
  title?: string;
  /** Plain-text event content (legacy description tag for older events). */
  description?: string;
  /** Optional upstream source URL from the `source` tag. */
  source?: string;
}

export { NappletResolutionError, type NappletResolutionErrorCode } from './errors.js';

/**
 * Normalize a current or legacy NIP-5D event without verifying its signature.
 * @param event - Candidate manifest; use resolveNapplet before trusting it.
 * @returns Manifest with normalized identity, paths, and routing declarations.
 * @example
 * const manifest = parseNappletManifest(event);
 */
export function parseNappletManifest(event: NostrEvent): NappletManifest {
  if (!isNappletManifestKind(event.kind)) {
    throw new NappletResolutionError('invalid-manifest', `not a NIP-5D napplet kind: ${event.kind}`);
  }
  const hashes = event.tags.filter((tag) => tag[0] === 'x');
  if (hashes.length !== 1) {
    throw new NappletResolutionError('invalid-manifest', 'manifest must carry exactly one x tag');
  }
  // Explicit format selection, never retry a malformed current event as legacy.
  return hashes[0][2] === 'aggregate'
    ? parseLegacyManifest(event)
    : parseCurrentManifest(event);
}

/**
 * Verify a manifest event's Nostr signature (id + schnorr sig).
 *
 * @param event - A manifest event
 * @returns `true` if the event is internally consistent and validly signed
 */
export function verifyManifestSignature(event: NostrEvent): boolean {
  try {
    return verifyEvent(event);
  } catch {
    return false;
  }
}

/**
 * Whether `bytes` hash to the expected lowercase-hex SHA-256.
 *
 * @param bytes - The blob bytes
 * @param sha256Hex - Expected lowercase-hex SHA-256
 * @returns `true` only on an exact match
 */
export function verifyBlobHash(bytes: Uint8Array, sha256Hex: string): boolean {
  return bytesToHex(sha256(bytes)) === sha256Hex;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Fetch a blob by SHA-256 from a list of Blossom servers, returning the first
 * server's bytes whose hash matches. The returned bytes are always re-verified
 * against `sha256Hex` — servers (and gateways) are never trusted.
 *
 * @param servers - Candidate Blossom server base URLs, tried in order
 * @param sha256Hex - The blob's lowercase-hex SHA-256
 * @param fetchBytes - Fetches raw bytes for a URL (`<server>/<sha256>`)
 * @returns The verified blob bytes
 * @throws {@link NappletResolutionError} `blob-unavailable` if no server serves
 *   a hash-matching blob
 */
export async function fetchBlob(
  servers: readonly string[],
  sha256Hex: string,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<Uint8Array> {
  for (const server of servers) {
    const url = `${stripTrailingSlash(server)}/${sha256Hex}`;
    try {
      const bytes = await fetchBytes(url);
      if (verifyBlobHash(bytes, sha256Hex)) return bytes;
    } catch {
      // try the next server
    }
  }
  throw new NappletResolutionError('blob-unavailable', `no server served blob ${sha256Hex}`);
}

/** A fully verified napplet, ready to inject via `iframe.srcdoc`. */
export interface ResolvedNapplet {
  /** Verified content identity; current artifact SHA-256 or legacy aggregate. */
  artifactHash: string;
  /** Computed `d` identifier (`''` for root/snapshot). */
  dTag: string;
  /** Compatibility alias for artifactHash; preserves existing host and ACL APIs. */
  aggregateHash: string;
  /** Verified file bytes keyed by manifest path. */
  files: Map<string, Uint8Array>;
  /** The verified `/index.html` decoded to text. */
  indexHtml: string;
  /** The parsed manifest. */
  manifest: NappletManifest;
}

/** Options for {@link resolveNapplet}. */
export interface ResolveNappletOptions {
  /** The candidate manifest event (resolved from relays by the caller). */
  event: NostrEvent;
  /**
   * Fetch raw blob bytes by SHA-256. Backed by Blossom (or a gateway) by the
   * caller. The bytes are re-verified against the hash here, so the fetcher is
   * untrusted.
   */
  fetchBlob: (sha256Hex: string, servers: readonly string[]) => Promise<Uint8Array>;
  /** Decode blob bytes to text for `indexHtml` (default UTF-8). */
  textDecode?: (bytes: Uint8Array) => string;
  /**
   * Optional verified artifact cache. Cache hits are still re-verified against
   * the manifest hash before use; cache writes happen only after the signature,
   * content identity, and every blob hash have been verified.
   */
  cache?: NappletArtifactCache;
}

const INDEX_PATHS = ['/index.html', 'index.html', '/'];

function defaultDecode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Resolve a napplet end-to-end from a candidate manifest event: verify the
 * signature, parse its schema, fetch and hash its artifact, and return verified
 * `/index.html`. Legacy events additionally verify their NIP-5A aggregate.
 *
 * The returned `(dTag, aggregateHash)` is computed from the verified bytes and
 * is the napplet's identity. Any failure throws a {@link NappletResolutionError}
 * — the caller must fail closed (never render unverified bytes).
 *
 * @param options - {@link ResolveNappletOptions}
 * @returns The {@link ResolvedNapplet}
 * @throws {@link NappletResolutionError} on signature, manifest, aggregate,
 *   blob-hash, blob-availability, or missing-index failures
 *
 * @example
 * ```ts
 * import { resolveNapplet } from '@kehto/nip/5d';
 * const napplet = await resolveNapplet({ event, fetchBlob });
 * iframe.srcdoc = napplet.indexHtml; // sandbox="allow-scripts", opaque origin
 * ```
 */
export async function resolveNapplet(options: ResolveNappletOptions): Promise<ResolvedNapplet> {
  const { event, fetchBlob: fetchBlobBytes, textDecode = defaultDecode, cache } = options;

  if (!verifyManifestSignature(event)) {
    throw new NappletResolutionError('invalid-signature', 'manifest signature is invalid');
  }

  const manifest = parseNappletManifest(event);

  if (manifest.format === 'legacy') verifyLegacyAggregate(manifest);

  const files = new Map<string, Uint8Array>();
  for (const entry of manifest.paths) {
    let bytes = await cache?.readBlob(entry.sha256);
    if (bytes && !verifyBlobHash(bytes, entry.sha256)) {
      await cache?.deleteBlob(entry.sha256);
      bytes = undefined;
    }
    bytes ??= await fetchBlobBytes(entry.sha256, manifest.servers);
    if (!verifyBlobHash(bytes, entry.sha256)) {
      throw new NappletResolutionError(
        'blob-hash-mismatch',
        `blob for ${entry.path} does not match hash ${entry.sha256}`,
      );
    }
    files.set(entry.path, bytes);
  }

  const indexEntry = manifest.paths.find((e) => INDEX_PATHS.includes(e.path));
  if (!indexEntry) {
    throw new NappletResolutionError('missing-index', 'manifest has no /index.html entry');
  }

  const indexHtml = textDecode(files.get(indexEntry.path)!);
  await cache?.writeVerifiedResolution({ event, manifest, files, indexHtml });
  if (manifest.format === 'legacy') warnLegacyManifest();

  return {
    artifactHash: manifest.aggregateHash,
    dTag: manifest.dTag,
    aggregateHash: manifest.aggregateHash,
    files,
    indexHtml,
    manifest,
  };
}
