import { createWebrtcService, type WebrtcServiceContext } from '@kehto/services';
import { createSessionTable } from './sessions.js';
import type { DomainBackendModule } from './types.js';

type WebrtcEvent = Parameters<WebrtcServiceContext['emit']>[0];
type OpenRequest = { scope: { type: string; pubkey?: string; room?: string }; channel?: string; protocol?: string; ordered?: boolean; maxRetransmits?: number };

/** Pubkey the simulated signaling authenticates for every room peer. */
export const WEBRTC_ROOM_PEER = 'c'.repeat(64);

function peerOf(request: OpenRequest): string {
  return request.scope.type === 'direct' && request.scope.pubkey ? request.scope.pubkey : WEBRTC_ROOM_PEER;
}

/**
 * NAP-WEBRTC backend: the reference WebRTC service over a simulated peer link.
 *
 * Open plans name no relay or ICE endpoint, so approval covers only the
 * `webrtc` interface and the session resource. Sessions open immediately with
 * the lowest free `sess-<n>` id and the requested delivery semantics.
 * `webrtc.peerMessage` makes the authenticated peer of every session ever
 * opened send a payload, as a late data-channel message racing a close would:
 * the shell "MUST NOT deliver messages for an unknown sessionId".
 */
export const WEBRTC_BACKEND: DomainBackendModule = {
  domain: 'webrtc',
  create() {
    const sessions = createSessionTable<WebrtcEvent>('sess');
    const peers = new Map<string, string>();
    const sent: { sessionId: string; payload: unknown }[] = [];
    const service = createWebrtcService({
      planOpen: () => ({ signalingRelayUrls: [], iceEndpoints: [], resource: 'webrtc:conformance' }),
      open(rawRequest, context) {
        const request = rawRequest as OpenRequest;
        const id = sessions.open(context.windowId, (event) => context.emit(event));
        peers.set(id, peerOf(request));
        return {
          session: {
            id, scope: rawRequest.scope, channel: request.channel ?? 'default', state: 'open',
            ...(request.protocol !== undefined ? { protocol: request.protocol } : {}),
            ordered: request.ordered ?? true,
            ...(request.maxRetransmits !== undefined ? { maxRetransmits: request.maxRetransmits } : {}),
            maxPayloadBytes: 16384,
          },
        };
      },
      send(sessionId, payload) { sent.push({ sessionId, payload: structuredClone(payload) }); },
      close(sessionId) { sessions.close(sessionId); },
      destroyWindow(windowId) { sessions.dropWindow(windowId); },
    });
    return {
      services: { webrtc: service },
      adapter: { webrtc: { isAvailable: () => true } },
      controls: {
        'webrtc.peerMessage': (payload) => {
          const body = (payload as { payload?: unknown } | undefined)?.payload ?? { body: 'hi' };
          for (const session of sessions.everOpened()) {
            session.emit({ type: 'message', sessionId: session.id, from: peers.get(session.id) ?? WEBRTC_ROOM_PEER, payload: structuredClone(body) });
          }
        },
        'webrtc.sent': () => sent.map((item) => ({ ...item })),
      },
    };
  },
};
