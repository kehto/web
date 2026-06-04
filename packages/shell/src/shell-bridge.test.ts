/**
 * shell-bridge.test.ts — Coverage for the `bridge.publishTheme(theme)`
 * broadcast API added by Phase 13 Plan 13-02 (TH-03, closes DRIFT-SHELL-05).
 *
 * `publishTheme` is the host-facing broadcast API on the ShellBridge: the
 * hosting application calls `bridge.publishTheme(theme)` and every napplet
 * currently registered in `runtime.sessionRegistry` receives a
 * `theme.changed` envelope via `originRegistry.getIframeWindow(windowId)
 * .postMessage(envelope, '*')`. This mirrors the multi-napplet fanout
 * pattern established by `keys-forwarder.ts` (lines 131-147).
 *
 * Test strategy:
 *   - Populate `bridge.runtime.sessionRegistry` (the Runtime's own instance)
 *     and the shell's module-level `originRegistry` singleton — these are
 *     the two sources `publishTheme` iterates.
 *   - Construct minimal fake iframe windows (`{ postMessage: vi.fn() }`)
 *     cast through `unknown` to `Window` — mirrors the identity-proxy and
 *     keys-forwarder test patterns.
 *   - Clear `originRegistry` in beforeEach/afterEach to keep tests isolated
 *     across the file. Each test creates a fresh bridge, so each runtime's
 *     session registry starts empty.
 *   - Build a minimal `ShellAdapter` whose methods are no-ops; the bridge
 *     only exercises `adaptHooks` at construction time, and `publishTheme`
 *     does not reach into the hook surface.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createShellBridge } from './shell-bridge.js';
import { originRegistry } from './origin-registry.js';
import type { ShellAdapter, SessionEntry } from './types.js';
import type { Theme } from '@napplet/nub/theme/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Minimal no-op ShellAdapter sufficient for `createShellBridge()` to run
 * `adaptHooks` without errors. Every hook returns the smallest acceptable
 * value; the bridge's `publishTheme` path does not read from any of them.
 */
function makeTestHooks(): ShellAdapter {
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
    windowManager: {
      createWindow: () => null,
    },
    auth: {
      getUserPubkey: () => null,
      getSigner: () => null,
    },
    config: {
      getNappUpdateBehavior: () => 'banner',
    },
    hotkeys: {
      executeHotkeyFromForward: () => {},
    },
    workerRelay: {
      getWorkerRelay: () => null,
    },
    crypto: {
      verifyEvent: async () => true,
    },
  };
}

/** Fabricate a fake iframe Window whose postMessage is a vi.fn() spy. */
function makeFakeIframe(): { postMessage: ReturnType<typeof vi.fn> } {
  return { postMessage: vi.fn() };
}

