/**
 * domains/common-nip19.ts — Dependency-free NIP-19 bech32/TLV codec used by the
 * NAP-COMMON mock. Public entity types only (`npub`, `note`, `nprofile`,
 * `nevent`, `naddr`, `nrelay`); `nsec` is rejected by both directions.
 */
import type { CommonNip19DecodeResult, CommonNip19EncodeResult } from '@napplet/core';
import { isHex } from './nostr-store.js';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3] as const;
/** Longest NIP-19 string the mock decodes (the NAP SHOULD-reject threshold). */
export const NIP19_MAX_LENGTH = 5000;

function polymod(values: readonly number[]): number {
  let chk = 1;
  for (const value of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let index = 0; index < 5; index += 1) if ((top >>> index) & 1) chk ^= GENERATOR[index]!;
  }
  return chk >>> 0;
}

function hrpExpand(hrp: string): number[] {
  const codes = [...hrp].map((char) => char.charCodeAt(0));
  return [...codes.map((code) => code >>> 5), 0, ...codes.map((code) => code & 31)];
}

function convertBits(data: readonly number[], fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const maxValue = (1 << toBits) - 1;
  for (const value of data) {
    if (value < 0 || value >>> fromBits !== 0) throw new Error('invalid bits');
    acc = ((acc << fromBits) | value) >>> 0;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      out.push((acc >>> bits) & maxValue);
    }
  }
  if (pad) {
    if (bits > 0) out.push((acc << (toBits - bits)) & maxValue);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxValue) !== 0) {
    throw new Error('invalid padding');
  }
  return out;
}

/**
 * Encode bytes as a bech32 string with the given human-readable part.
 *
 * @param hrp - Prefix such as `npub`.
 * @param bytes - Payload bytes.
 * @returns The bech32 string.
 * @example
 * ```ts
 * bech32Encode('npub', hexToBytes(pubkey)).startsWith('npub1');
 * ```
 */
export function bech32Encode(hrp: string, bytes: Uint8Array): string {
  const words = convertBits([...bytes], 8, 5, true);
  const values = [...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0];
  const mod = polymod(values) ^ 1;
  const checksum = [0, 1, 2, 3, 4, 5].map((index) => (mod >>> (5 * (5 - index))) & 31);
  return `${hrp}1${[...words, ...checksum].map((word) => CHARSET[word]).join('')}`;
}

/**
 * Decode a bech32 string into its prefix and payload bytes.
 *
 * @param value - Bech32 string (case-insensitive, not mixed case).
 * @returns Prefix and bytes, or `null` when malformed.
 * @example
 * ```ts
 * bech32Decode('npub1...')?.hrp === 'npub';
 * ```
 */
