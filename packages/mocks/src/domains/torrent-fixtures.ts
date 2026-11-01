/**
 * domains/torrent-fixtures.ts — Shared transfer helpers for the torrent, nzb,
 * and soulseek mocks: deterministic image bytes, bencoded metainfo, and the
 * capability snapshot NAP-TORRENT requires.
 */
import { createSeededRng, hashLabel } from '../core/rng.js';
import type { LinuxDistroImage } from '../fixtures/linux-distros.js';

const BLOCK = 64;

/**
 * Deterministic placeholder bytes of a catalog image as standard base64.
 * Byte `i` depends only on the image id and `i`, so overlapping reads agree.
 *
 * @param image - Catalog image.
 * @param offset - First byte offset.
 * @param length - Byte count (already clipped to the file size).
 * @returns Padded base64 of exactly `length` bytes.
 * @example
 * ```ts
 * mockImageBytesBase64(LINUX_DISTROS[0], 0, 3).length === 4;
 * ```
 */
export function mockImageBytesBase64(image: LinuxDistroImage, offset: number, length: number): string {
  let binary = '';
  let index = offset;
  const end = offset + length;
  while (index < end) {
    const block = Math.floor(index / BLOCK);
    const rng = createSeededRng(hashLabel(`bytes:${image.id}:${block}`));
    const skip = index - block * BLOCK;
    for (let i = 0; i < skip; i += 1) rng.int(256);
    for (; index < end && index < (block + 1) * BLOCK; index += 1) binary += String.fromCharCode(rng.int(256));
  }
  return btoa(binary);
}

/**
 * Decode base64 to a byte array without `Buffer`.
 *
 * @param base64 - Standard padded base64.
 * @returns Decoded bytes, or `undefined` when the input is malformed.
 * @example
 * ```ts
 * decodeBase64('aGVsbG8=')?.length === 5;
 * ```
 */
export function decodeBase64(base64: string): Uint8Array | undefined {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) return undefined;
  try {
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return undefined;
  }
}

function bencode(value: unknown): string {
  if (typeof value === 'number') return `i${value}e`;
  if (typeof value === 'string') return `${new TextEncoder().encode(value).length}:${value}`;
  if (Array.isArray(value)) return `l${value.map(bencode).join('')}e`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `d${entries.map(([key, item]) => `${bencode(key)}${bencode(item)}`).join('')}e`;
}

/**
 * Minimal single-file v1 `.torrent` document for a catalog image. The pieces
 * field holds placeholder SHA-1 digests; the catalog `infoHash` is reported
 * as its identity rather than the real digest of this dictionary.
 *
 * @param image - Catalog image.
 * @param trackers - Announce URLs embedded in the metainfo.
 * @returns Bencoded metainfo as a binary string (one char per byte).
 * @example
 * ```ts
 * mockMetainfo(LINUX_DISTROS[0], []).startsWith('d8:announce');
 * ```
 */
export function mockMetainfo(image: LinuxDistroImage, trackers: readonly string[]): string {
  const pieceLength = 4 * 1024 * 1024;
  const pieceCount = Math.ceil(image.sizeBytes / pieceLength);
  const digestRng = createSeededRng(hashLabel(`pieces:${image.id}`));
  let pieces = '';
  for (let i = 0; i < pieceCount * 20; i += 1) pieces += String.fromCharCode(digestRng.int(256));
  const announce = trackers[0] ?? 'udp://tracker.example.org:6969/announce';
  return bencode({
    announce,
    'announce-list': trackers.map((tracker) => [tracker]),
    'created by': 'kehto-mocks',
    info: { length: image.sizeBytes, name: image.fileName, 'piece length': pieceLength, pieces },
  });
}

/**
 * Byte length of a binary string.
 *
 * @example
 * ```ts
 * binaryLength('abc') === 3;
 * ```
 */
export function binaryLength(binary: string): number {
  return binary.length;
}

/**
 * Torrent engine limits and features the mock advertises.
 *
 * @example
 * ```ts
 * TORRENT_CAPABILITIES.maxReadBytes === 65536;
 * ```
 */
export const TORRENT_CAPABILITIES = Object.freeze({
  transports: ['webtorrent', 'bittorrent', 'auto'],
  modes: ['download', 'seed', 'download-and-seed'],
  formats: ['v1', 'hybrid'],
  createFormats: ['v1'],
  retentions: ['session', 'persistent'],
  mutableSettings: ['downloadLimitBytesPerSecond', 'uploadLimitBytesPerSecond', 'seedAfterComplete', 'trackers', 'webSeeds'],
  maxReadBytes: 65536,
  maxReadWaitMs: 5000,
  maxPendingReads: 4,
  maxMetainfoBytes: 1048576,
  canSaveFiles: true,
  canOpenFiles: true,
  maxActiveJobs: 8,
  canSeedRuntimeFiles: true,
  canUseDht: true,
  canUseTrackers: true,
  canUseWebSeeds: true,
});

