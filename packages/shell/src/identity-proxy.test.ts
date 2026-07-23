/**
 * identity-proxy.test.ts — Canonical shape test for the shell-side per-domain
 * proxy pattern established by Plan 12-11.
 *
 * Identity requests may be intercepted before runtime dispatch. Direct
 * identity delivery fails closed because it would bypass ShellBridge's live
 * session, granted-domain, and current-capability checks.
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

  it('emit() fails closed instead of bypassing ShellBridge recipient checks', () => {
    const runtime = fakeRuntime();
    const iframe = fakeIframeWindow();
    const originRegistry = fakeOriginRegistry(iframe as unknown as Window);
    const proxy = createIdentityProxy({ runtime, originRegistry });

    const envelope = {
      type: 'identity.getPublicKey.result',
      id: 'q1',
      pubkey: 'abc',
    } as unknown as NappletMessage;
    expect(() => proxy.emit('win-1', envelope)).toThrow(
      'use ShellBridge.publishIdentityChanged()',
    );
    expect(iframe.postMessage).not.toHaveBeenCalled();
  });

  it('emit() also fails closed for an unknown window', () => {
    const runtime = fakeRuntime();
    const originRegistry = fakeOriginRegistry(null);
    const proxy = createIdentityProxy({ runtime, originRegistry });

    const envelope = {
      type: 'identity.getPublicKey.result',
      id: 'q1',
      pubkey: 'abc',
    } as unknown as NappletMessage;

    expect(() => proxy.emit('missing-win', envelope)).toThrow(
      'use ShellBridge.publishIdentityChanged()',
    );
    expect(runtime.handleMessage).not.toHaveBeenCalled();
  });
});
