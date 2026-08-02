import type {
  CommonActionResult,
  CommonFollowsResult,
  CommonProfileData,
  CommonProfileResult,
  CommonProfileTarget,
  CommonReaction,
  CommonReportReason,
  CommonReportTarget,
  EventTemplate,
  NostrEvent,
} from '@napplet/core';
import type { Signer } from '@kehto/runtime';
import { decode } from 'nostr-tools/nip19';
import { verifyEvent } from 'nostr-tools/pure';
import {
  PAJA_LIVE_QUERY_WAIT_MS,
  type PajaRelayBackend,
} from './browser-relay-runtime.js';

const HEX_64 = /^[0-9a-f]{64}$/i;
const SHORTCODE = /^:[a-zA-Z0-9_+-]+:$/;

/** Dependencies for Paja's Nostr-backed NAP-COMMON operations. */
export interface PajaCommonBackendOptions {
  /** Relay backend shared with Paja's relay and outbox services. */
  readonly relay: PajaRelayBackend;
  /** Current live relay policy. */
  readonly getRelays: () => string[];
  /** Current shell-user signer. */
  readonly getSigner: () => Signer | null;
}

/** NAP-COMMON hooks backed by Nostr relay reads and signed publications. */
export interface PajaCommonBackend {
  getProfile(target: CommonProfileTarget): Promise<CommonProfileResult>;
  follows(): Promise<CommonFollowsResult>;
  follow(pubkeys: string[]): Promise<CommonActionResult>;
  unfollow(pubkeys: string[]): Promise<CommonActionResult>;
  react(targetEventId: string, reaction: CommonReaction, customEmojiHref?: string): Promise<CommonActionResult>;
  report(target: CommonReportTarget, reason: CommonReportReason, text: string): Promise<CommonActionResult>;
}

interface ProfileTarget {
  readonly pubkey: string;
  readonly relays: string[];
}

function relayUrls(values: readonly string[]): string[] {
  const urls = new Set<string>();
  for (const value of values) {
    try {
      const url = new URL(value);
      if (url.protocol === 'wss:' || url.protocol === 'ws:') urls.add(url.href);
    } catch {
      // Invalid untrusted relay hints are ignored.
    }
  }
  return [...urls];
}

