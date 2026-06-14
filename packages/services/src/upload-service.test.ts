/**
 * upload-service.test.ts — NAP-UPLOAD envelope-router service.
 *
 * Exercises createUploadService against a mock Uploader: upload.upload result
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
      expect(reqArg).toBe(request);
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

    it('falls back to uploader.status() when the upload is not tracked', async () => {
      const tracked: UploadStatus = { ok: true, uploadId: 'remote-9', status: 'complete', rail: 'blossom', updatedAt: 5 };
      const uploader = mockUploader({ status: vi.fn(async () => tracked) });
      const svc = createUploadService({ uploader, generateId: ID, now: NOW });
      const c = collector();

      svc.handleMessage(WINDOW, { type: 'upload.status', id: 's2', uploadId: 'remote-9' } as NappletMessage, c.send);
      await Promise.resolve();
      const res = c.sent.find((m) => m.type === 'upload.status.result') as { status?: UploadStatus } | undefined;
      expect(uploader.status).toHaveBeenCalledWith('remote-9');
      expect(res?.status).toBe(tracked);
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
});
