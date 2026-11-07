import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, ServiceRuntimeContext } from '@kehto/runtime';

import {
  INTENT_MOCK_ENTRY,
  INTENT_SPEC_REF,
  MOCK_NAPPLETS,
  createMockIntentService,
  mockArchetypes,
  mockContractsFor,
  mockNappletAddress,
  parseMockConvention,
  resolveMockHandler,
} from './intent.js';

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

const PROFILE_OPEN = { archetype: 'profile', action: 'open', convention: 'napplet:profile/open', payload: { pubkey: 'abc123' } };
const PROFILE_CANDIDATE = {
  id: 'catalog-profile-viewer',
  title: 'Profile Viewer',
  actions: ['open'],
  conventions: ['napplet:profile/open'],
  contracts: [{ convention: 'napplet:profile/open', params: ['pubkey'] }],
  isDefault: false,
};

describe('intent fixtures', () => {
  it('expose two handlers and one role-less source napplet', () => {
    expect(MOCK_NAPPLETS.map((n) => n.id)).toEqual(['catalog-profile-viewer', 'catalog-note-viewer', 'catalog-distro-tracker']);
    expect(MOCK_NAPPLETS[2]).toMatchObject({ kind: 15129, roles: [], intents: [] });
    expect(MOCK_NAPPLETS[2]?.dTag).toBeUndefined();
    expect(mockArchetypes(MOCK_NAPPLETS)).toEqual(['profile', 'note', 'feed']);
    expect(mockContractsFor(MOCK_NAPPLETS[1]!, 'feed')).toEqual([
      { convention: 'napplet:feed/open', params: [] },
      { convention: 'napplet:feed/edit', params: ['filters', 'relays'] },
    ]);
    expect(mockContractsFor(MOCK_NAPPLETS[1]!, 'profile')).toEqual([]);
    expect(parseMockConvention('napplet:note/open')).toEqual({ archetype: 'note', action: 'open' });
    expect(parseMockConvention('napplet:note/open?id=1')).toBeUndefined();
    expect(mockNappletAddress(MOCK_NAPPLETS[0]!)).toBe(`35129:${MOCK_NAPPLETS[0]!.pubkey}:profile-viewer`);
    expect(mockNappletAddress(MOCK_NAPPLETS[2]!)).toBeUndefined();
    expect(resolveMockHandler(MOCK_NAPPLETS, 'profile', new Map())).toBe('catalog-profile-viewer');
    expect(resolveMockHandler(MOCK_NAPPLETS, 'emoji-list', new Map())).toBeNull();
  });
});

