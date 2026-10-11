import { describe, expect, it } from 'vitest';
import { InstalledNappletCatalog } from '../../apps/playground/src/installed-napplet-catalog.js';

const profile = {
  catalogId: 'nip5d:35129:publisher:Profile', dTag: 'Profile', aggregateHash: 'profile-aggregate', requires: [],
  archetypes: [{ slug: 'profile', convention: 'napplet:profile/open', params: ['pubkey'] }], indexHtml: '<main>verified</main>',
};

describe('InstalledNappletCatalog', () => {
  it('uses catalog identity instead of a bare d tag while retaining verified contracts', () => {
    const catalog = new InstalledNappletCatalog();
    const record = catalog.install(profile, { name: 'profile', containerId: 'profile-frame' });
    expect(record.id).toBe(profile.catalogId);
    expect(catalog.get(profile.catalogId)).toBe(record);
    expect(catalog.findCatalogId({ dTag: profile.dTag, aggregateHash: profile.aggregateHash })).toBe(profile.catalogId);
    expect(catalog.intentCatalog()).toEqual([expect.objectContaining({ id: profile.catalogId })]);
  });
});
