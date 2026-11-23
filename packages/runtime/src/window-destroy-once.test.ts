/**
 * kehto/web#498: one window retirement can arrive through several teardown
 * entry points (`destroyWindow`, `sessionRegistry.unregister`, a bridge revoke
 * that calls both again). Services hear `onWindowDestroyed` at most once per
 * session registration; a later registration of the same windowId is a new
 * lifetime and gets its own destroy. Permission revocation is a separate
 * callback and never consumes the registration's destroy.
 */
import { describe, expect, it, vi } from 'vitest';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { ServiceHandler } from './service-types.js';

declare const AbortController: { new(): { readonly signal: unknown; abort(reason?: unknown): void } };
declare function setTimeout(callback: () => void, ms: number): unknown;

const settle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

function fixture(withPermissions: boolean) {
  const destroyed: string[] = [];
  const revoked: string[] = [];
  const handled: string[] = [];
  const counting: ServiceHandler = {
    descriptor: { name: 'counting', version: '1.0.0' },
    messageCapabilities: { 'counting.ping': null },
    handleMessage: (windowId) => { handled.push(windowId); },
    onWindowDestroyed: (windowId) => { destroyed.push(windowId); },
    onPermissionRevoked: (windowId) => { revoked.push(windowId); },
  };
  const legacyDestroyed: string[] = [];
  const legacy: ServiceHandler = {
    descriptor: { name: 'legacy', version: '1.0.0' },
    handleMessage() {},
    onWindowDestroyed: (windowId) => { legacyDestroyed.push(windowId); },
  };
  const { hooks } = createMockRuntimeAdapter({
    services: { counting, legacy },
    isDomainAllowed: () => true,
    ...(withPermissions ? {
      permissions: {
        now: () => 0,
        prompt: vi.fn(async () => ({ effect: 'allow' as const, lifetime: 'session' as const })),
        createCancellation: () => new AbortController() as never,
        schedule: () => () => {},
      },
    } : {}),
  });
  const runtime = createRuntime(hooks);
  const register = (windowId = 'window') => runtime.sessionRegistry.register(windowId, {
    ...createNip5dSessionEntry(windowId, 'app', 'a'.repeat(64)),
    permissionPrincipal: { kind: 'development' as const, target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) },
  });
  return { runtime, register, destroyed, revoked, legacyDestroyed, handled };
}

/** The Paja admission retire followed by the bridge revoke teardown (#495). */
function retireThroughEveryPath(runtime: ReturnType<typeof createRuntime>, windowId = 'window'): void {
  runtime.destroyWindow(windowId);
  runtime.sessionRegistry.unregister(windowId);
  runtime.destroyWindow(windowId);
  runtime.sessionRegistry.unregister(windowId);
}

describe.each([true, false])('window destroy notifications (permissions: %s)', (withPermissions) => {
  it('notifies services once when one retire runs through every teardown path', () => {
    const f = fixture(withPermissions);
    f.register();
    expect(f.destroyed).toEqual([]);
    retireThroughEveryPath(f.runtime);
    expect(f.destroyed).toEqual(['window']);
    expect(f.legacyDestroyed).toEqual(['window']);
    f.runtime.destroy();
  });

  it('notifies once when unregister runs before destroyWindow', () => {
    const f = fixture(withPermissions);
    f.register();
    f.runtime.sessionRegistry.unregister('window');
    f.runtime.destroyWindow('window');
    expect(f.destroyed).toEqual(['window']);
    f.runtime.destroy();
  });

  it('gives a later registration of the same windowId its own destroy', () => {
    const f = fixture(withPermissions);
    f.register();
    retireThroughEveryPath(f.runtime);
    f.register();
    expect(f.destroyed).toEqual(['window']);
    retireThroughEveryPath(f.runtime);
    expect(f.destroyed).toEqual(['window', 'window']);
    f.runtime.destroy();
  });

  it('never leaves state a source gathered after a cleanup destroy without its own destroy', async () => {
    const f = fixture(withPermissions);
    const admit = async () => {
      if (!withPermissions) return;
      const admission = await f.runtime.permissions!.admit('window', { available: ['counting'], required: ['counting'], optional: [] });
      expect(admission.status).toBe('admitted');
    };
    f.register();
    await admit();
    f.runtime.handleMessage('window', { type: 'counting.ping' });
    await settle();
    expect(f.handled).toEqual(['window']);
    f.runtime.destroyWindow('window');
    f.runtime.handleMessage('window', { type: 'counting.ping' });
    await settle();
    // The permission runtime retires the source; a legacy host keeps it live.
    const afterCleanup = withPermissions ? ['window'] : ['window', 'window'];
    expect(f.handled).toEqual(afterCleanup);
    f.runtime.sessionRegistry.unregister('window');
    f.runtime.destroyWindow('window');
    expect(f.destroyed).toEqual(afterCleanup);
    f.runtime.destroy();
  });

  it('keeps destroys of different windows independent', () => {
    const f = fixture(withPermissions);
    f.register('a');
    f.register('b');
    retireThroughEveryPath(f.runtime, 'a');
    retireThroughEveryPath(f.runtime, 'b');
    expect(f.destroyed).toEqual(['a', 'b']);
    f.runtime.destroy();
  });
});

