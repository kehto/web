/**
 * policy-denials.test.ts — ACL denials use each NAP's own failure wire.
 *
 * Every case is driven through `runtime.handleMessage` with the napplet blocked,
 * so it covers the shared runtime ACL denial path. The quoted sentence and the
 * napplet/naps ref for each row live in `policy-denials.ts`.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createDenialResponse } from './legacy-firewall-gate.js';
import { createPolicyDenialResult } from './policy-denials.js';
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
  // NAP-OUTBOX #32 @ 8865f73d: `plan` is required; a policy-derived empty plan (#481 spec gap)
  'outbox.resolveRelays': [{ target: { pubkey: 'a'.repeat(64), direction: 'read' } },
    [{ type: 'outbox.resolveRelays.result', id: 'r1', plan: { relays: [], source: 'policy' }, error: 'denied: outbox:read' }]],
  // NAP-UPLOAD #33 @ f5cc981e: top-level error only (info/status: #481 spec gap)
  'upload.info': [{}, [{ type: 'upload.info.result', id: 'r1', error: 'denied: upload:write' }]],
  'upload.upload': [{ request: {} }, [{ type: 'upload.upload.result', id: 'r1', error: 'denied: upload:write' }]],
  'upload.status': [{ uploadId: 'up-1' }, [{ type: 'upload.status.result', id: 'r1', error: 'denied: upload:write' }]],
  // NAP-KEYS #9 @ 8869a4cf: actionId echoed, no binding
  'keys.registerAction': [{ action: { id: 'editor.save', label: 'Save', defaultKey: 'Ctrl+S' } },
    [{ type: 'keys.registerAction.result', id: 'r1', actionId: 'editor.save', error: 'denied: keys:bind' }]],
  'keys.forward': [{ key: 'j', code: 'KeyJ', ctrl: false, alt: false, shift: false, meta: false }, []],
  'keys.unregisterAction': [{ actionId: 'editor.save' }, []],
  // NAP-MEDIA #10 @ 7806f438 (unchanged by the stacked #133 @ 8ea49c33)
  'media.session.create': [{ owner: 'napplet', sessionId: 's1' },
    [{ type: 'media.session.create.result', id: 'r1', error: 'denied: media:control' }]],
  'media.session.update': [{ sessionId: 's1', metadata: { title: 't' } }, []],
  'media.session.destroy': [{ sessionId: 's1' }, []],
  'media.state': [{ sessionId: 's1', status: 'playing' }, []],
  'media.capabilities': [{ sessionId: 's1', actions: ['play'] }, []],
  'media.command': [{ sessionId: 's1', action: 'play' }, []],
  // NAP-CONFIG #14 @ bed9cb5b: positive-ACK with no code; get/subscribe silent (#481 spec gaps)
  'config.registerSchema': [{ schema: { type: 'object', properties: {} } },
    [{ type: 'config.registerSchema.result', id: 'r1', ok: false, error: 'denied: config:read' }]],
  'config.get': [{}, []],
  'config.subscribe': [{}, []],
  'config.unsubscribe': [{}, []],
  'config.openSettings': [{ section: 'display' }, []],
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

// A silent row and a request that never reached the denial path both send
// nothing, so prove each silent row is an explicit table entry (null), not a
// fall-through to the generic projection (undefined).
describe('silent denial rows', () => {
  const SILENT = Object.entries(CASES).filter(([, [, expected]]) => expected.length === 0).map(([type]) => type);

  it.each(SILENT)('%s is an explicit silent row', (type) => {
    expect(createPolicyDenialResult({ type, id: 'r1' } as NappletMessage, 'denied: x')).toBeNull();
  });
});

// The legacy Firewall gate drops through the same projection (kehto/web#481).
describe('legacy Firewall denial projection', () => {
  it.each([
    [{ type: 'keys.registerAction', id: 'f1', action: { id: 'a.b', label: 'A' } },
      { type: 'keys.registerAction.result', id: 'f1', actionId: 'a.b', error: 'firewall: rate' }],
    [{ type: 'keys.registerAction', id: 'f2', action: {} },
      { type: 'keys.registerAction.result', id: 'f2', actionId: '', error: 'firewall: rate' }],
    [{ type: 'upload.status', id: 'f3', uploadId: 'u' }, { type: 'upload.status.result', id: 'f3', error: 'firewall: rate' }],
    [{ type: 'config.get', id: 'f4' }, null],
  ])('%o', (request, expected) => {
    expect(createDenialResponse(request as NappletMessage, 'firewall: rate')).toEqual(expected);
  });
});

// kehto/web#465. NIP-5D (nostr-protocol/nips#2303 @ dskvr/nips@f60550c3):
// "Messages with an unrecognized `type` MUST be silently ignored." A denial is
// a reply, so a blocked napplet probing an undefined type must get nothing.
describe('runtime ACL denial of unrecognized types', () => {
  const DOMAINS = ['relay', 'count', 'identity', 'keys', 'media', 'notify', 'storage', 'inc', 'theme', 'config',
    'resource', 'cvm', 'outbox', 'upload', 'intent', 'dm', 'fs', 'llm'];

  it.each(DOMAINS.flatMap((domain) => [`${domain}.bogus`, `${domain}.send.result`]))('%s gets no reply', (type) => {
    const ctx = createMockRuntimeAdapter();
    const runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, createNip5dSessionEntry(WINDOW_ID, DTAG, HASH));
    runtime.aclState.block('', DTAG, HASH);
    runtime.handleMessage(WINDOW_ID, { type, id: 'probe', subId: 's1' } as NappletMessage);
    expect(ctx.sent).toEqual([]);
  });
});
