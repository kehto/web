import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import type { MockScheduler } from '../core/types.js';
import { placeholderSha256 } from './file-bytes.js';
import { DEFAULT_UPLOAD_RAILS, MOCK_BLURHASH, UPLOAD_MOCK_ENTRY, UPLOAD_SPEC_REF, createMockUploadService } from './upload.js';

const clock = { now: () => 1_767_225_600_000 };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const PNG_SHA = placeholderSha256(PNG);

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (message: NappletMessage) => { sent.push(message); } };
}

function completeStatus(uploadId: string) {
  return {
    ok: true,
    uploadId,
    status: 'complete',
    rail: 'blossom',
    url: `https://blossom.example.org/${PNG_SHA}.png`,
    fallbackUrls: [`https://cdn.example.net/${PNG_SHA}.png`],
    sha256: PNG_SHA,
    originalSha256: PNG_SHA,
    size: 7,
    mimeType: 'image/png',
    dimensions: { width: 1280, height: 720 },
    blurhash: MOCK_BLURHASH,
    nip94: [['url', `https://blossom.example.org/${PNG_SHA}.png`], ['m', 'image/png'], ['x', PNG_SHA], ['ox', PNG_SHA], ['size', '7'], ['dim', '1280x720']],
  };
}

describe('createMockUploadService', () => {
  it('records the spec ref, descriptor, and registry entry', () => {
    const service = createMockUploadService();
    expect(UPLOAD_SPEC_REF).toEqual({ nap: 'NAP-UPLOAD', status: 'draft', source: 'pr', pr: 33, sha: 'f5cc981e', path: 'naps/NAP-UPLOAD.md' });
    expect(service.descriptor).toMatchObject({ name: 'upload', version: '1.0.0' });
    expect(service.messageCapabilities).toBeUndefined();
    expect(service.mock.routes).toEqual(['upload.info', 'upload.upload', 'upload.status']);
    expect(UPLOAD_MOCK_ENTRY).toMatchObject({ domain: 'upload', kind: 'service', spec: UPLOAD_SPEC_REF });
  });

  it('answers upload.info with the advisory rails and caps', () => {
    const { sent, send } = sink();
    createMockUploadService({ mimeTypes: ['image/png'] }).handleMessage('w1', { type: 'upload.info', id: 'i1' } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'upload.info.result', id: 'i1', info: { rails: [...DEFAULT_UPLOAD_RAILS], maxBytes: 100 * 1024 * 1024, mimeTypes: ['image/png'] } }]);
  });

  it('completes an upload synchronously with NIP-94 metadata and an example.org blossom URL', () => {
    const service = createMockUploadService({ clock });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'upload.upload', id: 'u1', request: { data: PNG, filename: 'diagram.png', mimeType: 'image/png', caption: 'architecture diagram' } } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'upload.upload.result', id: 'u1', result: completeStatus('upload-1') }]);
    service.handleMessage('w1', { type: 'upload.status', id: 's1', uploadId: 'upload-1' } as NappletMessage, send);
    expect(sent[1]).toEqual({ type: 'upload.status.result', id: 's1', status: { ...completeStatus('upload-1'), bytesSent: 7, bytesTotal: 7, updatedAt: clock.now() } });
  });

  it('routes nip96 uploads to files.example.org and infers the mime from the filename', () => {
    const service = createMockUploadService({ clock });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'upload.upload', id: 'u1', request: { rail: 'nip96', data: new ArrayBuffer(4), filename: 'notes.pdf' } } as NappletMessage, send);
    const sha = placeholderSha256(new Uint8Array(4));
    expect(sent[0]).toMatchObject({ result: { ok: true, status: 'complete', rail: 'nip96', url: `https://files.example.org/${sha}.pdf`, mimeType: 'application/pdf', size: 4 } });
    expect((sent[0] as NappletMessage & { result: Record<string, unknown> }).result).not.toHaveProperty('dimensions');
    expect((sent[0] as NappletMessage & { result: Record<string, unknown> }).result).not.toHaveProperty('fallbackUrls');
  });

  it('returns top-level errors when no upload is created', () => {
    const { sent, send } = sink();
    const service = createMockUploadService({ maxBytes: 4, mimeTypes: ['image/png'] });
    service.handleMessage('w1', { type: 'upload.upload', id: 'e1' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'upload.upload', id: 'e2', request: { rail: 'torrent', data: PNG } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'upload.upload', id: 'e3', request: { data: PNG, mimeType: 'image/png' } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'upload.upload', id: 'e4', request: { data: PNG.subarray(0, 2), mimeType: 'text/plain' } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'upload.status', id: 'e5', uploadId: 'upload-9' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'upload.status', id: 'e6' } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'upload.upload.result', id: 'e1', error: 'invalid request' },
      { type: 'upload.upload.result', id: 'e2', error: 'unsupported rail' },
      { type: 'upload.upload.result', id: 'e3', error: 'file too large' },
      { type: 'upload.upload.result', id: 'e4', error: 'unsupported media type' },
      { type: 'upload.status.result', id: 'e5', error: 'unknown upload' },
      { type: 'upload.status.result', id: 'e6', error: 'invalid uploadId' },
    ]);
    expect(service.mock.state().uploads.size).toBe(0);
  });

  it('stages uploads and pushes upload.status.changed on advance()', () => {
    const service = createMockUploadService({ staged: true, clock });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'upload.upload', id: 'u1', request: { data: PNG, mimeType: 'image/png' } } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'upload.upload.result', id: 'u1', result: { ok: true, uploadId: 'upload-1', status: 'uploading', rail: 'blossom' } }]);
    expect(service.advance()).toBe(true);
    expect(sent[1]).toEqual({ type: 'upload.status.changed', status: { ok: true, uploadId: 'upload-1', status: 'uploading', rail: 'blossom', bytesSent: 3, bytesTotal: 7, updatedAt: clock.now() } });
    expect(service.advance('upload-1')).toBe(true);
    expect(sent[2]).toMatchObject({ type: 'upload.status.changed', status: { bytesSent: 5 } });
    expect(service.advance()).toBe(true);
    expect(sent[3]).toEqual({ type: 'upload.status.changed', status: { ...completeStatus('upload-1'), bytesSent: 7, bytesTotal: 7, updatedAt: clock.now() } });
    expect(service.advance()).toBe(false);
    service.handleMessage('w1', { type: 'upload.status', id: 's1', uploadId: 'upload-1' } as NappletMessage, send);
    expect(sent[4]).toMatchObject({ type: 'upload.status.result', id: 's1', status: { status: 'complete' } });
    service.handleMessage('w2', { type: 'upload.status', id: 's2', uploadId: 'upload-1' } as NappletMessage, send);
    expect(sent[5]).toEqual({ type: 'upload.status.result', id: 's2', error: 'unknown upload' });
  });

  it('fails an in-flight upload through failUpload()', () => {
    const service = createMockUploadService({ latencyMs: 0, staged: true, clock });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'upload.upload', id: 'u1', request: { data: PNG } } as NappletMessage, send);
    expect(service.failUpload('upload-1', 'server rejected')).toBe(true);
    expect(sent[1]).toEqual({ type: 'upload.status.changed', status: { ok: false, uploadId: 'upload-1', status: 'failed', rail: 'blossom', bytesSent: 0, bytesTotal: 7, error: 'server rejected', updatedAt: clock.now() } });
    expect(service.failUpload('upload-1')).toBe(false);
    expect(service.advance()).toBe(false);
  });

  it('auto-advances through the scheduler and cancels timers on reset and window destroy', () => {
    const queued: Array<() => void> = [];
    const scheduler: MockScheduler = { schedule: (_ms, fn) => { queued.push(fn); return () => { queued.splice(queued.indexOf(fn), 1); }; } };
    const service = createMockUploadService({ staged: true, autoAdvanceMs: 10, scheduler, clock, progressSteps: 2 });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'upload.upload', id: 'u1', request: { data: PNG } } as NappletMessage, send);
    expect(queued).toHaveLength(1);
    queued.shift()!();
    expect(sent[1]).toMatchObject({ type: 'upload.status.changed', status: { status: 'uploading', bytesSent: 4 } });
    expect(queued).toHaveLength(1);
    queued.shift()!();
    expect(sent[2]).toMatchObject({ type: 'upload.status.changed', status: { status: 'complete' } });
    expect(queued).toHaveLength(0);

    service.handleMessage('w2', { type: 'upload.upload', id: 'u2', request: { data: PNG } } as NappletMessage, send);
    expect(queued).toHaveLength(1);
    service.onWindowDestroyed?.('w2');
    expect(queued).toHaveLength(0);
    expect(service.mock.state().uploads.has('upload-2')).toBe(false);

    service.handleMessage('w1', { type: 'upload.upload', id: 'u3', request: { data: PNG } } as NappletMessage, send);
    service.mock.reset();
    expect(queued).toHaveLength(0);
    expect(service.mock.state()).toEqual({ uploads: new Map(), nextId: 1, timers: new Map() });
    expect(service.mock.sent).toEqual([]);
  });
});
