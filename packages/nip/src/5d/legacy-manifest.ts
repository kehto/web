// Removal boundary for pre-0.15 @napplet/vite-plugin event compatibility.
import type { NostrEvent } from 'nostr-tools';
import { computeAggregateHash, pathEntriesFromTags, aggregateTagValue } from '../5a/index.js';
import type { NappletManifest } from './index.js';
import { NappletResolutionError } from './errors.js';

function firstTagValue(tags: readonly (readonly string[])[], name: string): string | undefined {
  for (const tag of tags) {
    if (tag[0] === name && typeof tag[1] === 'string' && tag[1].length > 0) return tag[1];
  }
  return undefined;
}

function allTagValues(tags: readonly (readonly string[])[], name: string): string[] {
  const out: string[] = [];
  for (const tag of tags) {
    if (tag[0] === name && typeof tag[1] === 'string' && tag[1].length > 0) out.push(tag[1]);
  }
  return out;
}

function archetypesFromTags(
  tags: readonly (readonly string[])[],
): Array<{ slug: string; convention: string }> {
  const out: Array<{ slug: string; convention: string }> = [];
  for (const tag of tags) {
    if (tag[0] !== 'archetype') continue;
    const slug = tag[1];
    if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      throw new NappletResolutionError(
        'invalid-manifest',
        'archetype slug must contain lowercase letters, numbers, and hyphens',
      );
    }

    const convention = tag[2];
    if (typeof convention !== 'string' || convention.length === 0) {
      throw new NappletResolutionError('invalid-manifest', 'archetype convention is required');
    }
    if (/^NAP-\d+$/.test(convention)) {
      throw new NappletResolutionError(
        'invalid-manifest',
        'numbered NAP identifier is not an archetype convention',
      );
    }
    if (!/^napplet:[^/?#\s]+\/[^/?#\s]+$/.test(convention)) {
      throw new NappletResolutionError(
        'invalid-manifest',
        'archetype convention must be a queryless napplet:<archetype>/<intent> identity',
      );
    }
    // NAP-INTENT keeps a routing archetype and a payload convention
    // orthogonal: one convention may serve multiple archetypes and vice versa.

    if (tag.length !== 3) {
      throw new NappletResolutionError(
        'invalid-manifest',
        'archetype tags must contain exactly slug and convention',
      );
    }
    out.push({ slug, convention });
  }
  return out;
}

export function parseLegacyManifest(event: NostrEvent): NappletManifest {
  const paths = pathEntriesFromTags(event.tags);
  if (paths.length === 0) {
    throw new NappletResolutionError('invalid-manifest', 'manifest has no path tags');
  }
  const aggregateHash = aggregateTagValue(event.tags);
  if (!aggregateHash) {
    throw new NappletResolutionError('invalid-manifest', 'manifest has no aggregate x tag');
  }
  const dTag = firstTagValue(event.tags, 'd');
  if (event.kind !== 35129 && dTag !== undefined) {
    throw new NappletResolutionError('invalid-manifest', 'only named manifests may carry a d tag');
  }
  return {
    format: 'legacy',
    artifactHash: aggregateHash,
    optional: [],
    kind: event.kind,
    pubkey: event.pubkey,
    dTag: dTag ?? '',
    paths,
    aggregateHash,
    servers: allTagValues(event.tags, 'server'),
    requires: allTagValues(event.tags, 'requires'),
    archetypes: archetypesFromTags(event.tags),
    title: firstTagValue(event.tags, 'title'),
    description: firstTagValue(event.tags, 'description'),
    source: firstTagValue(event.tags, 'source'),
  };
}


/** Compatibility-only aggregate check; current manifests never enter this path. */
export function verifyLegacyAggregate(manifest: NappletManifest): void {
  const recomputed = computeAggregateHash(manifest.paths);
  if (recomputed !== manifest.aggregateHash) {
    throw new NappletResolutionError('aggregate-mismatch',
      `recomputed aggregate ${recomputed} != manifest ${manifest.aggregateHash}`);
  }
}
