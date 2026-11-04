import { describe, expect, it } from 'vitest';
import { createAclState } from './acl-state.js';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter } from './test-utils.js';
import type { AclPersistence, RuntimeAdapter } from './types.js';

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
