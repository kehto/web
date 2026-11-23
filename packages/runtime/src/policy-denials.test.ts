/**
 * policy-denials.test.ts — ACL denials use each NAP's own failure wire.
 *
 * Every case is driven through `runtime.handleMessage` with the napplet blocked,
 * so it covers the shared runtime ACL denial path. The quoted sentence and the
 * napplet/naps ref for each row live in `policy-denials.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { LegacyFirewallAdapter } from './legacy-firewall-adapter.js';
import { createDenialResponse } from './legacy-firewall-gate.js';
import { createPolicyDenialResult } from './policy-denials.js';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';

declare const console: { warn(message: string): void };

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
  // NAP-UPLOAD #33 @ f5cc981e: `info` is required, so a redacted `{ rails: [] }` rides with the
  // error (#518); `upload.status` stays error-only, a bounded spec gap (see policy-denials.ts).
  'upload.info': [{}, [{ type: 'upload.info.result', id: 'r1', info: { rails: [] }, error: 'denied: upload:write' }]],
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
    [{ type: 'upload.info', id: 'f5' }, { type: 'upload.info.result', id: 'f5', info: { rails: [] }, error: 'firewall: rate' }],
  ])('%o', (request, expected) => {
    expect(createDenialResponse(request as NappletMessage, 'firewall: rate')).toEqual(expected);
  });
});

// kehto/web#494: domains ACL does not gate are denied only by the legacy
// Firewall gate. Each row is driven through `runtime.handleMessage` with a
// legacy adapter that rejects every observation, so it covers the real gate.
// Refs and spec-gap choices are in `policy-denials.ts`.
const HEX = 'a'.repeat(64);
const FIREWALL = 'firewall: blocked';
const commonFail = { ok: false, error: FIREWALL };
const FIREWALL_CASES: Readonly<Record<string, Case>> = {
  // NAP-COMMON #67 @ 8cd0eae8: `ok` always; getProfile needs `pubkey`, follows needs `pubkeys`
  'common.encodeNip19': [{ input: { type: 'npub', hex: HEX } }, [{ type: 'common.encodeNip19.result', id: 'r1', ...commonFail }]],
  'common.decodeNip19': [{ value: 'npub1x' }, [{ type: 'common.decodeNip19.result', id: 'r1', ...commonFail }]],
  'common.getProfile': [{ target: HEX }, [{ type: 'common.getProfile.result', id: 'r1', ok: false, pubkey: HEX, error: FIREWALL }]],
  'common.follows': [{}, [{ type: 'common.follows.result', id: 'r1', ok: false, pubkeys: [], error: FIREWALL }]],
  'common.follow': [{ pubkeys: ['npub1x'] }, [{ type: 'common.follow.result', id: 'r1', ...commonFail }]],
  'common.unfollow': [{ pubkeys: ['npub1x'] }, [{ type: 'common.unfollow.result', id: 'r1', ...commonFail }]],
  'common.react': [{ targetEventId: HEX, reaction: '+' }, [{ type: 'common.react.result', id: 'r1', ...commonFail }]],
  'common.report': [{ target: { type: 'pubkey', pubkey: HEX }, reason: 'spam', text: '' },
    [{ type: 'common.report.result', id: 'r1', ...commonFail }]],
  // NAP-LISTS #68 @ 7cf00cdb: `error` is a machine-readable code, `reason` is human text
  'lists.supported': [{}, [{ type: 'lists.supported.result', id: 'r1', error: 'policy-denied' }]],
  'lists.add': [{ list: { kind: 10000 }, items: [] },
    [{ type: 'lists.add.result', id: 'r1', ok: false, error: 'policy-denied', reason: FIREWALL }]],
  'lists.remove': [{ list: { kind: 10000 }, items: [] },
    [{ type: 'lists.remove.result', id: 'r1', ok: false, error: 'policy-denied', reason: FIREWALL }]],
  // NAP-SERIAL #61 @ 0c6e88ab, NAP-BLE #62 @ b46b8691, NAP-WEBRTC #59 @ fb4dd6f0: `.result` with `error`
  ...Object.fromEntries([
    'serial.open', 'serial.write', 'serial.close',
    'ble.open', 'ble.services', 'ble.read', 'ble.write', 'ble.subscribe', 'ble.unsubscribe', 'ble.close',
    'webrtc.open', 'webrtc.send', 'webrtc.sendBytes', 'webrtc.close',
  ].map((type) => [type, [{ sessionId: 's1' }, [{ type: `${type}.result`, id: 'r1', error: FIREWALL }]]])),
  // NAP-LINK #53 @ 100e5c93: `status` is required; "denied" carries `error`
  'link.open': [{ url: 'https://example.com/' }, [{ type: 'link.open.result', id: 'r1', status: 'denied', error: FIREWALL }]],
  // NAP-GAMEPAD #130 @ 0b28f77e: a snapshot after each subscribe; "blocked" is host policy
  'gamepad.subscribe': [{}, [{ type: 'gamepad.state', available: false, reason: 'blocked', focused: false, pads: [] }]],
  'gamepad.unsubscribe': [{}, []],
  // NAP-IDENTITY master @ 377bf939: already answered before the table by the
  // runtime-owned safe default (domain-results.ts); kept here as a regression.
  'identity.getPublicKey': [{}, [{ type: 'identity.getPublicKey.result', id: 'r1', pubkey: '' }]],
  'identity.getRelays': [{}, [{ type: 'identity.getRelays.result', id: 'r1', relays: {} }]],
  'identity.getFollows': [{}, [{ type: 'identity.getFollows.result', id: 'r1', pubkeys: [] }]],
};

function rejectAll(): LegacyFirewallAdapter {
  return {
    evaluate: () => ({ decision: 'reject', action: 'block', ruleId: 'test-block', reason: 'blocked' }),
    resetInitBudget() {}, setPolicy() {}, persist() {}, load() {},
  };
}

describe('legacy Firewall denial in domains ACL does not gate (kehto/web#494)', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ctx = createMockRuntimeAdapter({ legacyFirewall: rejectAll() });
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, createNip5dSessionEntry(WINDOW_ID, DTAG, HASH));
  });
  afterEach(() => { runtime.destroy(); warn.mockRestore(); });

  it.each(Object.entries(FIREWALL_CASES))('drops %s on its NAP-defined wire', (type, [request, expected]) => {
    const noId = type.startsWith('gamepad.');
    runtime.handleMessage(WINDOW_ID, { type, ...(noId ? {} : { id: 'r1' }), ...request } as NappletMessage);
    expect(ctx.sent.map(({ message }) => message)).toEqual(expected);
    expect(ctx.sent.some(({ message }) => (message as NappletMessage).type.endsWith('.error'))).toBe(false);
  });

  it('keeps gamepad.unsubscribe silent through an explicit row, not a fall-through', () => {
    expect(createPolicyDenialResult({ type: 'gamepad.unsubscribe' } as NappletMessage, FIREWALL)).toBeNull();
  });

  it('echoes a hex getProfile target and sends an empty pubkey for any other form', () => {
    runtime.handleMessage(WINDOW_ID, { type: 'common.getProfile', id: 'n1', target: 'npub1abc' } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'common.getProfile', id: 'n2', target: HEX.toUpperCase() } as NappletMessage);
    expect(ctx.sent.map(({ message }) => (message as NappletMessage & { pubkey: string }).pubkey)).toEqual(['', '']);
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
