/**
 * keys-register-authorization.ts — approval gate for `keys.registerAction`.
 *
 * NAP-KEYS napplet/naps#9 @ 8869a4cf: "The shell MUST respond to
 * `keys.registerAction` with a `keys.registerAction.result` carrying the same
 * `id`." and "`keys.registerAction.result` includes an `error` field (string)
 * on failure. ... When `error` is present, `binding` is undefined."
 *
 * Every request gets exactly one result until its window is destroyed
 * (kehto/web#520): validation errors, the registration's own result, or one
 * error for an approval that did not execute. `denied` and `cancelled` use the
 * policy code the runtime ACL denial uses (#489); `capacity`, `busy` and
 * `unavailable` are host conditions and use the #513 non-denial codes. NAP-KEYS
 * names neither, so these strings are a recorded spec gap. `actionId` echoes
 * the request's `action.id`, or `''` when there is none, as #489 does.
 * `keys.forward` and `keys.unregisterAction` are fire-and-forget and owe no reply.
 */

import type { NappletMessage } from '@napplet/core';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';
import type { KeysRegisterActionMessage, KeysRegisterActionResultMessage } from '@napplet/nap/keys/types';
import { approvalFailure } from './approval-failure.js';
import { formatChord, parseChord } from './keys-service-internals.js';

type Send = (message: NappletMessage) => void;

/** The runtime ACL denial reason (#489), reused for `denied` and `cancelled`. */
const POLICY_DENIED = 'policy denied';
/** Longest accepted `action.id`. */
const MAX_ACTION_ID_LENGTH = 256;

/**
 * Send one `keys.registerAction.result`.
 *
 * @param send - Outbound channel to the napplet.
 * @param message - The originating request.
 * @param binding - The normalized chord bound to the action, on success.
 * @param error - The failure reason; `binding` is then omitted.
 * @returns Nothing.
 * @example
 * sendRegisterActionResult(send, message, undefined, 'invalid action');
 */
export function sendRegisterActionResult(send: Send, message: KeysRegisterActionMessage, binding?: string, error?: string): void {
  const actionId = typeof message.action?.id === 'string' ? message.action.id : '';
  const result: KeysRegisterActionResultMessage & { error?: string } = {
    type: 'keys.registerAction.result',
    id: message.id,
    actionId,
    ...(binding ? { binding } : {}),
    ...(error ? { error } : {}),
  };
  send(result as NappletMessage);
}

/** Collaborators the gate needs from the keys service. */
export interface KeysRegisterGate {
  /** The runtime context, once registered. */
  readonly runtime: () => ServiceRuntimeContext | undefined;
  /** Current generation token for a window, created on first use. */
  readonly generationFor: (windowId: string) => symbol;
  /** Whether a generation is still the window's live one. */
  readonly current: (windowId: string, generation: symbol) => boolean;
  /** Checker that stays true until the window is destroyed (not merely revoked). */
  readonly liveSource: (windowId: string) => () => boolean;
}

/**
 * Validate, authorize and run one `keys.registerAction`, replying exactly once.
 *
 * @param gate - Runtime and window-generation accessors.
 * @param windowId - The requesting window.
 * @param message - The request.
 * @param send - Outbound channel to the napplet.
 * @param register - Performs the registration and sends its own result.
 * @returns Nothing; the reply is sent asynchronously once approval settles.
 * @example
 * authorizeRegisterAction(gate, windowId, message, send, handleRegister);
 */
export function authorizeRegisterAction(
  gate: KeysRegisterGate,
  windowId: string,
  message: KeysRegisterActionMessage,
  send: Send,
  register: (windowId: string, message: KeysRegisterActionMessage, send: Send) => void,
): void {
  const actionId = message.action?.id;
  if (typeof actionId !== 'string' || actionId.length === 0 || actionId.length > MAX_ACTION_ID_LENGTH) {
    sendRegisterActionResult(send, message, undefined, 'invalid action');
    return;
  }
  let chordScope: string | undefined;
  if (message.action.defaultKey) {
    try { chordScope = formatChord(parseChord(message.action.defaultKey)); }
    catch (error) { sendRegisterActionResult(send, message, undefined, `invalid chord: ${(error as Error).message}`); return; }
  }
  const generation = gate.generationFor(windowId);
  const guardedSend: Send = (outbound) => { if (gate.current(windowId, generation)) send(outbound); };
  // A revoked but live source still gets its terminal error; a destroyed one does not.
  const sourceLive = gate.liveSource(windowId);
  let replied = false;
  const fail = (error: string): void => {
    if (replied || !sourceLive()) return;
    replied = true;
    sendRegisterActionResult(send, message, undefined, error);
  };
  const revoked = new Error(POLICY_DENIED);
  const run = async (signal?: ApprovalSignal): Promise<void> => {
    if (!gate.current(windowId, generation) || signal?.aborted) throw revoked;
    replied = true;
    register(windowId, message, guardedSend);
  };
  const runtime = gate.runtime();
  if (!runtime?.authorizeOperation) { void run(); return; }
  void runtime.authorizeOperation(windowId, 'keys.registerAction', [
    { category: 'interface' as const, domain: 'keys', operation: 'access', scope: { kind: 'exact' as const, value: 'keys' } },
    { category: 'resource' as const, domain: 'keys', operation: 'keys.registerAction', scope: { kind: 'exact' as const, value: `keys:action:${actionId}` } },
    ...(chordScope ? [{ category: 'resource' as const, domain: 'keys', operation: 'keys.registerAction', scope: { kind: 'exact' as const, value: `keys:chord:${chordScope}` } }] : []),
  ], (signal) => run(signal))
    .then((outcome) => { if (outcome.status !== 'executed') fail(approvalFailure(outcome.status, { denied: POLICY_DENIED })); })
    // Only the gate's own revocation is a denial; any other fault is a host condition.
    .catch((error) => fail(error === revoked ? POLICY_DENIED : approvalFailure('unavailable', { denied: POLICY_DENIED })));
}
