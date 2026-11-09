import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { MOCK_ACCOUNTS } from '../fixtures/nostr.js';
import { MOCK_NAVIGATION_CONVENTIONS, NAVIGATION_MOCK_ENTRY, NAVIGATION_SPEC_REF, canonicalJson, createMockNavigationService } from './navigation.js';

const BOB = MOCK_ACCOUNTS[1]!.pubkey;
const HOME = { convention: 'napplet:home' };
const PROFILE = { convention: 'napplet:profile/open', payload: { pubkey: BOB }, title: 'Bob' };
const EMPTY = { entries: [], index: null, reportRevision: null, status: 'unreported' };

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}
const msg = (fields: Record<string, unknown>): NappletMessage => fields as unknown as NappletMessage;

function harness(options: Parameters<typeof createMockNavigationService>[0] = {}) {
  const service = createMockNavigationService(options);
  const { sent, send } = sink();
  const report = (id: string, report: unknown, windowId = 'w1') => {
    service.handleMessage(windowId, msg({ type: 'navigation.report', id, report }), send);
    return (sent.at(-1) as unknown as { result: { ok: boolean; view: { entries: unknown[]; index: number | null; reportRevision: number | null; status: string }; error?: unknown } }).result;
  };
  return { service, sent, send, report };
}