/**
 * Default tracker hint shared by catalog magnets.
 *
 * @example
 * ```ts
 * DEFAULT_TRACKER.startsWith('udp://');
 * ```
 */
export const DEFAULT_TRACKER = 'udp://tracker.example.org:6969/announce';

/**
 * `TorrentSettings` record.
 *
 * @example
 * ```ts
 * const settings: TorrentSettings = { revision: 0, downloadLimitBytesPerSecond: 0, uploadLimitBytesPerSecond: 0, seedAfterComplete: true, trackers: [], webSeeds: [], endpointsRedacted: false };
 * ```
 */
export interface TorrentSettings {
  revision: number;
  downloadLimitBytesPerSecond: number;
  uploadLimitBytesPerSecond: number;
  seedAfterComplete: boolean;
  trackers: string[];
  webSeeds: string[];
  endpointsRedacted: boolean;
}

/**
 * `TorrentJobState` values.
 *
 * @example
 * ```ts
 * const state: TorrentJobState = 'seeding';
 * ```
 */
export type TorrentJobState = 'queued' | 'metadata' | 'downloading' | 'seeding' | 'paused' | 'complete' | 'cancelled' | 'error';
/**
 * `TorrentMode` values.
 *
 * @example
 * ```ts
 * const mode: TorrentMode = 'download-and-seed';
 * ```
 */
export type TorrentMode = 'download' | 'seed' | 'download-and-seed';

/**
 * One torrent job tracked by the mock.
 *
 * @example
 * ```ts
 * const job = createMockTorrentService().mock.state().jobs.get('tor-1');
 * ```
 */
export interface MockTorrentJob {
  jobId: string;
  windowId: string;
  /** Catalog image; `undefined` for a valid-but-unknown hash (ends `no-peers`). */
  image?: LinuxDistroImage;
  /** Claimed v1 hash from the source. */
  claimedV1?: string;
  mode: TorrentMode;
  /** Whether the job was created seed-only (`runtime-file-set`). */
  seedOrigin: boolean;
  transport: string;
  state: TorrentJobState;
  /** State to return to when resumed. */
  resumeState?: TorrentJobState;
  retention: 'session' | 'persistent';
  storage?: string;
  metadataKnown: boolean;
  downloadedBytes: number;
  uploadedBytes: number;
  settings: TorrentSettings;
  fileSelected: boolean;
  priority: number;
  /** Peer names from the catalog `sharedBy` pool. */
  peerNames: string[];
  error?: string;
  reason?: string;
}

function rates(job: MockTorrentJob, progressPerStep: number): { downloadRate: number; uploadRate: number } {
  const size = job.image?.sizeBytes ?? 0;
  const downloadRate = job.state === 'downloading' ? Math.round(size * progressPerStep) : 0;
  const uploadRate = job.state === 'seeding' || (job.state === 'downloading' && job.mode === 'download-and-seed') ? Math.round(size * progressPerStep / 10) : 0;
  return { downloadRate, uploadRate };
}

function peerStats(job: MockTorrentJob): { peers: number; seeds: number; leeches: number } {
  if (job.state === 'paused' || job.state === 'complete' || job.state === 'cancelled' || job.state === 'error' || job.state === 'queued') return { peers: 0, seeds: 0, leeches: 0 };
  const peers = job.peerNames.length;
  const seeds = Math.ceil(peers / 2);
  return { peers, seeds, leeches: peers - seeds };
}

/**
 * `TorrentJobStatus` snapshot of a job.
 *
 * @param job - Tracked job.
 * @param progressPerStep - Fraction transferred per `advance()` step (for rates).
 * @returns The status record.
 * @example
 * ```ts
 * torrentStatus(job, 0.25).ok === true;
 * ```
 */
export function torrentStatus(job: MockTorrentJob, progressPerStep: number): Record<string, unknown> {
  const total = job.metadataKnown && job.image ? job.image.sizeBytes : undefined;
  const hashes = job.image ? { v1: job.image.infoHash } : job.claimedV1 ? { v1: job.claimedV1 } : undefined;
  return {
    ok: true, jobId: job.jobId, state: job.state, mode: job.mode, transport: job.transport,
    ...(hashes ? { hashes } : {}),
    downloadedBytes: job.downloadedBytes, uploadedBytes: job.uploadedBytes,
    ...(total !== undefined ? { totalBytes: total, progress: Number((job.downloadedBytes / total).toFixed(4)) } : {}),
    ...rates(job, progressPerStep),
    ratio: job.downloadedBytes > 0 ? Number((job.uploadedBytes / job.downloadedBytes).toFixed(4)) : 0,
    peers: peerStats(job),
    ...(job.image ? { title: job.image.fileName } : {}),
    ...(total !== undefined && job.state === 'downloading' ? { etaSeconds: Math.ceil((1 - job.downloadedBytes / total) / progressPerStep) } : {}),
    ...(job.storage ? { storage: job.storage } : {}),
    settings: { ...job.settings, trackers: [...job.settings.trackers], webSeeds: [...job.settings.webSeeds] },
    retention: job.retention,
    ...(job.error ? { error: job.error } : {}),
    ...(job.reason ? { reason: job.reason } : {}),
  };
}

