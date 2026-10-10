/**
 * playground-intent-catalog.ts — build the NAP-INTENT catalog from resolved manifests.
 *
 * Sources the playground's intent catalog from RESOLVED, verified napplet
 * manifests via the `@kehto/services` ARCH-02 adapter — not from host-injected
 * catalog data. Each resolved napplet's `{ dTag, title, archetypes }` is mapped
 * through `manifestToIntentCatalogEntry` into an `IntentCatalogEntry`, the shape
 * `createCatalogIntentResolver.loadCatalog` consumes.
 *
 * This builder is the Phase 104 wiring proof for ARCH-03. Phase 105 owns the
 * persistent live playground catalog/controller and interactive intent flow;
 * this module does not claim that host lifecycle wiring yet.
 *
 * @packageDocumentation
 */

import { manifestToIntentCatalogEntry } from '@kehto/services';
import type { IntentCatalogEntry } from '@kehto/services';
import type { PlaygroundNapplet } from './napplet-resolver.js';

/** The subset of a resolved {@link PlaygroundNapplet} the catalog needs. */
export type IntentCatalogSource = Pick<PlaygroundNapplet, 'catalogId' | 'title' | 'archetypes'>;

/**
 * Build the playground's NAP-INTENT catalog from resolved napplet manifests.
 *
 * Each resolved napplet is mapped through `manifestToIntentCatalogEntry`, so
 * availability/handler candidacy is derived from verified manifest archetype
 * tags rather than host-injected data. Napplets with no archetypes still produce
 * an entry (with `archetypes: {}`), contributing no candidates.
 *
 * @param napplets - Resolved napplets carrying their verified archetype data.
 * @returns The `IntentCatalogEntry[]` for `createCatalogIntentResolver`.
 *
 * @example
 * ```ts
 * const catalog = buildPlaygroundIntentCatalog([
 *   {
 *     dTag: 'profile-viewer',
 *     title: 'Profile',
 *     archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }],
 *   },
 * ]);
 * // → [{ dTag: 'profile-viewer', title: 'Profile',
 * //      archetypes: { profile: {
 * //        actions: ['open'],
 * //        conventions: ['napplet:profile/open'],
 * //        contracts: [{ convention: 'napplet:profile/open' }],
 * //      } } }]
 * ```
 */
export function buildPlaygroundIntentCatalog(
  napplets: ReadonlyArray<IntentCatalogSource>,
): IntentCatalogEntry[] {
  return napplets.map((napplet) =>
    manifestToIntentCatalogEntry({
      catalogId: napplet.catalogId,
      ...(napplet.title === undefined ? {} : { title: napplet.title }),
      archetypes: napplet.archetypes.map((archetype) => ({
        slug: archetype.slug,
        convention: archetype.convention,
        params: [...archetype.params],
      })),
    }),
  );
}
