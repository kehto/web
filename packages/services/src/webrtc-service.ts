/** Shell-mediated NAP-WEBRTC service. Raw SDP, ICE, and peer handles stay host-private. */
import type { NappletMessage, WebrtcEvent, WebrtcOpenRequest, WebrtcOpenResult } from '@napplet/core';
import type { WebrtcCloseMessage, WebrtcOpenMessage, WebrtcSendMessage } from '@napplet/nap/webrtc/types';
import { createUnrecognizedTypeDiagnostic } from '@kehto/runtime';
import type { ApprovalSignal, PermissionRequirement, ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';

const WEBRTC_SERVICE_VERSION = '1.0.0';
/** `closed` reason when policy revokes a window's WebRTC sessions; the `@kehto/mocks` mock uses the same text. */
const REVOKED_REASON = 'policy denied';

/** Side-effect-free host selection for an approved WebRTC open operation. */
export interface WebrtcOpenPlan {
  /** Nostr signaling relays selected before approval. */
  readonly signalingRelayUrls: readonly string[];
  /** Explicit ICE/TURN endpoints, approved individually as typed network scopes before peer creation. */
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
/** A live session: its owner, the window lifetime that opened it, and where its events go. */
type SessionEntry = { readonly windowId: string; readonly generation: object; readonly send: Send };
/** One pending open: early `state` events pass, and a backend `closed` is held for after the result. */
type Opening = { active: boolean; closed?: WebrtcEvent };

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
  if (candidate.iceEndpoints.some(endpoint => typeof endpoint !== 'string' || !endpoint)) throw new Error('Invalid ICE endpoint');
  const iceEndpoints = [...new Set(candidate.iceEndpoints)];
  const relayUrls = [...new Set(candidate.signalingRelayUrls.map((url) => {
    if (typeof url !== 'string') throw new Error('signaling unavailable');
    const parsed = new URL(url);
    if ((parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') || !parsed.hostname) throw new Error('signaling unavailable');
    return url.trim();
  }))];
  const origins = [...new Set(relayUrls.map((url) => new URL(url).origin))];
  const plan: WebrtcOpenPlan = Object.freeze({
    signalingRelayUrls: Object.freeze(relayUrls), iceEndpoints: Object.freeze(iceEndpoints), resource: candidate.resource,
  });
  return { plan, requirements: [
    { category: 'interface', domain: 'webrtc', operation: 'access', scope: { kind: 'exact', value: 'webrtc' } },
    { category: 'resource', domain: 'webrtc', operation: 'webrtc.open', scope: { kind: 'exact', value: plan.resource } },
    ...origins.map((value) => ({ category: 'network' as const, domain: 'webrtc', operation: 'webrtc.open', scope: { kind: 'origin' as const, value } })),
    ...iceEndpoints.map(value => ({ category: 'network' as const, domain: 'webrtc', operation: 'webrtc.open', scope: { kind: 'ice' as const, value } })),
  ] };
}

/**
 * Create the NAP-WEBRTC reference service.
 *
 * Open fails closed without an attached runtime approval coordinator and a
 * pure destination plan, so opaque host peer factories cannot hide endpoints.
 */
export function createWebrtcService(options: WebrtcServiceOptions = {}): ServiceHandler {
  const ignoreUnrecognized = createUnrecognizedTypeDiagnostic();
  let runtime: ServiceRuntimeContext | undefined;
  const generations = new Map<string, object>();
  const sessions = new Map<string, SessionEntry>();
  /** Napplet closes in flight, and whether the backend reported `closed` meanwhile. */
  const closingSessions = new Map<string, { endedByBackend: boolean }>();
  /** Window lifetimes ended by revocation: the window lives on, so its pending requests still get a result. */
  const revokedGenerations = new WeakSet<object>();
  const generationFor = (windowId: string): object => {
    let generation = generations.get(windowId);
    if (!generation) { generation = {}; generations.set(windowId, generation); }
    return generation;
  };
  const current = (windowId: string, generation: object, signal?: ApprovalSignal): boolean =>
    generations.get(windowId) === generation && !signal?.aborted;
  // NAP-WEBRTC #59 @ fb4dd6f0, Shell Behavior: "The shell MUST respond to every
  // request with a result message carrying the same id." A revoked window is
  // still live, so requests it sent before revocation are still answered; a
  // destroyed window's are not.
  const answerable = (windowId: string, generation: object): boolean =>
    current(windowId, generation) || revokedGenerations.has(generation);
  // NAP-WEBRTC #59 @ fb4dd6f0: the shell "may deliver webrtc.event state
  // updates before open() resolves ... but it MUST NOT deliver messages for an
  // unknown sessionId". A session is known from its open result until close
  // starts, the backend emits `closed` for it, revocation or destroy;
  // `opening` admits only those early states.
  const known = (sessionId: unknown, windowId: string, generation: object): boolean => {
    const entry = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;
    return entry?.windowId === windowId && entry.generation === generation;
  };
  const deliver = (event: WebrtcEvent, windowId: string, generation: object, send: Send, opening?: Opening): void => {
    const sessionId = (event as { sessionId?: unknown } | undefined)?.sessionId;
    if (typeof sessionId !== 'string') return;
    if (known(sessionId, windowId, generation)) {
      send({ type: 'webrtc.event', event } as NappletMessage);
      // Once `closed` is out the session is unknown, so nothing after it is delivered.
      if (event.type === 'closed') sessions.delete(sessionId);
      return;
    }
    if (event.type === 'closed') {
      const pending = closingSessions.get(sessionId);
      if (pending) pending.endedByBackend = true;
      else if (opening?.active) opening.closed = event;
      return;
    }
    if (opening?.active && event.type === 'state' && !sessions.has(sessionId)) send({ type: 'webrtc.event', event } as NappletMessage);
  };
  const contextFor = (windowId: string, send: Send, generation: object, signal?: ApprovalSignal, opening?: Opening): WebrtcServiceContext => ({
    windowId, ...(signal ? { signal } : {}),
    emit(event) {
      if (current(windowId, generation, signal)) deliver(event, windowId, generation, send, opening);
    },
  });
  /** End a window lifetime. Teardown events the backend emits after this are dropped. */
  const retire = (windowId: string): void => {
    generations.set(windowId, {});
    for (const [id, entry] of sessions) if (entry.windowId === windowId) sessions.delete(id);
  };
  // NAP-WEBRTC #59 @ fb4dd6f0, Error Handling: "The shell SHOULD send a
  // webrtc.event with type: "closed" when an established session ends because
  // ... policy revokes the capability." Each live session gets one `closed`,
  // then is forgotten like any other closed session. `closed` is a shell
  // session event, not a peer message, so "enforce per-napplet policy before
  // ... delivering peer messages" does not hold it back.
  const revoke = (windowId: string): void => {
    const generation = generations.get(windowId);
    if (generation) revokedGenerations.add(generation);
    for (const [sessionId, entry] of sessions) {
      if (entry.windowId !== windowId) continue;
      sessions.delete(sessionId);
      entry.send({ type: 'webrtc.event', event: { type: 'closed', sessionId, reason: REVOKED_REASON } } as NappletMessage);
    }
    retire(windowId);
    options.revokeWindow?.(windowId);
  };

  function open(windowId: string, message: WebrtcOpenMessage, send: Send): void {
    const id = message.id ?? '';
    const generation = generationFor(windowId);
    const opening: Opening = { active: true };
    const initialContext = contextFor(windowId, send, generation, undefined, opening);
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
      const result = await options.open!(message.request, contextFor(windowId, send, generation, signal, opening), approved.plan);
      if (!current(windowId, generation, signal)) {
        await Promise.resolve(options.close?.(result.session.id, 'policy denied', contextFor(windowId, send, generation, signal))).catch(() => undefined);
        throw new Error('policy denied');
      }
      return result;
    }).then((outcome) => {
      opening.active = false;
      if (!current(windowId, generation)) {
        if (revokedGenerations.has(generation)) send({ type: 'webrtc.open.result', id, error: 'policy denied' } as NappletMessage);
        return;
      }
      if (outcome.status !== 'executed' || !outcome.value) { send({ type: 'webrtc.open.result', id, error: 'policy denied' } as NappletMessage); return; }
      send({ type: 'webrtc.open.result', id, session: outcome.value.session } as NappletMessage);
      // A session the backend already ended while opening is reported closed
      // right after its result, and never kept.
      if (opening.closed?.sessionId === outcome.value.session.id) { send({ type: 'webrtc.event', event: opening.closed } as NappletMessage); return; }
      sessions.set(outcome.value.session.id, { windowId, generation, send });
    }).catch((error) => {
      opening.active = false;
      if (current(windowId, generation)) send({ type: 'webrtc.open.result', id, error: errorMessage(error, 'webrtc request failed') } as NappletMessage);
      else if (revokedGenerations.has(generation)) send({ type: 'webrtc.open.result', id, error: 'policy denied' } as NappletMessage);
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
    const call = () => closing
      ? options.close!(message.sessionId, (message as WebrtcCloseMessage).reason, context)
      : options.send!(message.sessionId, (message as WebrtcSendMessage).payload, context);
    // A closing session leaves delivery before transport teardown starts, so
    // teardown notifications and late peer events for it are dropped.
    const pending = { endedByBackend: false };
    if (closing) { sessions.delete(message.sessionId); closingSessions.set(message.sessionId, pending); }
    const settled = () => { if (closingSessions.get(message.sessionId) === pending) closingSessions.delete(message.sessionId); };
    void Promise.resolve().then(call).then(() => {
      settled();
      if (answerable(windowId, entry.generation)) send({ type: resultType, id } as NappletMessage);
    }).catch((error) => {
      settled();
      if (!answerable(windowId, entry.generation)) return;
      if (!current(windowId, entry.generation)) { send({ type: resultType, id, error: errorMessage(error, 'webrtc request failed') } as NappletMessage); return; }
      // A failed close leaves the session open, so it stays deliverable,
      // unless the backend reported it closed in the meantime.
      if (closing && !pending.endedByBackend && !sessions.has(message.sessionId)) sessions.set(message.sessionId, entry);
      send({ type: resultType, id, error: errorMessage(error, 'webrtc request failed') } as NappletMessage);
    });
  }

  return {
    descriptor: WEBRTC_DESCRIPTOR,
    onRegistered(context) { runtime = context; },
    onUnregistered() { for (const windowId of generations.keys()) { retire(windowId); options.revokeWindow?.(windowId); } runtime = undefined; },
    onPermissionRevoked(windowId) { revoke(windowId); },
    // An ACL block (`null`) revokes everything; no ACL capability maps to webrtc.
    onCapabilityRevoked(windowId, capability) { if (capability === null) revoke(windowId); },
    handleMessage(windowId, message, send) {
      if (message.type === 'webrtc.open') { open(windowId, message as WebrtcOpenMessage, send); return; }
      if (message.type === 'webrtc.send' || message.type === 'webrtc.close') { sessionAction(windowId, message as WebrtcSendMessage | WebrtcCloseMessage, send); return; }
      // NAP-WEBRTC #59 @ fb4dd6f0: "A shell that does not support byte payloads
      // returns the error `unsupported`". It defines `stats` only as a pushed
      // event, so a `webrtc.stats` request is unrecognized like any other type
      // and, per NIP-5D (nips#2303 @ f60550c3), gets no reply.
      if (message.type === 'webrtc.sendBytes') {
        send({ type: 'webrtc.sendBytes.result', id: (message as NappletMessage & { id?: string }).id ?? '', error: 'unsupported' } as NappletMessage);
        return;
      }
      ignoreUnrecognized('webrtc', message.type);
    },
    onWindowDestroyed(windowId) { retire(windowId); options.revokeWindow?.(windowId); options.destroyWindow?.(windowId); },
  };
}