export function bech32Decode(value: string): { hrp: string; bytes: Uint8Array } | null {
  if (value !== value.toLowerCase() && value !== value.toUpperCase()) return null;
  const lower = value.toLowerCase();
  const separator = lower.lastIndexOf('1');
  if (separator < 1 || separator + 7 > lower.length) return null;
  const hrp = lower.slice(0, separator);
  const words: number[] = [];
  for (const char of lower.slice(separator + 1)) {
    const index = CHARSET.indexOf(char);
    if (index === -1) return null;
    words.push(index);
  }
  if (polymod([...hrpExpand(hrp), ...words]) !== 1) return null;
  try {
    return { hrp, bytes: Uint8Array.from(convertBits(words.slice(0, -6), 5, 8, false)) };
  } catch {
    return null;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const TLV_SPECIAL = 0;
const TLV_RELAY = 1;
const TLV_AUTHOR = 2;
const TLV_KIND = 3;

function tlv(type: number, payload: Uint8Array): number[] {
  return [type, payload.length, ...payload];
}

function encodeTlv(hrp: string, entries: number[][]): string {
  return bech32Encode(hrp, Uint8Array.from(entries.flat()));
}

function parseTlv(bytes: Uint8Array): Map<number, Uint8Array[]> | null {
  const out = new Map<number, Uint8Array[]>();
  let offset = 0;
  while (offset < bytes.length) {
    const type = bytes[offset]!;
    const length = bytes[offset + 1];
    if (length === undefined || offset + 2 + length > bytes.length) return null;
    const list = out.get(type) ?? [];
    list.push(bytes.subarray(offset + 2, offset + 2 + length));
    out.set(type, list);
    offset += 2 + length;
  }
  return out;
}

const utf8 = { encode: (text: string) => new TextEncoder().encode(text), decode: (bytes: Uint8Array) => new TextDecoder().decode(bytes) };

function kindBytes(kind: number): Uint8Array {
  return Uint8Array.from([(kind >>> 24) & 255, (kind >>> 16) & 255, (kind >>> 8) & 255, kind & 255]);
}

function relayEntries(relays: unknown): number[][] {
  return Array.isArray(relays) ? relays.filter((relay): relay is string => typeof relay === 'string').map((relay) => tlv(TLV_RELAY, utf8.encode(relay))) : [];
}

/**
 * Encode a public NIP-19 identifier per `CommonNip19EncodeInput`.
 *
 * @param input - Structured encode input.
 * @returns `CommonNip19EncodeResult`; `nsec` and unknown types answer `unsupported-nip19-type`.
 * @example
 * ```ts
 * encodeNip19({ type: 'npub', hex: pubkey }).value?.startsWith('npub1');
 * ```
 */
export function encodeNip19(input: unknown): CommonNip19EncodeResult {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'invalid-nip19' };
  const value = input as Partial<Record<string, unknown>> & { type?: unknown };
  switch (value.type) {
    case 'npub':
      return isHex(value.hex, 64) ? { ok: true, value: bech32Encode('npub', hexToBytes(value.hex)), nip19Type: 'npub' } : { ok: false, error: 'invalid-pubkey' };
    case 'note':
      return isHex(value.hex, 64) ? { ok: true, value: bech32Encode('note', hexToBytes(value.hex)), nip19Type: 'note' } : { ok: false, error: 'invalid-nip19' };
    case 'nprofile': {
      if (!isHex(value.pubkey, 64)) return { ok: false, error: 'invalid-pubkey' };
      const entries = [tlv(TLV_SPECIAL, hexToBytes(value.pubkey)), ...relayEntries(value.relays)];
      return { ok: true, value: encodeTlv('nprofile', entries), nip19Type: 'nprofile' };
    }
    case 'nevent': {
      if (!isHex(value.eventId, 64)) return { ok: false, error: 'invalid-nip19' };
      const entries = [tlv(TLV_SPECIAL, hexToBytes(value.eventId)), ...relayEntries(value.relays)];
      if (value.author !== undefined) {
        if (!isHex(value.author, 64)) return { ok: false, error: 'invalid-pubkey' };
        entries.push(tlv(TLV_AUTHOR, hexToBytes(value.author)));
      }
      if (typeof value.kind === 'number' && Number.isInteger(value.kind) && value.kind >= 0) entries.push(tlv(TLV_KIND, kindBytes(value.kind)));
      return { ok: true, value: encodeTlv('nevent', entries), nip19Type: 'nevent' };
    }
    case 'naddr': {
      if (typeof value.identifier !== 'string' || typeof value.kind !== 'number' || !Number.isInteger(value.kind) || value.kind < 0) return { ok: false, error: 'invalid-nip19' };
      if (!isHex(value.pubkey, 64)) return { ok: false, error: 'invalid-pubkey' };
      const entries = [tlv(TLV_SPECIAL, utf8.encode(value.identifier)), ...relayEntries(value.relays), tlv(TLV_AUTHOR, hexToBytes(value.pubkey)), tlv(TLV_KIND, kindBytes(value.kind))];
      return { ok: true, value: encodeTlv('naddr', entries), nip19Type: 'naddr' };
    }
    case 'nrelay':
      if (typeof value.relay !== 'string' || value.relay.length === 0) return { ok: false, error: 'invalid-nip19' };
      return { ok: true, value: encodeTlv('nrelay', [tlv(TLV_SPECIAL, utf8.encode(value.relay))]), nip19Type: 'nrelay' };
    default:
      return { ok: false, error: 'unsupported-nip19-type' };
  }
}

function decodeTlvEntity(hrp: 'nprofile' | 'nevent' | 'naddr' | 'nrelay', bytes: Uint8Array): CommonNip19DecodeResult {
  const fields = parseTlv(bytes);
  const special = fields?.get(TLV_SPECIAL)?.[0];
  if (!fields || !special) return { ok: false, error: 'invalid-nip19' };
  const relays = (fields.get(TLV_RELAY) ?? []).map((relay) => utf8.decode(relay));
  const author = fields.get(TLV_AUTHOR)?.[0];
  const kindRaw = fields.get(TLV_KIND)?.[0];
  const kind = kindRaw && kindRaw.length === 4 ? ((kindRaw[0]! << 24) | (kindRaw[1]! << 16) | (kindRaw[2]! << 8) | kindRaw[3]!) >>> 0 : undefined;
  const withRelays = relays.length > 0 ? { relays } : {};
  switch (hrp) {
    case 'nprofile':
      return special.length === 32 ? { ok: true, nip19Type: 'nprofile', pubkey: bytesToHex(special), ...withRelays } : { ok: false, error: 'invalid-nip19' };
    case 'nevent':
      if (special.length !== 32) return { ok: false, error: 'invalid-nip19' };
      return {
        ok: true,
        nip19Type: 'nevent',
        eventId: bytesToHex(special),
        ...withRelays,
        ...(author && author.length === 32 ? { author: bytesToHex(author) } : {}),
        ...(kind === undefined ? {} : { kind }),
      };
    case 'naddr':
      if (!author || author.length !== 32 || kind === undefined) return { ok: false, error: 'invalid-nip19' };
      return { ok: true, nip19Type: 'naddr', identifier: utf8.decode(special), pubkey: bytesToHex(author), kind, ...withRelays };
    default:
      return { ok: true, nip19Type: 'nrelay', relay: utf8.decode(special) };
  }
}

/**
 * Decode a public NIP-19 identifier into hex fields per `CommonNip19DecodeResult`.
 *
 * @param value - NIP-19 string.
 * @returns Decoded fields; `nsec` answers `unsupported-nip19-type`, malformed input `invalid-nip19`.
 * @example
 * ```ts
 * decodeNip19(encodeNip19({ type: 'npub', hex: pubkey }).value!).hex === pubkey;
 * ```
 */
export function decodeNip19(value: unknown): CommonNip19DecodeResult {
  if (typeof value !== 'string' || value.length === 0 || value.length > NIP19_MAX_LENGTH) return { ok: false, error: 'invalid-nip19' };
  if (value.toLowerCase().startsWith('nsec1')) return { ok: false, error: 'unsupported-nip19-type' };
  const decoded = bech32Decode(value);
  if (!decoded) return { ok: false, error: 'invalid-nip19' };
  switch (decoded.hrp) {
    case 'npub':
    case 'note':
      return decoded.bytes.length === 32 ? { ok: true, nip19Type: decoded.hrp, hex: bytesToHex(decoded.bytes) } : { ok: false, error: 'invalid-nip19' };
    case 'nprofile':
    case 'nevent':
    case 'naddr':
    case 'nrelay':
      return decodeTlvEntity(decoded.hrp, decoded.bytes);
    default:
      return { ok: false, error: 'unsupported-nip19-type' };
  }
}

/**
 * Resolve an `npub` or 64-hex string to a hex pubkey.
 *
 * @param value - Candidate.
 * @returns Hex pubkey or `null`.
 * @example
 * ```ts
 * pubkeyFromNpubOrHex(pubkey) === pubkey;
 * ```
 */
export function pubkeyFromNpubOrHex(value: unknown): string | null {
  if (isHex(value, 64)) return value;
  if (typeof value !== 'string' || !value.toLowerCase().startsWith('npub1')) return null;
  const decoded = decodeNip19(value);
  return decoded.ok && decoded.hex ? decoded.hex : null;
}

/**
 * Hex-encode an `npub` for test vectors and fixtures.
 *
 * @param pubkey - 64-hex pubkey.
 * @returns The `npub` string.
 * @example
 * ```ts
 * npubOf(MOCK_ACCOUNTS[0].pubkey).startsWith('npub1');
 * ```
 */
export function npubOf(pubkey: string): string {
  return bech32Encode('npub', hexToBytes(pubkey));
}
