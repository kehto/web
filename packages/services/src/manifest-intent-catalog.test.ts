/**
 * manifest-intent-catalog.test.ts — manifestToIntentCatalogEntry adapter.
 *
 * Covers slug→entry mapping, nap→protocols, default action `open`, multiple and
 * empty archetypes, and title passthrough/omission.
 */

import { describe, it, expect } from 'vitest';
import { manifestToIntentCatalogEntry } from './manifest-intent-catalog.js';

describe('manifestToIntentCatalogEntry', () => {
  it('maps a slug + nap to {actions:["open"], protocols:[nap]}', () => {
    const entry = manifestToIntentCatalogEntry({
      dTag: 'profile-viewer',
      title: 'Profile',
      archetypes: [{ slug: 'profile', nap: 'NAP-1' }],
    });
    expect(entry).toEqual({
      dTag: 'profile-viewer',
      title: 'Profile',
      archetypes: { profile: { actions: ['open'], protocols: ['NAP-1'] } },
    });
  });

  it('maps an archetype with no nap to protocols:[] and actions:["open"]', () => {
    const entry = manifestToIntentCatalogEntry({
      dTag: 'feed',
      archetypes: [{ slug: 'feed' }],
    });
    expect(entry.archetypes.feed).toEqual({ actions: ['open'], protocols: [] });
  });

  it('defaults the action list to ["open"]', () => {
    const entry = manifestToIntentCatalogEntry({
      dTag: 'x',
      archetypes: [{ slug: 'profile', nap: 'NAP-1' }],
    });
    expect(entry.archetypes.profile.actions).toEqual(['open']);
  });

  it('maps multiple archetypes to multiple keyed supports', () => {
    const entry = manifestToIntentCatalogEntry({
      dTag: 'multi',
      archetypes: [
        { slug: 'profile', nap: 'NAP-1' },
        { slug: 'feed', nap: 'NAP-2' },
      ],
    });
    expect(entry.archetypes).toEqual({
      profile: { actions: ['open'], protocols: ['NAP-1'] },
      feed: { actions: ['open'], protocols: ['NAP-2'] },
    });
  });

  it('keeps the last support for a duplicate slug', () => {
    const entry = manifestToIntentCatalogEntry({
      dTag: 'dup',
      archetypes: [
        { slug: 'profile', nap: 'NAP-1' },
        { slug: 'profile', nap: 'NAP-9' },
      ],
    });
    expect(entry.archetypes.profile.protocols).toEqual(['NAP-9']);
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
