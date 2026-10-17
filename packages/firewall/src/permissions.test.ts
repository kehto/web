import { describe, expect, it } from 'vitest';
import {
  consumePermissionGrants, createPermissionState, deserializePermissions, evaluatePermissions,
  permissionPrincipalKey, putPermissionGrant, revokePermissionGrant, serializePermissions,
} from './permissions.js';
import { normalizePermissionScope } from './permission-scopes.js';
import type { PermissionGrant, PermissionPrincipal, PermissionRequest, PermissionRequirement } from './permission-types.js';

const publisher = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const artifactHash = '186ea5fd14e88fd1ac49351759e7ab906fa94892002b60bf7f5a428f28ca1c99';
const principal: PermissionPrincipal = { kind: 'verified', manifestKey: `nip5d:35129:${publisher}:my-napplet`, artifactHash };
const network: PermissionRequirement = { category: 'network', domain: 'link', operation: 'link.open', scope: { kind: 'origin', value: 'https://example.com' } };
const access: PermissionRequirement = { category: 'interface', domain: 'link', operation: 'access', scope: { kind: 'exact', value: 'link' } };
const request: PermissionRequest = { principal, sessionId: 'frame:1', requestId: 'request:1', requirements: [network] };

function grant(permission: PermissionRequirement, id: string = permission.category): PermissionGrant {
  return { id, principal, permission, effect: 'allow', lifetime: 'persistent' };
}

function approved() {
  return putPermissionGrant(putPermissionGrant(createPermissionState(), grant(access)), grant(network));
}

describe('permission composition', () => {
  it('requires interface access even when a network permission is supplied alone', () => {
    const state = putPermissionGrant(createPermissionState(), grant(network));
    expect(evaluatePermissions(state, request)).toMatchObject({ decision: 'ask', missing: [access] });
    expect(evaluatePermissions(approved(), request).decision).toBe('allow');
  });

  it('does not infer network approval from interface access', () => {
    const state = putPermissionGrant(createPermissionState(), grant(access));
    expect(evaluatePermissions(state, request)).toMatchObject({ decision: 'ask', missing: [network] });
  });

  it('requires resource and network scopes independently', () => {
    const resource: PermissionRequirement = { ...network, category: 'resource', scope: { kind: 'exact', value: 'https://example.com/post/123' } };
    expect(evaluatePermissions(approved(), { ...request, requirements: [network, resource] })).toMatchObject({ decision: 'ask', missing: [resource] });
  });

  it('prioritizes an explicit denial over a concurrent allow', () => {
    const denied = { ...grant(network, 'deny-destination'), effect: 'deny' as const };
    const state = putPermissionGrant(approved(), denied);
    expect(evaluatePermissions(state, request)).toMatchObject({ decision: 'deny', grantIds: ['deny-destination'] });
    expect(evaluatePermissions(revokePermissionGrant(state, denied.id), request).decision).toBe('allow');
  });

  it('keeps operation scopes exact', () => {
    expect(evaluatePermissions(approved(), { ...request, requirements: [{ ...network, operation: 'link.other' }] }).decision).toBe('ask');
  });

  it('requires explicit extension registration and interface access', () => {
    const extension: PermissionRequirement = { ...network, category: 'extension:payment', scope: { kind: 'exact', value: 'invoice:123' } };
    expect(() => putPermissionGrant(approved(), grant(extension))).toThrow('Unknown permission category');
    const options = { extensions: ['extension:payment'] as const };
    const state = putPermissionGrant(approved(), grant(extension), options);
    expect(evaluatePermissions(state, { ...request, requirements: [extension] }, options).decision).toBe('allow');
    expect(() => evaluatePermissions(state, { ...request, requirements: [extension] })).toThrow();
  });
});

describe('identity and lifetime boundaries', () => {
  it('isolates publishers, artifacts, roots, snapshots and development targets', () => {
    const otherPublisher = 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5';
    const others: PermissionPrincipal[] = [
      { ...principal, manifestKey: `nip5d:35129:${otherPublisher}:my-napplet` },
      { ...principal, artifactHash: '0'.repeat(64) },
      { ...principal, manifestKey: `nip5d:15129:${publisher}` },
      { ...principal, manifestKey: `nip5d:5129:${artifactHash}` },
      { kind: 'development', target: `nip5d:35129:${publisher}:my-napplet`, artifactHash },
    ];
    for (const identity of others) {
      expect(permissionPrincipalKey(identity)).not.toBe(permissionPrincipalKey(principal));
      expect(evaluatePermissions(approved(), { ...request, principal: identity }).decision).toBe('ask');
    }
  });

  it('rejects bare d tags and refuses durable development authority', () => {
    expect(() => permissionPrincipalKey({ ...principal, manifestKey: 'my-napplet' })).toThrow();
    expect(() => putPermissionGrant(createPermissionState(), {
      ...grant(access), principal: { kind: 'development', target: 'http://localhost:5173', artifactHash },
    })).toThrow('Persistent grants require verified identity');
  });

  it('limits session approval to one endpoint generation', () => {
    const state = putPermissionGrant(approved(), { ...grant(network), lifetime: 'session', sessionId: request.sessionId });
    expect(evaluatePermissions(state, request).decision).toBe('allow');
    expect(evaluatePermissions(state, { ...request, sessionId: 'frame:2' }).decision).toBe('ask');
  });

  it('consumes once authority only for its exact request and session', () => {
    const state = putPermissionGrant(approved(), {
      ...grant(network), lifetime: 'once', sessionId: request.sessionId, requestId: request.requestId,
    });
    expect(evaluatePermissions(state, { ...request, requestId: 'request:2' }).decision).toBe('ask');
    const consumed = consumePermissionGrants(state, request);
    expect(consumed.decision.decision).toBe('allow');
    expect(evaluatePermissions(consumed.state, request).decision).toBe('ask');
    expect(evaluatePermissions(state, request).decision).toBe('allow');
  });

  it('does not consume once grants when another requirement denies the operation', () => {
    let state = putPermissionGrant(approved(), { ...grant(network), lifetime: 'once', sessionId: request.sessionId, requestId: request.requestId });
    state = putPermissionGrant(state, { ...grant(access), effect: 'deny' });
    expect(consumePermissionGrants(state, request).state).toBe(state);
  });

  it('detaches and freezes accepted grants so caller mutation cannot widen access', () => {
    const scope = { kind: 'origin' as const, value: 'https://example.com' };
    const permission = { ...network, scope };
    const state = putPermissionGrant(approved(), grant(permission));
    scope.value = 'https://evil.example';
    expect(evaluatePermissions(state, request).decision).toBe('allow');
    expect(evaluatePermissions(state, { ...request, requirements: [permission] }).decision).toBe('ask');
    expect(Object.isFrozen(state.grants[1].permission.scope)).toBe(true);
  });
});

