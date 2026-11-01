/**
 * domains/file-bytes.ts — Byte helpers shared by the file-oriented mocks
 * (resource, upload, blossom, hashtree, fs, git).
 *
 * Every byte sequence a mock hands out is a deterministic placeholder derived
 * from `mockHex`; nothing here is a real image, archive, or signature. The
 * helpers are pure and DOM-free so they run identically in Node and browsers.
 */
import { hashLabel, mockHex } from '../core/rng.js';
import type { LinuxDistroImage } from '../fixtures/linux-distros.js';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP: Record<string, number> = {};
for (let index = 0; index < BASE64_ALPHABET.length; index += 1) BASE64_LOOKUP[BASE64_ALPHABET[index]!] = index;

/** Placeholder byte length of every catalog image served by the mocks. */
export const LINUX_DISTRO_BYTE_LENGTH = 1024;

/**
 * Encode bytes as canonical padded standard base64 (RFC 4648 section 4).
 *
 * @param bytes - Bytes to encode.
 * @returns Base64 text; empty input encodes as `""`.
 * @example
 * ```ts
 * encodeBase64(new Uint8Array([0, 1, 2, 255])) === 'AAEC/w==';
 * ```
 */
export function encodeBase64(bytes: Uint8Array): string {
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index]!;
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += BASE64_ALPHABET[(triple >> 18) & 63]! + BASE64_ALPHABET[(triple >> 12) & 63]!;
    out += b === undefined ? '=' : BASE64_ALPHABET[(triple >> 6) & 63]!;
    out += c === undefined ? '=' : BASE64_ALPHABET[triple & 63]!;
  }
  return out;
}

/**
 * Decode canonical padded standard base64. Rejects whitespace, base64url,
 * missing padding, and non-zero pad bits, as every byte-carrying NAP requires.
 *
 * @param text - Base64 text.
 * @returns Decoded bytes, or `null` when the encoding is not canonical.
 * @example
 * ```ts
 * decodeBase64('AAEC/w==')?.length === 4;
 * decodeBase64('AAEC/w') === null;
 * ```
 */
export function decodeBase64(text: string): Uint8Array | null {
  if (typeof text !== 'string' || text.length % 4 !== 0) return null;
  if (text === '') return new Uint8Array(0);
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const body = text.slice(0, text.length - padding);
  if (body.includes('=')) return null;
  const out = new Uint8Array((text.length / 4) * 3 - padding);
  let bits = 0;
  let buffer = 0;
  let written = 0;
  for (const char of body) {
    const value = BASE64_LOOKUP[char];
    if (value === undefined) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[written] = (buffer >> bits) & 0xff;
      written += 1;
    }
  }
  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) return null;
  return written === out.length ? out : null;
}

/**
 * Deterministic placeholder bytes for a label.
 *
 * @param label - Stable label such as `iso:debian-12-netinst`.
 * @param length - Byte count.
 * @returns Bytes derived from `mockHex(label)`.
 * @example
 * ```ts
 * placeholderBytes('iso:debian-12-netinst', 16).length === 16;
 * ```
 */
export function placeholderBytes(label: string, length: number): Uint8Array {
  return hexToBytes(mockHex(label, length * 2));
}

/**
 * Convert lowercase/uppercase hex to bytes.
 *
 * @param hex - Even-length hex string.
 * @returns Bytes.
 * @example
 * ```ts
 * hexToBytes('00ff').length === 2;
 * ```
 */
export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >> 1);
  for (let index = 0; index < out.length; index += 1) out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return out;
}

/**
 * Convert bytes to lowercase hex.
 *
 * @param bytes - Bytes.
 * @returns Hex string.
 * @example
 * ```ts
 * bytesToHex(new Uint8Array([0, 255])) === '00ff';
 * ```
 */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

/**
 * UTF-8 encode text.
 *
 * @param text - Text.
 * @returns UTF-8 bytes.
 * @example
 * ```ts
 * utf8Bytes('hi').length === 2;
 * ```
 */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * UTF-8 decode bytes (lossy for invalid sequences).
 *
 * @param bytes - UTF-8 bytes.
 * @returns Text.
 * @example
 * ```ts
 * utf8Text(utf8Bytes('hi')) === 'hi';
 * ```
 */
export function utf8Text(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Placeholder SHA-256 for a byte sequence: stable for equal bytes, never a
 * real digest.
 *
 * @param bytes - Bytes to "hash".
 * @returns 64-hex placeholder.
 * @example
 * ```ts
 * placeholderSha256(utf8Bytes('a')) === placeholderSha256(utf8Bytes('a'));
 * ```
 */
export function placeholderSha256(bytes: Uint8Array): string {
  let latin1 = '';
  for (const byte of bytes) latin1 += String.fromCharCode(byte);
  return mockHex(`sha256:bytes:${hashLabel(latin1)}:${bytes.length}`);
}

/**
 * Placeholder image bytes for a catalog entry: `LINUX_DISTRO_BYTE_LENGTH`
 * bytes derived from the catalog id. Catalog `sizeBytes` describes the real
 * image; the mocks serve this short stand-in instead.
 *
 * @param image - Catalog entry.
 * @returns Placeholder bytes.
 * @example
 * ```ts
 * linuxDistroBytes(LINUX_DISTROS[0]).length === LINUX_DISTRO_BYTE_LENGTH;
 * ```
 */
export function linuxDistroBytes(image: LinuxDistroImage): Uint8Array {
  return placeholderBytes(`iso:${image.id}`, LINUX_DISTRO_BYTE_LENGTH);
}

/**
 * `SHA256SUMS` text listing every catalog image (`<sha256>  <fileName>`).
 *
 * @param images - Catalog entries.
 * @returns Text with one line per image and a trailing newline.
 * @example
 * ```ts
 * linuxDistroSums(LINUX_DISTROS).split('\n').length === 9;
 * ```
 */
export function linuxDistroSums(images: readonly LinuxDistroImage[]): string {
  return images.map((image) => `${image.sha256}  ${image.fileName}`).join('\n') + '\n';
}

const EXTENSION_MIMES: Readonly<Record<string, string>> = Object.freeze({
  iso: 'application/x-iso9660-image',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain',
  md: 'text/markdown',
  bin: 'application/octet-stream',
});

/**
 * MIME type for a file name by extension (placeholder classification).
 *
 * @param fileName - File name or path.
 * @returns MIME type, `application/octet-stream` when unknown.
 * @example
 * ```ts
 * mimeForFileName('debian.iso') === 'application/x-iso9660-image';
 * ```
 */
export function mimeForFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const extension = dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
  return EXTENSION_MIMES[extension] ?? 'application/octet-stream';
}

