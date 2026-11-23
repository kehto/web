import { createMediaService, type HostMediaBridge, type MediaPlaybackBackend } from '@kehto/services';
import type { DomainBackendModule } from './types.js';

interface SessionPayload { sessionId?: string; reason?: string; action?: 'play' | 'pause' }

/** OS media surface stub: records nothing, touches no `navigator.mediaSession` and no DOM. */
const HOST_BRIDGE: HostMediaBridge = {
  setMetadata() {},
  setPlaybackState() {},
  onAction: () => () => {},
  setActiveSession() {},
  destroySession() {},
};

/** Shell-owned playback stub: no element, no network; commands move the reported state. */
const PLAYBACK: MediaPlaybackBackend = {
  async open(_windowId, _options, _signal, changed) {
    const actions = ['play', 'pause'] as const;
    return {
      state: { status: 'paused', position: 0 },
      actions,
      command(command) {
        if (command.action === 'play' || command.action === 'pause') changed({ status: command.action === 'play' ? 'playing' : 'paused', reason: 'user' }, actions);
      },
      destroy() {},
    };
  },
};

/**
 * NAP-MEDIA backend: the reference media service with a stub OS bridge and a
 * stub shell-owned player. Controls act as the shell's own media UI.
 */
export const MEDIA_BACKEND: DomainBackendModule = {
  domain: 'media',
  create() {
    const media = createMediaService({ hostBridge: HOST_BRIDGE, playback: PLAYBACK });
    /** The session the payload names, else the newest one: the canonical id may differ from the fixture's hint. */
    const sessionFor = (payload: SessionPayload): string | undefined => {
      const sessions = media.getSessions();
      return sessions.find((session) => session.sessionId === payload.sessionId)?.sessionId ?? sessions.at(-1)?.sessionId;
    };
    return {
      services: { media },
      controls: {
        'media.retire': (payload) => {
          const sessionId = sessionFor(payload as SessionPayload);
          if (sessionId) media.retire(sessionId, (payload as SessionPayload).reason ?? 'policy');
        },
        'media.command': (payload) => {
          const { sessionId = '', action = 'pause' } = payload as SessionPayload;
          // Always the named id: once that session is retired the shell must stay silent, so never fall back to another session.
          media.command(sessionId, { action });
        },
        'media.sessions': () => media.getSessions(),
      },
      dispose() { media.destroy(); },
    };
  },
};
