import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createCatalogIntentResolver } from './catalog-intent-resolver.js';
import { createIntentService } from './intent-service.js';
import { manifestToIntentCatalogEntry } from './manifest-intent-catalog.js';

const CONVENTION = 'napplet:profile/open';
const SOURCE = `nip5d:35129:${'a'.repeat(64)}:source`;
const TARGET = `nip5d:35129:${'b'.repeat(64)}:profile-viewer`;

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('verified manifest intent dispatch', () => {
  it('acknowledges accepted retained work, survives source removal, and never emits a completion result', async () => {
    let rejectCompletion!: (reason: Error) => void;
    const completion = new Promise<void>((_resolve, reject) => { rejectCompletion = reject; });
    const accept = vi.fn(() => ({ completion }));
    const resolver = createCatalogIntentResolver({
      loadCatalog: () => [manifestToIntentCatalogEntry({
        catalogId: TARGET,
        title: 'Profile Viewer',
        archetypes: [{ slug: 'profile', convention: CONVENTION, params: ['pubkey'] }],
      })],
      targets: { accept },
    });
    let sourceIsBound = true;
    const service = createIntentService({
      resolver,
      resolveSender: (windowId) => windowId === 'source-window' && sourceIsBound ? SOURCE : undefined,
    });
    const sent: NappletMessage[] = [];

    service.handleMessage('source-window', {
      type: 'intent.invoke', id: 'intent-1',
      request: { archetype: 'profile', action: 'open', convention: CONVENTION, payload: { pubkey: 'c'.repeat(64) } },
    } as unknown as NappletMessage, (message) => sent.push(message));
    await flush();

    expect(accept).toHaveBeenCalledWith({
      handler: TARGET,
      sender: SOURCE,
      archetype: 'profile',
      action: 'open',
      convention: CONVENTION,
      payload: { pubkey: 'c'.repeat(64) },
      sourceWindowId: 'source-window',
    });
    expect(sent).toEqual([{
      type: 'intent.invoke.result', id: 'intent-1',
      result: { ok: true, archetype: 'profile', action: 'open', convention: CONVENTION, handler: TARGET },
    }]);

    sourceIsBound = false;
    rejectCompletion(new Error('target terminal failure'));
    await flush();
    expect(sent).toHaveLength(1);
  });

  it('returns one rejection when target acceptance fails before delivery is retained', async () => {
    const resolver = createCatalogIntentResolver({
      loadCatalog: () => [manifestToIntentCatalogEntry({
        catalogId: TARGET,
        archetypes: [{ slug: 'profile', convention: CONVENTION, params: [] }],
      })],
      targets: { accept: () => { throw new Error('target unavailable'); } },
    });
    const service = createIntentService({ resolver, resolveSender: () => SOURCE });
    const sent: NappletMessage[] = [];
    service.handleMessage('source-window', {
      type: 'intent.invoke', id: 'intent-2',
      request: { archetype: 'profile', action: 'open', convention: CONVENTION },
    } as unknown as NappletMessage, (message) => sent.push(message));
    await flush();

    expect(sent).toEqual([{
      type: 'intent.invoke.result', id: 'intent-2', result: { ok: false, error: 'invoke rejected' },
    }]);
  });
});
