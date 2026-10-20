import { describe, expect, it, vi } from 'vitest';
import { createPermissionState, putPermissionGrant, serializePermissions } from '@kehto/firewall';
import type { PermissionGrant } from '@kehto/firewall';
import { createPermissionStore } from './permission-state.js';

const grant: PermissionGrant = {
  id: 'remembered', principal: { kind: 'verified', manifestKey: `nip5d:15129:${'b'.repeat(64)}`, artifactHash: 'a'.repeat(64) },
  permission: { category: 'interface', domain: 'link', operation: 'access', scope: { kind: 'exact', value: 'link' } },
  effect: 'allow', lifetime: 'persistent',
};
const saved = putPermissionGrant(createPermissionState(), grant);

describe('permission persistence', () => {
  it('loads versioned durable grants and never silently migrates a broad legacy allow', () => {
    const store = createPermissionStore({ invalidate: vi.fn(), persistence: { load: () => serializePermissions(saved), persist: vi.fn() } });
    expect(store.load()).toBe(true);
    expect(store.getState()).toEqual(saved);
    const onError = vi.fn();
    const legacy = createPermissionStore({ invalidate: vi.fn(), onError,
      persistence: { load: () => '{"policies":{"app":"allow"}}', persist: vi.fn() } });
    expect(legacy.load()).toBe(false);
    expect(legacy.available).toBe(false);
    expect(legacy.getState().grants).toEqual([]);
    expect(onError).toHaveBeenCalledWith('unsupported-version');
  });

  it('publishes durable authority only after a successful write', () => {
    const onError = vi.fn();
    const persist = vi.fn((): void => { throw new Error('disk full'); });
    const store = createPermissionStore({ invalidate: vi.fn(), onError, persistence: { load: () => null, persist } });
    expect(() => store.commit(saved)).toThrow('not persisted');
    expect(store.getState().grants).toEqual([]);
    expect(onError).toHaveBeenCalledWith('save-failed');
    persist.mockImplementation(() => {});
    store.commit(saved);
    expect(store.getState()).toBe(saved);
  });

  it('revokes locally on storage failure, cancels live work, and retries without reloading', () => {
    const load = vi.fn(() => serializePermissions(saved));
    const persist = vi.fn((): void => { throw new Error('disk full'); });
    const invalidate = vi.fn();
    const store = createPermissionStore({ invalidate, persistence: { load, persist } });
    store.load();
    expect(store.revoke('remembered')).toBe(false);
    expect(invalidate).toHaveBeenCalledWith(undefined);
    expect(store.getState().grants).toEqual([]);
    expect(store.available).toBe(false);
    expect(store.load()).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    expect(() => store.commit(saved)).toThrow('needs recovery');
    persist.mockImplementation(() => {});
    expect(store.retryPersistence()).toBe(true);
    expect(store.available).toBe(true);
    expect(persist).toHaveBeenLastCalledWith(serializePermissions(createPermissionState()));
  });

  it('requires explicit clearing after a failed load', () => {
    const persist = vi.fn();
    const store = createPermissionStore({ invalidate: vi.fn(), persistence: { load: () => { throw new Error('locked'); }, persist } });
    expect(store.load()).toBe(false);
    expect(store.retryPersistence()).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    expect(store.clear()).toBe(true);
    expect(store.available).toBe(true);
  });

  it('retirement removes only that session and writes no ephemeral grants', () => {
    const invalidate = vi.fn();
    const persist = vi.fn();
    const store = createPermissionStore({ invalidate, persistence: { load: () => null, persist } });
    const session = { ...grant, lifetime: 'session' as const, sessionId: 'one' };
    store.commit(putPermissionGrant(createPermissionState(), session));
    expect(persist).not.toHaveBeenCalled();
    store.retire('two');
    expect(store.getState().grants).toHaveLength(1);
    store.retire('one');
    expect(store.getState().grants).toEqual([]);
    expect(invalidate).toHaveBeenLastCalledWith('one');
  });

  it('refuses to pretend a persistent grant was saved without a storage adapter', () => {
    const onError = vi.fn();
    const store = createPermissionStore({ invalidate: vi.fn(), onError });
    expect(() => store.commit(saved)).toThrow('not persisted');
    expect(onError).toHaveBeenCalledWith('storage-unavailable');
    expect(store.getState().grants).toEqual([]);
  });
});
