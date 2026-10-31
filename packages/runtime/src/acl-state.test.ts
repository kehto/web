import { describe, expect, expectTypeOf, it } from 'vitest';
import { createAclState, type AclCapability } from './acl-state.js';
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
  it('lists canonical principals that can be looked up and mutated after reload', () => {
    const persistence = makePersistence();
    const acl = createAclState(persistence, 'restrictive');
    const principals = [
      { dTag: 'alpha', aggregateHash: 'a'.repeat(64) },
      { dTag: 'beta', aggregateHash: 'b'.repeat(64) },
      { dTag: 'alpha:child', aggregateHash: 'c'.repeat(64) },
    ];
    expect(acl.getAllEntries()).toEqual([]);
    for (const { dTag, aggregateHash } of principals) acl.grant('', dTag, aggregateHash, 'relay:read');
    acl.persist();
    const restored = createAclState(persistence, 'restrictive');
    restored.load();
    const entries = restored.getAllEntries();
    expect(entries.map(({ dTag, aggregateHash }) => ({ dTag, aggregateHash }))).toEqual(principals);
    for (const entry of entries) {
      expect(entry).toEqual(restored.getEntry(entry.pubkey, entry.dTag, entry.aggregateHash));
      expect(entry.capabilities).toEqual(['relay:read']);
    }
    const target = entries[2]!;
    restored.revoke(target.pubkey, target.dTag, target.aggregateHash, 'relay:read');
    expect(restored.check('', target.dTag, target.aggregateHash, 'relay:read')).toBe(false);
    expect(restored.check('', principals[0]!.dTag, principals[0]!.aggregateHash, 'relay:read')).toBe(true);
    const blocked = entries[1]!;
    restored.block(blocked.pubkey, blocked.dTag, blocked.aggregateHash);
    expect(restored.isBlocked('', blocked.dTag, blocked.aggregateHash)).toBe(true);
    expect(restored.getStateQuota('', blocked.dTag, blocked.aggregateHash)).toBe(blocked.stateQuota);
  });

  it('returns detached identity and capability values without exposing owned state', () => {
    const acl = createAclState(makePersistence(), 'restrictive');
    const hash = 'a'.repeat(64);
    acl.grant('', 'alpha', hash, 'relay:read');
    const entry = acl.getAllEntries()[0]!;
    entry.dTag = 'edited';
    entry.aggregateHash = 'b'.repeat(64);
    entry.capabilities.length = 0;
    expect(acl.getEntry('', 'alpha', hash)).toMatchObject({
      dTag: 'alpha', aggregateHash: hash, capabilities: ['relay:read'],
    });
    expect(acl.getEntry('', 'edited', entry.aggregateHash)).toBeUndefined();
  });

  it.each(['revoke', 'block'] as const)('reports failed persistence without undoing live %s or observer effects', (mutation) => {
    const principal = ['', 'alpha', 'a'.repeat(64)] as const;
    const saved = makePersistence();
    let fail = false;
    const order: string[] = [];
    const persistence: AclPersistence = {
      load: () => saved.load(),
      persist(data) {
        order.push('persist');
        if (fail) throw new Error('test-storage-failure');
        saved.persist(data);
      },
    };
    const acl = createAclState(persistence, 'restrictive', () => {
      expect(acl.check(...principal, 'relay:read')).toBe(false);
      order.push('observer');
    });
    acl.grant(...principal, 'relay:read');
    expect(acl.persist()).toBe(true);
    order.length = 0;
    fail = true;
    if (mutation === 'revoke') acl.revoke(...principal, 'relay:read');
    else acl.block(...principal);
    expect(order).toEqual(['observer']);
    expect(acl.persist()).toBe(false);
    expect(order).toEqual(['observer', 'persist']);
    expect(acl.check(...principal, 'relay:read')).toBe(false);
    const restored = createAclState(persistence, 'restrictive');
    restored.load();
    expect(restored.check(...principal, 'relay:read')).toBe(true);
    fail = false;
    expect(acl.persist()).toBe(true);
    restored.load();
    expect(restored.check(...principal, 'relay:read')).toBe(false);
    expect(order).toEqual(['observer', 'persist', 'persist']);
  });

  it('reports clear failure while retaining the live reset and allows a durable retry', () => {
    const principal = ['', 'alpha', 'a'.repeat(64)] as const;
    const saved = makePersistence();
    let fail = false;
    const persistence: AclPersistence = {
      load: () => saved.load(),
      persist(data) {
        if (fail) throw new Error('test-storage-failure');
        saved.persist(data);
      },
    };
    const acl = createAclState(persistence, 'restrictive');
    expectTypeOf(acl.persist).returns.toEqualTypeOf<boolean>();
    expectTypeOf(acl.clear).returns.toEqualTypeOf<boolean>();
    acl.grant(...principal, 'relay:read');
    expect(acl.persist()).toBe(true);
    fail = true;
    expect(acl.clear()).toBe(false);
    expect(acl.getAllEntries()).toEqual([]);
    expect(acl.check(...principal, 'relay:read')).toBe(false);
    const restored = createAclState(persistence, 'restrictive');
    restored.load();
    expect(restored.check(...principal, 'relay:read')).toBe(true);
    fail = false;
    expect(acl.clear()).toBe(true);
    const cleared = createAclState(persistence, 'restrictive');
    cleared.load();
    expect(cleared.check(...principal, 'relay:read')).toBe(false);
    expect(saved.data).toBe('');
  });

  it('preserves runtime-only permissive capabilities when the first mutation is a revoke', () => {
    const persistence = makePersistence();
    const acl = createAclState(persistence, 'permissive');

    acl.revoke('', 'chat', 'hash', 'relay:write');

    expect(acl.check('', 'chat', 'hash', 'relay:write')).toBe(false);
    expect(acl.check('', 'chat', 'hash', 'relay:read')).toBe(true);
    expect(acl.check('', 'chat', 'hash', 'cvm:call')).toBe(true);
    expect(acl.check('', 'chat', 'hash', 'notify:send')).toBe(true);
    expect(acl.check('', 'chat', 'hash', 'theme:read')).toBe(true);
    expect(acl.check('', 'chat', 'hash', 'fs:read')).toBe(true);
    expect(acl.check('', 'chat', 'hash', 'fs:write')).toBe(true);

    acl.persist();
    const restored = createAclState(persistence, 'permissive');
    restored.load();

    expect(restored.check('', 'chat', 'hash', 'relay:write')).toBe(false);
    expect(restored.check('', 'chat', 'hash', 'cvm:call')).toBe(true);
    expect(restored.check('', 'chat', 'hash', 'notify:send')).toBe(true);
    expect(restored.check('', 'chat', 'hash', 'theme:read')).toBe(true);
    expect(restored.check('', 'chat', 'hash', 'fs:read')).toBe(true);
    expect(restored.check('', 'chat', 'hash', 'fs:write')).toBe(true);
  });

  it('restores all runtime capabilities after blocking and unblocking a fresh permissive identity', () => {
    const acl = createAclState(makePersistence(), 'permissive');

    acl.block('', 'feed', 'hash');
    expect(acl.isBlocked('', 'feed', 'hash')).toBe(true);
    expect(acl.check('', 'feed', 'hash', 'theme:read')).toBe(false);

    acl.unblock('', 'feed', 'hash');
    expect(acl.isBlocked('', 'feed', 'hash')).toBe(false);
    expect(acl.check('', 'feed', 'hash', 'relay:read')).toBe(true);
    expect(acl.check('', 'feed', 'hash', 'cvm:call')).toBe(true);
    expect(acl.check('', 'feed', 'hash', 'notify:send')).toBe(true);
    expect(acl.check('', 'feed', 'hash', 'theme:read')).toBe(true);
  });

  it('reports only revoke and block facts to the internal mutation observer', () => {
    const mutations: unknown[] = [];
    const acl = createAclState(makePersistence(), 'permissive', (mutation) => mutations.push(mutation));

    acl.grant('', 'chat', 'hash', 'notify:send');
    acl.unblock('', 'chat', 'hash');
    acl.revoke('', 'chat', 'hash', 'relay:read');
    acl.block('', 'chat', 'hash');

    expect(mutations).toEqual([
      { type: 'revoke', dTag: 'chat', aggregateHash: 'hash', capability: 'relay:read' },
      { type: 'block', dTag: 'chat', aggregateHash: 'hash' },
    ]);
  });

  it('denies and ignores strings that are neither built-in nor extension capabilities (IN-02)', () => {
    const unknown: string[] = ['x-llm:generate', 'not-a-capability', 'x-echo:Bad', 'sign:event', ''];
    const permissive = createAclState(makePersistence(), 'permissive');
    const restrictive = createAclState(makePersistence(), 'restrictive');
    for (const capability of unknown) {
      expect(permissive.check('', 'probe', 'hash', capability as AclCapability)).toBe(false);
      expect(restrictive.check('', 'probe', 'hash', capability as AclCapability)).toBe(false);
    }
    expect(permissive.check('', 'probe', 'hash', 'x-echo:send')).toBe(true);
    expect(permissive.check('', 'probe', 'hash', 'relay:read')).toBe(true);

    const mutations: unknown[] = [];
    const acl = createAclState(makePersistence(), 'permissive', (mutation) => mutations.push(mutation));
    const bogus: string = 'bogus';
    acl.grant('', 'probe', 'hash', bogus as AclCapability);
    acl.revoke('', 'probe', 'hash', bogus as AclCapability);
    expect(acl.getEntry('', 'probe', 'hash')).toBeUndefined();
    expect(acl.getAllEntries()).toEqual([]);
    expect(mutations).toEqual([]);
    acl.grant('', 'probe', 'hash', 'relay:read');
    expect(acl.getEntry('', 'probe', 'hash')?.capabilities).toContain('relay:read');
  });
});
