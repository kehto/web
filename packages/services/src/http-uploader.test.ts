/**
 * http-uploader.test.ts — NAP-UPLOAD concrete HTTP-backed uploader.
 *
 * Exercises createHttpUploader against a mock fetch + signEvent: the NIP-96
 * (NIP-98 auth + multipart) happy path, the Blossom (kind 24242 auth + PUT)
 * happy path, rail selection / defaults, unsupported & unconfigured rails, and
 * server-rejection error mapping. signEvent and fetch are injected so no real
 * network or signing key is involved.
 */

import { describe, it, expect, vi } from 'vitest';
import { createHttpUploader } from './http-uploader.js';
import type { UploaderContext } from './upload-service.js';
import type { EventTemplate, NostrEvent } from '@napplet/core';

const SHA = 'a'.repeat(64);
const OX = 'b'.repeat(64);

function ctx(uploadId = 'up-1'): UploaderContext {
  return { uploadId, windowId: 'win-1', onStatus: vi.fn() };
}

function signer() {
  return vi.fn(async (tmpl: EventTemplate): Promise<NostrEvent> => ({
    ...tmpl,
    id: 'e'.repeat(64),
    pubkey: 'p'.repeat(64),
    sig: 'f'.repeat(128),
  }));
}

const NOW = () => 1_700_000_000;
const DIGEST = vi.fn(async () => SHA);

function nip96Response() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: 'success',
      message: 'ok',
      nip94_event: {
        tags: [
          ['url', 'https://files.test/abc.png'],
          ['ox', OX],
          ['x', SHA],
          ['size', '8'],
          ['m', 'image/png'],
          ['dim', '1280x720'],
        ],
      },
    }),
  } as unknown as Response;
}

function blossomResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      url: 'https://blossom.test/abc.pdf',
      sha256: SHA,
      size: 8,
      type: 'application/pdf',
    }),
  } as unknown as Response;
}

