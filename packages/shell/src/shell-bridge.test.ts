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
