/**
 * webrtc-bytes.ts — NAP-WEBRTC `WebrtcBytes` codec.
 *
 * NAP-WEBRTC (napplet/naps#59 @ fb4dd6f0), Byte payloads: "`WebrtcBytes` is
 * text containing canonical padded base64 as defined by RFC 4648, section 4:
 * standard alphabet, required `=` padding, zero pad bits, no whitespace, and
 * no data-URL prefix. Empty bytes encode as `""`. Receivers MUST reject
 * non-canonical encodings."
 */

const CANONICAL_SHAPE = /^[A-Za-z0-9+/]*={0,2}$/;
/** Characters per `String.fromCharCode` call, well under engine argument limits. */
const CHUNK = 0x8000;

/**
 * Encode bytes as canonical padded base64 `WebrtcBytes` text.
 *
 * @param bytes - The byte sequence.
 * @returns Canonical padded base64; `""` for no bytes.
 * @example
 * ```ts
 * encodeWebrtcBytes(new Uint8Array([0, 1, 2, 255])); // 'AAEC/w=='
 * ```
 */
export function encodeWebrtcBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK));
  }
  return btoa(binary);
}

/**
 * Decode canonical padded base64 `WebrtcBytes` text, rejecting every
 * non-canonical form (missing padding, non-zero pad bits, whitespace, the
 * URL-safe alphabet, a data-URL prefix).
 *
 * @param value - Candidate `WebrtcBytes` text.
 * @returns The decoded bytes, or `undefined` when `value` is not canonical.
 * @example
 * ```ts
 * decodeWebrtcBytes('AAEC/w=='); // Uint8Array [0, 1, 2, 255]
 * decodeWebrtcBytes('AAEC/x=='); // undefined: non-zero pad bits
 * ```
 */
export function decodeWebrtcBytes(value: unknown): Uint8Array | undefined {
  if (typeof value !== 'string' || value.length % 4 !== 0 || !CANONICAL_SHAPE.test(value)) return undefined;
  let binary: string;
  try { binary = atob(value); } catch { return undefined; }
  // Re-encoding round-trips only for canonical text (zero pad bits).
  if (btoa(binary) !== value) return undefined;
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
