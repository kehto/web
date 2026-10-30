// NIP-5D §Presentation media at dskvr/nips@6e24617cde507c0a87fa170af9ed6b2b46545b2d.
// Tags describe blobs with NIP-92 `key value` fields. Unusable entries are
// ignored and never suppress usable ones or prevent discovery or playback.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const HASH = /^[a-f0-9]{64}$/;
const MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const DIMENSIONS = /^([1-9][0-9]*)x([1-9][0-9]*)$/;
const INTEGER = /^(?:0|[1-9][0-9]*)$/;
const SECONDS = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

/** Screenshot formats a client decodes before rendering. */
export const SCREENSHOT_FORMATS = ['image/png', 'image/jpeg', 'image/webp'] as const;
/** Preview container formats recognised by {@link sniffPresentationMediaFormat}. */
export const PREVIEW_FORMATS = ['video/webm', 'video/mp4'] as const;

/** A media format {@link sniffPresentationMediaFormat} can recognise from bytes. */
export type PresentationMediaFormat = typeof SCREENSHOT_FORMATS[number] | typeof PREVIEW_FORMATS[number];

/** Which manifest tag a media entry came from. */
export type PresentationMediaKind = 'screenshot' | 'preview';

/** One usable `screenshot` or `preview` declaration. Bytes are unverified until fetched. */
export interface PresentationMedia {
  /** Lowercase-hex SHA-256 of the complete media bytes (`x`). */
  sha256: string;
  /** Declared MIME type (`m`), when present and well-formed. */
  mimeType?: string;
  /** Pixel dimensions (`dim`), when present and well-formed. */
  dim?: { width: number; height: number };
  /** Byte size (`size`), when present and well-formed. */
  size?: number;
  /** Video duration in seconds (`duration`); previews only. */
  duration?: number;
  /** Accessible description (`alt`). */
  alt?: string;
}

/** Presentation media a client may resolve, after the spec's ignore rules. */
export interface PresentationMediaResult {
  /** Usable screenshots in manifest order. */
  screenshots: PresentationMedia[];
  /** The single usable preview video; absent when zero or several were declared. */
  preview?: PresentationMedia;
}

function fieldsOf(tag: readonly string[]): Map<string, string[]> {
  const fields = new Map<string, string[]>();
  for (const field of tag.slice(1)) {
    if (typeof field !== 'string') continue;
    // NIP-92: split at the first ASCII space. A field without one has no value.
    const space = field.indexOf(' ');
    const key = space < 0 ? field : field.slice(0, space);
    const values = fields.get(key) ?? [];
    values.push(space < 0 ? '' : field.slice(space + 1));
    fields.set(key, values);
  }
  return fields;
}

function parseMediaTag(tag: readonly string[], kind: PresentationMediaKind): PresentationMedia | undefined {
  const fields = fieldsOf(tag);
  const hashes = fields.get('x');
  if (!hashes || hashes.length !== 1 || !HASH.test(hashes[0])) return undefined;
  const media: PresentationMedia = { sha256: hashes[0] };
  // An optional field is dropped when repeated or malformed; the entry survives.
  const optional = (key: string, accept: (value: string) => boolean): string | undefined => {
    const values = fields.get(key);
    return values?.length === 1 && accept(values[0]) ? values[0] : undefined;
  };
  const mimeType = optional('m', (value) => MIME_TYPE.test(value));
  if (mimeType !== undefined) {
    const lower = mimeType.toLowerCase();
    const decodable = kind === 'preview'
      ? lower.startsWith('video/')
      : (SCREENSHOT_FORMATS as readonly string[]).includes(lower);
    // A declared type the client could never match against decoded bytes makes
    // the whole entry unusable rather than silently rendering a mismatch.
    if (!decodable) return undefined;
    media.mimeType = mimeType;
  }
  const dim = optional('dim', (value) => DIMENSIONS.test(value));
  if (dim !== undefined) {
    const [, width, height] = DIMENSIONS.exec(dim)!;
    media.dim = { width: Number(width), height: Number(height) };
  }
  const size = optional('size', (value) => INTEGER.test(value));
  if (size !== undefined) media.size = Number(size);
  if (kind === 'preview') {
    const duration = optional('duration', (value) => SECONDS.test(value));
    if (duration !== undefined) media.duration = Number(duration);
  }
  const alt = optional('alt', (value) => value.trim().length > 0);
  if (alt !== undefined) media.alt = alt;
  return media;
}

