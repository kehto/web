/**
 * playground-intent-catalog.test.ts — buildPlaygroundIntentCatalog.
 *
 * Proves the playground intent catalog is sourced from resolved manifests via the
 * @kehto/services ARCH-02 adapter (ARCH-03 wiring proof). Lives in tests/unit so
 * the root vitest include (tests/unit/**) runs it.
 */

import { describe, it, expect } from 'vitest';
import { buildPlaygroundIntentCatalog } from '../../apps/playground/src/playground-intent-catalog.js';

describe('buildPlaygroundIntentCatalog', () => {
  it('maps a resolved napplet through the adapter into an IntentCatalogEntry', () => {
    const catalog = buildPlaygroundIntentCatalog([
      { dTag: 'profile-viewer', title: 'Profile', archetypes: [{ slug: 'profile', nap: 'NAP-1' }] },
    ]);
    expect(catalog).toEqual([
      {
        dTag: 'profile-viewer',
        title: 'Profile',
        archetypes: { profile: { actions: ['open'], protocols: ['NAP-1'] } },
      },
    ]);
  });

  it('includes a napplet with no archetypes as an entry with archetypes:{}', () => {
    const catalog = buildPlaygroundIntentCatalog([
      { dTag: 'plain', archetypes: [] },
    ]);
    expect(catalog).toHaveLength(1);
    expect(catalog[0].archetypes).toEqual({});
  });

  it('builds an entry per resolved napplet', () => {
    const catalog = buildPlaygroundIntentCatalog([
      { dTag: 'profile-viewer', archetypes: [{ slug: 'profile', nap: 'NAP-1' }] },
      { dTag: 'feed', archetypes: [{ slug: 'feed' }] },
    ]);
    expect(catalog.map((e) => e.dTag)).toEqual(['profile-viewer', 'feed']);
    expect(catalog[1].archetypes.feed).toEqual({ actions: ['open'], protocols: [] });
  });
});
