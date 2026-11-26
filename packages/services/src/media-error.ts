/**
 * Why a shell-owned session was not created, as `media.session.create.result.error`.
 *
 * NAP-MEDIA PR #10 @ 7806f438 (Error Handling) names `"unsupported source"`, `"source blocked"`
 * and `"autoplay denied"` for shell-owned sessions; `"source unavailable"` covers the rest.
 * Spec-gap decision: the result has only the `error` string, so a known cause follows the
 * category in parentheses, e.g. `source blocked (blocked-by-policy: denied:redirect-unverifiable)`.
 * Only typed causes are carried; any other backend error stays `"source unavailable"`, so a
 * backend's own message never reaches the napplet.
 */
import { ResourceServiceError, type ResourceErrorCode } from './resource-service.js';

/** The NAP-MEDIA creation error a playback failure belongs to. */
export type MediaCreateCategory = 'unsupported source' | 'source blocked' | 'source unavailable' | 'autoplay denied';

const MAX_DETAIL = 200;
const BLOCKED: ReadonlySet<string> = new Set<ResourceErrorCode>(['blocked-by-policy', 'unsupported-scheme', 'quota-exceeded']);

/** A playback failure whose category and detail are safe to return to the napplet. */
export class MediaPlaybackError extends Error {
  /**
   * @param category - The NAP-MEDIA creation error.
   * @param detail - Optional cause safe to show the napplet, such as a NAP-RESOURCE code.
   * @example
   * ```ts
   * throw new MediaPlaybackError('source unavailable', 'timeout');
   * ```
   */
  constructor(readonly category: MediaCreateCategory, readonly detail?: string) {
    const bounded = detail?.slice(0, MAX_DETAIL);
    super(bounded ? `${category} (${bounded})` : category);
    this.name = 'MediaPlaybackError';
  }
}

/**
 * Classify a NAP-RESOURCE failure of a media source.
 *
 * @param code - The NAP-RESOURCE error code.
 * @param message - The resource service's diagnostic, already safe for the napplet.
 * @returns The playback failure, blocked for policy codes and unavailable otherwise.
 * @example
 * ```ts
 * mediaResourceError('too-large', '').message; // "source unavailable (too-large)"
 * ```
 */
export function mediaResourceError(code: string, message?: string): MediaPlaybackError {
  const detail = message && message !== code ? `${code}: ${message}` : code;
  return new MediaPlaybackError(BLOCKED.has(code) ? 'source blocked' : 'source unavailable', detail);
}

/**
 * The `error` a failed shell-owned creation reports.
 *
 * @param error - What the playback backend rejected with.
 * @returns A NAP-MEDIA creation error, with its cause when the cause is typed.
 * @example
 * ```ts
 * mediaCreateError(new DOMException('blocked', 'NotAllowedError')); // "autoplay denied"
 * mediaCreateError(new Error('internal')); // "source unavailable"
 * ```
 */
export function mediaCreateError(error: unknown): string {
  if (error instanceof MediaPlaybackError) return error.message;
  if (error instanceof ResourceServiceError) return mediaResourceError(error.code, error.message).message;
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'NotAllowedError') return 'autoplay denied';
  if (name === 'NotSupportedError') return 'unsupported source';
  return 'source unavailable';
}
