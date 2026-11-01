/**
 * domains/hashtree-fixtures.ts — Seeded Hashtree document tree, HTS-01 style
 * identifiers, and a dependency-free bech32 codec shared by the hashtree and
 * resource mocks.
 *
 * The tree describes the Linux distribution catalog: one directory per distro
 * holding its image file, plus a `SHA256SUMS` text file at the root. Hashes are
 * `mockHex` placeholders (the catalog `sha256` doubles as each file's content
 * hash); they are not HTS-01 MessagePack node digests.
 */
import { mockHex, mockPubkey } from '../core/rng.js';
import { LINUX_DISTROS, type LinuxDistroImage } from '../fixtures/linux-distros.js';
import { MOCK_EPOCH_SECONDS, buildMockEvent } from '../fixtures/nostr.js';
import type { NostrEvent } from '@napplet/core';
import {
  bytesToHex,
  hexToBytes,
  linuxDistroBytes,
  linuxDistroSums,
  mimeForFileName,
  utf8Bytes,
} from './file-bytes.js';

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: readonly number[]): number {
  let checksum = 1;
  for (const value of values) {
    const top = checksum >> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let bit = 0; bit < 5; bit += 1) if ((top >> bit) & 1) checksum ^= BECH32_GENERATOR[bit]!;
  }
  return checksum;
}

function hrpExpand(prefix: string): number[] {
  const out: number[] = [];
  for (const char of prefix) out.push(char.charCodeAt(0) >> 5);
  out.push(0);
  for (const char of prefix) out.push(char.charCodeAt(0) & 31);
  return out;
}

function convertBits(data: readonly number[], from: number, to: number, pad: boolean): number[] | null {
  let accumulator = 0;
  let bits = 0;
  const out: number[] = [];
  const maxValue = (1 << to) - 1;
  for (const value of data) {
    accumulator = (accumulator << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((accumulator >> bits) & maxValue);
    }
  }
  if (pad) {
    if (bits > 0) out.push((accumulator << (to - bits)) & maxValue);
  } else if (bits >= from || ((accumulator << (to - bits)) & maxValue) !== 0) {
    return null;
  }
  return out;
}

/**
 * Encode bytes as a bech32 string (BIP-173 checksum, no length cap so long
 * TLV payloads such as `nevent` and `nhash` encode too).
 *
 * @param prefix - Human-readable part, e.g. `npub`.
 * @param bytes - Payload bytes.
 * @returns Lowercase bech32 text.
 * @example
 * ```ts
 * encodeBech32('npub', hexToBytes(pubkey)).startsWith('npub1');
 * ```
 */