describe('createMockNavigationService', () => {
  it('describes the extension and publishes both routes', () => {
    const service = createMockNavigationService();
    expect(service.descriptor).toEqual({ name: 'navigation', version: '0.1.0', description: 'Mock NAP-NAVIGATION runtime-maintained intent history' });
    expect(service.messageCapabilities).toEqual({ 'navigation.report': null, 'navigation.get': null });
    expect(NAVIGATION_SPEC_REF).toEqual({ nap: 'NAP-NAVIGATION', status: 'draft', source: 'pr', pr: 126, sha: '9a4b179ea5fe', path: 'naps/NAP-NAVIGATION.md' });
    expect(NAVIGATION_MOCK_ENTRY).toMatchObject({ domain: 'navigation', kind: 'extension' });
    expect(MOCK_NAVIGATION_CONVENTIONS.map((item) => item.convention)).toEqual(['napplet:home', 'napplet:profile/open', 'napplet:note/open', 'napplet:search']);
    expect(canonicalJson({ b: [1, { d: null, c: 'x' }], a: true })).toBe('{"a":true,"b":[1,{"c":"x","d":null}]}');
  });

  it('reads an unreported view and records visits from reports', () => {
    const { service, sent, send, report } = harness();
    service.handleMessage('w1', msg({ type: 'navigation.get', id: 'g1' }), send);
    expect(sent).toEqual([{ type: 'navigation.get.result', id: 'g1', result: { ok: true, view: EMPTY } }]);
    expect(report('r1', { revision: 1, location: HOME })).toEqual({ ok: true, view: { entries: [{ id: 'visit-1', location: HOME }], index: 0, reportRevision: 1, status: 'current' } });
    expect(sent.at(-1)).toMatchObject({ type: 'navigation.report.result', id: 'r1' });
    expect(report('r2', { revision: 2, location: PROFILE })).toEqual({ ok: true, view: { entries: [{ id: 'visit-1', location: HOME }, { id: 'visit-2', location: PROFILE }], index: 1, reportRevision: 2, status: 'current' } });
    expect(report('r2', { revision: 2, location: PROFILE }).view).toMatchObject({ entries: [expect.anything(), expect.anything()], index: 1 });
    expect(report('r3', { revision: 3, location: { ...PROFILE, title: 'Bob!' }, mode: 'push' }).view).toMatchObject({ entries: [HOME, { ...PROFILE, title: 'Bob!' }].map((location, index) => ({ id: `visit-${index + 1}`, location })), index: 1 });
    expect(report('r4', { revision: 4, location: { convention: 'napplet:search', payload: { query: 'debian', kinds: [1, 30023] } }, mode: 'replace' }).view).toMatchObject({ entries: [{ id: 'visit-1' }, { id: 'visit-2', location: { convention: 'napplet:search' } }], index: 1 });
    expect(report('r5', { revision: 5, location: null }).view).toMatchObject({ index: null, reportRevision: 5, status: 'current', entries: [{ id: 'visit-1' }, { id: 'visit-2' }] });
    expect(report('r6', { revision: 6, location: HOME }).view).toMatchObject({ entries: [{ id: 'visit-1' }, { id: 'visit-2' }, { id: 'visit-3', location: HOME }], index: 2 });
    expect(service.view('w1').entries).toHaveLength(3);
  });

  it('settles Back and Forward revisits by value and preserves forward history', () => {
    const { service, report } = harness();
    report('r1', { revision: 1, location: HOME });
    report('r2', { revision: 2, location: PROFILE });
    expect(service.back('w1')).toEqual({ convention: 'napplet:home' });
    expect(service.view('w1').status).toBe('pending');
    expect(service.back('w1')).toBeUndefined();
    expect(report('r3', { revision: 3, location: { ...HOME, title: 'Home' } })).toEqual({ ok: true, view: { entries: [{ id: 'visit-1', location: { ...HOME, title: 'Home' } }, { id: 'visit-2', location: PROFILE }], index: 0, reportRevision: 3, status: 'current' } });
    expect(service.forward('w1')).toEqual({ convention: 'napplet:profile/open', payload: { pubkey: BOB } });
    expect(report('r4', { revision: 4, location: PROFILE }).view).toMatchObject({ index: 1, entries: [{ id: 'visit-1' }, { id: 'visit-2' }], status: 'current' });
    expect(service.forward('w1')).toBeUndefined();
    expect(service.revisit('w1', 'visit-2')).toBeUndefined();
    expect(service.revisit('w1', 'visit-1')).toEqual({ convention: 'napplet:home' });
    expect(report('r5', { revision: 5, location: PROFILE, mode: 'replace' }).view).toMatchObject({ index: 1, status: 'current', entries: [{ id: 'visit-1' }, { id: 'visit-2' }] });
    expect(service.revisit('w1', 'visit-1')).toEqual({ convention: 'napplet:home' });
    expect(report('r6', { revision: 6, location: { convention: 'napplet:search', payload: { query: 'arch' } } }).view).toMatchObject({ index: 2, status: 'current', entries: [{ id: 'visit-1' }, { id: 'visit-2' }, { id: 'visit-3' }] });
    expect(service.revisit('w1', 'visit-1')).toEqual({ convention: 'napplet:home' });
    service.timeoutRevisit('w1');
    expect(service.view('w1')).toMatchObject({ index: 2, status: 'uncertain' });
    expect(service.back('w1')).toBeUndefined();
    expect(report('r7', { revision: 7, location: HOME }).view).toMatchObject({ index: 3, status: 'current' });
  });

  it('rejects invalid, unsupported, stale, changed, and oversized reports without partial history changes', () => {
    const { service, report } = harness({ maxEntries: 2 });
    report('r1', { revision: 1, location: HOME });
    expect(report('e1', { revision: 2, location: null, mode: 'push' })).toMatchObject({ ok: false, error: { code: 'invalid' }, view: { index: 0, reportRevision: 1, status: 'uncertain' } });
    expect(report('e2', { revision: 3, location: HOME, entries: [] })).toMatchObject({ ok: false, error: { code: 'invalid' } });
    expect(report('e3', { revision: 4, location: { convention: 'napplet:nope' } })).toMatchObject({ ok: false, error: { code: 'unsupported' } });
    expect(report('e4', { revision: 5, location: { convention: 'napplet:profile/open', payload: { pubkey: BOB, extra: 1 } } })).toMatchObject({ ok: false, error: { code: 'unsupported' } });
    expect(report('e5', { revision: 6, location: { convention: 'napplet:home', payload: { any: 1 } } })).toMatchObject({ ok: false, error: { code: 'unsupported' } });
    expect(report('e6', { revision: 7, location: { convention: 'napplet:home?x=1' } })).toMatchObject({ ok: false, error: { code: 'invalid' } });
    expect(report('e7', { revision: 8, location: { convention: 'napplet:search', payload: [1] } })).toMatchObject({ ok: false, error: { code: 'invalid' } });
    expect(report('e8', { revision: 9, location: { convention: 'napplet:search', payload: { query: Number.NaN } } })).toMatchObject({ ok: false, error: { code: 'invalid' } });
    expect(report('e9', { revision: 0, location: HOME })).toMatchObject({ ok: false, error: { code: 'invalid' } });
    expect(report('e10', { revision: 3, location: PROFILE })).toMatchObject({ ok: false, error: { code: 'stale' } });
    expect(report('e11', { revision: 9, location: HOME })).toMatchObject({ ok: false, error: { code: 'stale' } });
    expect(report('e12', { revision: 1, location: PROFILE })).toMatchObject({ ok: false, error: { code: 'invalid' } });
    expect(report('e13', 'nope')).toMatchObject({ ok: false, error: { code: 'invalid' } });
    expect(service.view('w1')).toMatchObject({ entries: [{ id: 'visit-1', location: HOME }], index: 0, reportRevision: 1, status: 'uncertain' });
    expect(report('r10', { revision: 10, location: PROFILE })).toMatchObject({ ok: true, view: { index: 1, status: 'current' } });
    expect(report('e14', { revision: 11, location: { convention: 'napplet:search', payload: { query: 'x' } } })).toMatchObject({ ok: false, error: { code: 'limit' }, view: { entries: [{ id: 'visit-1' }, { id: 'visit-2' }], index: 1 } });
    const huge = harness({ maxLocationBytes: 64 });
    expect(huge.report('h1', { revision: 1, location: { convention: 'napplet:search', payload: { query: 'x'.repeat(80) } } })).toMatchObject({ ok: false, error: { code: 'limit' }, view: EMPTY });
  });

  it('keeps instances independent and cleans them on window destroy and reset', () => {
    const { service, report } = harness();
    report('a1', { revision: 1, location: HOME });
    report('b1', { revision: 1, location: PROFILE }, 'w2');
    expect(service.view('w1').entries).toEqual([{ id: 'visit-1', location: HOME }]);
    expect(service.view('w2').entries).toEqual([{ id: 'visit-1', location: PROFILE }]);
    service.onWindowDestroyed?.('w1');
    expect(service.mock.state().instances.has('w1')).toBe(false);
    expect(service.view('w1')).toEqual(EMPTY);
    service.mock.reset();
    expect(service.mock.state().instances.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});
