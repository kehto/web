import { describe, expect, it } from 'vitest';
import { admitPermissionGrants } from './permission-capacity.js';
import { createPermissionState, evaluatePermissions, putPermissionGrant } from './permissions.js';
import type { PermissionGrant, PermissionPrincipal, PermissionRequirement, PermissionState } from './permission-types.js';

const hash = 'c'.repeat(64);
const napplet = (name: string): PermissionPrincipal => ({ kind: 'development', target: `http://${name}.localhost`, artifactHash: hash });
const alice = napplet('alice');
const bob = napplet('bob');
const origin = (index: number): PermissionRequirement => ({
  category: 'network', domain: 'relay', operation: 'relay.subscribe', scope: { kind: 'origin', value: `wss://relay-${index}.example` },
});
function grant(principal: PermissionPrincipal, index: number, lifetime: PermissionGrant['lifetime'] = 'session', id = `${principal.kind === 'development' ? principal.target : ''}-${index}`): PermissionGrant {
  return {
    id, principal, permission: origin(index), effect: 'allow', lifetime,
    ...(lifetime !== 'persistent' ? { sessionId: 's' } : {}), ...(lifetime === 'once' ? { requestId: `r${index}` } : {}),
  };
}
function fill(principal: PermissionPrincipal, count: number, from = 0, state: PermissionState = createPermissionState()): PermissionState {
  for (let index = from; index < from + count; index++) state = admitPermissionGrants(state, [grant(principal, index)], { maxGrants: 16, maxGrantsPerPrincipal: 8 }).state;
  return state;
}

describe('fair grant admission (kehto/web#513)', () => {
  it('keeps each napplet inside its share by evicting its own oldest session grant', () => {
    const state = fill(alice, 8);
    const { state: next, evicted } = admitPermissionGrants(state, [grant(alice, 8)], { maxGrants: 16, maxGrantsPerPrincipal: 8 });
    expect(next.grants).toHaveLength(8);
    expect(evicted.map((item) => item.id)).toEqual([grant(alice, 0).id]);
    expect(next.grants.map((item) => item.id)).toContain(grant(alice, 8).id);
  });

  it("doesn't let one napplet starve another when the table is full", () => {
    // Alice holds 12 of 16 only because her share allows it; Bob still gets in.
    let state = createPermissionState();
    for (let index = 0; index < 12; index++) state = admitPermissionGrants(state, [grant(alice, index)], { maxGrants: 16, maxGrantsPerPrincipal: 12 }).state;
    state = fill(bob, 4, 0, state);
    const { state: next, evicted } = admitPermissionGrants(state, [grant(bob, 4)], { maxGrants: 16, maxGrantsPerPrincipal: 12 });
    expect(next.grants).toHaveLength(16);
    expect(evicted).toHaveLength(1);
    expect(evicted[0]!.principal).toEqual(alice);
    expect(evaluatePermissions(next, { principal: bob, sessionId: 's', requestId: 'x', requirements: [origin(4)] }).missing
      .filter((item) => item.category !== 'interface')).toEqual([]);
  });

  it('never evicts persistent or once grants, and reports the limit instead', () => {
    const verified: PermissionPrincipal = { kind: 'verified', manifestKey: `nip5d:15129:${'d'.repeat(64)}`, artifactHash: hash };
    let state = createPermissionState();
    state = putPermissionGrant(state, grant(verified, 0, 'persistent'));
    state = putPermissionGrant(state, grant(verified, 1, 'once'));
    expect(() => admitPermissionGrants(state, [grant(verified, 2)], { maxGrants: 2 })).toThrow('Permission grant limit exceeded');
    expect(() => admitPermissionGrants(state, [grant(bob, 2)], { maxGrants: 2 })).toThrow('Permission grant limit exceeded');
    expect(state.grants).toHaveLength(2);
  });

  it('replaces a grant with the same id without evicting, and refuses mixed principals', () => {
    const state = fill(alice, 8);
    expect(admitPermissionGrants(state, [grant(alice, 3)], { maxGrants: 16, maxGrantsPerPrincipal: 8 }).evicted).toEqual([]);
    expect(() => admitPermissionGrants(state, [grant(alice, 20), grant(bob, 20)])).toThrow(TypeError);
  });
});
