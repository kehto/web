/**
 * policy-denials.test.ts — ACL denials use each NAP's own failure wire.
 *
 * Every case is driven through `runtime.handleMessage` with the napplet blocked,
 * so it covers the shared runtime ACL denial path. The quoted sentence and the
 * napplet/naps ref for each row live in `policy-denials.ts`.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';

const WINDOW_ID = 'win-denial';
const DTAG = 'denial-napp';
const HASH = 'd'.repeat(64);

type Case = readonly [request: Record<string, unknown>, expected: readonly Record<string, unknown>[]];

const CASES: Readonly<Record<string, Case>> = {
  // NAP-RELAY #2 @ 9f30b350
  'relay.subscribe': [{ subId: 's1', filters: [{ kinds: [1] }] },
    [{ type: 'relay.closed', subId: 's1', reason: 'denied: relay:read' }]],
  'relay.close': [{ subId: 's1' }, []],
  'relay.publish': [{ event: { kind: 1, content: '', tags: [], created_at: 0 } },
    [{ type: 'relay.publish.result', id: 'r1', ok: false, error: 'denied: relay:write' }]],
  'relay.query': [{ filters: [{ kinds: [1] }] },
    [{ type: 'relay.query.result', id: 'r1', error: 'denied: relay:read' }]],
};

describe('runtime ACL denial projection', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, createNip5dSessionEntry(WINDOW_ID, DTAG, HASH));
    runtime.aclState.block('', DTAG, HASH);
  });

  it.each(Object.entries(CASES))('denies %s on its NAP-defined wire', (type, [request, expected]) => {
    runtime.handleMessage(WINDOW_ID, { type, id: 'r1', ...request } as NappletMessage);
    expect(ctx.sent.map(({ message }) => message)).toEqual(expected);
    expect(ctx.sent.some(({ message }) => (message as NappletMessage).type.endsWith('.error'))).toBe(false);
  });
});