describe('scope boundaries', () => {
  it('normalizes case, IDN and default ports without matching lookalike hosts', () => {
    expect(normalizePermissionScope({ kind: 'origin', value: 'HTTPS://EXAMPLE.COM:443' }).value).toBe('https://example.com');
    expect(normalizePermissionScope({ kind: 'origin', value: 'https://café.example.com' }).value).toBe('https://xn--caf-dma.example.com');
    for (const value of ['https://example.com.evil.test', 'http://example.com', 'https://example.com:8443']) {
      expect(evaluatePermissions(approved(), { ...request, requirements: [{ ...network, scope: { kind: 'origin', value } }] }).decision).toBe('ask');
    }
  });

  it.each(['https://user:secret@example.com', 'https://*.example.com', 'javascript:alert(1)', 'https://example.com/path', 'https://example.com?query=1'])('rejects invalid origin scope %s', (value) => {
    expect(() => normalizePermissionScope({ kind: 'origin', value })).toThrow();
  });

  it('matches virtual subtrees on segment boundaries and includes the directory itself', () => {
    const directory: PermissionRequirement = { category: 'resource', domain: 'fs', operation: 'fs.read', scope: { kind: 'directory', value: '/shared' } };
    let state = putPermissionGrant(createPermissionState(), grant({ category: 'interface', domain: 'fs', operation: 'access', scope: { kind: 'exact', value: 'fs' } }));
    state = putPermissionGrant(state, grant(directory));
    for (const value of ['/shared', '/shared/report.md']) {
      expect(evaluatePermissions(state, { ...request, requirements: [{ ...directory, scope: { kind: 'exact', value } }] }).decision).toBe('allow');
    }
    expect(evaluatePermissions(state, { ...request, requirements: [{ ...directory, scope: { kind: 'exact', value: '/shared-private/report.md' } }] }).decision).toBe('ask');
  });

  it.each(['/shared/../secret', '/shared/%2e%2e/secret', '/shared//file', '/shared\\secret', 'relative/path'])('rejects unsafe directory scope %s', (value) => {
    expect(() => normalizePermissionScope({ kind: 'directory', value })).toThrow();
  });
});

describe('versioned policy persistence', () => {
  it('round trips durable grants and excludes all ephemeral decisions', () => {
    const state = putPermissionGrant(approved(), { ...grant(network, 'temporary'), lifetime: 'session', sessionId: request.sessionId });
    const result = deserializePermissions(serializePermissions(state));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected valid policy');
    expect(result.state.grants.map((entry) => entry.id)).toEqual(['interface', 'network']);
    expect(evaluatePermissions(result.state, request).decision).toBe('allow');
  });

  it.each(['{', 'null', '[]', '{"version":1,"grants":{}}', '{"version":1,"grants":[null]}'])('rejects malformed policy %s', (raw) => {
    expect(deserializePermissions(raw)).toEqual({ ok: false, reason: 'invalid-state' });
  });

  it('refuses duplicate identifiers, ephemeral persisted grants and unknown versions', () => {
    expect(deserializePermissions(JSON.stringify({ version: 1, grants: [grant(access), grant(access)] })).ok).toBe(false);
    expect(deserializePermissions(JSON.stringify({ version: 1, grants: [{ ...grant(access), lifetime: 'once', requestId: 'x', sessionId: 'y' }] })).ok).toBe(false);
    expect(deserializePermissions('{"version":2,"grants":[]}')).toEqual({ ok: false, reason: 'unsupported-version' });
    expect(deserializePermissions('{"napplets":{"my-napplet":{"policy":"allow"}}}').ok).toBe(false);
  });

  it('rejects missing domain fields rather than coercing undefined into a domain name', () => {
    const malformed = { ...grant(network), permission: { category: 'resource', operation: 'undefined.read', scope: { kind: 'exact', value: 'file' } } };
    expect(deserializePermissions(JSON.stringify({ version: 1, grants: [malformed] })).ok).toBe(false);
  });
});