describe('createHttpUploader', () => {
  describe('nip96 rail', () => {
    it('signs a NIP-98 auth event, POSTs multipart, and maps the NIP-94 result', async () => {
      const signEvent = signer();
      const fetchFn = vi.fn(async () => nip96Response());
      const uploader = createHttpUploader({
        rails: { nip96: { servers: ['https://files.test/upload'] } },
        signEvent,
        fetch: fetchFn as unknown as typeof fetch,
        digestSha256: DIGEST,
        now: NOW,
      });

      const result = await uploader.upload(
        { rail: 'nip96', data: new ArrayBuffer(8), filename: 'x.png', mimeType: 'image/png' },
        ctx(),
      );

      // Auth: NIP-98 (kind 27235) with u / method / payload tags.
      expect(signEvent).toHaveBeenCalledTimes(1);
      const authTmpl = (signEvent as ReturnType<typeof vi.fn>).mock.calls[0][0] as EventTemplate;
      expect(authTmpl.kind).toBe(27235);
      const tagMap = Object.fromEntries(authTmpl.tags.map((t) => [t[0], t[1]]));
      expect(tagMap.u).toBe('https://files.test/upload');
      expect(tagMap.method).toBe('POST');
      expect(tagMap.payload).toBe(SHA);

      // Transport: POST to the configured server with a Nostr auth header + FormData.
      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe('https://files.test/upload');
      expect(init.method).toBe('POST');
      expect(String(init.headers.Authorization)).toMatch(/^Nostr /);
      expect(init.body).toBeInstanceOf(FormData);

      // Result mapping from the nip94_event tags.
      expect(result).toMatchObject({
        ok: true,
        uploadId: 'up-1',
        status: 'complete',
        rail: 'nip96',
        url: 'https://files.test/abc.png',
        sha256: SHA,
        originalSha256: OX,
        size: 8,
        mimeType: 'image/png',
        dimensions: { width: 1280, height: 720 },
      });
      expect(result.nip94).toEqual([
        ['url', 'https://files.test/abc.png'],
        ['ox', OX],
        ['x', SHA],
        ['size', '8'],
        ['m', 'image/png'],
        ['dim', '1280x720'],
      ]);
    });

    it('maps an HTTP failure to a failed result (server rejected)', async () => {
      const fetchFn = vi.fn(async () => ({ ok: false, status: 413, json: async () => ({}) }) as unknown as Response);
      const uploader = createHttpUploader({
        rails: { nip96: { servers: ['https://files.test/upload'] } },
        signEvent: signer(),
        fetch: fetchFn as unknown as typeof fetch,
        digestSha256: DIGEST,
        now: NOW,
      });
      const result = await uploader.upload({ rail: 'nip96', data: new ArrayBuffer(8) }, ctx());
      expect(result.ok).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/413|server/i);
    });

    it('maps a NIP-96 error status body to a failed result', async () => {
      const fetchFn = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: 'error', message: 'quota exceeded' }),
      }) as unknown as Response);
      const uploader = createHttpUploader({
        rails: { nip96: { servers: ['https://files.test/upload'] } },
        signEvent: signer(),
        fetch: fetchFn as unknown as typeof fetch,
        digestSha256: DIGEST,
        now: NOW,
      });
      const result = await uploader.upload({ rail: 'nip96', data: new ArrayBuffer(8) }, ctx());
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/quota exceeded/);
    });
  });

  describe('blossom rail', () => {
    it('signs a kind 24242 auth event, PUTs the bytes, and maps the descriptor', async () => {
      const signEvent = signer();
      const fetchFn = vi.fn(async () => blossomResponse());
      const uploader = createHttpUploader({
        rails: { blossom: { servers: ['https://blossom.test'] } },
        signEvent,
        fetch: fetchFn as unknown as typeof fetch,
        digestSha256: DIGEST,
        now: NOW,
      });

      const result = await uploader.upload({ rail: 'blossom', data: new ArrayBuffer(8), filename: 'x.pdf' }, ctx('up-2'));

      const authTmpl = (signEvent as ReturnType<typeof vi.fn>).mock.calls[0][0] as EventTemplate;
      expect(authTmpl.kind).toBe(24242);
      const tags = authTmpl.tags;
      expect(tags).toContainEqual(['t', 'upload']);
      expect(tags).toContainEqual(['x', SHA]);
      expect(tags.some((t) => t[0] === 'expiration')).toBe(true);

      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe('https://blossom.test/upload');
      expect(init.method).toBe('PUT');
      expect(String(init.headers.Authorization)).toMatch(/^Nostr /);

      expect(result).toMatchObject({
        ok: true,
        uploadId: 'up-2',
        status: 'complete',
        rail: 'blossom',
        url: 'https://blossom.test/abc.pdf',
        sha256: SHA,
        size: 8,
        mimeType: 'application/pdf',
      });
    });
  });

  describe('rail selection', () => {
    it('uses the configured default rail when the request omits one', async () => {
      const fetchFn = vi.fn(async () => blossomResponse());
      const uploader = createHttpUploader({
        rails: { blossom: { servers: ['https://blossom.test'] } },
        defaultRail: 'blossom',
        signEvent: signer(),
        fetch: fetchFn as unknown as typeof fetch,
        digestSha256: DIGEST,
        now: NOW,
      });
      const result = await uploader.upload({ data: new ArrayBuffer(8) }, ctx());
      expect(result.rail).toBe('blossom');
      expect(result.ok).toBe(true);
    });

    it('fails with "unsupported rail" for a rail it cannot serve', async () => {
      const fetchFn = vi.fn();
      const uploader = createHttpUploader({
        rails: { nip96: { servers: ['https://files.test/upload'] } },
        signEvent: signer(),
        fetch: fetchFn as unknown as typeof fetch,
        digestSha256: DIGEST,
        now: NOW,
      });
      const result = await uploader.upload({ rail: 'torrent', data: new ArrayBuffer(8) }, ctx());
      expect(result.ok).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/unsupported rail/);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('fails with "no server configured" when the rail has no servers', async () => {
      const uploader = createHttpUploader({
        rails: { nip96: { servers: [] } },
        signEvent: signer(),
        fetch: (vi.fn() as unknown) as typeof fetch,
        digestSha256: DIGEST,
        now: NOW,
      });
      const result = await uploader.upload({ rail: 'nip96', data: new ArrayBuffer(8) }, ctx());
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/no server configured/);
    });
  });
});
