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
import type { IntentContract } from './intent-types.js';

/** NAP-INTENT default action when a manifest does not enumerate actions. */
const DEFAULT_ACTIONS: readonly string[] = ['open'];

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
   * Archetype slugs this napplet fulfills, from the manifest's `archetype` tags;
   * the optional `nap` is the recommended default wire protocol.
   */
  archetypes: Array<{ slug: string; convention?: string; eventKinds?: number[]; nap?: string }>;
}

/**
 * Map a resolved napplet manifest's archetype data into an
 * {@link IntentCatalogEntry}.
 *
 * Each archetype `{ slug, nap }` becomes a keyed support record where `actions`
 * defaults to `['open']` (the NAP-INTENT default action — manifests do not
 * enumerate actions in this phase) and `protocols` is `[nap]` when a NAP-N is
 * present, else `[]`. Duplicate slugs keep the last occurrence.
 *
 * @param manifest - A resolved manifest's structural archetype data.
 * @returns The `IntentCatalogEntry` for `createCatalogIntentResolver`.
 *
 * @example
 * ```ts
 * manifestToIntentCatalogEntry({
 *   dTag: 'profile-viewer',
 *   title: 'Profile',
 *   archetypes: [{ slug: 'profile', nap: 'NAP-1' }],
 * });
 * // → { dTag: 'profile-viewer', title: 'Profile',
 * //     archetypes: { profile: { actions: ['open'], protocols: ['NAP-1'] } } }
 * ```
 */
export function manifestToIntentCatalogEntry(manifest: ManifestArchetypeInput): IntentCatalogEntry {
  const archetypes: Record<string, IntentArchetypeSupport> = {};
  for (const { slug, convention, eventKinds, nap } of manifest.archetypes) {
    const stableConvention = convention ?? nap;
    const contracts: IntentContract[] = stableConvention
      ? [{ convention: stableConvention, ...(eventKinds?.length ? { eventKinds: [...eventKinds] } : {}) }]
      : [];
    archetypes[slug] = {
      actions: [...DEFAULT_ACTIONS],
      protocols: stableConvention ? [stableConvention] : [],
      conventions: stableConvention ? [stableConvention] : [],
      contracts,
    };
  }
  return {
    dTag: manifest.dTag,
    ...(manifest.title === undefined ? {} : { title: manifest.title }),
    archetypes,
  };
}