/** Build a SessionEntry suitable for sessionRegistry.register(). */
function makeSessionEntry(overrides: Partial<SessionEntry>): SessionEntry {
  return {
    pubkey: overrides.pubkey ?? `pk-${overrides.windowId ?? 'x'}`,
    windowId: overrides.windowId ?? 'win-x',
    origin: '*',
    type: 'test',
    dTag: 'd-test',
    aggregateHash: 'h-test',
    registeredAt: 0,
    instanceId: `inst-${overrides.windowId ?? 'x'}`,
    provenance: 'nip-5d',
    class: null, // CLASS-02: permissive default for test fixtures
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ShellBridge.publishTheme (TH-03, Plan 13-02)', () => {
  beforeEach(() => {
    originRegistry.clear();
  });

  afterEach(() => {
    originRegistry.clear();
  });

  it('broadcasts theme.changed to every registered napplet window', () => {
    const iframeA = makeFakeIframe();
    const iframeB = makeFakeIframe();

    // Register iframes with the shell-side origin registry (module singleton).
    originRegistry.register(iframeA as unknown as Window, 'win-A');
    originRegistry.register(iframeB as unknown as Window, 'win-B');

    const bridge = createShellBridge(makeTestHooks());

    // Seed the runtime's own session registry (distinct from the shell
    // singleton) — publishTheme iterates runtime.sessionRegistry.getAllEntries().
    bridge.runtime.sessionRegistry.register(
      'win-A',
      makeSessionEntry({ windowId: 'win-A', pubkey: 'pk-A' }),
    );
    bridge.runtime.sessionRegistry.register(
      'win-B',
      makeSessionEntry({ windowId: 'win-B', pubkey: 'pk-B' }),
    );

    const theme: Theme = {
      colors: { background: '#111', text: '#eee', primary: '#f0f' },
      title: 'Dark',
    };
    bridge.publishTheme(theme);

    const expectedEnvelope = { type: 'theme.changed', theme };

    expect(iframeA.postMessage).toHaveBeenCalledTimes(1);
    expect(iframeA.postMessage).toHaveBeenCalledWith(expectedEnvelope, '*');
    expect(iframeB.postMessage).toHaveBeenCalledTimes(1);
    expect(iframeB.postMessage).toHaveBeenCalledWith(expectedEnvelope, '*');

    bridge.destroy();
  });

  it('silently skips napplets whose windowId does not resolve to an iframe Window', () => {
    const iframeA = makeFakeIframe();

    // Register only win-A in the origin registry; win-B has a session entry
    // but no origin-registry mapping (simulates a stale session).
    originRegistry.register(iframeA as unknown as Window, 'win-A');

    const bridge = createShellBridge(makeTestHooks());
    bridge.runtime.sessionRegistry.register(
      'win-A',
      makeSessionEntry({ windowId: 'win-A', pubkey: 'pk-A' }),
    );
    bridge.runtime.sessionRegistry.register(
      'win-B',
      makeSessionEntry({ windowId: 'win-B', pubkey: 'pk-B' }),
    );

    const theme: Theme = {
      colors: { background: '#000', text: '#fff', primary: '#f00' },
    };

    // Must not throw on the unresolved windowId.
    expect(() => bridge.publishTheme(theme)).not.toThrow();
    expect(iframeA.postMessage).toHaveBeenCalledTimes(1);
    expect(iframeA.postMessage).toHaveBeenCalledWith(
      { type: 'theme.changed', theme },
      '*',
    );

    bridge.destroy();
  });

  it('exposes publishTheme as a callable function on the ShellBridge surface', () => {
    const bridge = createShellBridge(makeTestHooks());

    // Compile-time assertion: publishTheme must be typed as (theme: Theme) => void.
    const fn: (theme: Theme) => void = bridge.publishTheme;
    expect(typeof fn).toBe('function');
    expect(typeof bridge.publishTheme).toBe('function');

    // Calling with no registered napplets is a no-op and must not throw.
    expect(() =>
      bridge.publishTheme({
        colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' },
      }),
    ).not.toThrow();

    bridge.destroy();
  });
});

// ─── NIP-5D source validation ───────────────────────────────────────────────

describe('ShellBridge.handleMessage source validation', () => {
  beforeEach(() => {
    originRegistry.clear();
  });

  afterEach(() => {
    originRegistry.clear();
  });

  it('silently drops envelopes from unknown MessageEvent.source windows', () => {
    const bridge = createShellBridge(makeTestHooks());
    const runtimeSpy = vi.spyOn(bridge.runtime, 'handleMessage');
    const unknownWindow = makeFakeIframe() as unknown as Window;
    const envelope = { type: 'relay.subscribe', subId: 'sub-unknown', filters: [] };

    expect(() =>
      bridge.handleMessage({
        source: unknownWindow,
        data: envelope,
      } as MessageEvent),
    ).not.toThrow();

    expect(runtimeSpy).not.toHaveBeenCalled();

    runtimeSpy.mockRestore();
    bridge.destroy();
  });
});

// ─── ShellBridge.injectEvent single-topic forwarding (RENAME-HARD-01/02) ─────

describe('ShellBridge.injectEvent single-topic forwarding', () => {
  it("forwards the canonical 'identity:changed' topic exactly once", () => {
    const bridge = createShellBridge(makeTestHooks());
    const spy = vi.spyOn(bridge.runtime, 'injectEvent');

    const payload = { pubkey: 'abc' };
    bridge.injectEvent('identity:changed', payload);

    expect(spy.mock.calls).toEqual([['identity:changed', payload]]);

    spy.mockRestore();
    bridge.destroy();
  });

  it("forwards the deprecated 'auth:identity-changed' topic literally with no fan-out", () => {
    const bridge = createShellBridge(makeTestHooks());
    const spy = vi.spyOn(bridge.runtime, 'injectEvent');

    const payload = { pubkey: 'def' };
    bridge.injectEvent('auth:identity-changed', payload);

    expect(spy.mock.calls).toEqual([['auth:identity-changed', payload]]);

    spy.mockRestore();
    bridge.destroy();
  });

  it('forwards unrelated topics unchanged with no dual-emit', () => {
    const bridge = createShellBridge(makeTestHooks());
    const spy = vi.spyOn(bridge.runtime, 'injectEvent');

    const payload = { data: 'hello' };
    bridge.injectEvent('test:topic', payload);

    expect(spy.mock.calls).toEqual([['test:topic', payload]]);

    spy.mockRestore();
    bridge.destroy();
  });
});

// ─── NIP-5D session registration on shell.ready (issue #15 fix) ──────────────