/**
 * Parse `screenshot` and `preview` tags with NIP-92 `key value` fields and
 * apply the NIP-5D ignore rules: exactly one `x` field is required, unknown or
 * malformed optional fields are dropped, screenshot order is preserved, and
 * more than one `preview` tag ignores the preview entirely.
 *
 * @param tags - Manifest event tags
 * @returns Usable media declarations; nothing here has been fetched or verified
 * @example
 * const { screenshots, preview } = parsePresentationMedia(event.tags);
 */
export function parsePresentationMedia(tags: readonly (readonly string[])[]): PresentationMediaResult {
  const screenshots: PresentationMedia[] = [];
  for (const tag of tags) {
    if (tag[0] !== 'screenshot') continue;
    const media = parseMediaTag(tag, 'screenshot');
    if (media) screenshots.push(media);
  }
  const previews = tags.filter((tag) => tag[0] === 'preview');
  const preview = previews.length === 1 ? parseMediaTag(previews[0], 'preview') : undefined;
  return preview ? { screenshots, preview } : { screenshots };
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/**
 * Recognise a presentation media container from its leading bytes. This is a
 * header check, not a full decode: a host that renders the bytes still relies
 * on the browser's image or video decoder and must not display a blob that
 * fails to decode.
 *
 * @param bytes - Complete blob bytes
 * @returns The recognised format, or `undefined` for anything else
 * @example
 * sniffPresentationMediaFormat(bytes) === 'image/png';
 */
export function sniffPresentationMediaFormat(bytes: Uint8Array): PresentationMediaFormat | undefined {
  if (bytes.length < 12) return undefined;
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG' && bytes[4] === 0x0d && bytes[5] === 0x0a
    && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
    && ascii(bytes, 0, Math.min(bytes.length, 64)).includes('webm')) return 'video/webm';
  if (ascii(bytes, 4, 8) === 'ftyp') return 'video/mp4';
  return undefined;
}

/**
 * Apply the NIP-5D client checks to fetched presentation media bytes: the
 * SHA-256 must equal the declaration's `x`, the bytes must carry a decodable
 * screenshot or preview container for `kind`, and a declared `m` must match
 * the recognised format. Hosts keep placeholder artwork on `undefined`.
 *
 * @param bytes - Complete blob bytes fetched by hash
 * @param media - The parsed declaration the bytes are meant to satisfy
 * @param kind - `screenshot` expects an image container, `preview` a video container
 * @returns The recognised format when every check passes, else `undefined`
 * @example
 * const format = verifyPresentationMediaBytes(bytes, screenshot, 'screenshot');
 * if (format) img.src = URL.createObjectURL(new Blob([bytes], { type: format }));
 */
export function verifyPresentationMediaBytes(
  bytes: Uint8Array,
  media: Pick<PresentationMedia, 'sha256' | 'mimeType'>,
  kind: PresentationMediaKind,
): PresentationMediaFormat | undefined {
  if (bytesToHex(sha256(bytes)) !== media.sha256) return undefined;
  const format = sniffPresentationMediaFormat(bytes);
  if (!format) return undefined;
  const expected: readonly string[] = kind === 'preview' ? PREVIEW_FORMATS : SCREENSHOT_FORMATS;
  if (!expected.includes(format)) return undefined;
  if (media.mimeType !== undefined && media.mimeType.toLowerCase() !== format) return undefined;
  return format;
}