describe('window destroy notifications with the permission runtime', () => {
  it('retires a replaced registration exactly once, then the replacement once', () => {
    const f = fixture(true);
    f.register();
    f.register();
    expect(f.destroyed).toEqual(['window']);
    retireThroughEveryPath(f.runtime);
    expect(f.destroyed).toEqual(['window', 'window']);
    f.runtime.destroy();
  });

  it('notifies each live registration once when the session registry is cleared', () => {
    const f = fixture(true);
    f.register('a');
    f.register('b');
    f.runtime.destroyWindow('a');
    f.runtime.sessionRegistry.clear();
    f.runtime.destroyWindow('b');
    expect(f.destroyed).toEqual(['a', 'b']);
    f.runtime.destroy();
  });

  it('does not let permission revocation consume the registration destroy', async () => {
    const f = fixture(true);
    f.register();
    const admission = await f.runtime.permissions!.admit('window', { available: ['theme'], required: ['theme'], optional: [] });
    expect(admission.status).toBe('admitted');
    const grant = f.runtime.permissions!.grants.find((item) => item.permission.domain === 'theme');
    f.runtime.permissions!.revoke(grant!.id);
    expect(f.revoked).toEqual(['window']);
    expect(f.destroyed).toEqual([]);
    // A handler without onPermissionRevoked keeps its documented fallback.
    expect(f.legacyDestroyed).toEqual(['window']);
    retireThroughEveryPath(f.runtime);
    expect(f.destroyed).toEqual(['window']);
    expect(f.legacyDestroyed).toEqual(['window', 'window']);
    f.runtime.destroy();
  });
});

describe('window destroy notifications without the permission runtime', () => {
  it('keeps replacement registrations silent, as before', () => {
    const f = fixture(false);
    f.register();
    f.register();
    expect(f.destroyed).toEqual([]);
    retireThroughEveryPath(f.runtime);
    expect(f.destroyed).toEqual(['window']);
    f.runtime.destroy();
  });
});

describe('window destroy notifications for windows this runtime never registered', () => {
  it('keeps notifying on every destroyWindow call, as before', () => {
    const f = fixture(true);
    f.runtime.destroyWindow('stranger');
    f.runtime.destroyWindow('stranger');
    expect(f.destroyed).toEqual(['stranger', 'stranger']);
    f.runtime.destroy();
  });

  it('forgets only the oldest retired windows once the spent set is full', () => {
    const f = fixture(false);
    for (let index = 0; index <= 1024; index += 1) {
      f.register(`w${index}`);
      f.runtime.destroyWindow(`w${index}`);
    }
    f.destroyed.length = 0;
    f.runtime.destroyWindow('w1024');
    f.runtime.destroyWindow('w1');
    expect(f.destroyed).toEqual([]);
    // Evicted: a very late duplicate falls back to the unregistered behavior.
    f.runtime.destroyWindow('w0');
    expect(f.destroyed).toEqual(['w0']);
    f.runtime.destroy();
  });
});
