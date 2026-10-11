/**
 * manifest-intent-catalog.ts — signed-manifest → NAP-INTENT catalog adapter.
 *
 * Adapts a resolved NIP-5D manifest's normalized routing declarations into an
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
  /** Publisher/kind-safe catalog identifier derived from the verified event. */
  catalogId: string;
  /** Optional human-readable title from the manifest. */
  title?: string;
  /**
   * Normalized current z/i combinations or exact legacy archetype pairs.
   */
  archetypes: Array<{ slug: string; convention: string; params: string[] }>;
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
 * Repeated slugs group into one support record; exact contracts and their
 * parameter arrays remain stable and deduplicated.
 *
 * @param manifest - A resolved manifest's structural archetype data.
 * @returns The `IntentCatalogEntry` for `createCatalogIntentResolver`.
 *
 * @example
 * ```ts
 * manifestToIntentCatalogEntry({
 *   catalogId: 'nip5d:35129:publisher:profile-viewer',
 *   title: 'Profile',
 *   archetypes: [{ slug: 'profile', convention: 'napplet:profile/open', params: ['pubkey'] }],
 * });
 * // → { id: 'nip5d:35129:publisher:profile-viewer', title: 'Profile',
 * //     archetypes: { profile: { contracts: [
 * //       { convention: 'napplet:profile/open', params: ['pubkey'] },
 * //     ] } } }
 * ```
 */
export function manifestToIntentCatalogEntry(manifest: ManifestArchetypeInput): IntentCatalogEntry {
  const archetypes: Record<string, { contracts: IntentArchetypeSupport['contracts'][number][] }> = Object.create(null);
  for (const { slug, convention, params } of manifest.archetypes) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      throw new TypeError('manifest archetype slug is invalid');
    }
    actionFromConvention(convention);
    if (!convention.startsWith(`napplet:${slug}/`)) {
      throw new TypeError('manifest archetype must match its convention role');
    }
    const support = archetypes[slug] ??= {
      contracts: [],
    };
    if (!support.contracts.some((contract) => contract.convention === convention)) {
      support.contracts.push({ convention, params: [...params] });
    }
  }
  return {
    id: manifest.catalogId,
    ...(manifest.title === undefined ? {} : { title: manifest.title }),
    archetypes,
  };
}