/**
 * `TorrentJobSummary` row of a job.
 *
 * @param job - Tracked job.
 * @param progressPerStep - Fraction transferred per step (for rates).
 * @returns The summary record.
 * @example
 * ```ts
 * torrentSummary(job, 0.25).jobId === job.jobId;
 * ```
 */
export function torrentSummary(job: MockTorrentJob, progressPerStep: number): Record<string, unknown> {
  const status = torrentStatus(job, progressPerStep);
  const keys = ['jobId', 'state', 'mode', 'transport', 'hashes', 'progress', 'downloadRate', 'uploadRate', 'ratio', 'title', 'retention'];
  return Object.fromEntries(keys.filter((key) => key in status).map((key) => [key, status[key]]));
}

/**
 * Result of parsing a `TorrentSource`.
 *
 * @example
 * ```ts
 * const parsed: TorrentSourceParse = { ok: false, error: 'invalid-magnet' };
 * ```
 */
export type TorrentSourceParse =
  | { ok: true; sourceType: string; image?: LinuxDistroImage; claimedV1?: string; runtimeFileSetId?: string }
  | { ok: false; error: string };

const MAGNET_V1 = /urn:btih:([0-9a-f]{40})/i;

/**
 * Validate a `TorrentSource` and resolve it against the catalog.
 *
 * @param raw - `request.source` from `torrent.add`.
 * @param catalog - Images to resolve against.
 * @returns The resolved source or the NAP error to report.
 * @example
 * ```ts
 * parseTorrentSource({ sourceType: 'magnet', magnet: LINUX_DISTROS[0].magnet }, LINUX_DISTROS).ok === true;
 * ```
 */
export function parseTorrentSource(raw: unknown, catalog: readonly LinuxDistroImage[]): TorrentSourceParse {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid-source' };
  const source = raw as Record<string, unknown>;
  const fields = ['magnet', 'hashes', 'metainfo', 'runtimeFileSetId'].filter((field) => source[field] !== undefined);
  const expected: Record<string, string> = { magnet: 'magnet', infohash: 'hashes', metainfo: 'metainfo', 'runtime-file-set': 'runtimeFileSetId' };
  const sourceType = typeof source.sourceType === 'string' ? source.sourceType : '';
  const field = expected[sourceType];
  if (!field) return { ok: false, error: 'unsupported-source' };
  if (fields.length !== 1 || fields[0] !== field) return { ok: false, error: 'invalid-source' };
  if (sourceType === 'magnet') {
    const match = typeof source.magnet === 'string' && source.magnet.startsWith('magnet:?') ? MAGNET_V1.exec(source.magnet) : null;
    if (!match) return { ok: false, error: 'invalid-magnet' };
    const claimedV1 = match[1]!.toLowerCase();
    return { ok: true, sourceType, claimedV1, image: catalog.find((image) => image.infoHash === claimedV1) };
  }
  if (sourceType === 'infohash') {
    const hashes = source.hashes as Record<string, unknown> | undefined;
    if (!hashes || typeof hashes !== 'object' || (hashes.v1 === undefined && hashes.v2 === undefined)) return { ok: false, error: 'invalid-infohash' };
    if (hashes.v1 !== undefined && !(typeof hashes.v1 === 'string' && /^[0-9a-f]{40}$/.test(hashes.v1))) return { ok: false, error: 'invalid-infohash' };
    if (hashes.v2 !== undefined && !(typeof hashes.v2 === 'string' && /^[0-9a-f]{64}$/.test(hashes.v2))) return { ok: false, error: 'invalid-infohash' };
    if (hashes.v1 === undefined) return { ok: false, error: 'unsupported-format' };
    const claimedV1 = hashes.v1 as string;
    return { ok: true, sourceType, claimedV1, image: catalog.find((image) => image.infoHash === claimedV1) };
  }
  if (sourceType === 'metainfo') {
    const bytes = typeof source.metainfo === 'string' ? decodeBase64(source.metainfo) : undefined;
    if (!bytes) return { ok: false, error: 'invalid-source' };
    const text = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    const nameMatch = /4:name(\d+):/.exec(text);
    const name = nameMatch ? text.slice(nameMatch.index + nameMatch[0].length, nameMatch.index + nameMatch[0].length + Number(nameMatch[1])) : '';
    const image = catalog.find((item) => item.fileName === name);
    return image ? { ok: true, sourceType, image, claimedV1: image.infoHash } : { ok: false, error: 'invalid-source' };
  }
  return typeof source.runtimeFileSetId === 'string' ? { ok: true, sourceType, runtimeFileSetId: source.runtimeFileSetId } : { ok: false, error: 'invalid-source' };
}
