import { describe, expect, it } from 'vitest';
import {
  createPermissionRules, deserializePermissionRules, permissionRuleSubject,
  resolvePermissionRule, serializePermissionRules, setPermissionRule,
} from './permission-rules.js';
import type { PermissionPrincipal, PermissionRequirement } from './permission-types.js';

const verified: PermissionPrincipal = {
  kind: 'verified', manifestKey: `nip5d:15129:${'b'.repeat(64)}`, artifactHash: 'a'.repeat(64),
};
const development: PermissionPrincipal = {
  kind: 'development', target: 'http://localhost:5173', artifactHash: 'c'.repeat(64),
};
const linkAccess: PermissionRequirement = {
  category: 'interface', domain: 'link', operation: 'access', scope: { kind: 'exact', value: 'link' },
};
const linkOpen: PermissionRequirement = {
  category: 'resource', domain: 'link', operation: 'link.open', scope: { kind: 'exact', value: 'https://example.org/' },
};
const keysAction: PermissionRequirement = {
  category: 'resource', domain: 'keys', operation: 'keys.registerAction', scope: { kind: 'exact', value: 'keys:chord:Escape' },
};

describe('permission default rules', () => {
  it('asks for everything when a host configures nothing', () => {
    const rules = createPermissionRules();
    expect(rules.default).toBe('ask');
    expect(resolvePermissionRule(rules, verified, keysAction)).toBe('ask');
    expect(resolvePermissionRule(rules, verified, linkAccess)).toBe('ask');
  });

  it('lets an operation rule ask while the interface and other operations stay allowed', () => {
    const rules = createPermissionRules({ default: 'allow', operations: { 'link.open': 'ask' } });
    expect(resolvePermissionRule(rules, verified, linkOpen)).toBe('ask');
    expect(resolvePermissionRule(rules, verified, linkAccess)).toBe('allow');
    expect(resolvePermissionRule(rules, verified, keysAction)).toBe('allow');
  });

  it('applies a domain rule to interface access and every operation of that domain', () => {
    const rules = createPermissionRules({ default: 'allow', domains: { link: 'deny' } });
    expect(resolvePermissionRule(rules, verified, linkAccess)).toBe('deny');
    expect(resolvePermissionRule(rules, verified, linkOpen)).toBe('deny');
    expect(resolvePermissionRule(rules, verified, keysAction)).toBe('allow');
  });

  it('prefers an operation rule over its domain rule', () => {
    const rules = createPermissionRules({ default: 'ask', domains: { link: 'deny' }, operations: { 'link.open': 'allow' } });
    expect(resolvePermissionRule(rules, verified, linkOpen)).toBe('allow');
    expect(resolvePermissionRule(rules, verified, linkAccess)).toBe('deny');
  });

  it('prefers any rule for the napplet over every global rule', () => {
    let rules = createPermissionRules({ default: 'allow', operations: { 'link.open': 'ask' } });
    rules = setPermissionRule(rules, { napplet: permissionRuleSubject(verified), operation: 'link.open' }, 'allow');
    rules = setPermissionRule(rules, { napplet: permissionRuleSubject(development) }, 'deny');
    expect(resolvePermissionRule(rules, verified, linkOpen)).toBe('allow');
    expect(resolvePermissionRule(rules, verified, keysAction)).toBe('allow');
    expect(resolvePermissionRule(rules, development, linkOpen)).toBe('deny');
    expect(resolvePermissionRule(rules, development, keysAction)).toBe('deny');
  });

  it('keys a verified napplet by manifest so rules survive a new artifact version', () => {
    const rules = setPermissionRule(createPermissionRules(), { napplet: permissionRuleSubject(verified), domain: 'keys' }, 'allow');
    const updated: PermissionPrincipal = { ...verified, artifactHash: 'd'.repeat(64) };
    expect(resolvePermissionRule(rules, updated, keysAction)).toBe('allow');
    expect(permissionRuleSubject(development)).toBe('development:http://localhost:5173');
  });

  it('removes rules, drops an emptied napplet, and resets a removed default to ask', () => {
    const subject = permissionRuleSubject(verified);
    let rules = createPermissionRules({ default: 'allow' });
    rules = setPermissionRule(rules, { napplet: subject, domain: 'fs' }, 'ask');
    expect(Object.keys(rules.napplets)).toEqual([subject]);
    rules = setPermissionRule(rules, { napplet: subject, domain: 'fs' }, undefined);
    expect(rules.napplets).toEqual({});
    expect(setPermissionRule(rules, {}, undefined).default).toBe('ask');
  });

  it('returns frozen detached snapshots and leaves the input untouched', () => {
    const rules = createPermissionRules({ default: 'allow' });
    const next = setPermissionRule(rules, { domain: 'fs' }, 'ask');
    expect(rules.domains).toEqual({});
    expect(next.domains).toEqual({ fs: 'ask' });
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.domains)).toBe(true);
  });

  it('rejects malformed rules and targets', () => {
    expect(() => createPermissionRules({ domains: { 'Not A Domain': 'allow' } })).toThrow(TypeError);
    expect(() => createPermissionRules({ operations: { link: 'allow' } })).toThrow(TypeError);
    expect(() => createPermissionRules({ domains: { link: 'maybe' as 'allow' } })).toThrow(TypeError);
    expect(() => setPermissionRule(createPermissionRules(), { domain: 'link', operation: 'link.open' }, 'allow')).toThrow(TypeError);
    expect(() => setPermissionRule(createPermissionRules(), { napplet: '', domain: 'link' }, 'allow')).toThrow(TypeError);
  });

  it('does not read rules from the prototype chain', () => {
    const rules = createPermissionRules({ default: 'ask' });
    const requirement: PermissionRequirement = {
      category: 'resource', domain: 'constructor', operation: 'constructor.run', scope: { kind: 'exact', value: 'x' },
    };
    expect(resolvePermissionRule(rules, verified, requirement)).toBe('ask');
  });

  it('round-trips through storage and refuses a damaged or foreign document', () => {
    const rules = setPermissionRule(
      createPermissionRules({ default: 'allow', operations: { 'link.open': 'ask' } }),
      { napplet: permissionRuleSubject(verified), domain: 'fs' }, 'deny',
    );
    expect(deserializePermissionRules(serializePermissionRules(rules))).toEqual({ ok: true, rules });
    expect(deserializePermissionRules('{')).toEqual({ ok: false, reason: 'invalid-rules' });
    expect(deserializePermissionRules('[]')).toEqual({ ok: false, reason: 'invalid-rules' });
    expect(deserializePermissionRules('{"version":2,"default":"allow"}')).toEqual({ ok: false, reason: 'unsupported-version' });
    expect(deserializePermissionRules('{"version":1}')).toEqual({ ok: false, reason: 'invalid-rules' });
    expect(deserializePermissionRules('{"version":1,"default":"allow","domains":{"fs":"sometimes"}}'))
      .toEqual({ ok: false, reason: 'invalid-rules' });
  });
});
