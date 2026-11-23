/**
 * Shell pushes reach a napplet from its first valid `napplet.hello` (kehto/web#480).
 *
 * Spec check (napplet/naps master@377bf939, nostr-protocol/nips#2303 @ f60550c3):
 * - NIP-5D binds `(dTag, artifactHash)` "to the port carried by the first valid
 *   `napplet.hello`", and domain availability is injected presence, independent
 *   of NAP-SHELL readiness.
 * - NAP-THEME: the shell MUST broadcast `theme.changed` "to all napplets to which
 *   it exposes `theme`"; there is no subscribe.
 * - NAP-IDENTITY: the shell MUST emit `identity.changed` "to loaded napplets",
 *   including `pubkey: ""` on sign-out.
 *
 * So a napplet that only listens is a broadcast target as soon as its port is
 * bound, not after it sends its first envelope. Revoking or replacing the
 * binding removes the target again.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntentService, createThemeService, type IntentResolver } from '@kehto/services';
import type { IntentAvailability, IntentResult } from '@napplet/nap/intent/types';
import { createShellBridge, NAPPLET_HELLO } from './shell-bridge.js';
import { originRegistry } from './origin-registry.js';
import { sendHello } from './test-utils.js';
import type { NappletRevocation, ShellAdapter } from './types.js';
import type { Theme } from '@napplet/nap/theme/types';

const THEME: Theme = { colors: { background: '#101820', text: '#f2aa4c', primary: '#f95738' } };
const PUBKEY = 'b'.repeat(64);

function makeHooks(extra: Partial<ShellAdapter> = {}): ShellAdapter {
  return {
    relayPool: {
      getRelayPool: () => null,
      trackSubscription: () => {},
      untrackSubscription: () => {},
      openScopedRelay: () => {},
      closeScopedRelay: () => {},
      publishToScopedRelay: () => false,
      selectRelayTier: () => [],
    },
    relayConfig: {
      addRelay: () => {},
      removeRelay: () => {},
      getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
      getNip66Suggestions: () => null,
    },
    windowManager: { createWindow: () => null },
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'banner' },
    hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => null },
    crypto: { verifyEvent: async () => true },
    ...extra,
  };
}

type FakeFrame = Window & { postMessage: ReturnType<typeof vi.fn> };

/** Register a frame with verified identity and frozen grants; it sends nothing yet. */
function loadFrame(windowId: string, domains: readonly string[] = ['theme', 'identity']): FakeFrame {
  const win = { postMessage: vi.fn() } as unknown as FakeFrame;
  originRegistry.register(win, windowId, { dTag: `d-${windowId}`, aggregateHash: `h-${windowId}` });
  originRegistry.setEnvironment(win, { capabilities: { domains }, services: [] });
  return win;
}

function received(frame: FakeFrame): unknown[] {
  return frame.postMessage.mock.calls.map(([message]) => message);
}

