/**
 * domains/common.ts — Mock NAP-COMMON service.
 *
 * Spec: naps/NAP-COMMON.md @ napplet/naps PR #67 head 8cd0eae85505 (draft)
 * Routes: common.encodeNip19, common.decodeNip19, common.getProfile,
 *         common.follows, common.follow, common.unfollow, common.react,
 *         common.report
 * Spec gaps / decisions:
 * - NIP-19 codec is self-contained (`common-nip19.ts`): public types only,
 *   `nsec` rejected both ways, inputs longer than 5000 chars rejected,
 *   unknown TLVs ignored. `nrelay` uses the NIP-19 TLV form (type 0 = URL).
 * - `getProfile` works signed out; it resolves hex/npub/nprofile to hex,
 *   reads the latest kind 0 from the shared store, returns normalized
 *   `profile` (snake_case `display_name` -> `displayName`, other keys kept)
 *   and the raw event as `result` with `sidecar.relayHints`.
 * - `follow`/`unfollow` accept `npub` targets only (the NAP's
 *   `CommonPubkeyList`); hex answers `invalid-pubkey`. Both are idempotent:
 *   when nothing changes no new kind 3 is published and the current list's
 *   id/event are returned.
 * - `react` requires the target event to be in the store so the kind 7 can
 *   carry the author `p` and kind `k` tags; unknown ids answer
 *   `invalid-target`. Reactions are `+`, `-`, one emoji grapheme, or one
 *   `:shortcode:`; `customEmojiHref` requires a shortcode and writes the
 *   NIP-30 `emoji` tag.
 * - `report` resolves event authors from the store when `pubkey` is omitted
 *   and answers `author-unresolved` otherwise.
 * - Modifying operations and `follows` answer `not-signed-in` when the shell
 *   user is `''`. All published events are placeholder-signed as the user and
 *   fan out through the shared store.
 */
import type { CommonProfileData, NostrEvent } from '@napplet/core';
import type {
  CommonDecodeNip19Message,
  CommonEncodeNip19Message,
  CommonFollowMessage,
  CommonGetProfileMessage,
  CommonReactMessage,
  CommonReportMessage,
  CommonReportReason,
  CommonUnfollowMessage,
} from '@napplet/nap/common/types';
import { defineMockService, type MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { decodeNip19, encodeNip19, pubkeyFromNpubOrHex } from './common-nip19.js';
import { asRequest, createMockNostrStore, isHex, resolveMockUser, type MockNostrStore } from './nostr-store.js';

/** Spec document the mock was written against. */
export const COMMON_SPEC_REF: NapSpecRef = {
  nap: 'NAP-COMMON',
  status: 'draft',
  source: 'pr',
  pr: 67,
  sha: '8cd0eae85505',
  path: 'naps/NAP-COMMON.md',
};

/**
 * In-memory state of the common mock.
 *
 * @example
 * ```ts
 * const state = createMockCommonService().mock.state();
 * state.published.length === 0;
 * ```
 */
export interface MockCommonState {
  /** Shared event store. */
  store: MockNostrStore;
  /** Current shell-user pubkey, or `''` when signed out. */
  user: string;
  /** Events published by social actions, oldest first. */
  published: NostrEvent[];
}

/**
 * Options for `createMockCommonService`.
 *
 * @example
 * ```ts
 * const common = createMockCommonService({ store, user: 'alice' });
 * ```
 */
export interface MockCommonOptions extends MockServiceOptions {
  /** Shared store; a fresh seeded one is created when omitted. */
  store?: MockNostrStore;
  /** Shell user (fixture name or hex pubkey); `''` starts signed out. Default `alice`. */
  user?: string;
}

/**
 * Common mock with sign-in controls.
 *
 * @example
 * ```ts
 * const common = createMockCommonService();
 * common.signOut(); // modifying actions now answer not-signed-in
 * ```
 */
export type MockCommonService = MockService<MockCommonState> & {
  /** Switch the shell user used as event author. */
  signIn(user: string): void;
  /** Clear the shell user; modifying actions answer `not-signed-in`. */
  signOut(): void;
};

const REPORT_REASONS: readonly CommonReportReason[] = ['nudity', 'malware', 'profanity', 'illegal', 'spam', 'impersonation', 'other'];
const SHORTCODE = /^:([A-Za-z0-9_]+):$/;

type CommonContext = MockRouteContext<MockCommonState>;

/**
 * Normalize kind-0 content into `CommonProfileData` (`display_name` becomes
 * `displayName`; every other key is preserved).
 *
 * @param content - Kind-0 JSON content.
 * @returns Profile data, or `null` when the content is not a JSON object.
 * @example
 * ```ts
 * parseCommonProfile('{"display_name":"Alice","lud16":"alice@pay.example"}')?.displayName === 'Alice';
 * ```
 */
export function parseCommonProfile(content: string): CommonProfileData | null {
  let raw: unknown;
  try { raw = JSON.parse(content); } catch { return null; }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const { display_name: displayName, ...rest } = raw as Record<string, unknown>;
  return { ...rest, ...(typeof displayName === 'string' ? { displayName } : {}) };
}

function resolveProfileTarget(target: unknown): string | null {
  if (isHex(target, 64)) return target;
  if (typeof target !== 'string') return null;
  const decoded = decodeNip19(target);
  if (!decoded.ok) return null;
  if (decoded.nip19Type === 'npub') return decoded.hex ?? null;
  if (decoded.nip19Type === 'nprofile') return decoded.pubkey ?? null;
  return null;
}

function handleGetProfile({ message, state, reply }: CommonContext): void {
  const { target } = asRequest<CommonGetProfileMessage>(message);
  const pubkey = resolveProfileTarget(target);
  if (!pubkey) {
    reply({ ok: false, pubkey: '', error: 'invalid-profile-target' });
    return;
  }
  const event = state.store.latest(0, pubkey);
  if (!event) {
    reply({ ok: true, pubkey, profile: null });
    return;
  }
  reply({ ok: true, pubkey, profile: parseCommonProfile(event.content), result: state.store.toResult(event) });
}

function followList(state: MockCommonState): string[] {
  const list = state.store.latest(3, state.user);
  return list ? list.tags.filter((tag) => tag[0] === 'p' && isHex(tag[1], 64)).map((tag) => tag[1] as string) : [];
}

function decodeNpubs(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string' || !value.toLowerCase().startsWith('npub1')) return null;
    const decoded = decodeNip19(value);
    if (!decoded.ok || !decoded.hex) return null;
    out.push(decoded.hex);
  }
  return out;
}

