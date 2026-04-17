/**
 * identity-proxy.test.ts — Canonical shape test for the shell-side per-domain
 * proxy pattern established by Plan 12-11.
 *
 * Every per-domain proxy (identity, theme, keys, media, notify) exposes the
 * same two-method surface:
 *
 *   - `dispatch(windowId, envelope)` — route napplet→shell requests to the
 *     runtime (the runtime already owns domain dispatch per Plans 12-03..12-09).
 *   - `emit(windowId, envelope)` — post a shell→napplet push envelope into
 *     the napplet iframe through the origin registry.
 *
 * The identity-proxy is the canonical example. The other four proxies share
 * the identical shape; they are covered by build + type-check.
 */

import { describe, it, expect, vi } from 'vitest';
import { createIdentityProxy } from './identity-proxy.js';
import type { Runtime } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';

// ─── Stubs ───────────────────────────────────────────────────────────────────

function fakeRuntime(): Runtime & { handleMessage: ReturnType<typeof vi.fn> } {
  // Cast via unknown — we only exercise handleMessage; the other fields
  // are not touched by the proxy's dispatch path.
  return { handleMessage: vi.fn() } as unknown as Runtime & {
    handleMessage: ReturnType<typeof vi.fn>;
  };
}

function fakeOriginRegistry(win: Window | null): {
  getIframeWindow: (windowId: string) => Window | null;
} {
  return { getIframeWindow: () => win };
}

function fakeIframeWindow(): { postMessage: ReturnType<typeof vi.fn> } {
  return { postMessage: vi.fn() };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('identity-proxy (canonical per-domain proxy shape)', () => {
  it('dispatch() delegates napplet→shell requests to runtime.handleMessage', () => {
    const runtime = fakeRuntime();
    const originRegistry = fakeOriginRegistry(null);
    const proxy = createIdentityProxy({ runtime, originRegistry });

    const envelope: NappletMessage = {
      type: 'identity.getPublicKey',
      id: 'q1',
    } as NappletMessage;
    proxy.dispatch('win-1', envelope);

    expect(runtime.handleMessage).toHaveBeenCalledTimes(1);
    expect(runtime.handleMessage).toHaveBeenCalledWith('win-1', envelope);
  });

  it('emit() posts shell→napplet push envelopes through the origin registry', () => {
    const runtime = fakeRuntime();
    const iframe = fakeIframeWindow();
    const originRegistry = fakeOriginRegistry(iframe as unknown as Window);
    const proxy = createIdentityProxy({ runtime, originRegistry });

    const envelope = {
      type: 'identity.getPublicKey.result',
      id: 'q1',
      pubkey: 'abc',
    } as unknown as NappletMessage;
    proxy.emit('win-1', envelope);

    expect(iframe.postMessage).toHaveBeenCalledTimes(1);
    expect(iframe.postMessage).toHaveBeenCalledWith(envelope, '*');
  });

  it('emit() is a no-op when the origin registry returns null (unknown window)', () => {
    const runtime = fakeRuntime();
    const originRegistry = fakeOriginRegistry(null);
    const proxy = createIdentityProxy({ runtime, originRegistry });

    const envelope = {
      type: 'identity.getPublicKey.result',
      id: 'q1',
      pubkey: 'abc',
    } as unknown as NappletMessage;

    // Must not throw, must not invoke any postMessage.
    expect(() => proxy.emit('missing-win', envelope)).not.toThrow();
    // dispatch() remains untouched too.
    expect(runtime.handleMessage).not.toHaveBeenCalled();
  });
});
