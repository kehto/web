import type { NostrEvent } from 'nostr-tools';
import type { NappletManifest } from './index.js';

const MIB = 1024 * 1024;

/** Versioned Cache Storage namespace for verified napplet artifacts. */
export const NAPPLET_ARTIFACT_CACHE_NAME = 'kehto:napplet-artifacts:v1';
const SCHEMA_VERSION = 1;
const DEFAULT_BASE_URL = 'https://kehto.invalid';
const DEFAULT_UNKNOWN_BUDGET_BYTES = 32 * MIB;
const DEFAULT_SOFT_CEILING_BYTES = 128 * MIB;
const DEFAULT_HARD_CEILING_BYTES = 256 * MIB;
const DEFAULT_FOREGROUND_TTL_MS = 15 * 60 * 1000;
const DEFAULT_BACKGROUND_TTL_MS = 60 * 60 * 1000;

export interface NappletCacheDiagnostic {
  /** Diagnostic category for cache open/read/write/delete/prune/storage-estimate failures. */
  type:
    | 'cache-open-failed'
    | 'cache-read-failed'
    | 'cache-write-failed'
    | 'cache-delete-failed'
    | 'cache-prune-failed'
    | 'storage-estimate-unavailable';
  /** Human-readable diagnostic detail suitable for logs. */
  message: string;
  /** Original thrown value, when one exists. */
  cause?: unknown;
}

/** Metadata tracked for one cached napplet artifact blob. */
export interface NappletBlobIndexEntry {
  /** Blob byte length. */
  size: number;
  /** Last read or write timestamp in milliseconds. */
  lastAccessed: number;
  /** Number of cached aggregate records currently referencing this blob. */
  refCount: number;
}

/** Metadata tracked for one verified aggregate cache record. */
export interface NappletAggregateIndexEntry {
  /** Manifest `d` tag. */
  dTag: string;
  /** Verified NIP-5A aggregate hash. */
  aggregateHash: string;
  /** Internal cache key derived from `dTag` and `aggregateHash`. */
  key: string;
  /** SHA-256 hashes of blobs referenced by this aggregate. */
  blobHashes: string[];
  /** Approximate stored aggregate-record byte size. */
  size: number;
  /** Last read or write timestamp in milliseconds. */
  lastAccessed: number;
  /** Coordinate cache key that currently points at this aggregate, if any. */
  coordinateKey?: string;
  /** Reserved pin marker for hosts that want to protect an aggregate. */
  pinned?: boolean;
}

/** Cached mapping from a NIP-5D coordinate to a verified aggregate. */
export interface CachedCoordinate {
  /** Internal coordinate key in the form `kind:pubkey:dTag`. */
  key: string;
  /** Napplet manifest event kind. */
  kind: number;
  /** Manifest author public key. */
  pubkey: string;
  /** Manifest `d` tag. */
  dTag: string;
  /** Verified aggregate hash for the coordinate. */
  aggregateHash: string;
  /** Timestamp when this coordinate last resolved successfully. */
  lastResolvedAt: number;
  /** Foreground refresh TTL in milliseconds. */
  foregroundTtlMs: number;
  /** Background refresh TTL in milliseconds. */
  backgroundTtlMs: number;
}

/** Serialized Cache Storage index for verified napplet artifacts. */
export interface NappletArtifactCacheIndex {
  /** Index schema version. */
  schemaVersion: number;
  /** Last index update timestamp in milliseconds. */
  updatedAt: number;
  /** Blob entries keyed by SHA-256 hash. */
  blobs: Record<string, NappletBlobIndexEntry>;
  /** Aggregate entries keyed by the internal aggregate key. */
  aggregates: Record<string, NappletAggregateIndexEntry>;
  /** Coordinate entries keyed by {@link coordinateKey}. */
  coordinates: Record<string, CachedCoordinate>;
}

interface AggregateRecord {
  schemaVersion: number;
  dTag: string;
  aggregateHash: string;
  manifest: {
    kind: number;
    pubkey: string;
    dTag: string;
    paths: Array<{ path: string; sha256: string }>;
    requires: string[];
    title?: string;
    description?: string;
  };
  indexHtml: string;
  blobHashes: string[];
  writtenAt: number;
}

