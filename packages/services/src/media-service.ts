/**
 * media-service.ts — NIP-5D media NUB reference service (stub-level).
 *
 * Handles 5 napplet -> shell request types from @napplet/nub-media:
 *   media.session.create (result), media.session.update, media.session.destroy,
 *   media.state, media.capabilities.
 *
 * Stub-level: no real MediaSession API integration. Host apps wire real
 * playback backends via runtime.registerService('media', realHandler).
 *
 * Note: this is SEPARATE from packages/services/src/audio-service.ts, which
 * is the legacy ifc-topic-based audio source registry (audio:* topic events
 * over ifc.emit). media-service is the canonical @napplet/nub-media NIP-5D
 * path and they coexist — audio-service continues to track audio sources for
 * shell UI, while media-service handles the NUB protocol envelope surface.
 *
 * Shell -> Napplet push types (media.command, media.controls) are handled
 * by the shell adapter separately — out of scope for this service.
 */

import type { NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor dropped from @napplet/core
// v0.2.0+ (napplet phase-81). Re-exported from @kehto/runtime (canonical home after Phase 24 DRIFT-01).
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type {
  MediaSessionCreateMessage,
  MediaSessionCreateResultMessage,
} from '@napplet/nub-media';

/** Media service version — follows semver. */
const MEDIA_SERVICE_VERSION = '1.0.0';

/**
 * Optional host callbacks for the stub media service.
 *
 * Host shells can hook session creation and state updates to drive
 * their own UI (e.g., now-playing banner) without replacing the
 * ServiceHandler wholesale.
 *
 * @example
 * ```ts
 * const media = createMediaService({
 *   onSessionCreate: (windowId, sessionId, metadata) => {
 *     console.log(`[${windowId}] created session ${sessionId}`, metadata);
 *   },
 *   onState: (windowId, sessionId, state) => {
 *     nowPlaying.update(windowId, state);
 *   },
 * });
 *
 * runtime.registerService('media', media);
 * ```
 */
export interface MediaServiceOptions {
  /** Called when a napplet creates a session. May inspect/record the session. */
  onSessionCreate?: (windowId: string, sessionId: string, metadata?: unknown) => void;
  /** Called on media.state updates — high-frequency; keep handler work minimal. */
  onState?: (windowId: string, sessionId: string, state: unknown) => void;
  /** Called when a napplet destroys a session. */
  onSessionDestroy?: (windowId: string, sessionId: string) => void;
  /** Called when a napplet updates session metadata. */
  onSessionUpdate?: (windowId: string, sessionId: string, metadata: unknown) => void;
  /** Called when a napplet declares capabilities for a session. */
  onCapabilities?: (windowId: string, sessionId: string, actions: unknown) => void;
}

/**
 * Create a stub-level media NUB service handler.
 *
 * Implements the 5 napplet->shell media.* request types defined in
 * `@napplet/nub-media`. Only `media.session.create` produces a reply
 * envelope (`media.session.create.result`) — the remaining four
 * (`session.update`, `session.destroy`, `state`, `capabilities`) are
 * fire-and-forget per the NUB spec.
 *
 * Unknown `media.*` actions produce a `<type>.error` envelope so
 * napplets are never left hanging on a malformed request.
 *
 * @param options - Optional host callbacks for session lifecycle + state
 * @returns A ServiceHandler to register with the runtime
 *
 * @example
 * ```ts
 * import { createMediaService } from '@kehto/services';
 *
 * const media = createMediaService();
 * runtime.registerService('media', media);
 * ```
 */
export function createMediaService(options: MediaServiceOptions = {}): ServiceHandler {
  const descriptor: ServiceDescriptor = {
    name: 'media',
    version: MEDIA_SERVICE_VERSION,
    description: 'NIP-5D media NUB reference handler (stub)',
  };

  return {
    descriptor,

    handleMessage(
      windowId: string,
      message: NappletMessage,
      send: (msg: NappletMessage) => void,
    ): void {
      switch (message.type) {
        case 'media.session.create': {
          const m = message as MediaSessionCreateMessage;
          options.onSessionCreate?.(windowId, m.sessionId, m.metadata);
          const result: MediaSessionCreateResultMessage = {
            type: 'media.session.create.result',
            id: m.id,
            sessionId: m.sessionId,
          };
          send(result as NappletMessage);
          return;
        }

        case 'media.session.update': {
          const m = message as NappletMessage & { sessionId?: string; metadata?: unknown };
          options.onSessionUpdate?.(windowId, m.sessionId ?? '', m.metadata);
          return; // fire-and-forget
        }

        case 'media.session.destroy': {
          const m = message as NappletMessage & { sessionId?: string };
          options.onSessionDestroy?.(windowId, m.sessionId ?? '');
          return; // fire-and-forget
        }

        case 'media.state': {
          const m = message as NappletMessage & { sessionId?: string };
          options.onState?.(windowId, m.sessionId ?? '', m);
          return; // fire-and-forget
        }

        case 'media.capabilities': {
          const m = message as NappletMessage & { sessionId?: string; actions?: unknown };
          options.onCapabilities?.(windowId, m.sessionId ?? '', m.actions);
          return; // fire-and-forget
        }

        default: {
          const id = (message as NappletMessage & { id?: string }).id ?? '';
          send({
            type: `${message.type}.error`,
            id,
            error: `Unknown media method: ${message.type}`,
          } as NappletMessage);
          return;
        }
      }
    },

    onWindowDestroyed(_windowId: string): void {
      // Stub service holds no per-window state; real implementations should
      // tear down sessions here.
    },
  };
}
