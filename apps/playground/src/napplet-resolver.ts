/**
 * napplet-resolver.ts — content-addressed napplet resolution for the playground.
 *
 * Resolves a napplet end-to-end with no gateway in the trust path:
 *   1. fetch the author's NIP-65 relay list and select outbox relays
 *      (`@kehto/nip/65`),
 *   2. query a selected relay for the napplet's NIP-5D manifest event
 *      (kind 35129, by author + `d`),
 *   3. verify the signature, recompute + verify the NIP-5A aggregate, fetch each
 *      blob from Blossom and verify its hash (`@kehto/nip/5d` `resolveNapplet`),
 *   4. assemble the verified `/index.html` and inject the connect-src CSP `<meta>`
 *      so the policy holds inside the `srcdoc` opaque-origin iframe.
 *
 * Identity `(dTag, aggregateHash)` is computed from the verified bytes — never
 * taken from a gateway. Any failure throws; the caller must not render the
 * iframe.
 */

import type { NostrEvent } from 'nostr-tools';
import { resolveNapplet, fetchBlob, openNappletArtifactCache } from '@kehto/nip/5d';
import { parseNip65RelayList, selectWriteRelays } from '@kehto/nip/65';

/**
 * Manifest author for the in-repo dev build — the public key of the playground
 * manifest signing key (`'11'.repeat(32)`). Production napplets are published by
 * their real authors; the playground signs its dev artifacts with this key.
 */
export const PLAYGROUND_MANIFEST_AUTHOR =
  '4f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa';

/** A `fetch`-like function (injectable for tests). */
export type Fetcher = (url: string) => Promise<Response>;

/**
 * Inject a `connect-src` Content-Security-Policy `<meta http-equiv>` into the
 * assembled HTML. Under `srcdoc` the iframe has an opaque origin and no HTTP
 * response, so the CSP must travel inside the document.
 *
 * @param html - The verified, assembled `/index.html`
 * @param origins - Granted connect-src origins (empty → `'none'`)
 * @returns HTML with the CSP meta inside `<head>`
 */
export function injectCspMeta(html: string, origins: readonly string[]): string {
  const value = origins.length > 0
    ? `connect-src ${[...origins].sort().join(' ')}`
    : "connect-src 'none'";
  const meta = `<meta http-equiv="Content-Security-Policy" content="${value}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}${meta}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (open) => `${open}<head>${meta}</head>`);
  }
  return `${meta}${html}`;
}

/** A fully resolved, verified napplet. The shell injects the CSP and sets srcdoc. */
export interface PlaygroundNapplet {
  /** Computed `d` identifier. */
  dTag: string;
  /** Computed, verified aggregate hash (content address). */
  aggregateHash: string;
  /** Short NAP capability names the manifest requires. */
  requires: string[];
  /**
   * Archetype slugs this napplet fulfills, from the verified manifest's
   * `archetype` tags; the optional `nap` is the recommended default wire protocol.
   * Always present (empty when the manifest declares none).
   */
  archetypes: Array<{ slug: string; nap?: string }>;
  /** Optional human title from the verified manifest. */
  title?: string;
  /** Verified `/index.html` text (no CSP yet — inject with {@link injectCspMeta}). */
  indexHtml: string;
}

/** Options for {@link resolvePlaygroundNapplet}. */
export interface ResolvePlaygroundOptions {
  /** Requested napplet `d` identifier. */
  dTag: string;
  /** Expected manifest author (defaults to {@link PLAYGROUND_MANIFEST_AUTHOR}). */
  author?: string;
  /** NIP-65 relay-list discovery base — `GET <url>/<author>` → kind-10002 event. */
  relayDiscoveryUrl: string;
  /** Blossom server base URLs for blob fetch by sha256. */
  blossomServers: readonly string[];
  /** Fetch implementation (defaults to `fetch` with `no-store`). */
  fetcher?: Fetcher;
}

async function getJson(fetcher: Fetcher, url: string): Promise<unknown> {
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`[resolver] ${url}: ${res.status}`);
  return res.json();
}

/**
 * Resolve a playground napplet via relays → Blossom → verify → srcdoc.
 *
 * @param options - {@link ResolvePlaygroundOptions}
 * @returns The verified {@link PlaygroundNapplet}
 * @throws if no outbox relay is advertised, the manifest cannot be found, the
 *   author or `dTag` does not match, or any signature/aggregate/blob check fails
 */
export async function resolvePlaygroundNapplet(
  options: ResolvePlaygroundOptions,
): Promise<PlaygroundNapplet> {
  const fetcher: Fetcher = options.fetcher ?? ((url) => fetch(url, { cache: 'no-store' }));
  const author = options.author ?? PLAYGROUND_MANIFEST_AUTHOR;

  // 1. NIP-65 outbox relay selection.
  const relayListEvent = (await getJson(
    fetcher,
    `${options.relayDiscoveryUrl}/${author}`,
  )) as NostrEvent;
  const relays = selectWriteRelays(parseNip65RelayList(relayListEvent));
  if (relays.length === 0) {
    throw new Error(`[resolver] no outbox relays advertised for ${author}`);
  }

  // 2. Query the selected relays for the manifest event (kind + author + d).
  let event: NostrEvent | undefined;
  for (const relayUrl of relays) {
    try {
      event = (await getJson(fetcher, `${relayUrl}/${options.dTag}`)) as NostrEvent;
      if (event) break;
    } catch {
      // try the next relay
    }
  }
  if (!event) {
    throw new Error(`[resolver] manifest for ${options.dTag} not found on any outbox relay`);
  }

  // 3. Bind to the named coordinate before trusting anything else.
  if (event.pubkey !== author) {
    throw new Error(`[resolver] manifest author mismatch: ${event.pubkey} != ${author}`);
  }

  // 4. Verify signature + aggregate + every blob; identity is the computed tuple.
  const artifactCache = await openNappletArtifactCache({ requireStorageEstimate: true });
  const resolved = await resolveNapplet({
    event,
    cache: artifactCache,
    fetchBlob: (sha256Hex, servers) =>
      fetchBlob([...servers, ...options.blossomServers], sha256Hex, async (url) => {
        const res = await fetcher(url);
        if (!res.ok) throw new Error(`[resolver] blob ${url}: ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
      }),
  });
  if (resolved.dTag !== options.dTag) {
    throw new Error(`[resolver] manifest dTag mismatch: ${resolved.dTag} != ${options.dTag}`);
  }

  return {
    dTag: resolved.dTag,
    aggregateHash: resolved.aggregateHash,
    requires: resolved.manifest.requires,
    archetypes: resolved.manifest.archetypes,
    ...(resolved.manifest.title === undefined ? {} : { title: resolved.manifest.title }),
    indexHtml: resolved.indexHtml,
  };
}