function profileTarget(target: string, defaults: string[]): ProfileTarget | null {
  if (HEX_64.test(target)) return { pubkey: target.toLowerCase(), relays: relayUrls(defaults) };
  try {
    const decoded = decode(target);
    if (decoded.type === 'npub') {
      return { pubkey: decoded.data.toLowerCase(), relays: relayUrls(defaults) };
    }
    if (decoded.type === 'nprofile') {
      return {
        pubkey: decoded.data.pubkey.toLowerCase(),
        relays: relayUrls([...(decoded.data.relays ?? []), ...defaults]),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function npub(value: string): string | null {
  try {
    const decoded = decode(value);
    return decoded.type === 'npub' ? decoded.data.toLowerCase() : null;
  } catch {
    return null;
  }
}

function pubkey(value: string): string | null {
  if (HEX_64.test(value)) return value.toLowerCase();
  return npub(value);
}

function newestVerified(events: NostrEvent[], predicate: (event: NostrEvent) => boolean): NostrEvent | null {
  return events
    .filter((event) => predicate(event) && verifyEvent(event as Parameters<typeof verifyEvent>[0]))
    .sort((left, right) => right.created_at - left.created_at || left.id.localeCompare(right.id))[0]
    ?? null;
}

function parseProfile(event: NostrEvent): CommonProfileData | null {
  try {
    const parsed = JSON.parse(event.content) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const profile = { ...parsed } as CommonProfileData & { display_name?: unknown };
    if (typeof profile.display_name === 'string' && typeof profile.displayName !== 'string') {
      profile.displayName = profile.display_name;
    }
    return profile;
  } catch {
    return null;
  }
}

function contactPubkeys(event: NostrEvent | null): string[] {
  const follows = new Set<string>();
  for (const tag of event?.tags ?? []) {
    if (tag[0] === 'p' && typeof tag[1] === 'string' && HEX_64.test(tag[1])) {
      follows.add(tag[1].toLowerCase());
    }
  }
  return [...follows];
}

function actionError(error: unknown): CommonActionResult {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('denied')) return { ok: false, error: 'user-denied' };
  if (message.includes('publish')) return { ok: false, error: 'publish-failed' };
  return { ok: false, error: message };
}

function isSingleEmoji(value: string): boolean {
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)];
  return graphemes.length === 1 && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(value);
}

function reactionTags(
  target: NostrEvent,
  reaction: string,
  customEmojiHref?: string,
): string[][] | null {
  if (reaction !== '+' && reaction !== '-' && !isSingleEmoji(reaction) && !SHORTCODE.test(reaction)) return null;
  if (customEmojiHref && !SHORTCODE.test(reaction)) return null;
  if (SHORTCODE.test(reaction) && !customEmojiHref) return null;
  const tags = [['e', target.id], ['p', target.pubkey], ['k', String(target.kind)]];
  if (customEmojiHref) {
    let url: URL;
    try {
      url = new URL(customEmojiHref);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    tags.push(['emoji', reaction.slice(1, -1), url.href]);
  }
  return tags;
}

/**
 * Create Paja's live Nostr implementation of NAP-COMMON.
 *
 * @param options - Relay policy and current signer dependencies.
 * @returns Host hooks consumed by `createCommonService`.
 */
export function createPajaCommonBackend(options: PajaCommonBackendOptions): PajaCommonBackend {
  const query = (filters: Parameters<PajaRelayBackend['query']>[1], relays = options.getRelays()) =>
    options.relay.query(relays, filters, PAJA_LIVE_QUERY_WAIT_MS);

  const identity = async (): Promise<{ signer: Signer; pubkey: string }> => {
    const active = options.getSigner();
    if (!active?.getPublicKey) throw new Error('not-signed-in');
    const activePubkey = (await active.getPublicKey()).toLowerCase();
    if (!HEX_64.test(activePubkey)) throw new Error('not-signed-in');
    return { signer: active, pubkey: activePubkey };
  };

  const signer = async (): Promise<{ signer: Signer; pubkey: string }> => {
    const active = await identity();
    if (!active.signer.signEvent) throw new Error('not-signed-in');
    return active;
  };

  const currentContacts = async (author: string): Promise<NostrEvent | null> => {
    const events = await query([{ kinds: [3], authors: [author], limit: 16 }]);
    return newestVerified(events, (event) => event.kind === 3 && event.pubkey.toLowerCase() === author);
  };

  const publish = async (active: Signer, author: string, template: EventTemplate): Promise<CommonActionResult> => {
    try {
      const event = await active.signEvent!(template);
      if (event.pubkey.toLowerCase() !== author
        || !verifyEvent(event as Parameters<typeof verifyEvent>[0])) return { ok: false, error: 'invalid-signature' };
      await options.relay.publish(options.getRelays(), event);
      return { ok: true, eventId: event.id, event };
    } catch (error) {
      return actionError(error);
    }
  };

  const mutateFollows = async (values: string[], add: boolean): Promise<CommonActionResult> => {
    const targets = values.map(npub);
    if (targets.some((target) => target === null)) return { ok: false, error: 'invalid-pubkey' };
    try {
      const active = await signer();
      const current = await currentContacts(active.pubkey);
      const targetSet = new Set(targets as string[]);
      const existing = new Set(contactPubkeys(current));
      const changed = add
        ? [...targetSet].some((target) => !existing.has(target))
        : [...targetSet].some((target) => existing.has(target));
      if (!changed) {
        return current
          ? { ok: true, eventId: current.id, event: current }
          : { ok: true };
      }
      const tags = (current?.tags ?? []).filter((tag) => {
        if (tag[0] !== 'p' || typeof tag[1] !== 'string') return true;
        return add || !targetSet.has(tag[1].toLowerCase());
      });
      if (add) {
        for (const target of targetSet) {
          if (!existing.has(target)) tags.push(['p', target]);
        }
      }
      return publish(active.signer, active.pubkey, {
        kind: 3,
        created_at: Math.floor(Date.now() / 1_000),
        tags,
        content: current?.content ?? '',
      });
    } catch (error) {
      return actionError(error);
    }
  };

  return {
    async getProfile(target) {
      const resolved = profileTarget(target, options.getRelays());
      if (!resolved) return { ok: false, pubkey: '', error: 'invalid-profile-target' };
      try {
        const events = await query([{ kinds: [0], authors: [resolved.pubkey], limit: 16 }], resolved.relays);
        const event = newestVerified(events, (candidate) => candidate.kind === 0 && candidate.pubkey.toLowerCase() === resolved.pubkey);
        if (!event) return { ok: true, pubkey: resolved.pubkey, profile: null };
        return {
          ok: true,
          pubkey: resolved.pubkey,
          profile: parseProfile(event),
          result: { event, sidecar: { relayHints: resolved.relays } },
        };
      } catch {
        return { ok: false, pubkey: resolved.pubkey, error: 'relay-timeout' };
      }
    },

    async follows() {
      try {
        const active = await identity();
        return { ok: true, pubkeys: contactPubkeys(await currentContacts(active.pubkey)) };
      } catch (error) {
        const failure = actionError(error);
        return { ok: false, pubkeys: [], error: failure.error };
      }
    },

    follow: (pubkeys) => mutateFollows(pubkeys, true),
    unfollow: (pubkeys) => mutateFollows(pubkeys, false),

    async react(targetEventId, reaction, customEmojiHref) {
      if (!HEX_64.test(targetEventId)) return { ok: false, error: 'invalid-target' };
      try {
        const active = await signer();
        const events = await query([{ ids: [targetEventId], limit: 8 }]);
        const target = newestVerified(events, (event) => event.id === targetEventId.toLowerCase());
        if (!target) return { ok: false, error: 'invalid-target' };
        const tags = reactionTags(target, reaction, customEmojiHref);
        if (!tags) return { ok: false, error: 'invalid-reaction' };
        return publish(active.signer, active.pubkey, {
          kind: 7,
          created_at: Math.floor(Date.now() / 1_000),
          tags,
          content: reaction,
        });
      } catch (error) {
        return actionError(error);
      }
    },

    async report(target, reason, text) {
      try {
        const active = await signer();
        if (target.type === 'pubkey') {
          const reportedPubkey = pubkey(target.pubkey);
          if (!reportedPubkey) return { ok: false, error: 'invalid-target' };
          return publish(active.signer, active.pubkey, {
            kind: 1_984,
            created_at: Math.floor(Date.now() / 1_000),
            tags: [['p', reportedPubkey, target.relay ?? '', reason]],
            content: text,
          });
        }
        if (!HEX_64.test(target.id)) return { ok: false, error: 'invalid-target' };
        const explicitAuthor = target.pubkey ? pubkey(target.pubkey) : undefined;
        if (target.pubkey && !explicitAuthor) return { ok: false, error: 'invalid-target' };
        let author = explicitAuthor ?? null;
        if (!author) {
          const events = await query([{ ids: [target.id], limit: 8 }]);
          author = newestVerified(events, (event) => event.id === target.id.toLowerCase())?.pubkey ?? null;
        }
        if (!author) return { ok: false, error: 'author-unresolved' };
        return publish(active.signer, active.pubkey, {
          kind: 1_984,
          created_at: Math.floor(Date.now() / 1_000),
          tags: [
            ['e', target.id.toLowerCase(), target.relay ?? '', reason],
            ['p', author.toLowerCase(), '', reason],
          ],
          content: text,
        });
      } catch (error) {
        return actionError(error);
      }
    },
  };
}