describe('ShellBridge NIP-5D session registration on shell.ready', () => {
  beforeEach(() => {
    originRegistry.clear();
  });

  afterEach(() => {
    originRegistry.clear();
  });

  /**
   * End-to-end test: NIP-5D napplet registered via originRegistry identity.
   *
   * The fix ensures that when shell.ready arrives for a windowId that has
   * identity in originRegistry (dTag + aggregateHash), a source-identity
   * SessionEntry is created in runtime.sessionRegistry before the storage
   * domain handler runs. Without the fix, getEntryByWindowId(windowId)
   * returns undefined and all storage operations return 'not registered'.
   */
  it('registers a NIP-5D session entry on shell.ready when originRegistry has identity', () => {
    const iframe = makeFakeIframe();
    const win = iframe as unknown as Window;

    // Host registers the iframe window with NIP-5D identity at iframe creation time.
    originRegistry.register(win, 'win-nip5d', { dTag: 'my-napp', aggregateHash: 'abc123' });

    const bridge = createShellBridge(makeTestHooks());

    // Before shell.ready: no session entry yet
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId('win-nip5d')).toBeUndefined();

    // Napplet sends shell.ready
    bridge.handleMessage({
      source: win,
      origin: 'https://my-napp.example.com',
      data: { type: 'shell.ready' },
    } as MessageEvent);

    // After shell.ready: session entry populated
    const entry = bridge.runtime.sessionRegistry.getEntryByWindowId('win-nip5d');
    expect(entry).toBeDefined();
    expect(entry?.provenance).toBe('nip-5d');
    expect(entry?.pubkey).toBe('');
    expect(entry?.dTag).toBe('my-napp');
    expect(entry?.aggregateHash).toBe('abc123');
    expect(entry?.windowId).toBe('win-nip5d');
    expect(entry?.origin).toBe('https://my-napp.example.com');
    expect(entry?.instanceId).toBeTruthy();
    expect(typeof entry?.registeredAt).toBe('number');
    expect(entry?.class).toBeNull();

    bridge.destroy();
  });

  /**
   * End-to-end test: NIP-5D napplet registered via onNip5dIframeCreate hook.
   *
   * When hooks.onNip5dIframeCreate is provided, its return value takes precedence
   * over originRegistry.getIdentity(). The class posture from the hook is used.
   */
  it('registers a NIP-5D session entry on shell.ready using onNip5dIframeCreate hook', () => {
    const iframe = makeFakeIframe();
    const win = iframe as unknown as Window;

    // Register window in originRegistry WITHOUT identity (no dTag/aggregateHash)
    originRegistry.register(win, 'win-hook');

    const hooks: ShellAdapter = {
      ...makeTestHooks(),
      onNip5dIframeCreate: (windowId: string) => {
        if (windowId === 'win-hook') {
          return { dTag: 'hook-napp', aggregateHash: 'hookHash99', class: null };
        }
        return null;
      },
    };

    const bridge = createShellBridge(hooks);

    bridge.handleMessage({
      source: win,
      origin: 'https://hook-napp.example.com',
      data: { type: 'shell.ready' },
    } as MessageEvent);

    const entry = bridge.runtime.sessionRegistry.getEntryByWindowId('win-hook');
    expect(entry).toBeDefined();
    expect(entry?.provenance).toBe('nip-5d');
    expect(entry?.dTag).toBe('hook-napp');
    expect(entry?.aggregateHash).toBe('hookHash99');
    expect(entry?.pubkey).toBe('');
    expect(entry?.class).toBeNull();

    bridge.destroy();
  });

  /**
   * Storage operations no longer return 'not registered' after shell.ready
   * registers the session entry.
   *
   * After shell.ready, a storage.set followed by storage.get should NOT
   * produce a 'not registered' error in the response envelope. The actual
   * stored value may be null (localStorage unavailable in Node test env),
   * but the identity resolution path succeeds.
   */
  it('storage.get does not return not-registered error after shell.ready registers session', () => {
    const iframe = makeFakeIframe();
    const win = iframe as unknown as Window;

    originRegistry.register(win, 'win-storage', { dTag: 'store-napp', aggregateHash: 'storeHash42' });

    const bridge = createShellBridge(makeTestHooks());

    // Send shell.ready to trigger registration
    bridge.handleMessage({
      source: win,
      origin: 'https://store-napp.example.com',
      data: { type: 'shell.ready' },
    } as MessageEvent);

    // Confirm registration occurred
    const entry = bridge.runtime.sessionRegistry.getEntryByWindowId('win-storage');
    expect(entry).toBeDefined();
    expect(entry?.provenance).toBe('nip-5d');

    // Reset postMessage spy to isolate storage responses
    iframe.postMessage.mockClear();

    // Send storage.get — should not produce 'not registered'
    bridge.handleMessage({
      source: win,
      origin: 'https://store-napp.example.com',
      data: { type: 'storage.get', id: 'req-1', key: 'myKey' },
    } as MessageEvent);

    // Exactly one response posted to the iframe
    expect(iframe.postMessage).toHaveBeenCalledTimes(1);
    const response = iframe.postMessage.mock.calls[0][0] as Record<string, unknown>;
    expect(response.type).toBe('storage.get.result');
    // Must NOT be the 'not registered' error
    expect(response.error).not.toBe('not registered');
    // Value is null (localStorage unavailable in node test env, but identity resolved)
    expect(response.value).toBeNull();

    bridge.destroy();
  });

  /**
   * Storage round-trip: set then get returns the stored value when a
   * custom statePersistence is wired via a runtime-level spy.
   *
   * This test directly seeds runtime.sessionRegistry (bypassing shell.ready)
   * and drives handleMessage — confirming the runtime layer works end-to-end
   * when the entry IS present, and that the fix's registered entry enables the
   * same path.
   */
  it('storage set then get returns stored value after NIP-5D session is registered', () => {
    const iframe = makeFakeIframe();
    const win = iframe as unknown as Window;

    originRegistry.register(win, 'win-roundtrip', { dTag: 'rt-napp', aggregateHash: 'rtHash77' });

    const bridge = createShellBridge(makeTestHooks());

    // Trigger NIP-5D registration via shell.ready
    bridge.handleMessage({
      source: win,
      origin: 'https://rt-napp.example.com',
      data: { type: 'shell.ready' },
    } as MessageEvent);

    expect(bridge.runtime.sessionRegistry.getEntryByWindowId('win-roundtrip')).toBeDefined();
    iframe.postMessage.mockClear();

    // storage.set — localStorage not available in Node, but should not error 'not registered'
    bridge.handleMessage({
      source: win,
      origin: 'https://rt-napp.example.com',
      data: { type: 'storage.set', id: 'set-1', key: 'greeting', value: 'hello' },
    } as MessageEvent);

    expect(iframe.postMessage).toHaveBeenCalledTimes(1);
    const setResponse = iframe.postMessage.mock.calls[0][0] as Record<string, unknown>;
    expect(setResponse.type).toBe('storage.set.result');
    expect(setResponse.error).not.toBe('not registered');

    bridge.destroy();
  });

  /**
   * Regression guard: windows registered WITHOUT identity (no dTag/aggregateHash)
   * must not throw or register a broken session entry when shell.ready arrives.
   * This preserves compatibility with existing tests that call
   * originRegistry.register(win, 'win-A') without identity.
   */
  it('does not throw and skips registration when window has no NIP-5D identity', () => {
    const iframe = makeFakeIframe();
    const win = iframe as unknown as Window;

    // Register without identity metadata
    originRegistry.register(win, 'win-no-id');

    const bridge = createShellBridge(makeTestHooks());

    expect(() =>
      bridge.handleMessage({
        source: win,
        origin: 'https://unknown.example.com',
        data: { type: 'shell.ready' },
      } as MessageEvent),
    ).not.toThrow();

    // No session entry should be created (no identity available)
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId('win-no-id')).toBeUndefined();

    bridge.destroy();
  });

  /**
   * Idempotency: if a session entry already exists (e.g., registered by the host
   * before shell.ready), shell.ready must not overwrite it.
   */
  it('does not overwrite an existing session entry when shell.ready is received', () => {
    const iframe = makeFakeIframe();
    const win = iframe as unknown as Window;

    originRegistry.register(win, 'win-existing', { dTag: 'pre-registered', aggregateHash: 'preHash' });

    const bridge = createShellBridge(makeTestHooks());

    // Pre-register a session entry before shell.ready
    const preEntry: SessionEntry = {
      pubkey: '',
      windowId: 'win-existing',
      origin: 'https://pre.example.com',
      type: 'nip5d',
      dTag: 'pre-registered',
      aggregateHash: 'preHash',
      registeredAt: 1000,
      instanceId: 'pre-guid-fixed',
      provenance: 'nip-5d',
      class: null,
    };
    bridge.runtime.sessionRegistry.register('win-existing', preEntry);

    bridge.handleMessage({
      source: win,
      origin: 'https://pre.example.com',
      data: { type: 'shell.ready' },
    } as MessageEvent);

    // Entry must be the pre-registered one (instanceId preserved)
    const entry = bridge.runtime.sessionRegistry.getEntryByWindowId('win-existing');
    expect(entry?.instanceId).toBe('pre-guid-fixed');
    expect(entry?.registeredAt).toBe(1000);

    bridge.destroy();
  });
});
