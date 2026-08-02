import type {
  WebrtcEvent,
  WebrtcOpenRequest,
  WebrtcOpenResult,
} from '@napplet/core';

const DEV_WEBRTC_PEER = '6'.repeat(64);

function destroyWindowSessions<T extends { windowId: string }>(
  sessions: Map<string, T>,
  windowId: string,
): void {
  for (const [sessionId, session] of sessions) {
    if (session.windowId === windowId) sessions.delete(sessionId);
  }
}

/** Create a deterministic development WebRTC controller. */
export function createDevWebrtcController() {
  const sessions = new Map<string, { windowId: string; payloads: unknown[] }>();
  let nextSession = 1;
  const getSession = (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('webrtc session not found');
    return session;
  };

  return {
    open(request: WebrtcOpenRequest, context: { windowId: string; emit(event: WebrtcEvent): void }): WebrtcOpenResult {
      const id = `paja-webrtc-${nextSession++}`;
      const channel = request.channel ?? 'default';
      sessions.set(id, { windowId: context.windowId, payloads: [] });
      context.emit({ type: 'state', sessionId: id, state: 'open' });
      context.emit({ type: 'peer', sessionId: id, pubkey: DEV_WEBRTC_PEER, state: 'joined' });
      return {
        session: {
          id,
          scope: request.scope,
          channel,
          ...(request.protocol ? { protocol: request.protocol } : {}),
          state: 'open',
        },
      };
    },
    send(sessionId: string, payload: unknown, context: { emit(event: WebrtcEvent): void }): void {
      getSession(sessionId).payloads.push(payload);
      context.emit({ type: 'message', sessionId, from: DEV_WEBRTC_PEER, payload });
    },
    close(sessionId: string, reason: string | undefined, context: { emit(event: WebrtcEvent): void }): void {
      getSession(sessionId);
      sessions.delete(sessionId);
      context.emit({ type: 'closed', sessionId, ...(reason ? { reason } : {}) });
    },
    destroyWindow(windowId: string): void {
      destroyWindowSessions(sessions, windowId);
    },
  };
}
