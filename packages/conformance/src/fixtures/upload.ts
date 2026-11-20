import type { DomainFixture } from './types.js';

const BYTES_GAP = 'The probe wire step sends JSON plan data only, so request.data cannot be a Blob or ArrayBuffer, and NAP-UPLOAD forbids requiring base64 payloads.';

/** NAP-UPLOAD at napplet/naps#33 (f5cc981e): advisory info; byte-carrying operations need a binary send step. */
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
  ],
  gaps: [
    { type: 'upload.upload', kind: 'harness', decision: BYTES_GAP },
    { type: 'upload.status', kind: 'harness', decision: `upload.status needs an uploadId from a completed upload.upload. ${BYTES_GAP}` },
  ],
};
