import { describe, expect, it } from 'vitest';
import { manifestToIntentCatalogEntry } from './manifest-intent-catalog.js';

describe('manifestToIntentCatalogEntry', () => {
  it('groups canonical manifest conventions by archetype and deduplicates actions', () => {
    expect(manifestToIntentCatalogEntry({
      dTag: 'profile-viewer',
      title: 'Profile',
      archetypes: [
        { slug: 'profile', convention: 'napplet:profile/open' },
        { slug: 'profile', convention: 'napplet:profile/edit' },
        { slug: 'profile', convention: 'napplet:profile/open' },
      ],
    })).toEqual({
      dTag: 'profile-viewer',
      title: 'Profile',
      archetypes: {
        profile: {
          actions: ['open', 'edit'],
          conventions: ['napplet:profile/open', 'napplet:profile/edit'],
        },
      },
    });
  });

  it.each([
    [[{ slug: 'Bad Slug', convention: 'napplet:Bad Slug/open' }]],
    [[{ slug: 'profile', convention: 'napplet:note/open' }]],
    [[{ slug: 'profile', convention: 'napplet:profile/open?kind=0' }]],
  ])('rejects malformed or mismatched canonical archetype data', (archetypes) => {
    expect(() => manifestToIntentCatalogEntry({ dTag: 'target', archetypes }))
      .toThrow(/archetype/);
  });
});
