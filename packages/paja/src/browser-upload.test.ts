import { describe, expect, it, vi } from 'vitest';
import type { EventTemplate, NostrEvent, NostrFilter } from '@napplet/core';
import type { Signer } from '@kehto/runtime';

import { createPajaUploadRuntime } from './browser-upload.js';
import { normalizePajaSimulation } from './simulation.js';

const PUBKEY = 'a'.repeat(64);

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function signedEvent(template: EventTemplate, pubkey = PUBKEY): NostrEvent {
  return {
    ...template,
    id: 'b'.repeat(64),
    pubkey,
    sig: 'c'.repeat(128),
  };
}

function signer(pubkey = PUBKEY): Signer {
  return {
    getPublicKey: vi.fn(async () => pubkey),
    signEvent: vi.fn(async (template: EventTemplate) => signedEvent(template, pubkey)),
  };
}

function context(uploadId = 'upload-1') {
  return { uploadId, windowId: 'window-1', onStatus: vi.fn() };
}

function blossomEvent(pubkey: string, createdAt: number, servers: string[]): NostrEvent {
  return {
    id: `${createdAt}`.padStart(64, '0'),
    pubkey,
    sig: 'd'.repeat(128),
    kind: 10_063,
    created_at: createdAt,
    content: '',
    tags: servers.map((server) => ['server', server]),
  };
}

