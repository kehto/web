import { describe, expect, it } from 'vitest';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  parsePresentationMedia,
  sniffPresentationMediaFormat,
  verifyPresentationMediaBytes,
} from './presentation-media.js';

// NIP-5D §Presentation media at dskvr/nips@6e24617cde507c0a87fa170af9ed6b2b46545b2d.
const hash = 'c'.repeat(64);
const other = 'd'.repeat(64);

// Real container headers: 1x1 PNG, JFIF SOI+APP0, RIFF/WEBP VP8, EBML+DocType webm, isom ftyp.
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]);
const webp = new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([0x1a, 0, 0, 0], [...'WEBPVP8 '].map((c) => c.charCodeAt(0)), [0, 0, 0, 0]));
const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, 0x42, 0x87, 0x81, 0x02]);
const mp4 = new Uint8Array([0, 0, 0, 0x18, ...'ftypisom'].map((c) => typeof c === 'string' ? c.charCodeAt(0) : c).concat([0, 0, 0, 1, ...'isomavc1'].map((c) => typeof c === 'string' ? c.charCodeAt(0) : c)));
const mkv = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x88, 0x6d, 0x61, 0x74, 0x72, 0x6f, 0x73, 0x6b, 0x61]);
const digest = (bytes: Uint8Array) => bytesToHex(sha256(bytes));

describe('parsePresentationMedia', () => {
  it('parses NIP-92 fields in any order and preserves screenshot order', () => {
    expect(parsePresentationMedia([
      ['screenshot', 'alt The puzzle board', `x ${hash}`, 'm image/png', 'dim 1200x750', 'size 184320'],
      ['screenshot', `x ${other}`],
      ['preview', `x ${hash}`, 'm video/webm', 'dim 960x600', 'duration 8.5', 'alt Building a bridge'],
    ])).toEqual({
      screenshots: [
        { sha256: hash, mimeType: 'image/png', dim: { width: 1200, height: 750 }, size: 184320, alt: 'The puzzle board' },
        { sha256: other },
      ],
      preview: { sha256: hash, mimeType: 'video/webm', dim: { width: 960, height: 600 }, duration: 8.5, alt: 'Building a bridge' },
    });
  });
  it.each([
    [['screenshot']],
    [['screenshot', 'x']],
    [['screenshot', 'x bad']],
    [['screenshot', `x ${hash.toUpperCase()}`]],
    [['screenshot', `x ${hash}`, `x ${hash}`]],
    [['screenshot', `x ${hash}`, 'm image/svg+xml']],
    [['screenshot', `x ${hash}`, 'm video/webm']],
    [['preview', `x ${hash}`, 'm image/png']],
  ])('ignores an entry with a missing, repeated or undecodable identity: %j', (tag) => {
    const result = parsePresentationMedia([tag, ['screenshot', `x ${other}`]]);
    expect(result.screenshots).toEqual([{ sha256: other }]);
    expect(result.preview).toBeUndefined();
  });
  it('drops unknown, malformed or repeated optional fields but keeps the entry', () => {
    expect(parsePresentationMedia([[
      'screenshot', `x ${hash}`, 'dim 0x10', 'size -1', 'alt  ', 'm image/png', 'm image/png', 'duration 3', 'blurhash LEHV6nWB2yk8', 'size', 'url https://x',
    ]]).screenshots).toEqual([{ sha256: hash }]);
    expect(parsePresentationMedia([['screenshot', `x ${hash}`, 'size 0', 'dim 1x1']]).screenshots[0]).toMatchObject({ size: 0, dim: { width: 1, height: 1 } });
  });
  it('ignores the preview entirely when several are declared', () => {
    expect(parsePresentationMedia([['preview', `x ${hash}`], ['preview', `x ${other}`]])).toEqual({ screenshots: [] });
    expect(parsePresentationMedia([['preview', `x ${hash}`, 'duration x']]).preview).toEqual({ sha256: hash });
  });
  it('returns no media for manifests without declarations', () => {
    expect(parsePresentationMedia([['x', hash], ['icon', hash, 'image/png']])).toEqual({ screenshots: [] });
  });
});

describe('sniffPresentationMediaFormat', () => {
  it.each([
    [png, 'image/png'], [jpeg, 'image/jpeg'], [webp, 'image/webp'], [webm, 'video/webm'], [mp4, 'video/mp4'],
  ])('recognises %#', (bytes, format) => {
    expect(sniffPresentationMediaFormat(bytes)).toBe(format);
  });
  it.each([
    new Uint8Array(0), png.subarray(0, 8), new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    new TextEncoder().encode('RIFF....WAVEfmt '), mkv, new TextEncoder().encode('GIF89a......'),
  ])('rejects other bytes %#', (bytes) => {
    expect(sniffPresentationMediaFormat(bytes)).toBeUndefined();
  });
});

describe('verifyPresentationMediaBytes', () => {
  it('accepts bytes whose hash and container match the declaration', () => {
    expect(verifyPresentationMediaBytes(png, { sha256: digest(png), mimeType: 'image/png' }, 'screenshot')).toBe('image/png');
    expect(verifyPresentationMediaBytes(png, { sha256: digest(png) }, 'screenshot')).toBe('image/png');
    expect(verifyPresentationMediaBytes(webp, { sha256: digest(webp), mimeType: 'IMAGE/WEBP' }, 'screenshot')).toBe('image/webp');
    expect(verifyPresentationMediaBytes(webm, { sha256: digest(webm), mimeType: 'video/webm' }, 'preview')).toBe('video/webm');
    expect(verifyPresentationMediaBytes(mp4, { sha256: digest(mp4) }, 'preview')).toBe('video/mp4');
  });
  it('rejects a hash mismatch before any format check', () => {
    expect(verifyPresentationMediaBytes(png, { sha256: digest(jpeg) }, 'screenshot')).toBeUndefined();
  });
  it('rejects a declared type that does not match the decoded container', () => {
    expect(verifyPresentationMediaBytes(png, { sha256: digest(png), mimeType: 'image/jpeg' }, 'screenshot')).toBeUndefined();
    expect(verifyPresentationMediaBytes(webm, { sha256: digest(webm), mimeType: 'video/mp4' }, 'preview')).toBeUndefined();
  });
  it('rejects a container of the wrong kind or an unrecognised one', () => {
    expect(verifyPresentationMediaBytes(webm, { sha256: digest(webm) }, 'screenshot')).toBeUndefined();
    expect(verifyPresentationMediaBytes(png, { sha256: digest(png) }, 'preview')).toBeUndefined();
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    expect(verifyPresentationMediaBytes(svg, { sha256: digest(svg) }, 'screenshot')).toBeUndefined();
  });
});
