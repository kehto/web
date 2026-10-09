import type { NostrEvent } from 'nostr-tools';
import type { NappletManifest } from './index.js';
import { NappletResolutionError } from './errors.js';

const HASH = /^[a-f0-9]{64}$/;
const DOMAIN = /^[a-z][a-z0-9-]*$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const INTENT = /^napplet:[^/?#\s]+\/[^/?#\s]+$/;

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
  const archetypeSlugs = declarations(tags, 'z', SLUG);
  const intents = tags.filter((tag) => tag[0] === 'i').map((tag) => {
    const [, identity, ...parameters] = tag;
    if (!identity || !INTENT.test(identity)
      || parameters.some((parameter) => !parameter || /\s/.test(parameter))) {
      invalid('invalid accepted intent or parameter name');
    }
    return { identity, parameters };
  });
  return {
    format: 'current',
    kind: event.kind,
    pubkey: event.pubkey,
    dTag: dTag ?? '',
    artifactHash,
    aggregateHash: artifactHash,
    paths: [{ path: '/index.html', sha256: artifactHash }],
    servers: tags.filter((tag) => tag[0] === 'server' && tag[1]).map((tag) => tag[1]),
    requires: declarations(tags, 'R', DOMAIN),
    optional: declarations(tags, 'O', DOMAIN),
    archetypeSlugs,
    intents,
    // NAP-INTENT keeps roles and conventions orthogonal. The current schema
    // advertises independent sets; legacy explicit pairings stay in its adapter.
    archetypes: archetypeSlugs.flatMap((slug) => intents.map(({ identity }) => ({
      slug, convention: identity,
    }))),
    title: single(tags, 'title'),
    description: event.content,
    source: single(tags, 'source'),
    icon: iconFromTags(tags),
    parent,
    root,
  };
}
