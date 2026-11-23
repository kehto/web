/**
 * kehto/web#488: a Paja frame retired by the Firewall (a revoked grant, a
 * tightened rule) goes through the bridge's full revoke teardown, the same one
 * the e2e harness uses for `__unloadNapplet__`. Real bridge, real MessageChannel.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import { resolveNapplet } from '@kehto/nip/5d';
import { createShellBridge, NAPPLET_HELLO, originRegistry, type NappletRevocation, type ShellAdapter } from '@kehto/shell';
import type { ServiceHandler } from '@kehto/runtime';
import { navigateFrame } from './browser-target-frame.js';
import type { PajaHostConfig } from './options.js';
import type { PajaResolvedPointer } from './runtime-resolver.js';

const LOCKED_HOST = { querySelectorAll: () => [{ content: "frame-src 'none'" }] };
const config = { target: { mode: 'runtime-pointer' }, window: { id: 'retire' } } as PajaHostConfig;
const html = '<html><head><title>retire</title></head><body>Verified bytes</body></html>';
const bytes = new TextEncoder().encode(html);
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

async function sha256hex(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value.slice().buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function themeTarget(): Promise<PajaResolvedPointer> {
  const tags = [['d', 'retire'], ['x', await sha256hex(bytes)], ['R', 'theme']];
  const event = finalizeEvent({ kind: 35129, created_at: 1, content: 'Retire napplet', tags }, new Uint8Array(32).fill(0x22));
  const resolved = await resolveNapplet({ event, fetchBlob: async () => bytes });
  return { ...resolved, event, pointer: { type: 'nevent', value: 'retire-pointer', id: event.id, relays: [] }, relays: [], blossomServers: [] };
}

function setup() {
  const revocations: NappletRevocation[] = [];
  const destroyed: string[] = [];
  const permissionRevoked: string[] = [];
  const theme: ServiceHandler = {
    descriptor: { name: 'theme', version: '1.0.0' },
    handleMessage() {},
    onWindowDestroyed: (windowId) => { destroyed.push(windowId); },
    onPermissionRevoked: (windowId) => { permissionRevoked.push(windowId); },
  };
  const adapter: ShellAdapter = {
    services: { theme },
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    crypto: { verifyEvent: async () => false },
    hotkeys: { executeHotkeyFromForward() {} },
    windowManager: { createWindow: () => null },
    relayConfig: {
      addRelay() {}, removeRelay() {},
      getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
      getNip66Suggestions: () => [],
    },
    relayPool: {
      getRelayPool: () => null, trackSubscription() {}, untrackSubscription() {},
      openScopedRelay() {}, closeScopedRelay() {}, publishToScopedRelay: () => false,
      selectRelayTier: () => [],
    },
    workerRelay: { getWorkerRelay: () => null },
    permissions: {
      now: Date.now,
      prompt: async () => ({ effect: 'allow', lifetime: 'session' }),
      createCancellation: () => new AbortController(),
      schedule(callback, delayMs) { const timer = setTimeout(callback, delayMs); return () => clearTimeout(timer); },
    },
    onNappletRevoked: (revocation) => { revocations.push(revocation); },
  };
  const bridge = createShellBridge(adapter);
  const win = { postMessage: vi.fn() } as unknown as Window;
  const frame = { contentWindow: win, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null),
    setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  const channel = new MessageChannel();
  const hello = () => bridge.handleMessage({
    source: win, origin: 'null', data: { type: NAPPLET_HELLO }, ports: [channel.port2],
  } as unknown as MessageEvent);
  return { adapter, bridge, frame, napplet: channel.port1, hello, revocations, destroyed, permissionRevoked };
}

afterEach(() => { originRegistry.clear(); });

describe('Paja frame retirement (kehto/web#488)', () => {
  it('tears a retired, bound frame down through the bridge revoke path', async () => {
    const { adapter, bridge, frame, napplet, hello, revocations, destroyed, permissionRevoked } = setup();
    const registered = vi.fn();
    const windowId = await navigateFrame(frame, config, 1, adapter, bridge.runtime, await themeTarget(), {
      onRegistered: registered,
      revokeNapplet: (retired) => bridge.revokeNapplet(retired, 'host'),
    });
    expect(windowId).toBe('retire:1');
    hello();
    await flush();
    expect(originRegistry.getPort(windowId!)).toBeDefined();
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId(windowId!)).toBeDefined();
    expect(destroyed).toEqual([]);

    const grant = bridge.runtime.permissions!.grants.find((item) => item.permission.domain === 'theme');
    expect(grant).toBeDefined();
    bridge.runtime.permissions!.revoke(grant!.id);

    expect(frame.srcdoc).toBe('<!doctype html><html><body></body></html>');
    expect(registered).toHaveBeenLastCalledWith(null);
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId(windowId!)).toBeUndefined();
    // kehto/web#498: the admission retire and the bridge revoke both tear the
    // window down; services still hear exactly one destroy for the registration.
    expect(destroyed).toEqual([windowId]);
    expect(permissionRevoked).toEqual([windowId]);
    expect(originRegistry.getPort(windowId!)).toBeUndefined();
    expect(originRegistry.getWindowId(frame.contentWindow!)).toBeUndefined();
    // Reported once, as a host revoke: the bridge's own teardown ran.
    expect(revocations).toEqual([expect.objectContaining({ windowId, reason: 'host' })]);
    // A revoked binding stays revoked: a late hello from the spent Window is ignored.
    hello();
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId(windowId!)).toBeUndefined();
    napplet.close();
    bridge.destroy();
  });

  it('still retires the frame when the host gives no revoke callback', async () => {
    const { adapter, bridge, frame, hello, revocations } = setup();
    const windowId = await navigateFrame(frame, config, 1, adapter, bridge.runtime, await themeTarget());
    hello();
    await flush();
    const grant = bridge.runtime.permissions!.grants.find((item) => item.permission.domain === 'theme');
    bridge.runtime.permissions!.revoke(grant!.id);
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId(windowId!)).toBeUndefined();
    expect(originRegistry.getWindowId(frame.contentWindow!)).toBeUndefined();
    expect(revocations).toEqual([]);
    bridge.destroy();
  });
});
