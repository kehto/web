import type { NostrEvent } from 'nostr-tools';
import { verifyEvent } from 'nostr-tools/pure';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  computeAggregateHash,
  pathEntriesFromTags,
  aggregateTagValue,
  type PathEntry,
} from '../5a/index.js';
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
 * `@kehto/nip/5d` — NIP-5D napplet manifest resolution.
 *
 * NIP-5D (`dskvr/nips` branch `nip/5d`) defines content-addressed "napplet"
 * web applets published as Nostr events that reference their files by hash
 * (NIP-5A `path` tags + an aggregate `x` tag). A runtime resolves a napplet by:
 *
 * 1. verifying the manifest event's signature,
 * 2. recomputing the NIP-5A aggregate from its `path` tags and checking the
 *    `["x","<hex>","aggregate"]` tag,
 * 3. fetching each referenced blob (e.g. from Blossom) and verifying its hash,
 * 4. assembling the verified `/index.html`.
 *
 * The napplet's identity is the `(dTag, aggregateHash)` tuple **computed** from
 * these verified bytes — it is never accepted from a host or gateway.
 */

/** Snapshot manifest — regular event, immutable point-in-time release. */
export const NAPPLET_KIND_SNAPSHOT = 5129;
/** Root manifest — replaceable event, an author's latest unnamed napplet. */
export const NAPPLET_KIND_ROOT = 15129;
/** Named manifest — addressable event (carries a `d` tag identifier). */
export const NAPPLET_KIND_NAMED = 35129;

/** All three NIP-5D napplet manifest kinds. */
export const NAPPLET_KINDS: readonly number[] = [
  NAPPLET_KIND_SNAPSHOT,
  NAPPLET_KIND_ROOT,
  NAPPLET_KIND_NAMED,
];

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
 * event's tags; the aggregate is the declared `x` tag (verify it separately
 * with {@link resolveNapplet} or `@kehto/nip/5a` `verifyAggregate`).
 */
export interface NappletManifest {
  /** Manifest event kind (`5129` / `15129` / `35129`). */
  kind: number;
  /** Author hex public key. */
  pubkey: string;
  /** Named-napplet `d` identifier, or `''` for root/snapshot manifests. */
  dTag: string;
  /** File path entries from `path` tags. */
  paths: PathEntry[];
  /** Declared aggregate hash from the `["x","<hex>","aggregate"]` tag. */
  aggregateHash: string;
  /** Blossom server URL hints from `server` tags. */
  servers: string[];
  /** Short NAP capability names from `requires` tags. */
  requires: string[];
  /**
   * Archetype slugs this napplet fulfills, from `archetype` manifest tags; the
   * optional `nap` is the recommended default wire protocol (the 3rd tag element).
   */
  archetypes: Array<{ slug: string; nap?: string }>;
  /** Optional human title. */
  title?: string;
  /** Optional human description. */
  description?: string;
  /** Optional upstream source URL from the `source` tag. */
  source?: string;
}

/** Error codes for every napplet resolution failure path. */
export type NappletResolutionErrorCode =
  | 'invalid-signature'
  | 'invalid-manifest'
  | 'aggregate-mismatch'
  | 'blob-hash-mismatch'
  | 'blob-unavailable'
  | 'missing-index';

/**
 * Thrown on any napplet resolution/verification failure. The `code` field
 * identifies which guard rejected, so callers can fail closed without parsing
 * the message.
 */
export class NappletResolutionError extends Error {
  readonly code: NappletResolutionErrorCode;
  constructor(code: NappletResolutionErrorCode, message: string) {
    super(message);
    this.name = 'NappletResolutionError';
    this.code = code;
  }
}

function firstTagValue(tags: readonly (readonly string[])[], name: string): string | undefined {
  for (const tag of tags) {
    if (tag[0] === name && typeof tag[1] === 'string' && tag[1].length > 0) return tag[1];
  }
  return undefined;
}

function allTagValues(tags: readonly (readonly string[])[], name: string): string[] {
  const out: string[] = [];
  for (const tag of tags) {
    if (tag[0] === name && typeof tag[1] === 'string' && tag[1].length > 0) out.push(tag[1]);
  }
  return out;
}

function archetypesFromTags(
  tags: readonly (readonly string[])[],
): Array<{ slug: string; nap?: string }> {
  const out: Array<{ slug: string; nap?: string }> = [];
  for (const tag of tags) {
    if (tag[0] !== 'archetype') continue;
    if (typeof tag[1] !== 'string' || tag[1].length === 0) continue;
    out.push(
      typeof tag[2] === 'string' && tag[2].length > 0
        ? { slug: tag[1], nap: tag[2] }
        : { slug: tag[1] },
    );
  }
  return out;
}

/**
 * Parse a NIP-5D manifest event into a {@link NappletManifest}.
 *
 * Does not verify the signature, aggregate, or blobs — use {@link resolveNapplet}
 * for full verification.
 *
 * @param event - A NIP-5D manifest event (`5129` / `15129` / `35129`)
 * @returns The parsed manifest
 * @throws {@link NappletResolutionError} `invalid-manifest` for a non-napplet
 *   kind, missing `path` tags, or a missing aggregate `x` tag
 */
export function parseNappletManifest(event: NostrEvent): NappletManifest {
  if (!isNappletManifestKind(event.kind)) {
    throw new NappletResolutionError('invalid-manifest', `not a NIP-5D napplet kind: ${event.kind}`);
  }
  const paths = pathEntriesFromTags(event.tags);
  if (paths.length === 0) {
    throw new NappletResolutionError('invalid-manifest', 'manifest has no path tags');
  }
  const aggregateHash = aggregateTagValue(event.tags);
  if (!aggregateHash) {
    throw new NappletResolutionError('invalid-manifest', 'manifest has no aggregate x tag');
  }
  return {
    kind: event.kind,
    pubkey: event.pubkey,
    dTag: firstTagValue(event.tags, 'd') ?? '',
    paths,
    aggregateHash,
    servers: allTagValues(event.tags, 'server'),
    requires: allTagValues(event.tags, 'requires'),
    archetypes: archetypesFromTags(event.tags),
    title: firstTagValue(event.tags, 'title'),
    description: firstTagValue(event.tags, 'description'),
    source: firstTagValue(event.tags, 'source'),
  };
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
  /** Computed `d` identifier (`''` for root/snapshot). */
  dTag: string;
  /** Computed (and verified) aggregate hash — the content address. */
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
   * aggregate, and every blob hash have been verified.
   */
  cache?: NappletArtifactCache;
}

const INDEX_PATHS = ['/index.html', 'index.html', '/'];

function defaultDecode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Resolve a napplet end-to-end from a candidate manifest event: verify the
 * signature, parse the manifest, verify the NIP-5A aggregate, fetch and verify
 * every blob, then assemble the verified `/index.html`.
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

  const recomputed = computeAggregateHash(manifest.paths);
  if (recomputed !== manifest.aggregateHash) {
    throw new NappletResolutionError(
      'aggregate-mismatch',
      `recomputed aggregate ${recomputed} != manifest ${manifest.aggregateHash}`,
    );
  }

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

  return {
    dTag: manifest.dTag,
    aggregateHash: manifest.aggregateHash,
    files,
    indexHtml,
    manifest,
  };
}
