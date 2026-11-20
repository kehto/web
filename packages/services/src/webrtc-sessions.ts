/**
 * webrtc-sessions.ts — NAP-WEBRTC session bookkeeping for `createWebrtcService`.
 *
 * Tracks which sessions a window may hear about, per window lifetime
 * (generation), so revocation and destroy cut off late backend events, and
 * revocation can tell the napplet its sessions ended. Internal: not exported
 * from the package.
 */
import type { NappletMessage, WebrtcEvent } from '@napplet/core';
import type { ApprovalSignal } from '@kehto/runtime';

type Send = (msg: NappletMessage) => void;
/** A live session: its owner, the window lifetime that opened it, and where its events go. */
type SessionEntry = { readonly windowId: string; readonly generation: object; readonly send: Send };
/** One pending open: early `state` events pass, and a backend `closed` is held for after the result. */
export type Opening = { active: boolean; closed?: WebrtcEvent };

/** `closed` reason when policy revokes a window's WebRTC sessions; the `@kehto/mocks` mock uses the same text. */
const REVOKED_REASON = 'policy denied';

/**
 * Create empty session books.
 *
 * @returns Session maps plus the lifetime checks and delivery rules the service uses.
 * @example
 * ```ts
 * const book = createWebrtcSessions();
 * const generation = book.generationFor('win-1');
 * book.sessions.set('sess-1', { windowId: 'win-1', generation, send });
 * book.revokeSessions('win-1'); // sends `closed` for sess-1, then forgets it
 * ```
 */
export function createWebrtcSessions() {
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
  const revokeSessions = (windowId: string): void => {
    const generation = generations.get(windowId);
    if (generation) revokedGenerations.add(generation);
    for (const [sessionId, entry] of sessions) {
      if (entry.windowId !== windowId) continue;
      sessions.delete(sessionId);
      entry.send({ type: 'webrtc.event', event: { type: 'closed', sessionId, reason: REVOKED_REASON } } as NappletMessage);
    }
    retire(windowId);
  };
  return { sessions, closingSessions, revokedGenerations, generations, generationFor, current, answerable, deliver, retire, revokeSessions };
}