export function encodeBech32(prefix: string, bytes: Uint8Array): string {
  const words = convertBits([...bytes], 8, 5, true) ?? [];
  const expanded = [...hrpExpand(prefix), ...words];
  const mod = polymod([...expanded, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum: number[] = [];
  for (let index = 0; index < 6; index += 1) checksum.push((mod >> (5 * (5 - index))) & 31);
  return `${prefix}1${[...words, ...checksum].map((word) => BECH32_CHARSET[word]).join('')}`;
}

/**
 * Decode a bech32 string, validating its checksum.
 *
 * @param text - Bech32 text (either case, not mixed).
 * @returns Prefix and payload bytes, or `null` when malformed.
 * @example
 * ```ts
 * decodeBech32(encodeBech32('note', bytes))?.prefix === 'note';
 * ```
 */
export function decodeBech32(text: string): { prefix: string; bytes: Uint8Array } | null {
  if (text !== text.toLowerCase() && text !== text.toUpperCase()) return null;
  const lower = text.toLowerCase();
  const separator = lower.lastIndexOf('1');
  if (separator < 1 || separator + 7 > lower.length) return null;
  const prefix = lower.slice(0, separator);
  const words: number[] = [];
  for (const char of lower.slice(separator + 1)) {
    const value = BECH32_CHARSET.indexOf(char);
    if (value === -1) return null;
    words.push(value);
  }
  if (polymod([...hrpExpand(prefix), ...words]) !== 1) return null;
  const bytes = convertBits(words.slice(0, -6), 5, 8, false);
  return bytes ? { prefix, bytes: new Uint8Array(bytes) } : null;
}

/**
 * Parse a NIP-19 style TLV payload into `type → values`.
 *
 * @param bytes - TLV bytes.
 * @returns Map of TLV type to each value's bytes, in order.
 * @example
 * ```ts
 * parseTlv(bytes).get(0)?.[0]?.length === 32;
 * ```
 */
export function parseTlv(bytes: Uint8Array): Map<number, Uint8Array[]> {
  const out = new Map<number, Uint8Array[]>();
  let index = 0;
  while (index + 2 <= bytes.length) {
    const type = bytes[index]!;
    const length = bytes[index + 1]!;
    const value = bytes.subarray(index + 2, index + 2 + length);
    if (value.length !== length) break;
    out.set(type, [...(out.get(type) ?? []), value]);
    index += 2 + length;
  }
  return out;
}

/**
 * Build a NIP-19 style TLV payload.
 *
 * @param entries - `[type, value]` pairs.
 * @returns TLV bytes.
 * @example
 * ```ts
 * buildTlv([[0, hexToBytes(hash)]]).length === 34;
 * ```
 */
export function buildTlv(entries: ReadonlyArray<readonly [number, Uint8Array]>): Uint8Array {
  const out: number[] = [];
  for (const [type, value] of entries) out.push(type, value.length, ...value);
  return new Uint8Array(out);
}

/**
 * HTS-01 shaped immutable identifier: `nhash1…` wrapping TLV `0 = hash`
 * (and `1 = key` when present).
 *
 * @param hash - 64-hex content hash.
 * @param key - Optional 64-hex CHK key.
 * @returns Bech32 `nhash` text.
 * @example
 * ```ts
 * encodeNhash(LINUX_DISTROS[0].sha256).startsWith('nhash1');
 * ```
 */
export function encodeNhash(hash: string, key?: string): string {
  const entries: Array<readonly [number, Uint8Array]> = [[0, hexToBytes(hash)]];
  if (key) entries.push([1, hexToBytes(key)]);
  return encodeBech32('nhash', buildTlv(entries));
}

/**
 * Decode an `nhash` into its hash and optional key.
 *
 * @param text - Bech32 `nhash` text.
 * @returns Hash/key hex, or `null` when malformed.
 * @example
 * ```ts
 * decodeNhash(encodeNhash(hash))?.hash === hash;
 * ```
 */
export function decodeNhash(text: string): { hash: string; key?: string } | null {
  const decoded = decodeBech32(text);
  if (!decoded || decoded.prefix !== 'nhash') return null;
  const tlv = parseTlv(decoded.bytes);
  const hash = tlv.get(0)?.[0];
  if (!hash || hash.length !== 32) return null;
  const key = tlv.get(1)?.[0];
  return key && key.length === 32 ? { hash: bytesToHex(hash), key: bytesToHex(key) } : { hash: bytesToHex(hash) };
}

/**
 * One node of the seeded Hashtree.
 *
 * @example
 * ```ts
 * const node = MOCK_HASHTREE_NODES.get(MOCK_HASHTREE_ROOT_HASH);
 * node?.type === 'dir';
 * ```
 */
export interface MockHashtreeNode {
  /** 64-hex content hash (placeholder). */
  hash: string;
  /** `dir` or `file`. */
  type: 'dir' | 'file';
  /** Entry name within its parent (`distros` for the root). */
  name: string;
  /** Directory children, in name order. Files have none. */
  entries?: ReadonlyArray<{ name: string; hash: string }>;
  /** File bytes. Directories have none. */
  bytes?: Uint8Array;
  /** File MIME type. */
  mime?: string;
}

function fileNode(name: string, hash: string, bytes: Uint8Array, mime = mimeForFileName(name)): MockHashtreeNode {
  return { hash, type: 'file', name, bytes, mime };
}

function buildNodes(images: readonly LinuxDistroImage[]): { nodes: Map<string, MockHashtreeNode>; rootHash: string } {
  const nodes = new Map<string, MockHashtreeNode>();
  const rootEntries: Array<{ name: string; hash: string }> = [];
  for (const image of images) {
    const file = fileNode(image.fileName, image.sha256, linuxDistroBytes(image));
    nodes.set(file.hash, file);
    const dirHash = mockHex(`htree:dir:${image.id}`);
    nodes.set(dirHash, { hash: dirHash, type: 'dir', name: image.id, entries: [{ name: image.fileName, hash: file.hash }] });
    rootEntries.push({ name: image.id, hash: dirHash });
  }
  const sums = fileNode('SHA256SUMS', mockHex('htree:file:SHA256SUMS'), utf8Bytes(linuxDistroSums(images)), 'text/plain');
  nodes.set(sums.hash, sums);
  rootEntries.push({ name: sums.name, hash: sums.hash });
  rootEntries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  const rootHash = mockHex('htree:root:distros');
  nodes.set(rootHash, { hash: rootHash, type: 'dir', name: 'distros', entries: rootEntries });
  return { nodes, rootHash };
}

const built = buildNodes(LINUX_DISTROS);

/** Every seeded node keyed by content hash. */
export const MOCK_HASHTREE_NODES: ReadonlyMap<string, MockHashtreeNode> = built.nodes;

/** Content hash of the seeded `distros` root directory. */
export const MOCK_HASHTREE_ROOT_HASH: string = built.rootHash;

/** Tree name (`d` tag) of the seeded mutable root. */
export const MOCK_HASHTREE_TREE_NAME = 'distros';

/** Hex pubkey of the seeded root author (`alice`). */
export const MOCK_HASHTREE_AUTHOR: string = mockPubkey('alice');

/** `npub` of the seeded root author. */
export const MOCK_HASHTREE_AUTHOR_NPUB: string = encodeBech32('npub', hexToBytes(MOCK_HASHTREE_AUTHOR));

/**
 * Seeded kind `30064` root event for `htree://<alice>/distros`
 * (`d`, `l`, `hash` tags; `unencrypted` visibility).
 *
 * @example
 * ```ts
 * MOCK_HASHTREE_ROOT_EVENT.kind === 30064;
 * ```
 */
export const MOCK_HASHTREE_ROOT_EVENT: NostrEvent = buildMockEvent('hashtree:root:alice:distros', {
  kind: 30064,
  pubkey: MOCK_HASHTREE_AUTHOR,
  tags: [['d', MOCK_HASHTREE_TREE_NAME], ['l', 'hashtree'], ['hash', MOCK_HASHTREE_ROOT_HASH], ['visibility', 'unencrypted']],
  created_at: MOCK_EPOCH_SECONDS + 5000,
});

/**
 * Walk a logical path from a directory node.
 *
 * @param nodes - Node store.
 * @param rootHash - Starting directory hash.
 * @param segments - Path segments (already split and decoded).
 * @returns The node at the path, or `undefined`.
 * @example
 * ```ts
 * walkHashtree(MOCK_HASHTREE_NODES, MOCK_HASHTREE_ROOT_HASH, ['SHA256SUMS'])?.type === 'file';
 * ```
 */
export function walkHashtree(
  nodes: ReadonlyMap<string, MockHashtreeNode>,
  rootHash: string,
  segments: readonly string[],
): MockHashtreeNode | undefined {
  let current = nodes.get(rootHash);
  for (const segment of segments) {
    if (!current || current.type !== 'dir') return undefined;
    const child = current.entries?.find((entry) => entry.name === segment);
    current = child ? nodes.get(child.hash) : undefined;
  }
  return current;
}

/**
 * Split an `htree://<identifier>/<tree>[/<entry…>]` URL into its parts,
 * decoding each segment separately per the upstream URL-encoding guidance.
 *
 * @param url - Full `htree://` URL.
 * @returns Parts, or `null` when malformed (query strings, bad escapes, colon paths).
 * @example
 * ```ts
 * parseHtreeUrl('htree://abc/distros/SHA256SUMS')?.entryPath === 'SHA256SUMS';
 * ```
 */
export function parseHtreeUrl(url: string): { identifier: string; treeName: string; entryPath: string; fragment: string } | null {
  if (!url.startsWith('htree://')) return null;
  const hashIndex = url.indexOf('#');
  const fragment = hashIndex === -1 ? '' : url.slice(hashIndex + 1);
  const body = hashIndex === -1 ? url.slice(8) : url.slice(8, hashIndex);
  if (body.includes('?')) return null;
  const segments = body.split('/');
  if (segments.length < 2 || segments.some((segment) => segment === '')) return null;
  const decoded: string[] = [];
  for (const segment of segments) {
    try { decoded.push(decodeURIComponent(segment)); } catch { return null; }
  }
  const [identifier, treeName, ...rest] = decoded as [string, string, ...string[]];
  if (identifier.includes(':') || treeName.includes(':') || rest.some((segment) => segment.includes(':'))) return null;
  return { identifier, treeName, entryPath: rest.join('/'), fragment };
}

/**
 * Resolve an identifier (`npub…` or 64-hex) to a hex pubkey.
 *
 * @param identifier - `npub` or hex.
 * @returns Hex pubkey, or `null` when neither form parses.
 * @example
 * ```ts
 * identifierToPubkey(MOCK_HASHTREE_AUTHOR_NPUB) === MOCK_HASHTREE_AUTHOR;
 * ```
 */
export function identifierToPubkey(identifier: string): string | null {
  if (/^[0-9a-f]{64}$/.test(identifier)) return identifier;
  const decoded = decodeBech32(identifier);
  return decoded && decoded.prefix === 'npub' && decoded.bytes.length === 32 ? bytesToHex(decoded.bytes) : null;
}

/** `HashtreeVisibility` enumeration. */
export type HashtreeVisibility = 'unencrypted' | 'public' | 'link-visible' | 'private';
/**
 * `HashtreeCid` record.
 *
 * @example
 * ```ts
 * const cid: HashtreeCid = { hash: MOCK_HASHTREE_ROOT_HASH };
 * ```
 */
export interface HashtreeCid { hash: string; key?: string; nhash?: string }

/**
 * `HashtreeRef` record returned by `parseRef`.
 *
 * @example
 * ```ts
 * const ref: HashtreeRef = { kind: 'htree', ref: 'htree://npub1…/distros', identifier: 'npub1…', treePath: 'distros', entryPath: '' };
 * ```
 */
export interface HashtreeRef {
  kind: 'nhash' | 'cid' | 'htree' | 'npub-path';
  ref: string;
  cid?: HashtreeCid;
  identifier?: string;
  treePath?: string;
  entryPath?: string;
  visibility?: HashtreeVisibility;
  shareSecret?: string;
}

/**
 * Parse a Hashtree reference without fetching anything.
 *
 * @param ref - `nhash…`, `hashtree:nhash…`, `<hash>[:<key>]`, `htree://…`, or `npub…/tree/path`.
 * @returns The parsed reference, or `null` when malformed.
 * @example
 * ```ts
 * parseHashtreeRef(MOCK_HASHTREE_ROOT_HASH)?.kind === 'cid';
 * ```
 */
export function parseHashtreeRef(ref: string): HashtreeRef | null {
  if (typeof ref !== 'string' || ref === '') return null;
  const nhashText = ref.startsWith('hashtree:') ? ref.slice(9) : ref;
  if (nhashText.startsWith('nhash1')) {
    const decoded = decodeNhash(nhashText);
    return decoded ? { kind: 'nhash', ref, cid: { ...decoded, nhash: nhashText } } : null;
  }
  const cid = /^([0-9a-f]{64})(?::([0-9a-f]{64}))?$/.exec(ref);
  if (cid) return { kind: 'cid', ref, cid: { hash: cid[1]!, ...(cid[2] ? { key: cid[2] } : {}), nhash: encodeNhash(cid[1]!, cid[2]) } };
  if (ref.startsWith('htree://')) {
    const parts = parseHtreeUrl(ref);
    if (!parts) return null;
    const secret = /^k=([0-9a-f]{64})$/.exec(parts.fragment);
    if (parts.fragment !== '' && !secret && parts.fragment !== 'private') return null;
    return {
      kind: 'htree',
      ref,
      identifier: parts.identifier,
      treePath: parts.treeName,
      entryPath: parts.entryPath,
      ...(secret ? { visibility: 'link-visible' as const, shareSecret: secret[1] } : parts.fragment === 'private' ? { visibility: 'private' as const } : {}),
    };
  }
  if (ref.startsWith('npub1')) {
    const [identifier, treePath, ...rest] = ref.split('/');
    if (!treePath || !identifierToPubkey(identifier!)) return null;
    return { kind: 'npub-path', ref, identifier: identifier!, treePath, entryPath: rest.join('/') };
  }
  return null;
}

/** `HashtreeJobState` enumeration. */
export type HashtreeJobState = 'queued' | 'running' | 'complete' | 'cancelled' | 'error';

/**
 * `HashtreeEntry` record.
 *
 * @example
 * ```ts
 * const entry: HashtreeEntry = { path: 'SHA256SUMS', type: 'file', cid: { hash: '…' }, size: 700, mime: 'text/plain' };
 * ```
 */
export interface HashtreeEntry { path: string; type: 'blob' | 'file' | 'dir'; cid: HashtreeCid; name?: string; size?: number; mime?: string }

/**
 * `HashtreeResolvedRoot` record.
 *
 * @example
 * ```ts
 * const root: HashtreeResolvedRoot = { cid: { hash: MOCK_HASHTREE_ROOT_HASH }, treeName: 'distros', visibility: 'unencrypted' };
 * ```
 */
export interface HashtreeResolvedRoot {
  cid: HashtreeCid;
  ref?: HashtreeRef;
  rootResult?: { event: NostrEvent };
  eventId?: string;
  author?: string;
  treeName?: string;
  visibility?: HashtreeVisibility;
}

/**
 * `HashtreeJobStatus` record.
 *
 * @example
 * ```ts
 * const status: HashtreeJobStatus = { ok: true, jobId: 'ht-1', kind: 'import', state: 'queued', processedBytes: 0, totalBytes: 8192, progress: 0 };
 * ```
 */
export interface HashtreeJobStatus {
  ok: boolean;
  jobId: string;
  kind: 'import' | 'export';
  state: HashtreeJobState;
  processedBytes: number;
  totalBytes: number;
  progress: number;
  cid?: HashtreeCid;
  ref?: string;
  runtimeFileSetId?: string;
  error?: string;
  reason?: string;
}

/**
 * `HashtreePin` record.
 *
 * @example
 * ```ts
 * const pin: HashtreePin = { ref: 'htree://npub1…/distros', cid: { hash: MOCK_HASHTREE_ROOT_HASH }, createdAt: 1767225600 };
 * ```
 */
export interface HashtreePin { ref: string; cid: HashtreeCid; label?: string; bytesStored?: number; createdAt?: number }

/**
 * `HashtreeRuntimeFileSet` record.
 *
 * @example
 * ```ts
 * const set: HashtreeRuntimeFileSet = { runtimeFileSetId: 'fs-1', files: [], totalBytes: 0 };
 * ```
 */
export interface HashtreeRuntimeFileSet { runtimeFileSetId: string; files: HashtreeEntry[]; totalBytes: number; displayName?: string }

/**
 * `HashtreeCapabilities` record.
 *
 * @example
 * ```ts
 * const capabilities: HashtreeCapabilities = { canReadImmutable: true, canWrite: true };
 * ```
 */
export interface HashtreeCapabilities {
  canReadImmutable?: boolean;
  canResolveMutable?: boolean;
  canWrite?: boolean;
  canPublishRoots?: boolean;
  canPin?: boolean;
  canImportRuntimeFiles?: boolean;
  canExportRuntimeFiles?: boolean;
  supportsFips?: boolean;
  supportsBlossom?: boolean;
  supportsLocalStore?: boolean;
  maxReadBytes?: number;
  maxWriteBytes?: number;
}