export interface WriteVerifiedResolutionInput {
  /** Verified NIP-5D manifest event. */
  event: NostrEvent;
  /** Parsed manifest whose aggregate and paths have already been verified. */
  manifest: NappletManifest;
  /** File bytes keyed by manifest path. */
  files: ReadonlyMap<string, Uint8Array>;
  /** Verified `/index.html` bytes decoded as text. */
  indexHtml: string;
  /** Timestamp override for deterministic tests. */
  now?: number;
}

/** Freshness controls for reading a cached coordinate. */
export interface CoordinateFreshnessOptions {
  /** Timestamp override in milliseconds. */
  now?: number;
  /** Use the background TTL instead of the foreground TTL. */
  background?: boolean;
}

/** Cache interface for verified NIP-5D napplet artifacts. */
export interface NappletArtifactCache {
  /** Read one cached artifact blob by SHA-256 hash. */
  readBlob(sha256Hex: string): Promise<Uint8Array | undefined>;
  /** Delete one cached artifact blob by SHA-256 hash. */
  deleteBlob(sha256Hex: string): Promise<void>;
  /** Write a verified manifest resolution and all referenced blobs. */
  writeVerifiedResolution(input: WriteVerifiedResolutionInput): Promise<void>;
  /** Cache the latest aggregate for a NIP-5D coordinate. */
  writeCoordinate(input: {
    kind: number;
    pubkey: string;
    dTag: string;
    aggregateHash: string;
    lastResolvedAt?: number;
    foregroundTtlMs?: number;
    backgroundTtlMs?: number;
  }): Promise<void>;
  /** Read a cached coordinate with a computed freshness flag. */
  getCoordinate(input: {
    kind: number;
    pubkey: string;
    dTag: string;
  }, options?: CoordinateFreshnessOptions): Promise<(CachedCoordinate & { fresh: boolean }) | undefined>;
  /** Update aggregate/blob last-access timestamps. */
  touchAggregate(dTag: string, aggregateHash: string, now?: number): Promise<void>;
  /** Protect an aggregate from normal pruning while it is in active use. */
  markAggregateActive(dTag: string, aggregateHash: string): void;
  /** Release an aggregate previously marked active. */
  releaseAggregateActive(dTag: string, aggregateHash: string): void;
  /** Prune cache contents to the configured storage budget. */
  prune(now?: number): Promise<void>;
}

/** Constructor options for {@link CacheStorageNappletArtifactCache}. */
export interface CacheStorageNappletArtifactCacheOptions {
  /** Cache Storage implementation; defaults to `globalThis.caches`. */
  cacheStorage?: CacheStorage;
  /** Storage manager used for quota estimates; defaults to `navigator.storage`. */
  storage?: StorageManager;
  /** Cache Storage namespace. */
  cacheName?: string;
  /** Base URL used to construct synthetic cache keys. */
  baseUrl?: string;
  /** Clock used for timestamps. */
  now?: () => number;
  /** Diagnostic callback for non-fatal cache failures. */
  onDiagnostic?: (diagnostic: NappletCacheDiagnostic) => void;
  /** Budget used when storage estimates are unavailable. */
  unknownBudgetBytes?: number;
  /** Soft cache ceiling in bytes. */
  softCeilingBytes?: number;
  /** Hard cache ceiling in bytes. */
  hardCeilingBytes?: number;
}

/** Options for opening the browser Cache Storage artifact cache. */
export interface OpenNappletArtifactCacheOptions extends CacheStorageNappletArtifactCacheOptions {
  /** Return `undefined` when quota estimates are unavailable. */
  requireStorageEstimate?: boolean;
}

function emptyIndex(now: number): NappletArtifactCacheIndex {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    blobs: {},
    aggregates: {},
    coordinates: {},
  };
}

function aggregateKey(dTag: string, aggregateHash: string): string {
  return `${encodeURIComponent(dTag)}:${aggregateHash}`;
}

/**
 * Build the stable index key for a NIP-5D coordinate.
 *
 * @param kind - Manifest event kind.
 * @param pubkey - Manifest author public key.
 * @param dTag - Manifest `d` tag.
 * @returns Cache key in the form `kind:pubkey:dTag`.
 */
export function coordinateKey(kind: number, pubkey: string, dTag: string): string {
  return `${kind}:${pubkey}:${encodeURIComponent(dTag)}`;
}

