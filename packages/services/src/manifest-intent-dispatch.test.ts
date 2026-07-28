import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ServiceRuntimeContext } from '@kehto/runtime';
import { createCatalogIntentResolver } from './catalog-intent-resolver.js';
import { createIntentService } from './intent-service.js';
import { manifestToIntentCatalogEntry } from './manifest-intent-catalog.js';

const CONVENTION = 'napplet:profile/open';

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function runtime(): ServiceRuntimeContext {
  return {
    resolveDTag: () => 'feed',
    listWindowIds: () => Object.freeze([]),
    sendToEligibleNapplet: () => false,
  };
}

describe('verified manifest intent dispatch', () => {
  it('selects canonical manifest metadata and returns the dispatched target identity', async () => {
    const dispatch = vi.fn(async () => ({ windowId: 'profile-window' }));
    const resolver = createCatalogIntentResolver({
      loadCatalog: () => [manifestToIntentCatalogEntry({
        dTag: 'profile-viewer',
        title: 'Profile Viewer',
        archetypes: [{ slug: 'profile', convention: CONVENTION }],
      })],
      targets: { dispatch },
    });
    const service = createIntentService({ resolver });
    service.onRegistered?.(runtime());
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'source-window',
      {
        type: 'intent.invoke',
        id: 'intent-1',
        request: {
          archetype: 'profile',
          payload: { pubkey: 'a'.repeat(64) },
          behavior: { focus: true },
        },
      } as unknown as NappletMessage,
      (message) => sent.push(message),
    );
    await flush();

    expect(dispatch).toHaveBeenCalledWith({
      handler: 'profile-viewer',
      sender: 'feed',
      archetype: 'profile',
      action: 'open',
      convention: CONVENTION,
      payload: { pubkey: 'a'.repeat(64) },
      behavior: { focus: true },
    });
    expect(sent).toEqual([{
      type: 'intent.invoke.result',
      id: 'intent-1',
      result: {
        ok: true,
        archetype: 'profile',
        action: 'open',
        handled: true,
        handler: 'profile-viewer',
        windowId: 'profile-window',
        convention: CONVENTION,
      },
    }]);
  });

  it('returns one canonical rejection when target dispatch fails', async () => {
    const resolver = createCatalogIntentResolver({
      loadCatalog: () => [manifestToIntentCatalogEntry({
        dTag: 'profile-viewer',
        archetypes: [{ slug: 'profile', convention: CONVENTION }],
      })],
      targets: {
        dispatch: vi.fn(async () => {
          throw new Error('target unavailable');
        }),
      },
    });
    const service = createIntentService({ resolver });
    service.onRegistered?.(runtime());
    const sent: NappletMessage[] = [];
    service.handleMessage(
      'source-window',
      {
        type: 'intent.invoke',
        id: 'intent-2',
        request: { archetype: 'profile', convention: CONVENTION },
      } as unknown as NappletMessage,
      (message) => sent.push(message),
    );
    await flush();

    expect(sent).toEqual([{
      type: 'intent.invoke.result',
      id: 'intent-2',
      result: {
        ok: false,
        archetype: 'profile',
        action: 'open',
        handled: false,
        error: 'invoke failed',
      },
    }]);
  });
});
