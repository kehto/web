import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createUploadService, type UploaderContext, type UploadResult, type UploadStatus } from './upload-service.js';

const payload = new Blob(['x'], { type: 'text/plain' });
// SHA-256 of the issue reproduction's single UTF-8 byte "x".
const hash = '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881';
const result: UploadResult = {
  ok: true, uploadId: 'backend', status: 'complete', rail: 'blossom',
  url: 'https://example.invalid/blob', sha256: hash,
  size: payload.size, mimeType: payload.type,
};
const progress: UploadStatus = { ...result, status: 'uploading', bytesSent: 0, bytesTotal: 1, updatedAt: 1 };
declare function setTimeout(callback: () => void, delay: number): unknown;
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup(generateId?: () => string) {
  let sequence = 0;
  let requestSequence = 0;
  const jobs: Array<{ context: UploaderContext; resolve: (value: UploadResult) => void; reject: (error: Error) => void }> = [];
  const cancelled: string[] = [];
  const sent: Array<{ windowId: string; message: NappletMessage }> = [];
  const service = createUploadService({
    generateId: generateId ?? (() => `upload-${++sequence}`),
    uploader: {
      upload(_request, context) {
        return new Promise((resolve, reject) => jobs.push({ context, resolve, reject }));
      },
      cancel(id) {
        cancelled.push(id);
        // Cancellation can synchronously invoke progress before settling later.
        jobs.find(({ context }) => context.uploadId === id)?.context.onStatus(progress);
        if (id === 'upload-1') throw new Error('backend cancellation failed');
      },
    },
  });
  function upload(windowId: string) {
    service.handleMessage(windowId, {
      type: 'upload.upload', id: `request-${++requestSequence}`, request: { data: payload, mimeType: payload.type },
    } as NappletMessage, (message) => sent.push({ windowId, message }));
  }
  return { service, jobs, cancelled, sent, upload };
}

describe('upload requester lifetime', () => {
  it('cancels exact owners and preserves colon-bearing windows despite cancellation errors (#293)', async () => {
    const { service, jobs, cancelled, sent, upload } = setup();
    upload('a'); upload('a'); upload('a:b');
    await flush();
    expect(() => service.onWindowDestroyed?.('a')).not.toThrow();
    expect(cancelled).toEqual(['upload-1', 'upload-2']);
    expect(sent).toEqual([]);
    jobs[2]!.context.onStatus(progress);
    jobs[2]!.resolve(result);
    await flush();
    expect(sent.map(({ windowId }) => windowId)).toEqual(['a:b', 'a:b']);
    service.onWindowDestroyed?.('a');
    expect(cancelled).toHaveLength(2);
    service.onWindowDestroyed?.('a:b');
    expect(cancelled).toEqual(['upload-1', 'upload-2', 'upload-3']);
  });

  it.each(['resolve', 'reject'] as const)('suppresses late progress and %s after teardown and ID reuse (#292)', async (settlement) => {
    const { service, jobs, sent, upload } = setup(() => 'one-upload');
    upload('first');
    await flush();
    service.onWindowDestroyed?.('first');
    upload('first');
    await flush();
    jobs[0]!.context.onStatus(progress);
    if (settlement === 'resolve') jobs[0]!.resolve(result);
    else jobs[0]!.reject(new Error('late rejection'));
    await flush();
    expect(sent).toEqual([]);
    jobs[1]!.context.onStatus(progress);
    jobs[1]!.resolve(result);
    await flush();
    expect(sent.map(({ message }) => message.type)).toEqual(['upload.status.changed', 'upload.upload.result']);
    service.handleMessage('first', { type: 'upload.status', id: 'lookup', uploadId: 'one-upload' } as NappletMessage,
      (message) => sent.push({ windowId: 'first', message }));
    expect(sent.at(-1)?.message).toMatchObject({ status: { status: 'complete', uploadId: 'one-upload' } });
  });

  it('invalidates all requesters before late settlement after service removal', async () => {
    const { service, jobs, cancelled, sent, upload } = setup();
    upload('a'); upload('a:b');
    await flush();
    service.onUnregistered?.();
    expect(cancelled).toEqual(['upload-1', 'upload-2']);
    for (const job of jobs) { job.context.onStatus(progress); job.resolve(result); }
    await flush();
    expect(sent).toEqual([]);
  });

  it('suppresses pending upload.info replies after window replacement', async () => {
    const type = 'upload.info';
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const sent: NappletMessage[] = [];
    const service = createUploadService({
      uploader: { upload: async () => result, status: async () => { await pending; return progress; } },
      uploadInfo: async () => { await pending; return { rails: [] }; },
    });
    service.handleMessage('a', { type, id: 'old', uploadId: 'remote' } as NappletMessage, (message) => sent.push(message));
    service.onWindowDestroyed?.('a');
    service.handleMessage('a', { type, id: 'new', uploadId: 'remote' } as NappletMessage, (message) => sent.push(message));
    finish();
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ id: 'new' });
  });

  it('rejects unowned status lookups without consulting the backend', () => {
    // Firewall ownership supersedes the old asynchronous backend fallback: an
    // unknown ID must never disclose another window's upload or prompt for it.
    const status = vi.fn(async () => progress);
    const service = createUploadService({ uploader: { upload: async () => result, status } });
    const sent: NappletMessage[] = [];
    service.handleMessage('a', { type: 'upload.status', id: 'lookup', uploadId: 'remote' } as NappletMessage,
      (message) => sent.push(message));
    expect(status).not.toHaveBeenCalled();
    expect(sent).toEqual([{ type: 'upload.status.result', id: 'lookup', error: 'unknown upload' }]);
  });
});