/**
 * Check whether a cached coordinate is still inside its foreground/background TTL.
 *
 * @param coordinate - Cached coordinate to inspect.
 * @param options - Optional clock and TTL mode overrides.
 * @returns `true` when the coordinate can be used without a network refresh.
 */
export function isCoordinateFresh(
  coordinate: CachedCoordinate,
  options: CoordinateFreshnessOptions = {},
): boolean {
  const now = options.now ?? Date.now();
  const ttl = options.background ? coordinate.backgroundTtlMs : coordinate.foregroundTtlMs;
  return ttl === Number.POSITIVE_INFINITY || now - coordinate.lastResolvedAt <= ttl;
}

function byteLength(bytes: Uint8Array): number {
  return bytes.byteLength;
}

function encodeKeyPart(value: string): string {
  return encodeURIComponent(value).replaceAll('%2F', '%252F');
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function responseBody(bytes: Uint8Array): ArrayBuffer {
  return cloneBytes(bytes).buffer as ArrayBuffer;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function resolveBaseUrl(baseUrl?: string): string {
  if (baseUrl) return normalizeBaseUrl(baseUrl);
  const maybeLocation = globalThis as typeof globalThis & { location?: { origin?: string } };
  if (maybeLocation.location?.origin) return normalizeBaseUrl(maybeLocation.location.origin);
  return normalizeBaseUrl(DEFAULT_BASE_URL);
}

async function responseBytes(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

async function responseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

function refCounts(index: NappletArtifactCacheIndex): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const aggregate of Object.values(index.aggregates)) {
    for (const hash of aggregate.blobHashes) counts[hash] = (counts[hash] ?? 0) + 1;
  }
  return counts;
}

function cachedSize(index: NappletArtifactCacheIndex): number {
  const blobBytes = Object.values(index.blobs).reduce((sum, entry) => sum + entry.size, 0);
  const aggregateBytes = Object.values(index.aggregates).reduce((sum, entry) => sum + entry.size, 0);
  return blobBytes + aggregateBytes;
}

/**
 * Browser Cache Storage implementation of {@link NappletArtifactCache}.
 *
 * It stores verified blobs and aggregate records under synthetic URLs, keeps a
 * small JSON index, and prunes according to quota-derived budgets.
 */
export class CacheStorageNappletArtifactCache implements NappletArtifactCache {
  private readonly cacheStorage: CacheStorage;
  private readonly storage?: StorageManager;
  private readonly cacheName: string;
  private readonly baseUrl: string;
  private readonly now: () => number;
  private readonly activeAggregates = new Set<string>();
  private readonly onDiagnostic?: (diagnostic: NappletCacheDiagnostic) => void;
  private readonly unknownBudgetBytes: number;
  private readonly softCeilingBytes: number;
  private readonly hardCeilingBytes: number;
  private cachePromise?: Promise<Cache>;

  constructor(options: CacheStorageNappletArtifactCacheOptions = {}) {
    const maybeCacheStorage = options.cacheStorage ?? (globalThis as typeof globalThis & { caches?: CacheStorage }).caches;
    if (!maybeCacheStorage) {
      throw new Error('Cache Storage is unavailable');
    }
    this.cacheStorage = maybeCacheStorage;
    this.storage = options.storage ?? (globalThis.navigator as Navigator | undefined)?.storage;
    this.cacheName = options.cacheName ?? NAPPLET_ARTIFACT_CACHE_NAME;
    this.baseUrl = resolveBaseUrl(options.baseUrl);
    this.now = options.now ?? Date.now;
    this.onDiagnostic = options.onDiagnostic;
    this.unknownBudgetBytes = options.unknownBudgetBytes ?? DEFAULT_UNKNOWN_BUDGET_BYTES;
    this.softCeilingBytes = options.softCeilingBytes ?? DEFAULT_SOFT_CEILING_BYTES;
    this.hardCeilingBytes = options.hardCeilingBytes ?? DEFAULT_HARD_CEILING_BYTES;
  }

  async readBlob(sha256Hex: string): Promise<Uint8Array | undefined> {
    try {
      const cache = await this.open();
      const response = await cache.match(this.blobUrl(sha256Hex));
      if (!response) return undefined;
      const bytes = await responseBytes(response);
      const index = await this.readIndex(cache);
      const entry = index.blobs[sha256Hex];
      if (entry) {
        entry.lastAccessed = this.now();
        index.updatedAt = entry.lastAccessed;
        await this.writeIndex(cache, index);
      }
      return bytes;
    } catch (cause) {
      this.diagnostic({ type: 'cache-read-failed', message: `failed to read blob ${sha256Hex}`, cause });
      return undefined;
    }
  }

  async deleteBlob(sha256Hex: string): Promise<void> {
    try {
      const cache = await this.open();
      await cache.delete(this.blobUrl(sha256Hex));
      const index = await this.readIndex(cache);
      delete index.blobs[sha256Hex];
      index.updatedAt = this.now();
      await this.writeIndex(cache, index);
    } catch (cause) {
      this.diagnostic({ type: 'cache-delete-failed', message: `failed to delete blob ${sha256Hex}`, cause });
    }
  }

  async writeVerifiedResolution(input: WriteVerifiedResolutionInput): Promise<void> {
    try {
      await this.writeVerifiedResolutionOnce(input);
    } catch (firstCause) {
      try {
        await this.prune(input.now ?? this.now());
        await this.writeVerifiedResolutionOnce(input);
      } catch (cause) {
        this.diagnostic({
          type: 'cache-write-failed',
          message: 'failed to write verified napplet artifacts after prune retry',
          cause: cause ?? firstCause,
        });
      }
    }
  }

  async writeCoordinate(input: {
    kind: number;
    pubkey: string;
    dTag: string;
    aggregateHash: string;
    lastResolvedAt?: number;
    foregroundTtlMs?: number;
    backgroundTtlMs?: number;
  }): Promise<void> {
    const cache = await this.open();
    const now = this.now();
    const index = await this.readIndex(cache);
    const key = coordinateKey(input.kind, input.pubkey, input.dTag);
    index.coordinates[key] = {
      key,
      kind: input.kind,
      pubkey: input.pubkey,
      dTag: input.dTag,
      aggregateHash: input.aggregateHash,
      lastResolvedAt: input.lastResolvedAt ?? now,
      foregroundTtlMs: input.foregroundTtlMs ?? DEFAULT_FOREGROUND_TTL_MS,
      backgroundTtlMs: input.backgroundTtlMs ?? DEFAULT_BACKGROUND_TTL_MS,
    };
    index.updatedAt = now;
    await this.writeIndex(cache, index);
  }

  async getCoordinate(
    input: { kind: number; pubkey: string; dTag: string },
    options: CoordinateFreshnessOptions = {},
  ): Promise<(CachedCoordinate & { fresh: boolean }) | undefined> {
    const cache = await this.open();
    const index = await this.readIndex(cache);
    const coordinate = index.coordinates[coordinateKey(input.kind, input.pubkey, input.dTag)];
    if (!coordinate) return undefined;
    return { ...coordinate, fresh: isCoordinateFresh(coordinate, options) };
  }

  async touchAggregate(dTag: string, aggregateHash: string, now: number = this.now()): Promise<void> {
    const cache = await this.open();
    const index = await this.readIndex(cache);
    const key = aggregateKey(dTag, aggregateHash);
    const aggregate = index.aggregates[key];
    if (!aggregate) return;
    aggregate.lastAccessed = now;
    for (const hash of aggregate.blobHashes) {
      if (index.blobs[hash]) index.blobs[hash].lastAccessed = now;
    }
    index.updatedAt = now;
    await this.writeIndex(cache, index);
  }

  markAggregateActive(dTag: string, aggregateHash: string): void {
    this.activeAggregates.add(aggregateKey(dTag, aggregateHash));
  }

  releaseAggregateActive(dTag: string, aggregateHash: string): void {
    this.activeAggregates.delete(aggregateKey(dTag, aggregateHash));
  }

  async prune(now: number = this.now()): Promise<void> {
    try {
      const cache = await this.open();
      const index = await this.readIndex(cache);
      let size = cachedSize(index);
      const budget = await this.budgetBytes();
      const hardBudget = await this.hardBudgetBytes();
      const shouldPrune = size > budget || await this.originPressureHigh();
      if (!shouldPrune) return;

      this.rewriteRefCounts(index);

      for (const [hash, blob] of Object.entries(index.blobs)) {
        if (size <= budget) break;
        if (blob.refCount > 0) continue;
        await cache.delete(this.blobUrl(hash));
        delete index.blobs[hash];
        size -= blob.size;
      }

      const currentAggregateHashes = new Set(
        Object.values(index.coordinates).map((coordinate) => coordinate.aggregateHash),
      );
      const aggregates = Object.values(index.aggregates)
        .filter((entry) => !this.activeAggregates.has(entry.key))
        .sort((a, b) => {
          const currentA = currentAggregateHashes.has(a.aggregateHash) ? 1 : 0;
          const currentB = currentAggregateHashes.has(b.aggregateHash) ? 1 : 0;
          if (currentA !== currentB) return currentA - currentB;
          return a.lastAccessed - b.lastAccessed;
        });

      for (const aggregate of aggregates) {
        if (size <= budget) break;
        await cache.delete(this.aggregateUrl(aggregate.key));
        delete index.aggregates[aggregate.key];
        size -= aggregate.size;
        this.rewriteRefCounts(index);
      }

      if (size > hardBudget) {
        const active = Object.values(index.aggregates)
          .filter((entry) => this.activeAggregates.has(entry.key))
          .sort((a, b) => a.lastAccessed - b.lastAccessed);
        for (const aggregate of active) {
          if (size <= hardBudget) break;
          await cache.delete(this.aggregateUrl(aggregate.key));
          delete index.aggregates[aggregate.key];
          size -= aggregate.size;
        }
      }

      this.rewriteRefCounts(index);
      for (const [hash, blob] of Object.entries(index.blobs)) {
        if (blob.refCount === 0) {
          await cache.delete(this.blobUrl(hash));
          delete index.blobs[hash];
        }
      }
      index.updatedAt = now;
      await this.writeIndex(cache, index);
    } catch (cause) {
      this.diagnostic({ type: 'cache-prune-failed', message: 'failed to prune napplet artifact cache', cause });
    }
  }

  async snapshotIndex(): Promise<NappletArtifactCacheIndex> {
    return this.readIndex(await this.open());
  }

  private async writeVerifiedResolutionOnce(input: WriteVerifiedResolutionInput): Promise<void> {
    const cache = await this.open();
    const now = input.now ?? this.now();
    const index = await this.readIndex(cache);
    const blobHashes: string[] = [];

    for (const pathEntry of input.manifest.paths) {
      const bytes = input.files.get(pathEntry.path);
      if (!bytes) continue;
      blobHashes.push(pathEntry.sha256);
      await cache.put(this.blobUrl(pathEntry.sha256), new Response(responseBody(bytes)));
      index.blobs[pathEntry.sha256] = {
        size: byteLength(bytes),
        lastAccessed: now,
        refCount: index.blobs[pathEntry.sha256]?.refCount ?? 0,
      };
    }

    const key = aggregateKey(input.manifest.dTag, input.manifest.aggregateHash);
    const record: AggregateRecord = {
      schemaVersion: SCHEMA_VERSION,
      dTag: input.manifest.dTag,
      aggregateHash: input.manifest.aggregateHash,
      manifest: {
        kind: input.manifest.kind,
        pubkey: input.manifest.pubkey,
        dTag: input.manifest.dTag,
        paths: input.manifest.paths.map((entry) => ({ path: entry.path, sha256: entry.sha256 })),
        requires: [...input.manifest.requires],
        ...(input.manifest.title === undefined ? {} : { title: input.manifest.title }),
        ...(input.manifest.description === undefined ? {} : { description: input.manifest.description }),
      },
      indexHtml: input.indexHtml,
      blobHashes,
      writtenAt: now,
    };
    const aggregateBytes = new TextEncoder().encode(JSON.stringify(record));
    await cache.put(this.aggregateUrl(key), new Response(responseBody(aggregateBytes), {
      headers: { 'content-type': 'application/json' },
    }));

    const coordKey = coordinateKey(input.manifest.kind, input.manifest.pubkey, input.manifest.dTag);
    index.aggregates[key] = {
      dTag: input.manifest.dTag,
      aggregateHash: input.manifest.aggregateHash,
      key,
      blobHashes,
      size: byteLength(aggregateBytes),
      lastAccessed: now,
      coordinateKey: coordKey,
    };
    index.coordinates[coordKey] = {
      key: coordKey,
      kind: input.manifest.kind,
      pubkey: input.manifest.pubkey,
      dTag: input.manifest.dTag,
      aggregateHash: input.manifest.aggregateHash,
      lastResolvedAt: now,
      foregroundTtlMs: DEFAULT_FOREGROUND_TTL_MS,
      backgroundTtlMs: DEFAULT_BACKGROUND_TTL_MS,
    };

    this.rewriteRefCounts(index);
    index.updatedAt = now;
    await this.writeIndex(cache, index);
    await this.prune(now);
  }

  private async open(): Promise<Cache> {
    this.cachePromise ??= this.cacheStorage.open(this.cacheName);
    return this.cachePromise;
  }

  private indexUrl(): string {
    return new URL('__kehto_napplet_cache/index.json', this.baseUrl).toString();
  }

  private blobUrl(hash: string): string {
    return new URL(`__kehto_napplet_cache/blob/${encodeKeyPart(hash)}`, this.baseUrl).toString();
  }

  private aggregateUrl(key: string): string {
    return new URL(`__kehto_napplet_cache/aggregate/${encodeKeyPart(key)}.json`, this.baseUrl).toString();
  }

  private async readIndex(cache: Cache): Promise<NappletArtifactCacheIndex> {
    const response = await cache.match(this.indexUrl());
    if (!response) return emptyIndex(this.now());
    try {
      const index = await responseJson<NappletArtifactCacheIndex>(response);
      if (index.schemaVersion !== SCHEMA_VERSION) return emptyIndex(this.now());
      return index;
    } catch {
      return emptyIndex(this.now());
    }
  }

  private async writeIndex(cache: Cache, index: NappletArtifactCacheIndex): Promise<void> {
    await cache.put(this.indexUrl(), new Response(JSON.stringify(index), {
      headers: { 'content-type': 'application/json' },
    }));
  }

  private rewriteRefCounts(index: NappletArtifactCacheIndex): void {
    const counts = refCounts(index);
    for (const [hash, blob] of Object.entries(index.blobs)) {
      blob.refCount = counts[hash] ?? 0;
    }
  }

  private async budgetBytes(): Promise<number> {
    const estimate = await this.estimateStorage();
    if (!estimate?.quota) return this.unknownBudgetBytes;
    return Math.min(this.softCeilingBytes, Math.floor(estimate.quota * 0.1));
  }

  private async hardBudgetBytes(): Promise<number> {
    const estimate = await this.estimateStorage();
    if (!estimate?.quota) return this.unknownBudgetBytes;
    return Math.min(this.hardCeilingBytes, Math.floor(estimate.quota * 0.2));
  }

  private async originPressureHigh(): Promise<boolean> {
    const estimate = await this.estimateStorage();
    if (!estimate?.quota || estimate.usage === undefined) return false;
    return estimate.usage / estimate.quota >= 0.8;
  }

  private async estimateStorage(): Promise<StorageEstimate | undefined> {
    if (!this.storage?.estimate) return undefined;
    try {
      return this.storage.estimate();
    } catch (cause) {
      this.diagnostic({
        type: 'storage-estimate-unavailable',
        message: 'storage estimate failed; using unknown quota cache budget',
        cause,
      });
      return undefined;
    }
  }

  private diagnostic(diagnostic: NappletCacheDiagnostic): void {
    this.onDiagnostic?.(diagnostic);
  }
}

/**
 * Open the browser Cache Storage artifact cache when the host supports it.
 *
 * @param options - Cache construction options and diagnostics callback.
 * @returns A cache instance, or `undefined` when Cache Storage is unavailable.
 */
export async function openNappletArtifactCache(
  options: OpenNappletArtifactCacheOptions = {},
): Promise<CacheStorageNappletArtifactCache | undefined> {
  const cacheStorage = options.cacheStorage ?? (globalThis as typeof globalThis & { caches?: CacheStorage }).caches;
  if (!cacheStorage) return undefined;
  const storage = options.storage ?? (globalThis.navigator as Navigator | undefined)?.storage;
  if (options.requireStorageEstimate && !storage?.estimate) {
    options.onDiagnostic?.({
      type: 'storage-estimate-unavailable',
      message: 'storage estimates are unavailable; using network-only loading',
    });
    return undefined;
  }
  try {
    const cache = new CacheStorageNappletArtifactCache({ ...options, cacheStorage, storage });
    await cache.snapshotIndex();
    return cache;
  } catch (cause) {
    options.onDiagnostic?.({
      type: 'cache-open-failed',
      message: 'Cache Storage napplet artifact cache could not be opened',
      cause,
    });
    return undefined;
  }
}
