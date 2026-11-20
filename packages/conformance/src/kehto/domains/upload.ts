import { createUploadService, type UploadRequest, type UploadResult, type UploaderContext } from '@kehto/services';
import { FIXTURE_USER_PUBKEY } from '../user.js';
import type { DomainBackendModule } from './types.js';

/** Blossom endpoint the plan names. Stored in memory: nothing connects to it. */
const BLOSSOM = 'https://blossom.conformance.invalid';

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** NAP-UPLOAD backend: the reference upload service over an in-memory Blossom store. */
export const UPLOAD_BACKEND: DomainBackendModule = {
  domain: 'upload',
  create() {
    const stored = new Map<string, { size: number; mimeType: string }>();
    let clock = 1_700_000_000_000;
    let sequence = 0;
    const store = async (request: UploadRequest, ctx: UploaderContext): Promise<UploadResult> => {
      const bytes = request.data instanceof ArrayBuffer ? request.data : await request.data.arrayBuffer();
      const hash = await sha256(bytes);
      const mimeType = request.mimeType ?? 'application/octet-stream';
      ctx.onStatus({ ok: true, uploadId: ctx.uploadId, status: 'uploading', rail: 'blossom', bytesSent: bytes.byteLength, bytesTotal: bytes.byteLength, updatedAt: clock });
      stored.set(hash, { size: bytes.byteLength, mimeType });
      const url = `${BLOSSOM}/${hash}`;
      return {
        ok: true, uploadId: ctx.uploadId, status: 'complete', rail: 'blossom', url, sha256: hash, size: bytes.byteLength, mimeType,
        nip94: [['url', url], ['m', mimeType], ['x', hash], ['size', String(bytes.byteLength)]],
      };
    };
    return {
      services: {
        upload: createUploadService({
          uploader: {
            planUpload: (request, ctx) => ({ rail: 'blossom', destination: `${BLOSSOM}/upload`, signingPubkey: FIXTURE_USER_PUBKEY, execute: () => store(request, ctx) }),
            upload: store,
          },
          uploadInfo: { rails: [{ rail: 'blossom', enabled: true, returns: ['https'] }], maxBytes: 1048576 },
          generateId: () => `upload-${++sequence}`,
          now: () => (clock += 1),
        }),
      },
      adapter: { upload: { getUploader: () => ({ rails: ['blossom'] }) } },
      controls: {
        /** Evidence: every stored blob by SHA-256. */
        'upload.stored': () => Object.fromEntries(stored),
      },
    };
  },
};
