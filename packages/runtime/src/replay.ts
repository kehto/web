/**
 * replay.ts — Replay detection module.
 *
 * Tracks seen event IDs and validates timestamps to prevent
 * duplicate event processing and replay attacks.
 */

import type { NostrEvent } from '@napplet/core';

/**
 * Replay detection window in seconds — events older than this are rejected.
 * Relocated inline from the former @napplet/core compatibility shim
 * (DRIFT-CORE-06, Phase 24). Numeric value preserved unchanged from the shim
 * to hold behavioral parity with the Phase 23 test baseline.
 */
const REPLAY_WINDOW_SECONDS = 30;

/**
 * Replay detection engine. Tracks seen event IDs and validates timestamps.
 *
 * @example
 * ```ts
 * const detector = createReplayDetector();
 * const reason = detector.check(event);
 * if (reason !== null) { // reject event }
 * ```
 */
export interface ReplayDetector {
  /**
   * Check if an event should be rejected as a replay.
   * Returns null if event is valid, or a string reason if it should be rejected.
   */
  check(event: NostrEvent): string | null;

  /** Clear all tracked event IDs. */
  clear(): void;
}

/**
 * Create a replay detector that rejects duplicate events and events
 * with timestamps outside the replay window.
 *
 * @param getReplayWindow - Optional getter for a dynamic replay window override.
 *   When provided, its return value is used instead of the module-level constant.
 *   Called on every check, so changes take effect immediately.
 * @returns A ReplayDetector instance
 *
 * @example
 * ```ts
 * import { createReplayDetector } from '@kehto/runtime';
 *
 * const detector = createReplayDetector();
 * const reason = detector.check(event);
 * if (reason !== null) {
 *   // Reject — duplicate, stale, or future-dated
 * }
 * ```
 */
export function createReplayDetector(getReplayWindow?: () => number | undefined): ReplayDetector {
  const seenEventIds = new Map<string, number>();

  return {
    check(event: NostrEvent): string | null {
      const replayWindow = getReplayWindow?.() ?? REPLAY_WINDOW_SECONDS;
      const now = Math.floor(Date.now() / 1000);
      if (now - event.created_at > replayWindow) return 'invalid: event created_at too old';
      if (event.created_at - now > 10) return 'invalid: event created_at in the future';
      if (seenEventIds.has(event.id)) return 'duplicate: already processed';
      seenEventIds.set(event.id, now);
      for (const [id, timestamp] of seenEventIds) {
        if (now - timestamp > replayWindow) seenEventIds.delete(id);
      }
      return null;
    },

    clear(): void {
      seenEventIds.clear();
    },
  };
}