/**
 * File extension (with dot) for a MIME type, defaulting to `.bin`.
 *
 * @param mime - MIME type.
 * @returns Extension such as `.png`.
 * @example
 * ```ts
 * extensionForMime('image/png') === '.png';
 * ```
 */
export function extensionForMime(mime: string): string {
  for (const [extension, candidate] of Object.entries(EXTENSION_MIMES)) {
    if (candidate === mime && extension !== 'jpeg') return `.${extension}`;
  }
  return '.bin';
}

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  return magic.every((byte, index) => bytes[index] === byte);
}

/**
 * Classify bytes by magic numbers, never by an upstream header.
 *
 * @param bytes - Bytes to sniff.
 * @param fallback - Used when no magic number matches. Default `application/octet-stream`.
 * @returns MIME type.
 * @example
 * ```ts
 * sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47])) === 'image/png';
 * ```
 */
export function sniffMime(bytes: Uint8Array, fallback = 'application/octet-stream'): string {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
  const head = utf8Text(bytes.subarray(0, 64)).trimStart();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'image/svg+xml';
  return fallback;
}

/**
 * Placeholder PNG bytes: a real PNG signature followed by placeholder bytes,
 * so `sniffMime` classifies them as `image/png`. Not a decodable image.
 *
 * @param label - Stable label.
 * @param length - Total length including the 8-byte signature. Default 256.
 * @returns Bytes.
 * @example
 * ```ts
 * sniffMime(placeholderPng('avatar:alice')) === 'image/png';
 * ```
 */
export function placeholderPng(label: string, length = 256): Uint8Array {
  const out = new Uint8Array(Math.max(8, length));
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  out.set(placeholderBytes(label, out.length - 8), 8);
  return out;
}

/**
 * Coerce projection-native byte payloads to bytes. `Blob` cannot be read
 * synchronously, so a Blob yields placeholder bytes of its size (capped at
 * 4096) — enough to keep hashes and sizes stable in tests.
 *
 * @param data - `Uint8Array`, `ArrayBuffer`, any `ArrayBufferView`, a `Blob`, or base64 text.
 * @returns Bytes, or `null` when `data` is not a byte payload.
 * @example
 * ```ts
 * toBytes(new Uint8Array([1, 2]))?.length === 2;
 * toBytes('AAEC/w==')?.length === 4;
 * ```
 */
export function toBytes(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (typeof data === 'string') return decodeBase64(data);
  if (isBlobLike(data)) return placeholderBytes(`blob:${data.size}:${data.type}`, Math.min(data.size, 4096));
  return null;
}

/**
 * Byte length of a projection-native payload without copying it.
 *
 * @param data - Same inputs as `toBytes`.
 * @returns Length, or `null` when `data` is not a byte payload.
 * @example
 * ```ts
 * byteLengthOf(new ArrayBuffer(8)) === 8;
 * ```
 */
export function byteLengthOf(data: unknown): number | null {
  if (isBlobLike(data)) return data.size;
  if (typeof data === 'string') return decodeBase64(data)?.length ?? null;
  return toBytes(data)?.length ?? null;
}

/**
 * Declared MIME type of a `Blob`-like payload, when any.
 *
 * @param data - Payload.
 * @returns The Blob's `type` or `undefined`.
 * @example
 * ```ts
 * blobType(new Blob(['x'], { type: 'text/plain' })) === 'text/plain';
 * ```
 */
export function blobType(data: unknown): string | undefined {
  return isBlobLike(data) && data.type ? data.type : undefined;
}

function isBlobLike(data: unknown): data is { size: number; type: string } {
  return typeof data === 'object' && data !== null
    && typeof (data as { size?: unknown }).size === 'number'
    && typeof (data as { type?: unknown }).type === 'string'
    && typeof (data as { arrayBuffer?: unknown }).arrayBuffer === 'function';
}

/**
 * Build a `Blob` from bytes when the host has one, else return the bytes.
 *
 * @param bytes - Bytes.
 * @param mime - Blob type.
 * @returns A `Blob` or the input bytes.
 * @example
 * ```ts
 * const blob = toBlob(utf8Bytes('hi'), 'text/plain');
 * ```
 */
export function toBlob(bytes: Uint8Array, mime: string): Blob | Uint8Array {
  return typeof Blob === 'function' ? new Blob([bytes as BlobPart], { type: mime }) : bytes;
}
