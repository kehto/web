import { describe, expect, it } from 'vitest';
import { createAclState, createRuntime } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

const principal = ['', 'alpha', 'a'.repeat(64)] as const;

describe('runtime ACL quota administration', () => {
  it.each(['permissive', 'restrictive'] as const)('sets and persists an isolated quota with %s policy', (policy) => {
    const { hooks, aclStore } = createMockRuntimeAdapter();
    const acl = createAclState(hooks.aclPersistence, policy);
    expect(acl.getStateQuota(...principal)).toBe(524288);
    const allowed = acl.check(...principal, 'fs:write');
    acl.setStateQuota(...principal, 1024);
    expect(acl.getStateQuota(...principal)).toBe(1024);
    expect(acl.getEntry(...principal)?.stateQuota).toBe(1024);
    expect(acl.check(...principal, 'fs:write')).toBe(allowed);
    expect(acl.getStateQuota('', 'beta', principal[2])).toBe(524288);
    expect(acl.getStateQuota('', principal[1], 'b'.repeat(64))).toBe(524288);
    expect(aclStore.data).toBeNull();
    acl.persist();
    const restored = createAclState(hooks.aclPersistence, policy);
    restored.load();
    expect(restored.getStateQuota(...principal)).toBe(1024);
    acl.block(...principal);
    acl.setStateQuota(...principal, 0);
    expect(acl.isBlocked(...principal)).toBe(true);
    expect(acl.getStateQuota(...principal)).toBe(0);
    acl.setStateQuota(...principal, Number.MAX_SAFE_INTEGER);
    expect(acl.getStateQuota(...principal)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([-1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '1024', null, undefined])
    ('rejects malformed byte count %s without mutating policy', (bytes) => {
      const { hooks } = createMockRuntimeAdapter();
      const acl = createAclState(hooks.aclPersistence);
      expect(() => acl.setStateQuota(...principal, bytes as number)).toThrow(RangeError);
      expect(acl.getAllEntries()).toEqual([]);
      expect(acl.getStateQuota(...principal)).toBe(524288);
    });

  it('uses the configured quota at the storage boundary without evicting existing values', () => {
    const { hooks, stateStore, sent } = createMockRuntimeAdapter();
    const runtime = createRuntime(hooks);
    runtime.sessionRegistry.register('alpha', createNip5dSessionEntry('alpha', principal[1], principal[2]));
    const request = (type: string, value?: string) => {
      sent.length = 0;
      runtime.handleMessage('alpha', { type, id: 'storage-probe', key: 'key', value } as NappletMessage);
      return sent.at(-1)?.message;
    };
    try {
      expect(request('storage.set', 'é')).toMatchObject({ type: 'storage.set.result', ok: true });
      const [key, value] = [...stateStore][0]!;
      const exactBytes = new TextEncoder().encode(key + value).byteLength;
      request('storage.remove');
      runtime.aclState.setStateQuota(...principal, exactBytes);
      expect(request('storage.set', 'é')).toMatchObject({ ok: true });
      runtime.aclState.setStateQuota(...principal, 0);
      expect(request('storage.get')).toMatchObject({ value: 'é' });
      expect(request('storage.set', 'x')).toMatchObject({ error: expect.stringContaining('quota exceeded') });
      request('storage.remove');
      runtime.aclState.setStateQuota(...principal, exactBytes);
      expect(request('storage.set', 'éx')).toMatchObject({ error: expect.stringContaining('quota exceeded') });
      expect(stateStore.size).toBe(0);
    } finally {
      runtime.destroyWindow('alpha');
      runtime.destroy();
    }
  });
});
