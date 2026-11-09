import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, ServiceRuntimeContext } from '@kehto/runtime';

import {
  CLASS_1_MOCK_ENTRY,
  CLASS_1_SPEC_REF,
  CLASS_2_MOCK_ENTRY,
  CLASS_2_SPEC_REF,
  CLASS_MOCK_ENTRY,
  CLASS_SPEC_REF,
  MOCK_NAPPLET_CLASSES,
  createMockClassService,
} from './class.js';

function runtimeContext(windows: string[] = ['w1', 'w2']): ServiceRuntimeContext {
  return {
    resolveDTag: () => 'dtag',
    listWindowIds: () => windows,
    hasCapability: () => true,
    sendToEligibleNapplet: vi.fn(() => true),
  };
}

describe('NAP-CLASS track entries', () => {
  it('records the three draft PR heads', () => {
    expect(CLASS_SPEC_REF).toEqual({ nap: 'NAP-CLASS', status: 'draft', source: 'pr', pr: 16, sha: '4828279800dc', path: 'naps/NAP-CLASS.md' });
    expect(CLASS_1_SPEC_REF).toEqual({ nap: 'NAP-CLASS-1', status: 'draft', source: 'pr', pr: 17, sha: 'b9128e0cb611', path: 'naps/NAP-CLASS-1.md' });
    expect(CLASS_2_SPEC_REF).toEqual({ nap: 'NAP-CLASS-2', status: 'draft', source: 'pr', pr: 18, sha: '45c9b12dcb87', path: 'naps/NAP-CLASS-2.md' });
  });

  it('registers class as a push-only extension and the postures without factories', () => {
    expect(CLASS_MOCK_ENTRY).toMatchObject({ domain: 'class', kind: 'extension', spec: CLASS_SPEC_REF });
    expect(CLASS_MOCK_ENTRY.create?.({}).descriptor.name).toBe('class');
    expect(CLASS_1_MOCK_ENTRY).toMatchObject({ domain: 'class-1', kind: 'posture', spec: CLASS_1_SPEC_REF });
    expect(CLASS_2_MOCK_ENTRY).toMatchObject({ domain: 'class-2', kind: 'posture', spec: CLASS_2_SPEC_REF });
    expect(CLASS_1_MOCK_ENTRY.create).toBeUndefined();
    expect(CLASS_2_MOCK_ENTRY.create).toBeUndefined();
    expect(CLASS_1_MOCK_ENTRY.note).toContain("connect-src 'none'");
    expect(CLASS_2_MOCK_ENTRY.note).toContain('(dTag, aggregateHash)');
  });

  it('describes both postures as the documents define them', () => {
    expect(MOCK_NAPPLET_CLASSES[1]).toEqual({
      class: 1,
      document: 'NAP-CLASS-1.md',
      title: 'Strict Baseline Class',
      connectSrc: "'none'",
      consentPrompt: false,
      grantKey: null,
      refuseOnMetaCsp: false,
    });
    expect(MOCK_NAPPLET_CLASSES[2]).toEqual({
      class: 2,
      document: 'NAP-CLASS-2.md',
      title: 'User-Approved Explicit-Origin Class',
      connectSrc: '<space-separated-list-of-granted-origins>',
      consentPrompt: true,
      grantKey: ['dTag', 'aggregateHash'],
      refuseOnMetaCsp: true,
      deniedFallbackClass: 1,
    });
  });
});

describe('createMockClassService', () => {
  it('declares no request routes, an empty extension capability map, and the class.assigned push', () => {
    const service = createMockClassService();
    expect(service.descriptor).toMatchObject({ name: 'class', version: '1.0.0' });
    expect(service.mock.routes).toEqual([]);
    expect(Object.keys(service.messageCapabilities ?? {})).toEqual([...service.mock.routes]);
    // NAP-CLASS @ 4828279800dc gates delivery on advertised support, not an ACL grant.
    expect(service.pushCapabilities).toEqual({ 'class.assigned': null });
    const sent: NappletMessage[] = [];
    service.handleMessage('w1', { type: 'class.anything', id: 'x' } as NappletMessage, (msg) => sent.push(msg));
    expect(sent).toEqual([]);
  });

  it('pushes class.assigned once per window lifecycle through the runtime context', () => {
    const service = createMockClassService();
    expect(service.assign('w1')).toBe(false);
    const runtime = runtimeContext();
    service.onRegistered?.(runtime);
    expect(service.assign('w1')).toBe(true);
    expect(service.assign('w1', 2)).toBe(false);
    expect(service.assign('w2', 2)).toBe(true);
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledTimes(2);
    expect(runtime.sendToEligibleNapplet).toHaveBeenNthCalledWith(1, 'w1', { type: 'class.assigned', id: 'c1', class: 1 });
    expect(runtime.sendToEligibleNapplet).toHaveBeenNthCalledWith(2, 'w2', { type: 'class.assigned', id: 'c2', class: 2 });
    expect(service.mock.state().assigned.get('w1')).toEqual({ id: 'c1', class: 1 });
    expect(service.mock.sent.map((entry) => entry.windowId)).toEqual(['w1', 'w2']);
  });

  it('records nothing when the runtime refuses the push, and still owes the lifecycle envelope', () => {
    const service = createMockClassService();
    let exposed = false;
    const runtime: ServiceRuntimeContext = {
      resolveDTag: () => 'dtag',
      listWindowIds: () => ['w1'],
      hasCapability: () => true,
      sendToEligibleNapplet: vi.fn(() => exposed),
    };
    service.onRegistered?.(runtime);
    expect(service.assign('w1', 2)).toBe(false);
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledWith('w1', { type: 'class.assigned', id: 'c1', class: 2 });
    expect(service.mock.state()).toEqual({ assigned: new Map(), nextId: 1 });
    expect(service.mock.sent).toEqual([]);

    exposed = true;
    expect(service.assign('w1', 2)).toBe(true);
    expect(service.mock.state().assigned.get('w1')).toEqual({ id: 'c1', class: 2 });
    expect(service.mock.sent).toEqual([{ windowId: 'w1', message: { type: 'class.assigned', id: 'c1', class: 2 } }]);
    expect(service.assign('w1', 1)).toBe(false);
  });

  it('resolves the class from classFor, then defaultClass, and rejects bad integers', () => {
    const service = createMockClassService({ defaultClass: 2, classFor: (windowId) => (windowId === 'w1' ? 1 : undefined) });
    service.onRegistered?.(runtimeContext());
    expect(service.assign('w1')).toBe(true);
    expect(service.assign('w2')).toBe(true);
    expect(service.assign('w3', -1)).toBe(false);
    expect(service.assign('w3', 1.5)).toBe(false);
    expect(service.mock.sent.map((entry) => entry.message)).toEqual([
      { type: 'class.assigned', id: 'c1', class: 1 },
      { type: 'class.assigned', id: 'c2', class: 2 },
    ]);
  });

  it('starts a new lifecycle on onWindowDestroyed and clears on reset', () => {
    const service = createMockClassService();
    service.onRegistered?.(runtimeContext());
    service.assign('w1', 2);
    service.onWindowDestroyed?.('w1');
    expect(service.assign('w1', 1)).toBe(true);
    expect(service.mock.sent.at(-1)?.message).toEqual({ type: 'class.assigned', id: 'c2', class: 1 });
    service.mock.reset();
    expect(service.mock.state()).toEqual({ assigned: new Map(), nextId: 1 });
    expect(service.mock.sent).toEqual([]);
  });
});
