/**
 * manifest-intent-catalog.ts — signed-manifest → NAP-INTENT catalog adapter.
 *
 * Adapts a resolved NIP-5A/5D napplet manifest's archetype tags into an
 * {@link IntentCatalogEntry} — the shape `createCatalogIntentResolver.loadCatalog`
 * consumes. This lets NAP-INTENT availability and handler candidacy flow from
 * verified manifest tags rather than host-injected catalog data.
 *
 * To avoid a `@kehto/services → @kehto/nip` dependency cycle (services must stay
 * dependency-light and `@kehto/nip` is a lower-level NIP utility), the adapter
 * takes a minimal STRUCTURAL input {@link ManifestArchetypeInput} that the
 * `@kehto/nip/5d` `NappletManifest` satisfies by duck typing — callers pass
 * `resolved.manifest` directly without any package coupling.
 *
 * @packageDocumentation
 */

import type { IntentArchetypeSupport, IntentCatalogEntry } from './catalog-intent-resolver.js';

/**
 * The structural subset of `@kehto/nip/5d` `NappletManifest` the adapter needs.
 * Intentionally a duck-typed shape so the playground (or any caller) can pass a
 * resolved manifest without importing `@kehto/nip`.
 */
export interface ManifestArchetypeInput {
  /** The napplet's `d` identifier. */
  dTag: string;
  /** Optional human-readable title from the manifest. */
  title?: string;
  /**
   * Ordered convention contracts from the manifest's `archetype` tags.
   */
  archetypes: Array<{ slug: string; convention: string }>;
}

function actionFromConvention(convention: string): string {
  const match = /^napplet:([^/?#\s]+)\/([^/?#\s]+)$/.exec(convention);
  if (!match) {
    throw new TypeError('manifest archetype convention is invalid');
  }
  return match[2];
}

/**
 * Map a resolved napplet manifest's archetype data into an
 * {@link IntentCatalogEntry}.
 *
 * Repeated slugs group into one support record; action and convention arrays
 * remain stable and deduplicated.
 *
 * @param manifest - A resolved manifest's structural archetype data.
 * @returns The `IntentCatalogEntry` for `createCatalogIntentResolver`.
 *
 * @example
 * ```ts
 * manifestToIntentCatalogEntry({
 *   dTag: 'profile-viewer',
 *   title: 'Profile',
 *   archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }],
 * });
 * // → { dTag: 'profile-viewer', title: 'Profile',
 * //     archetypes: { profile: {
 * //       actions: ['open'],
 * //       conventions: ['napplet:profile/open'],
 * //     } } }
 * ```
 */
export function manifestToIntentCatalogEntry(manifest: ManifestArchetypeInput): IntentCatalogEntry {
  const archetypes: Record<string, IntentArchetypeSupport> = {};
  for (const { slug, convention } of manifest.archetypes) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      throw new TypeError('manifest archetype slug is invalid');
    }
    // NAP-INTENT deliberately keeps routing archetypes and payload conventions
    // orthogonal, so the convention's URI archetype need not equal this slug.
    const action = actionFromConvention(convention);
    const support = archetypes[slug] ??= {
      actions: [],
      conventions: [],
    };
    if (!support.actions.includes(action)) support.actions.push(action);
    if (!support.conventions.includes(convention)) support.conventions.push(convention);
  }
  return {
    dTag: manifest.dTag,
    ...(manifest.title === undefined ? {} : { title: manifest.title }),
    archetypes,
  };
}
