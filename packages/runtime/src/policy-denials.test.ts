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
  // NAP-OUTBOX #32 @ 8865f73d
  'outbox.getEvent': [{ eventId: 'e'.repeat(64) },
    [{ type: 'outbox.getEvent.result', id: 'r1', error: 'denied: outbox:read' }]],
  'outbox.subscribe': [{ subId: 's1', filters: [{ kinds: [1] }] },
    [{ type: 'outbox.closed', subId: 's1', reason: 'denied: outbox:read' }]],
  'outbox.close': [{ subId: 's1' }, []],
  'outbox.publish': [{ event: { kind: 1, content: '', tags: [], created_at: 0 } },
    [{ type: 'outbox.publish.result', id: 'r1', ok: false, error: 'denied: outbox:write' }]],
  // NAP-UPLOAD #33 @ f5cc981e
  'upload.upload': [{ request: {} }, [{ type: 'upload.upload.result', id: 'r1', error: 'denied: upload:write' }]],
  // NAP-COUNT #69 @ 9353a0c6
  'count.query': [{ filters: [{ kinds: [1] }] },
    [{ type: 'count.query.result', id: 'r1', ok: false, error: 'policy-denied', reason: 'denied: relay:read' }]],
  // NAP-NOTIFY #11 @ 67877ef6
  'notify.send': [{ title: 't' }, [{ type: 'notify.send.result', id: 'r1', error: 'denied: notify:send' }]],
  'notify.permission.request': [{}, [{ type: 'notify.permission.result', id: 'r1', granted: false }]],
  'notify.dismiss': [{ notificationId: 'n1' }, []],
  'notify.badge': [{ count: 1 }, []],
  'notify.channel.register': [{ channelId: 'c', label: 'C' }, []],
  // NAP-DM #74 @ 2c4e4423
  ...Object.fromEntries(['status', 'conversations', 'messages', 'send', 'subscribe', 'unsubscribe'].map((op) => [`dm.${op}`,
    [{}, [{ type: `dm.${op}.result`, id: 'r1', error: `denied: ${op === 'send' ? 'dm:write' : 'dm:read'}` }]]])),
  // NAP-FS #88 @ bd1b9e91
  ...Object.fromEntries(['info', 'pickFile', 'pickFiles', 'pickDirectory', 'pickSaveFile', 'stat', 'list', 'read',
    'write', 'mkdir', 'remove', 'move', 'watch', 'unwatch'].map((op) => [`fs.${op}`,
    [{}, [{ type: `fs.${op}.result`, id: 'r1', error: 'policy-denied' }]]])),
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
