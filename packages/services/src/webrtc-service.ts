/** Shell-mediated NAP-WEBRTC service. Raw SDP, ICE, and peer handles stay host-private. */
import type { NappletMessage, WebrtcEvent, WebrtcOpenRequest, WebrtcOpenResult } from '@napplet/core';
import type { WebrtcCloseMessage, WebrtcOpenMessage, WebrtcSendMessage } from '@napplet/nap/webrtc/types';
import type { ApprovalSignal, PermissionRequirement, ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';

const WEBRTC_SERVICE_VERSION = '1.0.0';

/** Side-effect-free host selection for an approved WebRTC open operation. */
export interface WebrtcOpenPlan {
  /** Nostr signaling relays selected before approval. */
  readonly signalingRelayUrls: readonly string[];
  /** Explicit ICE/TURN endpoints. Non-empty endpoints are rejected by current host policy. */
  readonly iceEndpoints: readonly string[];
  /** Host-private peer or room resource. */
  readonly resource: string;
}

/** Context passed to host-provided NAP-WEBRTC hooks. */
export interface WebrtcServiceContext {
  readonly windowId: string;
  /** Hosts must stop all peer/session work after this signal aborts. */
  readonly signal?: ApprovalSignal;
  emit(event: WebrtcEvent): void;
}

/** Options for {@link createWebrtcService}. */
export interface WebrtcServiceOptions {
  /** Select signaling and peer/room resources without creating a controller or peer. */
  planOpen?: (request: WebrtcOpenRequest, context: WebrtcServiceContext) => WebrtcOpenPlan;
  /** Host-owned peer setup, called only under the approved plan. */
  open?: (request: WebrtcOpenRequest, context: WebrtcServiceContext, plan: WebrtcOpenPlan) => WebrtcOpenResult | Promise<WebrtcOpenResult>;
  send?: (sessionId: string, payload: unknown, context: WebrtcServiceContext) => void | Promise<void>;
  close?: (sessionId: string, reason: string | undefined, context: WebrtcServiceContext) => void | Promise<void>;
  /** Physically stop peer and signaling work when authorization is revoked. */
  revokeWindow?: (windowId: string) => void;
  destroyWindow?: (windowId: string) => void;
}

type Send = (msg: NappletMessage) => void;
type SessionEntry = { readonly windowId: string; readonly generation: object };

const WEBRTC_DESCRIPTOR: ServiceDescriptor = {
  name: 'webrtc', version: WEBRTC_SERVICE_VERSION,
  description: 'NAP-WEBRTC reference handler for shell-mediated WebRTC sessions',
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;
}

function unsupported(resultType: string, id: string): NappletMessage {
  return { type: resultType, id, error: `${resultType.replace('.result', '')} unavailable` } as NappletMessage;
}

function validRequest(request: WebrtcOpenRequest): boolean {
  if (!request || typeof request !== 'object' || !request.scope || typeof request.scope !== 'object') return false;
  if (request.scope.type === 'direct') return typeof request.scope.pubkey === 'string' && request.scope.pubkey.length > 0;
  return request.scope.type === 'room' && typeof request.scope.room === 'string' && request.scope.room.length > 0
    && (request.scope.peers === undefined || (Array.isArray(request.scope.peers) && request.scope.peers.every((peer) => typeof peer === 'string' && peer.length > 0)));
}

function normalizePlan(candidate: WebrtcOpenPlan): { plan: WebrtcOpenPlan; requirements: PermissionRequirement[] } {
  if (!candidate || typeof candidate.resource !== 'string' || !candidate.resource
    || !Array.isArray(candidate.signalingRelayUrls) || !Array.isArray(candidate.iceEndpoints)) throw new Error('signaling unavailable');
  // Firewall origins intentionally cover HTTP(S)/WS(S), never stun:/turn:. Until
  // Firewall gains a typed ICE endpoint scope, configured ICE/TURN is rejected.
  if (candidate.iceEndpoints.some((endpoint) => typeof endpoint !== 'string' || endpoint.trim())) {
    throw new Error('configured ICE/TURN endpoints unsupported by host policy');
  }
  const relayUrls = [...new Set(candidate.signalingRelayUrls.map((url) => {
    if (typeof url !== 'string') throw new Error('signaling unavailable');
    const parsed = new URL(url);
    if ((parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') || !parsed.hostname) throw new Error('signaling unavailable');
    return url.trim();
  }))];
  const origins = [...new Set(relayUrls.map((url) => new URL(url).origin))];
  const plan: WebrtcOpenPlan = Object.freeze({
    signalingRelayUrls: Object.freeze(relayUrls), iceEndpoints: Object.freeze([]), resource: candidate.resource,
  });
  return { plan, requirements: [
    { category: 'interface', domain: 'webrtc', operation: 'access', scope: { kind: 'exact', value: 'webrtc' } },
    { category: 'resource', domain: 'webrtc', operation: 'webrtc.open', scope: { kind: 'exact', value: plan.resource } },
    ...origins.map((value) => ({ category: 'network' as const, domain: 'webrtc', operation: 'webrtc.open', scope: { kind: 'origin' as const, value } })),
  ] };
}

/**
 * Create the NAP-WEBRTC reference service.
 *
 * Open fails closed without an attached runtime approval coordinator and a
 * pure destination plan, so opaque host peer factories cannot hide endpoints.
 */
export function createWebrtcService(options: WebrtcServiceOptions = {}): ServiceHandler {
  let runtime: ServiceRuntimeContext | undefined;
  const generations = new Map<string, object>();
  const sessions = new Map<string, SessionEntry>();
  const generationFor = (windowId: string): object => {
    let generation = generations.get(windowId);
    if (!generation) { generation = {}; generations.set(windowId, generation); }
    return generation;
  };
  const current = (windowId: string, generation: object, signal?: ApprovalSignal): boolean =>
    generations.get(windowId) === generation && !signal?.aborted;
  const contextFor = (windowId: string, send: Send, generation: object, signal?: ApprovalSignal): WebrtcServiceContext => ({
    windowId, ...(signal ? { signal } : {}),
    emit(event) { if (current(windowId, generation, signal)) send({ type: 'webrtc.event', event } as NappletMessage); },
  });
  const retire = (windowId: string): void => {
    generations.set(windowId, {});
    for (const [id, entry] of sessions) if (entry.windowId === windowId) sessions.delete(id);
    options.revokeWindow?.(windowId);
  };

  function open(windowId: string, message: WebrtcOpenMessage, send: Send): void {
    const id = message.id ?? '';
    const generation = generationFor(windowId);
    const initialContext = contextFor(windowId, send, generation);
    if (!options.open) { send(unsupported('webrtc.open.result', id)); return; }
    if (!validRequest(message.request) || !options.planOpen || !runtime?.authorizeOperation) {
      send({ type: 'webrtc.open.result', id, error: 'webrtc approval unavailable' } as NappletMessage);
      return;
    }
    let approved: { plan: WebrtcOpenPlan; requirements: PermissionRequirement[] };
    try { approved = normalizePlan(options.planOpen(message.request, initialContext)); }
    catch (error) { send({ type: 'webrtc.open.result', id, error: errorMessage(error, 'signaling unavailable') } as NappletMessage); return; }
    void runtime.authorizeOperation(windowId, 'webrtc.open', approved.requirements, async (signal) => {
      if (!current(windowId, generation, signal)) throw new Error('policy denied');
      const result = await options.open!(message.request, contextFor(windowId, send, generation, signal), approved.plan);
      if (!current(windowId, generation, signal)) {
        await Promise.resolve(options.close?.(result.session.id, 'policy denied', contextFor(windowId, send, generation, signal))).catch(() => undefined);
        throw new Error('policy denied');
      }
      return result;
    }).then((outcome) => {
      if (!current(windowId, generation)) return;
      if (outcome.status !== 'executed' || !outcome.value) { send({ type: 'webrtc.open.result', id, error: 'policy denied' } as NappletMessage); return; }
      sessions.set(outcome.value.session.id, { windowId, generation });
      send({ type: 'webrtc.open.result', id, session: outcome.value.session } as NappletMessage);
    }).catch((error) => {
      if (current(windowId, generation)) send({ type: 'webrtc.open.result', id, error: errorMessage(error, 'webrtc request failed') } as NappletMessage);
    });
  }

  function sessionAction(windowId: string, message: WebrtcSendMessage | WebrtcCloseMessage, send: Send): void {
    const id = message.id ?? '';
    const closing = message.type === 'webrtc.close';
    const resultType = closing ? 'webrtc.close.result' : 'webrtc.send.result';
    const entry = sessions.get(message.sessionId);
    if (!entry || entry.windowId !== windowId || !current(windowId, entry.generation)) { send({ type: resultType, id, error: 'session not found' } as NappletMessage); return; }
    const context = contextFor(windowId, send, entry.generation);
    const hook = closing ? options.close : options.send;
    if (!hook) { send(unsupported(resultType, id)); return; }
    const call = closing
      ? options.close!(message.sessionId, (message as WebrtcCloseMessage).reason, context)
      : options.send!(message.sessionId, (message as WebrtcSendMessage).payload, context);
    void Promise.resolve(call).then(() => {
      if (!current(windowId, entry.generation)) return;
      if (closing) sessions.delete(message.sessionId);
      send({ type: resultType, id } as NappletMessage);
    }).catch((error) => {
      if (current(windowId, entry.generation)) send({ type: resultType, id, error: errorMessage(error, 'webrtc request failed') } as NappletMessage);
    });
  }

  return {
    descriptor: WEBRTC_DESCRIPTOR,
    onRegistered(context) { runtime = context; },
    onUnregistered() { for (const windowId of generations.keys()) retire(windowId); runtime = undefined; },
    onPermissionRevoked(windowId) { retire(windowId); },
    handleMessage(windowId, message, send) {
      if (message.type === 'webrtc.open') { open(windowId, message as WebrtcOpenMessage, send); return; }
      if (message.type === 'webrtc.send' || message.type === 'webrtc.close') { sessionAction(windowId, message as WebrtcSendMessage | WebrtcCloseMessage, send); return; }
      const id = (message as NappletMessage & { id?: string }).id ?? '';
      send({ type: `${message.type}.error`, id, error: `Unknown webrtc method: ${message.type}` } as NappletMessage);
    },
    onWindowDestroyed(windowId) { retire(windowId); options.destroyWindow?.(windowId); },
  };
}