function publishAs(state: MockCommonState, template: { kind: number; content?: string; tags?: string[][] }): NostrEvent {
  const event = state.store.publish(template, state.user);
  state.published.push(event);
  return event;
}

function currentListResult(state: MockCommonState): Record<string, unknown> {
  const current = state.store.latest(3, state.user);
  return current ? { ok: true, eventId: current.id, event: current } : { ok: true };
}

function handleFollowChange(context: CommonContext, mode: 'follow' | 'unfollow'): void {
  const { message, state, reply } = context;
  if (state.user === '') {
    reply({ ok: false, error: 'not-signed-in' });
    return;
  }
  const targets = decodeNpubs((asRequest<CommonFollowMessage | CommonUnfollowMessage>(message)).pubkeys);
  if (!targets) {
    reply({ ok: false, error: 'invalid-pubkey' });
    return;
  }
  const current = state.store.latest(3, state.user);
  const existing = followList(state);
  const tags = current ? current.tags.map((tag) => [...tag]) : [];
  let changed = false;
  if (mode === 'follow') {
    for (const pubkey of targets) {
      if (existing.includes(pubkey) || tags.some((tag) => tag[0] === 'p' && tag[1] === pubkey)) continue;
      tags.push(['p', pubkey]);
      changed = true;
    }
  } else {
    const kept = tags.filter((tag) => !(tag[0] === 'p' && targets.includes(tag[1] ?? '')));
    changed = kept.length !== tags.length;
    tags.length = 0;
    tags.push(...kept);
  }
  if (!changed) {
    reply(currentListResult(state));
    return;
  }
  const event = publishAs(state, { kind: 3, content: current?.content ?? '', tags });
  reply({ ok: true, eventId: event.id, event });
}

function isSingleEmoji(value: string): boolean {
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)];
  return graphemes.length === 1 && /\p{Extended_Pictographic}/u.test(value);
}

function reactionTags(reaction: string, customEmojiHref: unknown): string[][] | null {
  if (reaction === '+' || reaction === '-') return customEmojiHref === undefined ? [] : null;
  const shortcode = SHORTCODE.exec(reaction)?.[1];
  if (shortcode) {
    if (customEmojiHref === undefined) return [];
    return typeof customEmojiHref === 'string' && customEmojiHref.length > 0 ? [['emoji', shortcode, customEmojiHref]] : null;
  }
  return isSingleEmoji(reaction) && customEmojiHref === undefined ? [] : null;
}

