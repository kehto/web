import type { DomainFixture } from './types.js';

const BYTES = [...new TextEncoder().encode('kehto conformance upload')];
const HEX64 = /^[0-9a-f]{64}$/;

/** NAP-UPLOAD at napplet/naps#33 (f5cc981e): advisory info, a structured-clone Blob upload, and status by uploadId. */
export const UPLOAD_FIXTURE: DomainFixture = {
  domain: 'upload',
  cases: [
    {
      id: 'upload/info', type: 'upload.info',
      semantics: {
        rule: 'upload.info.result carries UploadInfo: a rails list of { rail, enabled }',
        verify: (reply) => {
          const rails = (reply?.info as { rails?: unknown } | undefined)?.rails;
          const valid = Array.isArray(rails) && rails.every((rail) => typeof rail?.rail === 'string' && typeof rail?.enabled === 'boolean');
          return valid ? null : `info was ${JSON.stringify(reply?.info)}`;
        },
      },
    },
    {
      id: 'upload/upload', type: 'upload.upload',
      payload: { request: { data: { $blob: { bytes: BYTES, type: 'text/plain' } }, filename: 'conformance.txt' } },
      semantics: {
        rule: '"request.data is a Blob ... by structured clone"; the result reports the integrity sha256 and, when complete, a url',
        verify: (reply) => {
          const result = reply?.result as { ok?: unknown; uploadId?: unknown; status?: unknown; sha256?: unknown; url?: unknown } | undefined;
          if (result?.ok !== true || typeof result.uploadId !== 'string') return `result was ${JSON.stringify(result)}`;
          if (result.status === 'complete' && (typeof result.url !== 'string' || typeof result.sha256 !== 'string' || !HEX64.test(result.sha256))) return `a complete result lacks url or sha256: ${JSON.stringify(result)}`;
          return null;
        },
      },
    },
    {
      id: 'upload/status', type: 'upload.status', fill: { uploadId: { case: 'upload/upload', path: ['result', 'uploadId'] } },
      semantics: {
        rule: 'upload.status for a known uploadId returns its current status',
        verify: (reply) => (typeof (reply?.status as { status?: unknown } | undefined)?.status === 'string' ? null : `status was ${JSON.stringify(reply?.status)}`),
      },
    },
  ],
};
