/**
 * keys-register-approval.test.ts — `keys.registerAction` replies exactly once
 * whatever the approval outcome (kehto/web#520).
 *
 * NAP-KEYS napplet/naps#9 @ 8869a4cf: "The shell MUST respond to
 * `keys.registerAction` with a `keys.registerAction.result` carrying the same
 * `id`." and "`keys.registerAction.result` includes an `error` field (string)
 * on failure. ... When `error` is present, `binding` is undefined."
 */

import { describe, it, expect } from 'vitest';
import type { ApprovalFailure, ServiceRuntimeContext } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';
import { createKeysService } from './keys-service.js';

const WINDOW_ID = 'win-keys-approval';
const signal = { aborted: false, addEventListener() {}, removeEventListener() {} };

type Execute = (approvalSignal: typeof signal) => unknown;
type Authorize = (windowId: string, operation: string, requirements: unknown, execute: Execute) => Promise<unknown>;

function register(authorize: Authorize, message: Record<string, unknown> = {
  type: 'keys.registerAction', id: 'r1', action: { id: 'editor.save', label: 'Save', defaultKey: 'Ctrl+S' },
}): { sent: NappletMessage[]; settle: () => Promise<void> } {
  const service = createKeysService({ listenerTarget: new EventTarget() });
  service.onRegistered?.({ authorizeOperation: authorize } as unknown as ServiceRuntimeContext);
  const sent: NappletMessage[] = [];
  service.handleMessage(WINDOW_ID, message as unknown as NappletMessage, (outbound) => sent.push(outbound));
  return { sent, settle: () => new Promise((resolve) => setTimeout(resolve, 0)) };
}

function results(sent: readonly NappletMessage[]): Array<Record<string, unknown>> {
  return sent.filter((message) => message.type === 'keys.registerAction.result') as unknown as Array<Record<string, unknown>>;
}

describe('keys.registerAction approval outcomes (#520)', () => {
  const outcomes: ReadonlyArray<[ApprovalFailure, string]> = [
    ['denied', 'policy denied'],
    ['cancelled', 'policy denied'],
    ['capacity', 'approval capacity reached'],
    ['busy', 'approval busy'],
    ['unavailable', 'approval unavailable'],
  ];

  it.each(outcomes)('replies once with `%s` → %j', async (status, error) => {
    const { sent, settle } = register(async () => ({ status }));
    await settle();
    expect(results(sent)).toEqual([{ type: 'keys.registerAction.result', id: 'r1', actionId: 'editor.save', error }]);
  });

  it('host conditions are never reported as a denial', async () => {
    for (const status of ['capacity', 'busy', 'unavailable'] as const) {
      const { sent, settle } = register(async () => ({ status }));
      await settle();
      expect(results(sent)).toHaveLength(1);
      expect(results(sent)[0]?.error).not.toBe('policy denied');
    }
  });

  it('does not add a second result when the registration ran but the continuation was cancelled', async () => {
    const { sent, settle } = register(async (_w, _o, _r, execute) => {
      await execute(signal);
      return { status: 'cancelled' };
    });
    await settle();
    expect(results(sent)).toEqual([{ type: 'keys.registerAction.result', id: 'r1', actionId: 'editor.save', binding: 'Ctrl+S' }]);
  });

  it('replies once with the policy code when the approval rejects', async () => {
    const { sent, settle } = register(async (_w, _o, _r, execute) => execute({ ...signal, aborted: true }));
    await settle();
    expect(results(sent)).toEqual([{ type: 'keys.registerAction.result', id: 'r1', actionId: 'editor.save', error: 'policy denied' }]);
  });

  it('echoes an empty action id when the request carries no action', async () => {
    const { sent, settle } = register(async () => ({ status: 'denied' }), { type: 'keys.registerAction', id: 'r2' });
    await settle();
    expect(results(sent)).toEqual([{ type: 'keys.registerAction.result', id: 'r2', actionId: '', error: 'invalid action' }]);
  });

  it('reports a host fault in the approval as unavailable, not a denial', async () => {
    const { sent, settle } = register(async () => { throw new Error('storage exploded'); });
    await settle();
    expect(results(sent)).toEqual([{ type: 'keys.registerAction.result', id: 'r1', actionId: 'editor.save', error: 'approval unavailable' }]);
  });

  function pending(): { service: ReturnType<typeof createKeysService>; sent: NappletMessage[]; finish: (outcome: unknown) => void } {
    let finish!: (outcome: unknown) => void;
    const service = createKeysService({ listenerTarget: new EventTarget() });
    service.onRegistered?.({ authorizeOperation: () => new Promise((resolve) => { finish = resolve; }) } as unknown as ServiceRuntimeContext);
    const sent: NappletMessage[] = [];
    service.handleMessage(WINDOW_ID, { type: 'keys.registerAction', id: 'r3', action: { id: 'editor.save' } } as NappletMessage, (outbound) => sent.push(outbound));
    return { service, sent, finish };
  }

  it('still answers a live source whose permission was revoked mid-approval', async () => {
    const { service, sent, finish } = pending();
    service.onPermissionRevoked?.(WINDOW_ID);
    finish({ status: 'cancelled' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(results(sent)).toEqual([{ type: 'keys.registerAction.result', id: 'r3', actionId: 'editor.save', error: 'policy denied' }]);
  });

  it('stays silent once the window is gone', async () => {
    const { service, sent, finish } = pending();
    service.onWindowDestroyed?.(WINDOW_ID);
    finish({ status: 'denied' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(results(sent)).toEqual([]);
  });
});