describe('createPajaUploadRuntime', () => {
  it('uploads disclosed bytes to the first explicit shell-owned Blossom server', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const sha256 = await sha256Hex(bytes);
    const activeSigner = signer();
    const confirmRequest = vi.fn(() => true);
    const queryDiscovery = vi.fn(async () => []);
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        url: `https://blossom.example/${sha256}`,
        sha256,
        size: bytes.byteLength,
        type: 'application/octet-stream',
      }),
    }) as Response);
    const runtime = createPajaUploadRuntime({
      getSimulation: () => normalizePajaSimulation({
        upload: { mode: 'blossom', servers: ['https://blossom.example'] },
      }),
      getSigner: () => activeSigner,
      getProviderPubkey: () => PUBKEY,
      queryDiscovery,
      getRelayUrls: () => ['wss://relay.example'],
      confirmRequest,
      getNappletIdentity: () => ({ dTag: 'demo', aggregateHash: 'hash' }),
      fetch: fetchFn as unknown as typeof fetch,
    });

    await runtime.refreshIdentity();
    const result = await runtime.uploader.upload({
      rail: 'blossom',
      data: bytes.buffer,
      filename: 'sample.bin',
      mimeType: 'application/octet-stream',
    }, context());

    expect(queryDiscovery).not.toHaveBeenCalled();
    expect(confirmRequest).toHaveBeenCalledWith({
      action: 'upload',
      windowId: 'window-1',
      napplet: { dTag: 'demo', aggregateHash: 'hash' },
      filename: 'sample.bin',
      size: 4,
      mimeType: 'application/octet-stream',
      server: 'https://blossom.example',
      warning: 'This upload is public and durable.',
    });
    expect(fetchFn).toHaveBeenCalledWith('https://blossom.example/upload', expect.objectContaining({
      method: 'PUT',
      body: bytes.buffer,
    }));
    expect(result).toMatchObject({
      ok: true,
      status: 'complete',
      rail: 'blossom',
      url: `https://blossom.example/${sha256}`,
      sha256,
      size: 4,
    });
  });

  it('warms the newest ordered BUD-03 server list without discovery from info or upload', async () => {
    const activeSigner = signer();
    const queryDiscovery = vi.fn(async () => [
      blossomEvent(PUBKEY, 10, ['https://old.example']),
      blossomEvent(PUBKEY, 20, ['https://two.example/', 'http://localhost:3000', 'https://two.example']),
    ]);
    const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const bytes = new Uint8Array(init?.body as ArrayBuffer);
      const sha256 = await sha256Hex(bytes);
      return {
        ok: true,
        status: 200,
        json: async () => ({ url: `https://two.example/${sha256}`, sha256, size: bytes.byteLength }),
      } as Response;
    });
    const runtime = createPajaUploadRuntime({
      getSimulation: () => normalizePajaSimulation({ upload: { mode: 'blossom' } }),
      getSigner: () => activeSigner,
      getProviderPubkey: () => PUBKEY,
      queryDiscovery,
      getRelayUrls: () => ['wss://relay.example'],
      confirmRequest: () => true,
      getNappletIdentity: () => ({ dTag: 'demo', aggregateHash: 'hash' }),
      fetch: fetchFn as unknown as typeof fetch,
    });

    await runtime.refreshIdentity();
    expect(queryDiscovery).toHaveBeenCalledTimes(1);
    expect(runtime.uploadInfo()).toEqual({
      rails: [{ rail: 'blossom', enabled: true, returns: ['https'] }],
    });
    await runtime.uploader.upload({ data: new Uint8Array([5]).buffer }, context('discovered'));

    expect(queryDiscovery).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('https://two.example/upload', expect.anything());
  });

  it.each(['nip07', 'nip46'])('fails closed when a %s provider disagrees with its signer', async () => {
    const activeSigner = signer('b'.repeat(64));
    const queryDiscovery = vi.fn(async () => []);
    const confirmRequest = vi.fn(() => true);
    const fetchFn = vi.fn();
    const runtime = createPajaUploadRuntime({
      getSimulation: () => normalizePajaSimulation({
        identity: { mode: 'fixed', pubkey: PUBKEY },
        upload: { mode: 'blossom', servers: ['https://blossom.example'] },
      }),
      getSigner: () => activeSigner,
      getProviderPubkey: () => PUBKEY,
      queryDiscovery,
      getRelayUrls: () => ['wss://relay.example'],
      confirmRequest,
      getNappletIdentity: () => ({ dTag: 'demo', aggregateHash: 'hash' }),
      fetch: fetchFn as unknown as typeof fetch,
    });

    await runtime.refreshIdentity();
    const result = await runtime.uploader.upload({ data: new ArrayBuffer(1) }, context());

    expect(result).toMatchObject({ ok: false, error: 'no signer available' });
    expect(queryDiscovery).not.toHaveBeenCalled();
    expect(confirmRequest).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fails before signer access when configured and provider pubkeys disagree', async () => {
    const activeSigner = signer();
    const queryDiscovery = vi.fn(async () => []);
    const confirmRequest = vi.fn(() => true);
    const fetchFn = vi.fn();
    const runtime = createPajaUploadRuntime({
      getSimulation: () => normalizePajaSimulation({
        identity: { mode: 'fixed', pubkey: PUBKEY },
        upload: { mode: 'blossom', servers: ['https://blossom.example'] },
      }),
      getSigner: () => activeSigner,
      getProviderPubkey: () => 'b'.repeat(64),
      queryDiscovery,
      getRelayUrls: () => ['wss://relay.example'],
      confirmRequest,
      getNappletIdentity: () => ({ dTag: 'demo', aggregateHash: 'hash' }),
      fetch: fetchFn as unknown as typeof fetch,
    });

    await runtime.refreshIdentity();
    await expect(runtime.uploader.upload({ data: new ArrayBuffer(1) }, context()))
      .resolves.toMatchObject({ ok: false, error: 'no signer available' });
    expect(activeSigner.getPublicKey).not.toHaveBeenCalled();
    expect(queryDiscovery).not.toHaveBeenCalled();
    expect(confirmRequest).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('invalidates identity and discovery snapshots when the signer changes', async () => {
    let pubkey = PUBKEY;
    let activeSigner = signer(pubkey);
    let listener: (() => void) | undefined;
    const queryDiscovery = vi.fn(async (_relayUrls: string[], _filters: NostrFilter[]) => [
      blossomEvent(pubkey, 20, [`https://${pubkey[0]}.example`]),
    ]);
    const runtime = createPajaUploadRuntime({
      getSimulation: () => normalizePajaSimulation({ upload: { mode: 'blossom' } }),
      getSigner: () => activeSigner,
      getProviderPubkey: () => pubkey,
      queryDiscovery,
      getRelayUrls: () => ['wss://relay.example'],
      confirmRequest: () => true,
      getNappletIdentity: () => ({ dTag: 'demo', aggregateHash: 'hash' }),
      subscribeSignerChange: (next) => {
        listener = next;
        return () => { listener = undefined; };
      },
    });
    await runtime.refreshIdentity();
    expect(runtime.uploadInfo().rails[0]).toEqual({ rail: 'blossom', enabled: true, returns: ['https'] });

    pubkey = 'b'.repeat(64);
    activeSigner = signer(pubkey);
    listener?.();

    await vi.waitFor(() => expect(queryDiscovery).toHaveBeenCalledTimes(2));
    expect(queryDiscovery.mock.calls[1]?.[1]).toEqual([{ kinds: [10_063], authors: [pubkey], limit: 1 }]);
    expect(runtime.uploadInfo().rails[0]).toEqual({ rail: 'blossom', enabled: true, returns: ['https'] });
  });

  it('rejects a signed authorization whose pubkey changes after consent', async () => {
    const activeSigner = signer();
    activeSigner.signEvent = vi.fn(async (template: EventTemplate) => signedEvent(template, 'b'.repeat(64)));
    const fetchFn = vi.fn();
    const runtime = createPajaUploadRuntime({
      getSimulation: () => normalizePajaSimulation({
        upload: { mode: 'blossom', servers: ['https://blossom.example'] },
      }),
      getSigner: () => activeSigner,
      getProviderPubkey: () => PUBKEY,
      queryDiscovery: vi.fn(async () => []),
      getRelayUrls: () => [],
      confirmRequest: () => true,
      getNappletIdentity: () => ({ dTag: 'demo', aggregateHash: 'hash' }),
      fetch: fetchFn as unknown as typeof fetch,
    });

    await runtime.refreshIdentity();
    const result = await runtime.uploader.upload({ data: new ArrayBuffer(1) }, context());

    expect(result).toMatchObject({ ok: false, status: 'failed', error: 'signer identity mismatch' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('keeps a fixed pubkey read-only when no signer can authorize the upload', async () => {
    const confirmRequest = vi.fn(() => true);
    const fetchFn = vi.fn();
    const runtime = createPajaUploadRuntime({
      getSimulation: () => normalizePajaSimulation({
        identity: { mode: 'fixed', pubkey: PUBKEY },
        upload: { mode: 'blossom', servers: ['https://blossom.example'] },
      }),
      getSigner: () => null,
      getProviderPubkey: () => null,
      queryDiscovery: vi.fn(async () => []),
      getRelayUrls: () => [],
      confirmRequest,
      getNappletIdentity: () => ({ dTag: 'demo', aggregateHash: 'hash' }),
      fetch: fetchFn as unknown as typeof fetch,
    });

    await runtime.refreshIdentity();
    expect(runtime.uploadInfo().rails[0]).toEqual({ rail: 'blossom', enabled: false });
    await expect(runtime.uploader.upload({ data: new ArrayBuffer(1) }, context()))
      .resolves.toMatchObject({ ok: false, error: 'no signer available' });
    expect(confirmRequest).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ['unsupported rail', { rail: 'nip96', data: new ArrayBuffer(1) }, 'unsupported rail'],
    ['oversize bytes', { data: new ArrayBuffer(3) }, 'file too large'],
    ['disallowed MIME', { data: new ArrayBuffer(1), mimeType: 'text/plain' }, 'unsupported media type'],
  ])('applies %s policy before consent, signing, or storage egress', async (_case, request, error) => {
    const activeSigner = signer();
    const confirmRequest = vi.fn(() => true);
    const fetchFn = vi.fn();
    const runtime = createPajaUploadRuntime({
      getSimulation: () => normalizePajaSimulation({
        upload: {
          mode: 'blossom',
          servers: ['https://blossom.example'],
          maxBytes: 2,
          mimeTypes: ['image/png'],
        },
      }),
      getSigner: () => activeSigner,
      getProviderPubkey: () => PUBKEY,
      queryDiscovery: vi.fn(async () => []),
      getRelayUrls: () => [],
      confirmRequest,
      getNappletIdentity: () => ({ dTag: 'demo', aggregateHash: 'hash' }),
      fetch: fetchFn as unknown as typeof fetch,
    });
    await runtime.refreshIdentity();
    vi.mocked(activeSigner.signEvent!).mockClear();

    const result = await runtime.uploader.upload(request, context());

    expect(result).toMatchObject({ ok: false, error });
    expect(confirmRequest).not.toHaveBeenCalled();
    expect(activeSigner.signEvent).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('cancels before authorization or storage when upload disclosure is denied', async () => {
    const activeSigner = signer();
    const fetchFn = vi.fn();
    const runtime = createPajaUploadRuntime({
      getSimulation: () => normalizePajaSimulation({
        upload: { mode: 'blossom', servers: ['http://localhost:3000'] },
      }),
      getSigner: () => activeSigner,
      getProviderPubkey: () => PUBKEY,
      queryDiscovery: vi.fn(async () => []),
      getRelayUrls: () => [],
      confirmRequest: () => false,
      getNappletIdentity: () => ({ dTag: 'demo', aggregateHash: 'hash' }),
      fetch: fetchFn as unknown as typeof fetch,
    });
    await runtime.refreshIdentity();
    vi.mocked(activeSigner.signEvent!).mockClear();

    expect(runtime.uploadInfo().rails[0]).toEqual({ rail: 'blossom', enabled: true, returns: ['http'] });
    await expect(runtime.uploader.upload({ data: new ArrayBuffer(1) }, context()))
      .resolves.toMatchObject({ ok: false, status: 'cancelled', error: 'user cancelled' });
    expect(activeSigner.signEvent).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
