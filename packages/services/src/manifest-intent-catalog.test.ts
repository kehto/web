/**
 * manifest-intent-catalog.test.ts — manifestToIntentCatalogEntry adapter.
 *
 * Covers slug→entry mapping, convention contracts, default action `open`, multiple and
 * empty archetypes, and title passthrough/omission.
 */

import { describe, it, expect } from 'vitest';
import { manifestToIntentCatalogEntry } from './manifest-intent-catalog.js';

describe('manifestToIntentCatalogEntry', () => {
  it('maps a slug + convention to a contract', () => {
    const entry = manifestToIntentCatalogEntry({
      dTag: 'profile-viewer',
      title: 'Profile',
      archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }],
    });
    expect(entry).toEqual({
      dTag: 'profile-viewer',
      title: 'Profile',
      archetypes: { profile: { actions: ['open'], protocols: ['napplet:profile/open'], conventions: ['napplet:profile/open'], contracts: [{ convention: 'napplet:profile/open' }] } },
    });
  });

  it('maps an archetype with no nap to protocols:[] and actions:["open"]', () => {
    const entry = manifestToIntentCatalogEntry({
      dTag: 'feed',
      archetypes: [{ slug: 'feed' }],
    });
    expect(entry.archetypes.feed).toEqual({ actions: ['open'], protocols: [], conventions: [], contracts: [] });
  });

  it('defaults the action list to ["open"]', () => {
    const entry = manifestToIntentCatalogEntry({
      dTag: 'x',
      archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }],
    });
    expect(entry.archetypes.profile.actions).toEqual(['open']);
  });

  it('maps multiple archetypes to multiple keyed supports', () => {
    const entry = manifestToIntentCatalogEntry({
      dTag: 'multi',
      archetypes: [
        { slug: 'profile', convention: 'napplet:profile/open' },
        { slug: 'feed', convention: 'napplet:feed/open' },
      ],
    });
    expect(entry.archetypes).toEqual({
      profile: { actions: ['open'], protocols: ['napplet:profile/open'], conventions: ['napplet:profile/open'], contracts: [{ convention: 'napplet:profile/open' }] },
      feed: { actions: ['open'], protocols: ['napplet:feed/open'], conventions: ['napplet:feed/open'], contracts: [{ convention: 'napplet:feed/open' }] },
    });
  });

  it('keeps the last support for a duplicate slug', () => {
    const entry = manifestToIntentCatalogEntry({
      dTag: 'dup',
      archetypes: [
        { slug: 'profile', convention: 'napplet:profile/open' },
        { slug: 'profile', convention: 'napplet:profile/edit' },
      ],
    });
    expect(entry.archetypes.profile.protocols).toEqual(['napplet:profile/edit']);
  });

  it('maps empty archetypes to archetypes:{}', () => {
    const entry = manifestToIntentCatalogEntry({ dTag: 'bare', archetypes: [] });
    expect(entry.archetypes).toEqual({});
  });

  it('omits title when absent (no title key emitted)', () => {
    const entry = manifestToIntentCatalogEntry({ dTag: 'no-title', archetypes: [] });
    expect('title' in entry).toBe(false);
  });

  it('passes title through when present', () => {
    const entry = manifestToIntentCatalogEntry({ dTag: 't', title: 'Titled', archetypes: [] });
    expect(entry.title).toBe('Titled');
  });
});