describe('createMockIntentService', () => {
  it('describes itself and records the spec ref', () => {
    const service = createMockIntentService();
    expect(service.descriptor).toMatchObject({ name: 'intent', version: '1.0.0' });
    expect(service.mock.routes).toEqual(['intent.invoke', 'intent.available', 'intent.handlers']);
    expect(service.messageCapabilities).toBeUndefined();
    expect(INTENT_SPEC_REF).toEqual({ nap: 'NAP-INTENT', status: 'merged', source: 'master', sha: '43cb3a4e8555', path: 'naps/NAP-INTENT.md' });
    expect(INTENT_MOCK_ENTRY.kind).toBe('service');
    expect(INTENT_MOCK_ENTRY.create?.({}).descriptor.name).toBe('intent');
  });

  it('answers intent.available and intent.handlers from the catalog', () => {
    const service = createMockIntentService({ defaults: { feed: 'catalog-note-viewer' } });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'intent.available', id: 'a1', archetype: 'profile' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'intent.available', id: 'a2', archetype: 'emoji-list' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'intent.available', id: 'a3' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'intent.handlers', id: 'h1' } as NappletMessage, send);
    expect(sent[0]).toEqual({ type: 'intent.available.result', id: 'a1', availability: { archetype: 'profile', available: true, candidates: [PROFILE_CANDIDATE], hasDefault: false } });
    expect(sent[1]).toEqual({ type: 'intent.available.result', id: 'a2', availability: { archetype: 'emoji-list', available: false, candidates: [], hasDefault: false } });
    expect(sent[2]).toEqual({ type: 'intent.available.result', id: 'a3', error: 'invalid archetype' });
    expect(sent[3]).toMatchObject({ type: 'intent.handlers.result', id: 'h1' });
    const handlers = (sent[3] as unknown as { handlers: Array<{ archetype: string; hasDefault: boolean; candidates: Array<{ id: string; isDefault: boolean; actions: string[] }> }> }).handlers;
    expect(handlers.map((h) => h.archetype)).toEqual(['profile', 'note', 'feed']);
    expect(handlers[2]).toMatchObject({ hasDefault: true, candidates: [{ id: 'catalog-note-viewer', isDefault: true, actions: ['open', 'edit'] }] });
  });

  it('invokes, resolves the handler, and delivers to the bound target window', () => {
    const service = createMockIntentService({ windows: { w1: 'catalog-social-feed', w2: 'catalog-profile-viewer' } });
    const source = sink();
    const target = sink();
    service.handleMessage('w2', { type: 'intent.handlers', id: 'h0' } as NappletMessage, target.send);
    service.handleMessage('w1', { type: 'intent.invoke', id: 'i1', request: PROFILE_OPEN } as NappletMessage, source.send);
    expect(source.sent).toEqual([{
      type: 'intent.invoke.result', id: 'i1',
      result: { ok: true, archetype: 'profile', action: 'open', convention: 'napplet:profile/open', handler: 'catalog-profile-viewer' },
    }]);
    expect(target.sent.at(-1)).toEqual({
      type: 'intent.deliver',
      delivery: { sender: 'catalog-social-feed', archetype: 'profile', action: 'open', convention: 'napplet:profile/open', payload: { pubkey: 'abc123' } },
    });
    expect(service.mock.state().deliveries).toEqual([{ target: 'catalog-profile-viewer', delivered: true, delivery: expect.objectContaining({ sender: 'catalog-social-feed' }) }]);
  });

  it('retains pending deliveries until the handler window binds, and derives senders for unbound windows', () => {
    const service = createMockIntentService();
    const source = sink();
    service.handleMessage('w1', { type: 'intent.invoke', id: 'i1', request: { archetype: 'note', action: 'open', convention: 'napplet:note/open' } } as NappletMessage, source.send);
    expect(service.mock.state().deliveries[0]).toEqual({
      target: 'catalog-note-viewer', delivered: false,
      delivery: { sender: 'catalog-window-w1', archetype: 'note', action: 'open', convention: 'napplet:note/open' },
    });
    const target = sink();
    service.handleMessage('w3', { type: 'intent.handlers', id: 'h0' } as NappletMessage, target.send);
    service.bindWindow('w3', 'catalog-note-viewer');
    expect(target.sent.at(-1)).toEqual({ type: 'intent.deliver', delivery: { sender: 'catalog-window-w1', archetype: 'note', action: 'open', convention: 'napplet:note/open' } });
    expect(service.mock.state().deliveries[0]?.delivered).toBe(true);
  });

  it('rejects invalid, unsupported, and unauthorized requests before acceptance', () => {
    const service = createMockIntentService();
    const { sent, send } = sink();
    const invoke = (id: string, request: unknown) => service.handleMessage('w1', { type: 'intent.invoke', id, request } as NappletMessage, send);
    invoke('i2', { archetype: 'emoji-list', action: 'open', convention: 'napplet:emoji-list/open' });
    invoke('i3', { archetype: 'profile', action: 'edit', convention: 'napplet:profile/edit' });
    invoke('i4', { archetype: 'profile', action: 'open', convention: 'napplet:note/open' });
    invoke('i5', { archetype: 'profile', action: 'open', convention: 'napplet:profile/open?x=1' });
    invoke('i6', { ...PROFILE_OPEN, sender: 'spoof' });
    invoke('i7', { ...PROFILE_OPEN, handler: 'catalog-note-viewer' });
    invoke('i8', { ...PROFILE_OPEN, handlerHint: { address: 'bogus' } });
    invoke('i9', 'napplet:profile/open');
    expect(sent.map((msg) => (msg as unknown as { result: unknown }).result)).toEqual([
      { ok: false, error: 'no handler' },
      { ok: false, error: 'unsupported convention' },
      { ok: false, error: 'invalid convention' },
      { ok: false, error: 'invalid convention' },
      { ok: false, error: 'invalid convention' },
      { ok: false, error: 'invoke rejected' },
      { ok: false, error: 'invalid convention' },
      { ok: false, error: 'invalid convention' },
    ]);
    expect(service.mock.state().deliveries).toEqual([]);
  });

  it('honors explicit handlers, choose, defaults, and handler hints', () => {
    const second = { ...MOCK_NAPPLETS[0]!, id: 'catalog-profile-alt', dTag: 'profile-alt', title: 'Alt Profile' };
    const service = createMockIntentService({ napplets: [...MOCK_NAPPLETS, second] });
    const { sent, send } = sink();
    const invoke = (id: string, request: unknown) => service.handleMessage('w1', { type: 'intent.invoke', id, request } as NappletMessage, send);
    invoke('c1', PROFILE_OPEN);
    invoke('c2', { ...PROFILE_OPEN, handler: 'choose' });
    invoke('c3', { ...PROFILE_OPEN, handler: 'catalog-profile-alt' });
    invoke('c4', { ...PROFILE_OPEN, handlerHint: { address: mockNappletAddress(second), relays: ['wss://relay-a.example.org'] } });
    service.setDefault('profile', 'catalog-profile-alt');
    invoke('c5', { ...PROFILE_OPEN, handler: 'default' });
    invoke('c6', { ...PROFILE_OPEN, behavior: { focus: true, reuse: false } });
    const handlers = sent.filter((msg) => msg.type === 'intent.invoke.result').map((msg) => (msg as unknown as { result: { handler?: string } }).result.handler);
    expect(handlers).toEqual([
      'catalog-profile-viewer', 'catalog-profile-viewer', 'catalog-profile-alt', 'catalog-profile-alt', 'catalog-profile-alt', 'catalog-profile-alt',
    ]);
  });

  it('pushes intent.changed on setDefault to known and runtime windows', () => {
    const service = createMockIntentService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'intent.available', id: 'a1', archetype: 'feed' } as NappletMessage, send);
    const runtime: ServiceRuntimeContext = { resolveDTag: () => 'd', listWindowIds: () => ['w1', 'w9'], hasCapability: () => true, sendToEligibleNapplet: vi.fn(() => true) };
    service.onRegistered?.(runtime);
    const availability = service.setDefault('feed', 'catalog-note-viewer');
    expect(availability).toMatchObject({ archetype: 'feed', hasDefault: true, candidates: [{ id: 'catalog-note-viewer', isDefault: true }] });
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledWith('w1', { type: 'intent.changed', availability });
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledWith('w9', { type: 'intent.changed', availability });
    service.setDefault('feed', null);
    expect(service.mock.state().defaults.has('feed')).toBe(false);
  });

  it('cleans window bindings on destroy and resets', () => {
    const service = createMockIntentService({ windows: { w1: 'catalog-profile-viewer' } });
    service.handleMessage('w1', { type: 'intent.invoke', id: 'i1', request: PROFILE_OPEN } as NappletMessage, () => {});
    service.onWindowDestroyed?.('w1');
    expect(service.mock.state().windows.size).toBe(0);
    expect(service.mock.state().seen.size).toBe(0);
    service.mock.reset();
    expect(service.mock.state().windows.get('w1')).toBe('catalog-profile-viewer');
    expect(service.mock.state().deliveries).toEqual([]);
    expect(service.mock.sent).toEqual([]);
  });
});
