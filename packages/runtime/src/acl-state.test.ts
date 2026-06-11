import { describe, expect, it } from 'vitest';
import { createAclState } from './acl-state.js';
import type { AclPersistence } from './types.js';

function makePersistence(initial: string | null = null): AclPersistence & { data: string | null } {
  return {
    data: initial,
    persist(data: string): void {
      this.data = data;
    },
    load(): string | null {
      return this.data;
    },
  };
}

describe('runtime ACL state', () => {
  it('preserves runtime-only permissive capabilities when the first mutation is a revoke', () => {
    const persistence = makePersistence();
    const acl = createAclState(persistence, 'permissive');

    acl.revoke('', 'chat', 'hash', 'relay:write');

    expect(acl.check('', 'chat', 'hash', 'relay:write')).toBe(false);
    expect(acl.check('', 'chat', 'hash', 'relay:read')).toBe(true);
    expect(acl.check('', 'chat', 'hash', 'identity:decrypt')).toBe(true);
    expect(acl.check('', 'chat', 'hash', 'notify:send')).toBe(true);
    expect(acl.check('', 'chat', 'hash', 'theme:read')).toBe(true);

    acl.persist();
    const restored = createAclState(persistence, 'permissive');
    restored.load();

    expect(restored.check('', 'chat', 'hash', 'relay:write')).toBe(false);
    expect(restored.check('', 'chat', 'hash', 'identity:decrypt')).toBe(true);
    expect(restored.check('', 'chat', 'hash', 'notify:send')).toBe(true);
    expect(restored.check('', 'chat', 'hash', 'theme:read')).toBe(true);
  });

  it('restores all runtime capabilities after blocking and unblocking a fresh permissive identity', () => {
    const acl = createAclState(makePersistence(), 'permissive');

    acl.block('', 'feed', 'hash');
    expect(acl.isBlocked('', 'feed', 'hash')).toBe(true);
    expect(acl.check('', 'feed', 'hash', 'theme:read')).toBe(false);

    acl.unblock('', 'feed', 'hash');
    expect(acl.isBlocked('', 'feed', 'hash')).toBe(false);
    expect(acl.check('', 'feed', 'hash', 'relay:read')).toBe(true);
    expect(acl.check('', 'feed', 'hash', 'identity:decrypt')).toBe(true);
    expect(acl.check('', 'feed', 'hash', 'notify:send')).toBe(true);
    expect(acl.check('', 'feed', 'hash', 'theme:read')).toBe(true);
  });
});
