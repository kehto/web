import { describe, expect, it } from 'vitest';
import {
  ALL_CAPABILITIES, CAP_RELAY_READ, RESERVED_NAP_DOMAINS, block, check, checkExtension, createState,
  deserialize, grant, grantExtension, isExtensionCapability, isExtensionDomain, migrateAclState, revoke,
  revokeExtension, serialize, unblock, validateExtensionCapability, validateExtensionDomain,
} from './index.js';

const id = { dTag: 'probe', hash: 'aa' };

describe('extension domain namespace', () => {
  it('accepts x- domains that collide with nothing', () => {
    for (const domain of ['x-echo', 'x-weather-feed', 'x-a1']) expect(validateExtensionDomain(domain)).toBeNull();
  });

  it('rejects every reserved domain, including llm, and x- aliases of them', () => {
    for (const domain of RESERVED_NAP_DOMAINS) {
      expect(isExtensionDomain(domain)).toBe(false);
      expect(validateExtensionDomain(`x-${domain}`)).toMatch(/reserved|aliases/);
    }
    expect(validateExtensionDomain('llm')).toMatch(/reserved NAP domain/);
    expect(validateExtensionDomain('x-llm')).toMatch(/aliases the reserved NAP domain llm/);
  });

  it('rejects unprefixed, malformed and overlong names', () => {
    for (const domain of ['echo', 'X-echo', 'x-', 'x--echo', 'x-echo-', 'x-ech.o', 'x-1echo', `x-${'a'.repeat(70)}`, '']) {
      expect(isExtensionDomain(domain)).toBe(false);
    }
  });
});

describe('extension capability namespace', () => {
  it('accepts own-domain x- capabilities', () => {
    expect(validateExtensionCapability('x-echo:send', 'x-echo')).toBeNull();
    expect(isExtensionCapability('x-echo:receive-push')).toBe(true);
  });

  it('never redefines built-in capabilities, llm:generate included', () => {
    for (const capability of ALL_CAPABILITIES) expect(isExtensionCapability(capability)).toBe(false);
    expect(validateExtensionCapability('llm:generate')).toMatch(/built-in capability/);
    expect(validateExtensionCapability('x-llm:generate')).toMatch(/aliases/);
  });

  it('rejects borrowing another domain capability and malformed strings', () => {
    expect(validateExtensionCapability('x-other:send', 'x-echo')).toMatch(/cannot borrow/);
    for (const capability of ['x-echo', 'x-echo:', 'x-echo:a:b', 'x-echo:Send', ':send']) {
      expect(isExtensionCapability(capability)).toBe(false);
    }
  });
});

describe('extension grants', () => {
  it('follows the default policy until an explicit decision exists', () => {
    expect(checkExtension(createState('permissive'), id, 'x-echo:send')).toBe(true);
    expect(checkExtension(createState('restrictive'), id, 'x-echo:send')).toBe(false);
    // An entry created by an unrelated built-in revoke keeps the permissive default.
    const permissive = revoke(createState('permissive'), id, CAP_RELAY_READ);
    expect(checkExtension(permissive, id, 'x-echo:send')).toBe(true);
  });

  it('grants, revokes and blocks without touching built-in bits', () => {
    let state = grant(createState('restrictive'), id, CAP_RELAY_READ);
    state = grantExtension(state, id, 'x-echo:send');
    expect(checkExtension(state, id, 'x-echo:send')).toBe(true);
    expect(state.entries['probe:aa'].caps).toBe(CAP_RELAY_READ);
    state = block(state, id);
    expect(checkExtension(state, id, 'x-echo:send')).toBe(false);
    state = unblock(state, id);
    expect(checkExtension(state, id, 'x-echo:send')).toBe(true);
    state = revokeExtension(state, id, 'x-echo:send');
    expect(checkExtension(state, id, 'x-echo:send')).toBe(false);
    expect(check(state, id, CAP_RELAY_READ)).toBe(true);
  });

  it('ignores invalid and built-in strings in grant and check', () => {
    const state = createState('restrictive');
    expect(grantExtension(state, id, 'llm:generate')).toBe(state);
    expect(checkExtension(createState('permissive'), id, 'relay:read')).toBe(false);
  });

  it('round-trips through serialize and drops tampered decisions', () => {
    const state = grantExtension(createState('restrictive'), id, 'x-echo:send');
    expect(deserialize(serialize(state))).toEqual(state);
    const tampered = JSON.stringify({
      defaultPolicy: 'restrictive',
      entries: { 'probe:aa': { caps: 0, blocked: false, quota: 1, ext: { 'llm:generate': true, 'x-echo:send': 'yes', 'x-echo:ping': true } } },
    });
    expect(deserialize(tampered).entries['probe:aa'].ext).toEqual({ 'x-echo:ping': true });
  });

  it('merges decisions when migrating legacy keys', () => {
    const legacy = {
      defaultPolicy: 'restrictive' as const,
      entries: {
        'pk:probe:aa': { caps: 0, blocked: false, quota: 1, ext: { 'x-echo:send': true } },
        'probe:aa': { caps: 0, blocked: false, quota: 1, ext: { 'x-echo:send': false, 'x-echo:ping': false } },
      },
    };
    expect(migrateAclState(legacy).entries['probe:aa'].ext).toEqual({ 'x-echo:send': true, 'x-echo:ping': false });
  });
});
