import { describe, expect, it, vi } from 'vitest';
import { createAclState } from './acl-state.js';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { ApprovalCancellation } from './approval-coordinator.js';
import type { AclPersistence, RuntimeAdapter } from './types.js';

declare const AbortController: { new(): ApprovalCancellation };

const known = { dTag: 'known', hash: 'a'.repeat(64) };
const unknown = { dTag: 'unknown', hash: 'b'.repeat(64) };

function memoryPersistence(data: string | null = null): AclPersistence {
  let stored = data;
  return {
    persist: (raw) => { stored = raw; },
    load: () => stored,
  };
}

/** Persisted state written under one policy, with one explicit entry. */
function savedState(policy: 'permissive' | 'restrictive'): string | null {
  let saved: string | null = null;
  const acl = createAclState({ persist: (raw) => { saved = raw; }, load: () => null }, policy);
  acl.grant('', known.dTag, known.hash, 'relay:read');
  acl.persist();
  return saved;
}

function runtimeWith(overrides: Partial<RuntimeAdapter>) {
  return createRuntime(createMockRuntimeAdapter(overrides).hooks);
}

describe('aclDefaultPolicy (#398)', () => {
  it('stays permissive for unknown identities when the host leaves it out', () => {
    const { aclState } = runtimeWith({ aclPersistence: memoryPersistence() });
    expect(aclState.check('', unknown.dTag, unknown.hash, 'relay:read')).toBe(true);
  });

  it('keeps honouring a restrictive policy already in persisted state when left out', () => {
    const { aclState } = runtimeWith({ aclPersistence: memoryPersistence(savedState('restrictive')) });
    expect(aclState.check('', unknown.dTag, unknown.hash, 'relay:read')).toBe(false);
  });

  it('starts unknown identities with nothing granted under restrictive', () => {
    const { aclState } = runtimeWith({
      aclDefaultPolicy: 'restrictive',
      aclPersistence: memoryPersistence(),
    });
    expect(aclState.check('', unknown.dTag, unknown.hash, 'relay:read')).toBe(false);

    aclState.grant('', unknown.dTag, unknown.hash, 'relay:read');
    expect(aclState.check('', unknown.dTag, unknown.hash, 'relay:read')).toBe(true);
    expect(aclState.check('', unknown.dTag, unknown.hash, 'relay:write')).toBe(false);
  });

  it('does not fall back to a permissive policy stored by an earlier run', () => {
    const { aclState } = runtimeWith({
      aclDefaultPolicy: 'restrictive',
      aclPersistence: memoryPersistence(savedState('permissive')),
    });
    expect(aclState.check('', unknown.dTag, unknown.hash, 'relay:read')).toBe(false);
  });

  it('keeps stored entries when the configured policy replaces the stored one', () => {
    const { aclState } = runtimeWith({
      aclDefaultPolicy: 'restrictive',
      aclPersistence: memoryPersistence(savedState('permissive')),
    });
    expect(aclState.check('', known.dTag, known.hash, 'relay:read')).toBe(true);
  });

  it('applies an explicit permissive policy over a stored restrictive one', () => {
    const { aclState } = runtimeWith({
      aclDefaultPolicy: 'permissive',
      aclPersistence: memoryPersistence(savedState('restrictive')),
    });
    expect(aclState.check('', unknown.dTag, unknown.hash, 'relay:read')).toBe(true);
  });

  it('stays restrictive after clear and when persisted state is corrupt', () => {
    const cleared = runtimeWith({ aclDefaultPolicy: 'restrictive', aclPersistence: memoryPersistence() }).aclState;
    cleared.clear();
    expect(cleared.check('', unknown.dTag, unknown.hash, 'relay:read')).toBe(false);

    const corrupt = runtimeWith({ aclDefaultPolicy: 'restrictive', aclPersistence: memoryPersistence('{nope') }).aclState;
    expect(corrupt.check('', unknown.dTag, unknown.hash, 'relay:read')).toBe(false);
  });
});

// A restrictive ACL caps what approvals can reach: admission covers the interface,
// and the operation is refused until the host grants the capability.
describe('aclDefaultPolicy with the approval runtime', () => {
  const hash = 'c'.repeat(64);

  async function configured(aclDefaultPolicy?: 'permissive' | 'restrictive') {
    const prompt = vi.fn(async () => ({ effect: 'allow' as const, lifetime: 'session' as const }));
    const ctx = createMockRuntimeAdapter({
      aclDefaultPolicy,
      permissions: {
        now: () => 0,
        prompt,
        createCancellation: () => new AbortController(),
        schedule: () => () => undefined,
      },
    });
    const runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register('window', {
      ...createNip5dSessionEntry('window', 'app', hash),
      permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: hash },
    });
    await runtime.permissions!.admit('window', { required: ['storage'], optional: [], available: ['storage'] });
    const set = (id: string) => runtime.handleMessage('window', { type: 'storage.set', id, key: id, value: 'v' });
    return { runtime, ctx, prompt, set };
  }

  it('still admits the interface for an unknown identity', async () => {
    const f = await configured('restrictive');
    expect(f.prompt).toHaveBeenCalledTimes(1);
    expect(f.runtime.permissions!.grants).toHaveLength(1);
    f.runtime.destroy();
  });

  it('refuses the operation with a correlated reply and no further prompt', async () => {
    const f = await configured('restrictive');
    f.prompt.mockClear();
    f.set('denied');
    expect(f.ctx.stateStore.size).toBe(0);
    expect(f.prompt).not.toHaveBeenCalled();
    expect(f.ctx.sent).toEqual([{ windowId: 'window', message: expect.objectContaining({ type: 'storage.set.result', id: 'denied', error: expect.any(String) }) }]);
    f.runtime.destroy();
  });

  it('lets the operation through once the host grants the capability', async () => {
    const f = await configured('restrictive');
    f.runtime.aclState.grant('', 'app', hash, 'state:write');
    f.set('granted');
    expect(f.ctx.stateStore.size).toBe(1);
    f.runtime.destroy();
  });

  it('keeps today\'s behaviour when the host leaves it out', async () => {
    const f = await configured();
    f.set('default');
    expect(f.ctx.stateStore.size).toBe(1);
    f.runtime.destroy();
  });
});
