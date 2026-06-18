/**
 * audio-service.ts — Audio source registry as a ServiceHandler.
 *
 * Tracks which napplet windows are producing audio. Shell hosts wire this
 * into the runtime via registerService('audio', createAudioService(opts)).
 * Browser-agnostic — no DOM, no window, no postMessage.
 */

import type { NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor dropped from @napplet/core
// v0.2.0+ (napplet phase-81). Re-exported from @kehto/runtime (canonical home after Phase 24 DRIFT-01).
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type { AudioSource, AudioServiceOptions } from './types.js';

/** Audio service version — follows semver. */
const AUDIO_SERVICE_VERSION = '1.0.0';

/**
 * Create an audio service handler.
 *
 * The audio service is a state registry that tracks active audio sources
 * per napplet window. Napplets announce audio state via `audio:*` topic
 * events; the service tracks sources and can relay mute commands back.
 *
 * @param options - Optional configuration (onChange callback for UI updates)
 * @returns A ServiceHandler to register with the runtime
 *
 * @example
 * ```ts
 * import { createAudioService } from '@kehto/services';
 *
 * const audio = createAudioService({
 *   onChange: (sources) => {
 *     // Update UI with current audio sources
 *     for (const [windowId, source] of sources) {
 *       console.log(`${source.title} (${source.muted ? 'muted' : 'playing'})`);
 *     }
 *   },
 * });
 *
 * runtime.registerService('audio', audio);
 * ```
 */
export function createAudioService(options?: AudioServiceOptions): ServiceHandler {
  const sources = new Map<string, AudioSource>();
  const onChange = options?.onChange;

  function notify(): void {
    onChange?.(new Map(sources));
  }

  const descriptor: ServiceDescriptor = {
    name: 'audio',
    version: AUDIO_SERVICE_VERSION,
    description: 'Audio source registry — tracks active audio sources per napplet window',
  };

  return {
    descriptor,

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      if (message.type !== 'inc.emit') return;
      const incMessage = message as NappletMessage & { topic?: unknown; payload?: unknown };
      const topic = typeof incMessage.topic === 'string' ? incMessage.topic : undefined;
      if (!topic?.startsWith('audio:')) return;

      const action = topic.slice(6); // 'audio:'.length === 6
      const payload = incMessage.payload && typeof incMessage.payload === 'object'
        ? incMessage.payload as Record<string, unknown>
        : {};

      switch (action) {
        case 'register': {
          const nappletClass = typeof payload.nappletClass === 'string' ? payload.nappletClass : '';
          const title = typeof payload.title === 'string' ? payload.title : '';
          sources.set(windowId, { windowId, nappletClass, title, muted: false });
          notify();
          break;
        }

        case 'unregister': {
          if (sources.delete(windowId)) {
            notify();
          }
          break;
        }

        case 'state-changed': {
          const source = sources.get(windowId);
          if (!source) return;
          if (typeof payload.title === 'string') {
            source.title = payload.title;
          }
          notify();
          break;
        }

        case 'mute': {
          const targetWindowId = typeof payload.windowId === 'string'
            ? payload.windowId
            : windowId;
          const muted = payload.muted === true;

          const source = sources.get(targetWindowId);
          if (source) {
            source.muted = muted;
            notify();
          }

          send({ type: 'inc.event', topic: 'napplet:audio-muted', payload: { muted } } as NappletMessage);
          break;
        }

        default:
          // Unknown audio action — ignore
          break;
      }
    },

    onWindowDestroyed(windowId: string): void {
      if (sources.delete(windowId)) {
        notify();
      }
    },
  };
}
