import type { NostrEvent } from 'nostr-tools';
import type { NappletManifest } from './index.js';
import { NappletResolutionError } from './errors.js';
import { getNappletCatalogId } from './catalog-id.js';

const HASH = /^[a-f0-9]{64}$/;
const DOMAIN = /^[a-z][a-z0-9-]*$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

function invalid(message: string): never {
  throw new NappletResolutionError('invalid-manifest', message);
}

function single(tags: string[][], name: string): string | undefined {
  const matches = tags.filter((tag) => tag[0] === name);
  if (matches.length > 1 || matches.some((tag) => tag.length !== 2 || !tag[1])) {
    invalid(`manifest ${name} tag must have one value and occur at most once`);
  }
  return matches[0]?.[1];
}

function declarations(tags: string[][], name: string, pattern: RegExp): string[] {
  return [...new Set(tags.filter((tag) => tag[0] === name).map((tag) => {
    if (tag.length !== 2 || !pattern.test(tag[1])) invalid(`invalid ${name} declaration`);
    return tag[1];
  }))];
}

function intentDeclarations(tags: string[][], roles: readonly string[]): Array<{
  slug: string;
  convention: string;
  params: string[];
}> {
  const roleSet = new Set(roles);
  const contracts: Array<{ slug: string; convention: string; params: string[] }> = [];
  for (const tag of tags) {
    if (tag[0] !== 'i') continue;
    const [, identity, ...params] = tag;
    const match = typeof identity === 'string' ? /^napplet:([a-z0-9][a-z0-9-]*)\/[^/?#\s]+$/.exec(identity) : null;
    if (!match || params.some((param) => !param || /\s/.test(param))) continue;
    // A current `i` advertisement is eligible only for the same declared role.
    if (!roleSet.has(match[1])) continue;
    contracts.push({ slug: match[1], convention: identity, params });
  }
  return contracts;
}

function iconFromTags(tags: string[][]): NappletManifest['icon'] {
  const icons = tags.filter((tag) => tag[0] === 'icon');
  if (icons.length !== 1) return undefined;
  const [, hash, mimeType] = icons[0];
  if (icons[0].length !== 3 || !HASH.test(hash)) return undefined;
  if (mimeType !== 'image/png' && mimeType !== 'image/jpeg' && mimeType !== 'image/webp') {
    return undefined;
  }
  // A declaration is not verified image data. Hosts retain generic artwork until
  // both its hash and decoded image format have been checked independently.
  return { sha256: hash, mimeType };
}

/** Parse the single-artifact schema from NIP-5D #2303, 020cb8b. */
export function parseCurrentManifest(event: NostrEvent): NappletManifest {
  const tags = event.tags;
  const artifactHash = single(tags, 'x');
  if (!artifactHash || !HASH.test(artifactHash)) invalid('invalid artifact x hash');
  if (typeof event.content !== 'string' || !event.content.trim()) {
    invalid('manifest content must be a non-empty plain-text description');
  }
  const dTag = single(tags, 'd');
  if (event.kind === 35129 ? dTag === undefined : dTag !== undefined) {
    invalid('exactly one d tag is required only on named manifests');
  }
  const parent = single(tags, 'a');
  const root = single(tags, 'A');
  for (const address of [parent, root]) {
    if (address === undefined) continue;
    if (event.kind !== 5129 || !/^(35129:[a-f0-9]{64}:.+|15129:[a-f0-9]{64}:)$/.test(address)) {
      invalid('lineage must be a napplet address on a snapshot');
    }
  }
  // NAP-INTENT advertisements are optional routing hints. A malformed z/i tag
  // contributes no contract and never invalidates an otherwise verified artifact.
  const archetypeSlugs = [...new Set(tags
    .filter((tag) => tag[0] === 'z' && tag.length === 2 && SLUG.test(tag[1]))
    .map((tag) => tag[1]))];
  const archetypes = intentDeclarations(tags, archetypeSlugs);
  const intents = archetypes.map(({ convention: identity, params: parameters }) => ({ identity, parameters }));
  return {
    format: 'current',
    kind: event.kind,
    pubkey: event.pubkey,
    dTag: dTag ?? '',
    catalogId: getNappletCatalogId(event),
    artifactHash,
    aggregateHash: artifactHash,
    paths: [{ path: '/index.html', sha256: artifactHash }],
    servers: tags.filter((tag) => tag[0] === 'server' && tag[1]).map((tag) => tag[1]),
    requires: declarations(tags, 'R', DOMAIN),
    optional: declarations(tags, 'O', DOMAIN),
    archetypeSlugs,
    intents,
    archetypes,
    title: single(tags, 'title'),
    description: event.content,
    source: single(tags, 'source'),
    icon: iconFromTags(tags),
    parent,
    root,
  };
}
