import { describe, expect, it } from 'vitest';
import { manifestToIntentCatalogEntry } from './manifest-intent-catalog.js';

describe('manifestToIntentCatalogEntry', () => {
  it('retains same-role contracts and advertised params', () => {
    expect(manifestToIntentCatalogEntry({
      catalogId: 'nip5d:35129:publisher:profile', title: 'Profile',
      archetypes: [
        { slug: 'profile', convention: 'napplet:profile/open', params: ['pubkey'] },
        { slug: 'profile', convention: 'napplet:profile/edit', params: ['draft', 'relays'] },
      ],
    })).toEqual({
      id: 'nip5d:35129:publisher:profile', title: 'Profile',
      archetypes: { profile: { contracts: [
        { convention: 'napplet:profile/open', params: ['pubkey'] },
        { convention: 'napplet:profile/edit', params: ['draft', 'relays'] },
      ] } },
    });
  });

  it('rejects a mismatched role instead of fabricating a catalog contract', () => {
    expect(() => manifestToIntentCatalogEntry({ catalogId: 'id', archetypes: [
      { slug: 'profile', convention: 'napplet:note/open', params: [] },
    ] })).toThrow(/match/);
  });
});
