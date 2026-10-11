import { describe, expect, it } from 'vitest';
import { buildPlaygroundIntentCatalog } from '../../apps/playground/src/playground-intent-catalog.js';

describe('buildPlaygroundIntentCatalog', () => {
  it('maps verified contracts to opaque catalog candidates with retained params', () => {
    expect(buildPlaygroundIntentCatalog([{
      catalogId: 'nip5d:35129:publisher:profile', title: 'Profile',
      archetypes: [{ slug: 'profile', convention: 'napplet:profile/open', params: ['pubkey'] }],
    }])).toEqual([{
      id: 'nip5d:35129:publisher:profile', title: 'Profile',
      archetypes: { profile: { contracts: [{ convention: 'napplet:profile/open', params: ['pubkey'] }] } },
    }]);
  });
});
