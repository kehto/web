/**
 * Paja NIP-5D host integration (nostr-protocol/nips#2303 @ 51ef0cd): window
 * traffic from Paja frames goes to the bridge (hello binding), port traffic is
 * observed for readiness, revoked frames are removed or replaced, and the
 * verified launcher's two host messages never reach the bridge.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { originRegistry } from '@kehto/shell';

import type { PajaBrowserState, PajaBrowserStateContext } from './browser-host.js';
import {
  handlePajaNappletRevoked,
  handlePajaWindowMessage,
  observePajaNappletMessage,
} from './browser-nip5d-host.js';

function bindPort(windowId: string): void {
  originRegistry.bindPort(windowId, { onmessage: null, postMessage: () => {}, close: () => {} } as unknown as MessagePort);
}

function setup() {
  const launcherWindow = { postMessage: vi.fn() } as unknown as Window;
  const singleWindow = { postMessage: vi.fn() } as unknown as Window;
  const launcherFrame = { remove: vi.fn() };
  const launcher = { windowId: 'launcher', frame: launcherFrame, progress: {}, ready: vi.fn(), result: vi.fn() };
  const handleMessage = vi.fn();
  const runtime = {
    launcherFrames: new Map([[launcherWindow, launcher]]),
    intentSenderIds: new Map([['launcher', 'catalog']]),
    explicitIntentHandlers: new Map(),
    readyWindowIds: new Set<string>(),
    currentWindowId: 'single' as string | null,
  };
  const state = { tabs: [], messageLog: [], messageFilter: '' } as unknown as PajaBrowserState;
  const context = {
    runtime,
    frame: { contentWindow: singleWindow },
    bridge: { handleMessage },
  } as unknown as PajaBrowserStateContext;
  const setStatus = vi.fn();
  return { state, context, runtime, launcher, launcherWindow, launcherFrame, singleWindow, handleMessage, setStatus };
}

describe('Paja NIP-5D host integration', () => {
  beforeEach(() => {
    originRegistry.clear();
    vi.stubGlobal('document', { getElementById: () => null });
  });
  afterEach(() => {
    originRegistry.clear();
    vi.unstubAllGlobals();
  });

  it('forwards window-level traffic from Paja frames to the bridge and ignores foreign sources', () => {
    const { state, context, singleWindow, handleMessage } = setup();
    const hello = { source: singleWindow, data: { type: 'napplet.hello' }, ports: [] } as unknown as MessageEvent;
    handlePajaWindowMessage(state, context, hello);
    handlePajaWindowMessage(state, context, { source: {}, data: { type: 'napplet.hello' } } as unknown as MessageEvent);
    expect(handleMessage).toHaveBeenCalledExactlyOnceWith(hello);
  });

  it('handles the verified launcher host messages only while its port is bound, never via the bridge', () => {
    const { state, context, launcher, launcherWindow, handleMessage } = setup();
    originRegistry.register(launcherWindow, 'launcher', { dTag: 'paja-intent-launcher', aggregateHash: 'h' });
    const ready = { source: launcherWindow, data: { type: 'paja.intent.launcher.ready' } } as unknown as MessageEvent;
    const result = { source: launcherWindow, data: { type: 'paja.intent.launcher.result', correlation: 'c1', result: { ok: true } } } as unknown as MessageEvent;

    handlePajaWindowMessage(state, context, ready);
    expect(launcher.ready).not.toHaveBeenCalled();

    bindPort('launcher');
    handlePajaWindowMessage(state, context, ready);
    handlePajaWindowMessage(state, context, result);
    expect(launcher.ready).toHaveBeenCalledOnce();
    expect(launcher.result).toHaveBeenCalledExactlyOnceWith('c1', { ok: true });
    expect(handleMessage).not.toHaveBeenCalled();

    // Any other window-level message from the launcher still reaches the bridge (and revokes).
    const nap = { source: launcherWindow, data: { type: 'intent.invoke' } } as unknown as MessageEvent;
    handlePajaWindowMessage(state, context, nap);
    expect(handleMessage).toHaveBeenCalledExactlyOnceWith(nap);
  });

  it('marks the single frame ready from shell.ready observed on its port', () => {
    const { state, context, runtime, setStatus } = setup();
    observePajaNappletMessage(state, context, 'single', { type: 'relay.subscribe' } as never, { setStatus });
    expect(setStatus).not.toHaveBeenCalled();
    observePajaNappletMessage(state, context, 'single', { type: 'shell.ready' } as never, { setStatus });
    expect(runtime.readyWindowIds.has('single')).toBe(true);
    expect(setStatus).toHaveBeenCalledWith(state, 'ready');
  });

  it('removes a revoked launcher frame and forgets its identity', () => {
    const { state, context, runtime, launcherFrame, setStatus } = setup();
    handlePajaNappletRevoked(state, context, { windowId: 'launcher', reason: 'second-load', detail: 'x' }, { setStatus });
    expect(launcherFrame.remove).toHaveBeenCalledOnce();
    expect(runtime.launcherFrames.size).toBe(0);
    expect(runtime.intentSenderIds.has('launcher')).toBe(false);
    expect(state.messageLog.at(-1)).toMatchObject({ direction: 'paja', windowId: 'launcher' });
  });

  it('replaces the revoked single frame with a fresh iframe and reports the error state', () => {
    const { state, context, runtime, singleWindow, setStatus } = setup();
    originRegistry.register(singleWindow, 'single', { dTag: 'single', aggregateHash: 'h' });
    originRegistry.unregister('single'); // the bridge already revoked: the Window is spent
    runtime.readyWindowIds.add('single');
    const fresh = { removeAttribute: vi.fn(), addEventListener: vi.fn() };
    const used = { contentWindow: singleWindow, cloneNode: vi.fn(() => fresh), replaceWith: vi.fn() };
    context.frame = used as unknown as HTMLIFrameElement;

    handlePajaNappletRevoked(state, context, { windowId: 'single', reason: 'window-message', detail: 'x' }, { setStatus });

    expect(used.replaceWith).toHaveBeenCalledExactlyOnceWith(fresh);
    expect(fresh.removeAttribute).toHaveBeenCalledWith('srcdoc');
    expect(context.frame).toBe(fresh);
    expect(runtime.currentWindowId).toBeNull();
    expect(runtime.readyWindowIds.has('single')).toBe(false);
    expect(setStatus).toHaveBeenCalledWith(state, 'error');
  });
});