describe('ShellBridge broadcast targets bind at napplet.hello (#480)', () => {
  beforeEach(() => originRegistry.clear());
  afterEach(() => originRegistry.clear());

  it('delivers theme.changed and identity.changed to a hello-only napplet, with or without shell', () => {
    const bridge = createShellBridge(makeHooks());
    const withShell = loadFrame('with-shell', ['shell', 'theme', 'identity']);
    const shellAbsent = loadFrame('shell-absent');
    sendHello(bridge, withShell);
    sendHello(bridge, shellAbsent);

    expect(bridge.runtime.sessionRegistry.getEntryByWindowId('shell-absent')).toMatchObject({
      dTag: 'd-shell-absent', aggregateHash: 'h-shell-absent', provenance: 'nip-5d',
    });
    bridge.publishIdentityChanged(PUBKEY);
    bridge.publishIdentityChanged('');
    bridge.publishTheme(THEME);

    for (const frame of [withShell, shellAbsent]) {
      expect(received(frame)).toEqual([
        { type: 'identity.changed', pubkey: PUBKEY },
        { type: 'identity.changed', pubkey: '' },
        { type: 'theme.changed', theme: THEME },
      ]);
    }
    bridge.destroy();
  });

  it('delivers over a real MessageChannel before the napplet posts anything', async () => {
    const bridge = createShellBridge(makeHooks());
    const win = loadFrame('real-port', ['theme']);
    const channel = new MessageChannel();
    bridge.handleMessage({ source: win, origin: 'null', data: { type: NAPPLET_HELLO }, ports: [channel.port2] } as unknown as MessageEvent);

    const next = new Promise((resolve) => {
      channel.port1.addEventListener('message', (event) => resolve(event.data), { once: true });
      channel.port1.start();
    });
    bridge.publishTheme(THEME);
    await expect(next).resolves.toEqual({ type: 'theme.changed', theme: THEME });
    expect(win.postMessage).not.toHaveBeenCalled();
    channel.port1.close();
    bridge.destroy();
  });

  it('lists a hello-only napplet for service broadcasts such as the theme service', () => {
    const theme = createThemeService();
    const bridge = createShellBridge(makeHooks({ services: { theme: theme.handler } }));
    const frame = loadFrame('service-target', ['theme']);
    sendHello(bridge, frame);

    theme.publishTheme(THEME);

    expect(received(frame)).toEqual([{ type: 'theme.changed', theme: expect.objectContaining({ colors: THEME.colors }) }]);
    bridge.destroy();
  });

  it('lists a hello-only napplet for intent.changed availability pushes', () => {
    let notify: ((availability: IntentAvailability) => void) | undefined;
    const resolver: IntentResolver = {
      invoke: () => ({ ok: false, error: 'unused' }) as IntentResult,
      available: (archetype) => ({ archetype, available: false, candidates: [], hasDefault: false }),
      handlers: () => [],
      onChanged(listener) {
        notify = listener;
        return () => { notify = undefined; };
      },
    };
    const intent = createIntentService({ resolver, resolveSender: () => undefined });
    const bridge = createShellBridge(makeHooks({ services: { intent } }));
    const frame = loadFrame('intent-target', ['intent']);
    sendHello(bridge, frame);

    const availability: IntentAvailability = { archetype: 'note', available: false, candidates: [], hasDefault: false };
    notify?.(availability);

    expect(received(frame)).toEqual([{ type: 'intent.changed', availability }]);
    bridge.destroy();
  });

  it('resolves identity through onNip5dIframeCreate at hello', () => {
    const onNip5dIframeCreate = vi.fn(() => ({ dTag: 'hooked', aggregateHash: 'h-hooked' }));
    const bridge = createShellBridge(makeHooks({ onNip5dIframeCreate }));
    const frame = loadFrame('hooked-frame');
    sendHello(bridge, frame);

    expect(onNip5dIframeCreate).toHaveBeenCalledWith('hooked-frame');
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId('hooked-frame')?.dTag).toBe('hooked');
    bridge.destroy();
  });

  it('keeps unbound, unexposed, and ungranted napplets out of the broadcast', () => {
    const bridge = createShellBridge(makeHooks());
    const noHello = loadFrame('no-hello');
    const themeOnly = loadFrame('theme-only', ['theme']);
    const ungranted = loadFrame('ungranted');
    sendHello(bridge, themeOnly);
    sendHello(bridge, ungranted);
    const entry = bridge.runtime.sessionRegistry.getEntryByWindowId('ungranted')!;
    bridge.runtime.aclState.revoke(entry.pubkey, entry.dTag, entry.aggregateHash, 'theme:read');
    bridge.runtime.aclState.revoke(entry.pubkey, entry.dTag, entry.aggregateHash, 'identity:read');

    bridge.publishIdentityChanged(PUBKEY);
    bridge.publishTheme(THEME);

    expect(bridge.runtime.sessionRegistry.getEntryByWindowId('no-hello')).toBeUndefined();
    expect(noHello.postMessage).not.toHaveBeenCalled();
    expect(ungranted.postMessage).not.toHaveBeenCalled();
    expect(received(themeOnly)).toEqual([{ type: 'theme.changed', theme: THEME }]);
    bridge.destroy();
  });

  it('binds no target when the hello frame has no verified identity', () => {
    const bridge = createShellBridge(makeHooks());
    const win = { postMessage: vi.fn() } as unknown as FakeFrame;
    originRegistry.register(win, 'anonymous');
    sendHello(bridge, win);

    bridge.publishTheme(THEME);

    expect(bridge.runtime.sessionRegistry.getEntryByWindowId('anonymous')).toBeUndefined();
    expect(win.postMessage).not.toHaveBeenCalled();
    bridge.destroy();
  });

  type Bound = { bridge: ReturnType<typeof createShellBridge>; frame: FakeFrame; port: ReturnType<typeof sendHello> };
  const teardowns: ReadonlyArray<readonly [string, (bound: Bound) => void]> = [
    ['host revocation', ({ bridge }) => bridge.revokeNapplet('teardown')],
    ['port close', ({ port }) => port.fireClose()],
    ['second hello', ({ bridge, frame }) => {
      bridge.handleMessage({ source: frame, origin: 'null', data: { type: NAPPLET_HELLO }, ports: [new MessageChannel().port2] } as unknown as MessageEvent);
    }],
  ];

  it.each(teardowns)('drops the broadcast target on %s', (_label, teardown) => {
    const revocations: NappletRevocation[] = [];
    const bridge = createShellBridge(makeHooks({ onNappletRevoked: (revocation) => revocations.push(revocation) }));
    const frame = loadFrame('teardown');
    const port = sendHello(bridge, frame);
    bridge.publishTheme(THEME);
    expect(received(frame)).toEqual([{ type: 'theme.changed', theme: THEME }]);
    frame.postMessage.mockClear();
    const post = vi.spyOn(originRegistry, 'postToNapplet');

    teardown({ bridge, frame, port });
    bridge.publishIdentityChanged('');
    bridge.publishTheme(THEME);

    expect(revocations).toHaveLength(1);
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId('teardown')).toBeUndefined();
    expect(post).not.toHaveBeenCalled();
    expect(frame.postMessage).not.toHaveBeenCalled();
    post.mockRestore();
    bridge.destroy();
  });

  it('moves the target to the replacement frame when a windowId is re-registered', () => {
    const bridge = createShellBridge(makeHooks());
    const original = loadFrame('replaced', ['theme']);
    sendHello(bridge, original);
    const originalInstance = bridge.runtime.sessionRegistry.getEntryByWindowId('replaced')?.instanceId;
    originRegistry.unregister('replaced');

    const replacement = loadFrame('replaced', ['theme']);
    sendHello(bridge, replacement);
    bridge.publishTheme(THEME);

    expect(bridge.runtime.sessionRegistry.getEntryByWindowId('replaced')?.instanceId).not.toBe(originalInstance);
    expect(original.postMessage).not.toHaveBeenCalled();
    expect(received(replacement)).toEqual([{ type: 'theme.changed', theme: THEME }]);
    bridge.destroy();
  });
});
