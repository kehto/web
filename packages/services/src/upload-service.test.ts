/**
 * upload-service.test.ts — NAP-UPLOAD envelope-router service.
 *
 * Exercises createUploadService against a mock Uploader: upload.info result,
 * upload.upload result
 * marshalling + uploadId stamping, progress (upload.status.changed) streaming,
 * upload.status tracking + lookup, missing-data rejection, uploader-rejection
 * handling, and window-teardown cleanup (cancel).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createUploadService } from './upload-service.js';
import type {
  Uploader,
  UploaderContext,
  UploadRequest,
  UploadResult,
  UploadStatus,
} from './upload-service.js';
import type { NappletMessage } from '@napplet/core';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';

const WINDOW = 'win-1';

function bytes(n = 8): ArrayBuffer {
  return new ArrayBuffer(n);
}

function baseResult(overrides: Partial<UploadResult> = {}): UploadResult {
  return {
    ok: true,
    uploadId: 'will-be-overwritten',
    status: 'complete',
    rail: 'nip96',
    url: 'https://files.test/abc.png',
    sha256: 'a'.repeat(64),
    size: 8,
    mimeType: 'image/png',
    ...overrides,
  };
}

interface MockUploader extends Uploader {
  lastCtx: UploaderContext | null;
  cancel: (uploadId: string) => void;
}

function mockUploader(overrides: Partial<Uploader> = {}): MockUploader {
  const cancel = vi.fn((_uploadId: string): void => {});
  const u: MockUploader = {
    lastCtx: null,
    cancel,
    upload: vi.fn(async (_req: UploadRequest, ctx: UploaderContext): Promise<UploadResult> => {
      u.lastCtx = ctx;
      return baseResult();
    }),
    ...overrides,
  };
  return u;
}

function collector() {
  const sent: NappletMessage[] = [];
  return { sent, send: (m: NappletMessage) => { sent.push(m); } };
}

const ID = () => 'upload-1';
const NOW = () => 1_000;

describe('createUploadService', () => {
  it('throws when uploader is missing', () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => createUploadService({})).toThrow(/uploader is required/);
  });

  it('exposes the upload descriptor', () => {
    const svc = createUploadService({ uploader: mockUploader() });
    expect(svc.descriptor.name).toBe('upload');
  });

  describe('upload.info', () => {
    it('returns advisory upload rails and coarse limits', async () => {
      const uploader = mockUploader();
      const svc = createUploadService({
        uploader,
        uploadInfo: {
          rails: [
            { rail: 'nip96', enabled: true, returns: ['https'] },
            { rail: 'blossom', enabled: false, returns: ['https', 'blossom'] },
          ],
          maxBytes: 1024,
          mimeTypes: ['image/png', 'application/pdf'],
        },
      });
      const c = collector();

      svc.handleMessage(WINDOW, { type: 'upload.info', id: 'info-1' } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();

      expect(uploader.upload).not.toHaveBeenCalled();
      expect(c.sent).toEqual([
        {
          type: 'upload.info.result',
          id: 'info-1',
          info: {
            rails: [
              { rail: 'nip96', enabled: true, returns: ['https'] },
              { rail: 'blossom', enabled: false, returns: ['https', 'blossom'] },
            ],
            maxBytes: 1024,
            mimeTypes: ['image/png', 'application/pdf'],
          },
        },
      ]);
    });

    it('maps upload info provider failures to upload.info.result error', async () => {
      const svc = createUploadService({
        uploader: mockUploader(),
        uploadInfo: () => {
          throw new Error('policy unavailable');
        },
      });
      const c = collector();

      svc.handleMessage(WINDOW, { type: 'upload.info', id: 'info-fail' } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(c.sent).toEqual([
        {
          type: 'upload.info.result',
          id: 'info-fail',
          error: 'policy unavailable',
        },
      ]);
    });
  });

  describe('upload.upload', () => {
    let uploader: MockUploader;
    let svc: ReturnType<typeof createUploadService>;
    let c: ReturnType<typeof collector>;

    beforeEach(() => {
      uploader = mockUploader();
      svc = createUploadService({ uploader, generateId: ID, now: NOW });
      c = collector();
    });

    it('calls the uploader with the request and a context carrying uploadId + windowId', async () => {
      const request: UploadRequest = { rail: 'nip96', data: bytes(), filename: 'x.png' };
      svc.handleMessage(WINDOW, { type: 'upload.upload', id: 'u1', request } as NappletMessage, c.send);
      await Promise.resolve();
      expect(uploader.upload).toHaveBeenCalledTimes(1);
      const [reqArg, ctxArg] = (uploader.upload as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(reqArg).toMatchObject({ rail: 'nip96', filename: 'x.png' });
      expect(reqArg.data).toBeInstanceOf(Blob);
      expect(reqArg.data).not.toBe(request.data);
      expect(Array.from(new Uint8Array(await reqArg.data.arrayBuffer()))).toEqual(Array.from(new Uint8Array(request.data as ArrayBuffer)));
      expect(ctxArg.uploadId).toBe('upload-1');
      expect(ctxArg.windowId).toBe(WINDOW);
    });

    it('returns upload.upload.result with the result, stamping the service uploadId', async () => {
      svc.handleMessage(WINDOW, { type: 'upload.upload', id: 'u1', request: { data: bytes() } } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();
      expect(c.sent).toHaveLength(1);
      expect(c.sent[0]).toMatchObject({
        type: 'upload.upload.result',
        id: 'u1',
        result: { ok: true, uploadId: 'upload-1', status: 'complete', url: 'https://files.test/abc.png' },
      });
    });

    it('rejects a request with no data via a top-level error (no upload created)', async () => {
      svc.handleMessage(WINDOW, { type: 'upload.upload', id: 'u2', request: { filename: 'x' } } as unknown as NappletMessage, c.send);
      await Promise.resolve();
      expect(uploader.upload).not.toHaveBeenCalled();
      expect(c.sent).toHaveLength(1);
      expect(c.sent[0]).toMatchObject({ type: 'upload.upload.result', id: 'u2', error: expect.any(String) });
      expect((c.sent[0] as { result?: unknown }).result).toBeUndefined();
    });

    it('maps an uploader rejection to a top-level error result', async () => {
      uploader.upload = vi.fn(async () => { throw new Error('server rejected'); });
      svc.handleMessage(WINDOW, { type: 'upload.upload', id: 'u3', request: { data: bytes() } } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();
      expect(c.sent).toHaveLength(1);
      expect(c.sent[0]).toMatchObject({ type: 'upload.upload.result', id: 'u3', error: 'server rejected' });
    });

    it('streams uploader progress as upload.status.changed with stamped uploadId + updatedAt', async () => {
      uploader.upload = vi.fn(async (_req, ctx) => {
        ctx.onStatus({ ok: true, uploadId: 'ignored', status: 'uploading', rail: 'nip96', bytesSent: 4, bytesTotal: 8, updatedAt: 0 });
        return baseResult();
      });
      svc.handleMessage(WINDOW, { type: 'upload.upload', id: 'u4', request: { data: bytes() } } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();
      const changed = c.sent.find((m) => m.type === 'upload.status.changed') as { status?: UploadStatus } | undefined;
      expect(changed).toBeDefined();
      expect(changed?.status).toMatchObject({ uploadId: 'upload-1', status: 'uploading', bytesSent: 4, updatedAt: 1000 });
    });
  });

  describe('upload.status', () => {
    it('returns the latest tracked status for a known upload', async () => {
      const uploader = mockUploader();
      const svc = createUploadService({ uploader, generateId: ID, now: NOW });
      const c = collector();

      svc.handleMessage(WINDOW, { type: 'upload.upload', id: 'u1', request: { data: bytes() } } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();

      svc.handleMessage(WINDOW, { type: 'upload.status', id: 's1', uploadId: 'upload-1' } as NappletMessage, c.send);
      const res = c.sent.find((m) => m.type === 'upload.status.result') as { status?: UploadStatus } | undefined;
      expect(res).toBeDefined();
      expect(res?.status).toMatchObject({ uploadId: 'upload-1', status: 'complete', updatedAt: 1000 });
    });

    it('never asks a backend for an upload that this window does not own', async () => {
      const tracked: UploadStatus = { ok: true, uploadId: 'remote-9', status: 'complete', rail: 'blossom', updatedAt: 5 };
      const uploader = mockUploader({ status: vi.fn(async () => tracked) });
      const svc = createUploadService({ uploader, generateId: ID, now: NOW });
      const c = collector();

      svc.handleMessage(WINDOW, { type: 'upload.status', id: 's2', uploadId: 'remote-9' } as NappletMessage, c.send);
      await Promise.resolve();
      const res = c.sent.find((m) => m.type === 'upload.status.result') as { status?: UploadStatus } | undefined;
      expect(uploader.status).not.toHaveBeenCalled();
      expect(res).toMatchObject({ error: 'unknown upload' });
    });

    it('errors when an unknown upload cannot be resolved', async () => {
      const uploader = mockUploader();
      const svc = createUploadService({ uploader, generateId: ID, now: NOW });
      const c = collector();
      svc.handleMessage(WINDOW, { type: 'upload.status', id: 's3', uploadId: 'nope' } as NappletMessage, c.send);
      await Promise.resolve();
      expect(c.sent[0]).toMatchObject({ type: 'upload.status.result', id: 's3', error: expect.any(String) });
    });
  });

  describe('lifecycle', () => {
    it('cancels in-flight uploads and clears tracking on window teardown', async () => {
      const uploader = mockUploader();
      const svc = createUploadService({ uploader, generateId: ID, now: NOW });
      const c = collector();

      svc.handleMessage(WINDOW, { type: 'upload.upload', id: 'u1', request: { data: bytes() } } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();

      svc.onWindowDestroyed?.(WINDOW);
      expect(uploader.cancel).toHaveBeenCalledWith('upload-1');

      // After teardown the status is no longer tracked.
      const c2 = collector();
      svc.handleMessage(WINDOW, { type: 'upload.status', id: 's1', uploadId: 'upload-1' } as NappletMessage, c2.send);
      await Promise.resolve();
      expect(c2.sent[0]).toMatchObject({ type: 'upload.status.result', id: 's1', error: expect.any(String) });
    });

    it('ignores unknown upload.* actions (forward-compatible)', () => {
      const uploader = mockUploader();
      const svc = createUploadService({ uploader, generateId: ID, now: NOW });
      const c = collector();
      svc.handleMessage(WINDOW, { type: 'upload.frobnicate', id: 'x' } as NappletMessage, c.send);
      expect(c.sent).toHaveLength(0);
    });
  });

  describe('runtime approval boundary', () => {
    it('does not repeat an upload for a replayed request ID or disclose another window status', async () => {
      const uploader = mockUploader();
      const svc = createUploadService({ uploader, generateId: ID });
      const owner = collector();
      const other = collector();
      const message = { type: 'upload.upload', id: 'same', request: { data: bytes() } } as NappletMessage;
      svc.handleMessage(WINDOW, message, owner.send);
      await vi.waitFor(() => expect(owner.sent).toContainEqual(expect.objectContaining({ type: 'upload.upload.result', id: 'same' })));
      svc.handleMessage(WINDOW, message, owner.send);
      expect(uploader.upload).toHaveBeenCalledTimes(1);
      expect(owner.sent).toContainEqual(expect.objectContaining({ type: 'upload.upload.result', id: 'same', error: 'duplicate request id' }));
      svc.handleMessage('other-window', { type: 'upload.status', id: 'lookup', uploadId: 'upload-1' } as NappletMessage, other.send);
      expect(other.sent).toContainEqual(expect.objectContaining({ type: 'upload.status.result', id: 'lookup', error: 'unknown upload' }));
    });

    it('warns once when the retained host-only upload path is actually used', async () => {
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        let next = 0;
        const svc = createUploadService({ uploader: mockUploader(), generateId: () => `upload-${++next}` });
        const c = collector();
        for (const id of ['legacy-1', 'legacy-2']) {
          svc.handleMessage(WINDOW, { type: 'upload.upload', id, request: { data: bytes() } } as NappletMessage, c.send);
        }
        await vi.waitFor(() => expect(c.sent.filter((message) => message.type === 'upload.upload.result')).toHaveLength(2));
        expect(warning).toHaveBeenCalledTimes(1);
        expect(warning.mock.calls[0]?.[0]).toMatch(/FW-UPLOAD-LEGACY-001.*planUpload.*permissions.*once per service instance/);
        expect(warning.mock.calls[0]?.[0]).not.toContain('legacy-1');
      } finally { warning.mockRestore(); }
    });

    it('binds detached bytes and selected destination before executing exactly once', async () => {
      const original = new Uint8Array([1, 2, 3]);
      const execute = vi.fn(async (_signal: ApprovalSignal): Promise<UploadResult> => baseResult({ size: 3 }));
      const planUpload = vi.fn((_request: UploadRequest) => ({
        rail: 'nip96' as const,
        destination: 'https://files.test/upload',
        signingPubkey: 'a'.repeat(64),
        execute,
      }));
      let approve!: () => void;
      const gate = new Promise<void>((resolve) => { approve = resolve; });
      const authorizeOperation = vi.fn(async (_windowId, _operation, _requirements, run: (signal: ApprovalSignal) => Promise<UploadResult>) => {
        await gate;
        return { status: 'executed' as const, value: await run(new AbortController().signal) };
      });
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const uploader = mockUploader({ planUpload });
        const svc = createUploadService({ uploader, generateId: ID });
        svc.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
        const c = collector();
        svc.handleMessage(WINDOW, { type: 'upload.upload', id: 'approved', request: {
          data: original.buffer, filename: 'photo.png', mimeType: 'image/png',
        } } as NappletMessage, c.send);
        original[0] = 9;
        await vi.waitFor(() => expect(authorizeOperation).toHaveBeenCalledTimes(1));
        expect(execute).not.toHaveBeenCalled();
        expect(uploader.upload).not.toHaveBeenCalled();
        expect(authorizeOperation.mock.calls[0]?.slice(0, 2)).toEqual([WINDOW, 'upload.upload']);
        expect(authorizeOperation.mock.calls[0]?.[2]).toMatchObject([
          { category: 'resource', domain: 'upload', operation: 'upload.upload', scope: { kind: 'exact' } },
          { category: 'network', domain: 'upload', operation: 'upload.upload', scope: { kind: 'origin', value: 'https://files.test' } },
        ]);
        const snapshot = planUpload.mock.calls[0]?.[0];
        expect(snapshot).toBeDefined();
        expect(snapshot!.data).toBeInstanceOf(Blob);
        expect(Array.from(new Uint8Array(await (snapshot!.data as Blob).arrayBuffer()))).toEqual([1, 2, 3]);
        approve();
        await vi.waitFor(() => expect(c.sent).toEqual([expect.objectContaining({
          type: 'upload.upload.result', id: 'approved', result: expect.objectContaining({ ok: true }),
        })]));
        expect(execute).toHaveBeenCalledTimes(1);
        expect(warning).not.toHaveBeenCalled();
      } finally { warning.mockRestore(); }
    });

    it('denies an unavailable approval without signing, egress, or a legacy fallback', async () => {
      const execute = vi.fn(async () => baseResult());
      const uploader = mockUploader({ planUpload: vi.fn(() => ({
        rail: 'nip96', destination: 'https://files.test/upload', signingPubkey: 'a'.repeat(64), execute,
      })) });
      const authorizeOperation = vi.fn(async () => ({ status: 'denied' as const }));
      const svc = createUploadService({ uploader, generateId: ID });
      svc.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
      const c = collector();
      svc.handleMessage(WINDOW, { type: 'upload.upload', id: 'denied', request: { data: bytes() } } as NappletMessage, c.send);
      await vi.waitFor(() => expect(c.sent).toContainEqual(expect.objectContaining({
        type: 'upload.upload.result', id: 'denied', error: 'policy denied',
      })));
      expect(execute).not.toHaveBeenCalled();
      expect(uploader.upload).not.toHaveBeenCalled();
    });

    it('fails closed when a prepared signer has no host-attested identity', async () => {
      const execute = vi.fn(async () => baseResult());
      const uploader = mockUploader({ planUpload: vi.fn(() => ({
        rail: 'nip96', destination: 'https://files.test/upload', execute,
      })) });
      const authorizeOperation = vi.fn();
      const svc = createUploadService({ uploader, generateId: ID });
      svc.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
      const c = collector();
      svc.handleMessage(WINDOW, { type: 'upload.upload', id: 'no-identity', request: { data: bytes() } } as NappletMessage, c.send);
      await vi.waitFor(() => expect(c.sent).toContainEqual(expect.objectContaining({
        type: 'upload.upload.result', id: 'no-identity', error: 'upload signing identity unavailable',
      })));
      expect(authorizeOperation).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    });

    it('aborts a pending approval and suppresses late progress and result after revocation', async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      let progress!: UploaderContext['onStatus'];
      const uploader = mockUploader({ planUpload: vi.fn((_request, ctx) => {
        progress = ctx.onStatus;
        return { rail: 'nip96', destination: 'https://files.test/upload', signingPubkey: 'a'.repeat(64), execute: vi.fn(async () => baseResult()) };
      }) });
      const authorizeOperation = vi.fn(async () => { await gate; return { status: 'denied' as const }; });
      const svc = createUploadService({ uploader, generateId: ID });
      svc.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
      const c = collector();
      svc.handleMessage(WINDOW, { type: 'upload.upload', id: 'retired', request: { data: bytes() } } as NappletMessage, c.send);
      await vi.waitFor(() => expect(authorizeOperation).toHaveBeenCalledTimes(1));
      svc.onPermissionRevoked?.(WINDOW);
      progress({ ok: true, uploadId: 'upload-1', status: 'uploading', rail: 'nip96', updatedAt: 1 });
      release();
      await Promise.resolve();
      expect(c.sent).toEqual([]);
      expect(uploader.cancel).toHaveBeenCalledWith('upload-1');
    });
  });
});
