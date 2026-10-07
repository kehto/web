/** Error codes for every napplet resolution failure path. */
export type NappletResolutionErrorCode =
  | 'invalid-signature'
  | 'invalid-manifest'
  | 'aggregate-mismatch'
  | 'blob-hash-mismatch'
  | 'blob-unavailable'
  | 'missing-index';

/**
 * Thrown on any napplet resolution/verification failure. The `code` field
 * identifies which guard rejected, so callers can fail closed without parsing
 * the message.
 */
export class NappletResolutionError extends Error {
  readonly code: NappletResolutionErrorCode;
  constructor(code: NappletResolutionErrorCode, message: string) {
    super(message);
    this.name = 'NappletResolutionError';
    this.code = code;
  }
}

