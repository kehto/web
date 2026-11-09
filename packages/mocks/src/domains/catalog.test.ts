import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { CATALOG_MOCK_ENTRY, CATALOG_SPEC_REF, createMockCatalogService, mockCatalogSnapshot } from './catalog.js';
import { MOCK_NAPPLETS } from './intent-fixtures.js';
import { createMockIntentService } from './intent.js';

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

describe('createMockCatalogService', () => {
  it('describes itself, publishes its route capability, and records the spec ref', () => {
    const service = createMockCatalogService();
    expect(service.descriptor).toMatchObject({ name: 'catalog', version: '1.0.0' });
    expect(service.mock.routes).toEqual(['catalog.get']);
    expect(Object.keys(service.messageCapabilities ?? {})).toEqual([...service.mock.routes]);
    expect(service.messageCapabilities).toEqual({ 'catalog.get': null });
    expect(CATALOG_SPEC_REF).toEqual({ nap: 'NAP-CATALOG', status: 'draft', source: 'pr', pr: 95, sha: '1020ae53', path: 'naps/NAP-CATALOG.md' });
    expect(CATALOG_MOCK_ENTRY.kind).toBe('extension');
    expect(CATALOG_MOCK_ENTRY.create?.({}).descriptor.name).toBe('catalog');
  });

  it('answers catalog.get with a complete snapshot', () => {
    const service = createMockCatalogService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'catalog.get', id: 'c1' } as NappletMessage, send);
    const [profile, note, tracker] = MOCK_NAPPLETS;
    expect(sent).toEqual([{
      type: 'catalog.get.result',
      id: 'c1',
      snapshot: {
        napplets: [
          {
            id: 'catalog-profile-viewer',
            identity: { kind: 35129, pubkey: profile!.pubkey, eventId: profile!.eventId, dTag: 'profile-viewer', artifactHash: profile!.artifactHash },
            title: 'Profile Viewer',
            description: 'Displays a Nostr profile.',
            requires: ['relay'],
            optional: ['theme'],
            archetypes: [{ archetype: 'profile', intents: [{ intent: 'open', convention: 'napplet:profile/open', parameters: ['pubkey'] }] }],
          },
          {
            id: 'catalog-note-viewer',
            identity: { kind: 35129, pubkey: note!.pubkey, eventId: note!.eventId, dTag: 'note-viewer', artifactHash: note!.artifactHash },
            title: 'Note Viewer',
            description: 'Displays a Nostr note or a filtered feed.',
            requires: ['relay', 'storage'],
            optional: ['theme', 'intent'],
            archetypes: [
              { archetype: 'note', intents: [{ intent: 'open', convention: 'napplet:note/open', parameters: ['id'] }] },
              { archetype: 'feed', intents: [
                { intent: 'open', convention: 'napplet:feed/open', parameters: [] },
                { intent: 'edit', convention: 'napplet:feed/edit', parameters: ['filters', 'relays'] },
              ] },
            ],
          },
          {
            id: 'catalog-distro-tracker',
            identity: { kind: 15129, pubkey: tracker!.pubkey, eventId: tracker!.eventId, artifactHash: tracker!.artifactHash },
            title: 'Distro Tracker',
            description: 'Tracks Linux distribution releases.',
            requires: ['storage'],
            optional: ['notify'],
            archetypes: [],
          },
        ],
        handlers: [
          { archetype: 'profile', currentHandler: 'catalog-profile-viewer' },
          { archetype: 'note', currentHandler: 'catalog-note-viewer' },
          { archetype: 'feed', currentHandler: 'catalog-note-viewer' },
        ],
      },
    }]);
    expect(sent[0]).not.toHaveProperty('snapshot.napplets.2.identity.dTag');
    expect(service.mock.state().requests).toBe(1);
  });

  it('reports null handlers when several candidates lack a default, and honors setDefault', () => {
    const alt = { ...MOCK_NAPPLETS[0]!, id: 'catalog-profile-alt', dTag: 'profile-alt' };
    const service = createMockCatalogService({ napplets: [...MOCK_NAPPLETS, alt] });
    const handlersFor = () => mockCatalogSnapshot(service.mock.state().napplets, service.mock.state().defaults).handlers.find((h) => h.archetype === 'profile');
    expect(handlersFor()).toEqual({ archetype: 'profile', currentHandler: null });
    service.setDefault('profile', 'catalog-profile-alt');
    expect(handlersFor()).toEqual({ archetype: 'profile', currentHandler: 'catalog-profile-alt' });
    service.setDefault('profile', 'catalog-ghost');
    expect(handlersFor()).toEqual({ archetype: 'profile', currentHandler: null });
    service.setDefault('profile', null);
    expect(service.mock.state().defaults.size).toBe(0);
  });

  it('agrees with the intent mock on identifiers and current handlers', () => {
    const catalog = createMockCatalogService({ defaults: { feed: 'catalog-note-viewer' } });
    const intent = createMockIntentService({ defaults: { feed: 'catalog-note-viewer' } });
    const snapshot = mockCatalogSnapshot(catalog.mock.state().napplets, catalog.mock.state().defaults);
    const { sent, send } = sink();
    intent.handleMessage('w1', { type: 'intent.handlers', id: 'h1' } as NappletMessage, send);
    const handlers = (sent[0] as unknown as { handlers: Array<{ archetype: string; candidates: Array<{ id: string; isDefault: boolean }> }> }).handlers;
    for (const handler of handlers) {
      const ids = handler.candidates.map((c) => c.id);
      for (const id of ids) expect(snapshot.napplets.some((n) => n.id === id)).toBe(true);
      const current = snapshot.handlers.find((h) => h.archetype === handler.archetype)?.currentHandler;
      if (current !== null) expect(ids).toContain(current);
    }
    expect(snapshot.handlers.find((h) => h.archetype === 'feed')?.currentHandler).toBe('catalog-note-viewer');
  });

  it('fails with catalog unavailable, ignores window destruction, and resets', () => {
    const service = createMockCatalogService({ unavailable: true });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'catalog.get', id: 'c1' } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'catalog.get.result', id: 'c1', error: 'catalog unavailable' }]);
    service.onWindowDestroyed?.('w1');
    service.setDefault('note', 'catalog-note-viewer');
    service.mock.reset();
    expect(service.mock.state().requests).toBe(0);
    expect(service.mock.state().defaults.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});