function handleReact({ message, state, reply }: CommonContext): void {
  const { targetEventId, reaction, customEmojiHref } = asRequest<CommonReactMessage>(message);
  if (state.user === '') {
    reply({ ok: false, error: 'not-signed-in' });
    return;
  }
  const target = isHex(targetEventId, 64) ? state.store.get(targetEventId) : undefined;
  if (!target) {
    reply({ ok: false, error: 'invalid-target' });
    return;
  }
  const extraTags = typeof reaction === 'string' && reaction.length > 0 ? reactionTags(reaction, customEmojiHref) : null;
  if (!extraTags) {
    reply({ ok: false, error: 'invalid-reaction' });
    return;
  }
  const hints = state.store.hintsFor(target);
  const tags = [['e', target.id, hints[0] ?? ''], ['p', target.pubkey], ['k', String(target.kind)], ...extraTags];
  const event = publishAs(state, { kind: 7, content: reaction, tags });
  reply({ ok: true, eventId: event.id, event });
}

function reportTags(state: MockCommonState, target: CommonReportMessage['target'], reason: CommonReportReason): string[][] | string {
  if (typeof target !== 'object' || target === null) return 'invalid-target';
  if (target.type === 'pubkey') {
    const pubkey = pubkeyFromNpubOrHex(target.pubkey);
    return pubkey ? [['p', pubkey, reason]] : 'invalid-pubkey';
  }
  if (target.type !== 'event' || !isHex(target.id, 64)) return 'invalid-target';
  const author = isHex(target.pubkey, 64) ? target.pubkey : state.store.get(target.id)?.pubkey;
  if (!author) return 'author-unresolved';
  return [['e', target.id, reason], ['p', author]];
}

function handleReport({ message, state, reply }: CommonContext): void {
  const { target, reason, text } = asRequest<CommonReportMessage>(message);
  if (state.user === '') {
    reply({ ok: false, error: 'not-signed-in' });
    return;
  }
  if (!REPORT_REASONS.includes(reason)) {
    reply({ ok: false, error: 'invalid-report-reason' });
    return;
  }
  const tags = reportTags(state, target, reason);
  if (typeof tags === 'string') {
    reply({ ok: false, error: tags });
    return;
  }
  const event = publishAs(state, { kind: 1984, content: typeof text === 'string' ? text : '', tags });
  reply({ ok: true, eventId: event.id, event });
}

/**
 * Create the NAP-COMMON mock.
 *
 * @param options - Store, shell user, and shared mock options.
 * @returns A common `ServiceHandler` with `mock` controls.
 * @example
 * ```ts
 * const common = createMockCommonService();
 * common.handleMessage('w1', { type: 'common.follows', id: 'f1' }, console.log);
 * ```
 */
export function createMockCommonService(options: MockCommonOptions = {}): MockCommonService {
  const store = options.store ?? createMockNostrStore(options.clock ? { clock: options.clock } : {});
  const ownsStore = options.store === undefined;

  const base = defineMockService<MockCommonState>({
    domain: 'common',
    version: '1.0.0',
    description: 'Mock NAP-COMMON: NIP-19 helpers and social actions over nostr fixtures',
    kind: 'service',
    initialState: () => {
      if (ownsStore) store.reset();
      return { store, user: resolveMockUser(options.user), published: [] };
    },
    routes: {
      'common.encodeNip19': ({ message, reply }) => reply({ ...encodeNip19(asRequest<CommonEncodeNip19Message>(message).input) }),
      'common.decodeNip19': ({ message, reply }) => reply({ ...decodeNip19(asRequest<CommonDecodeNip19Message>(message).value) }),
      'common.getProfile': handleGetProfile,
      'common.follows': ({ state, reply }) => {
        if (state.user === '') reply({ ok: false, pubkeys: [], error: 'not-signed-in' });
        else reply({ ok: true, pubkeys: followList(state) });
      },
      'common.follow': (context) => handleFollowChange(context, 'follow'),
      'common.unfollow': (context) => handleFollowChange(context, 'unfollow'),
      'common.react': handleReact,
      'common.report': handleReport,
    },
  }, options);

  const service: MockCommonService = Object.assign(base, {
    signIn(user: string): void { service.mock.state().user = resolveMockUser(user); },
    signOut(): void { service.mock.state().user = ''; },
  });
  return service;
}

/** Registry row for the common domain. */
export const COMMON_MOCK_ENTRY: MockDomainEntry = {
  domain: 'common',
  kind: 'service',
  spec: COMMON_SPEC_REF,
  create: (options) => createMockCommonService(options),
};
