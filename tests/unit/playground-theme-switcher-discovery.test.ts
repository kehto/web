import { describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_THEME_KIND,
  THEME_DEFINITION_KIND,
  discoverThemeCatalog,
  parseContactPubkeys,
  parseThemeEvent,
  type NostrEvent,
  type NostrFilter,
  type ThemeRelaySubscribe,
} from '../../apps/playground/napplets/theme-switcher/src/theme-discovery.js';

const USER = 'a'.repeat(64);
const FOLLOW = 'b'.repeat(64);
const GLOBAL_AUTHOR = 'c'.repeat(64);

interface RecordedCall {
  filters: NostrFilter | NostrFilter[];
  close: ReturnType<typeof vi.fn>;
}

function firstFilter(filters: NostrFilter | NostrFilter[]): NostrFilter {
  return Array.isArray(filters) ? filters[0]! : filters;
}

function makeEvent(overrides: Partial<NostrEvent>): NostrEvent {
  return {
    id: overrides.id ?? 'e'.repeat(64),
    pubkey: overrides.pubkey ?? USER,
    created_at: overrides.created_at ?? 100,
    kind: overrides.kind ?? THEME_DEFINITION_KIND,
    tags: overrides.tags ?? [
      ['d', 'theme'],
      ['title', 'Theme'],
      ['c', '#101820', 'background'],
      ['c', '#f4f7fb', 'text'],
      ['c', '#4fb477', 'primary'],
    ],
    content: overrides.content ?? '',
    sig: overrides.sig ?? '0'.repeat(128),
  };
}

function makeTheme(pubkey: string, title: string, identifier: string, createdAt: number): NostrEvent {
  return makeEvent({
    id: `${identifier.slice(0, 1)}${pubkey.slice(0, 8)}`.padEnd(64, '0'),
    pubkey,
    created_at: createdAt,
    kind: THEME_DEFINITION_KIND,
    tags: [
      ['d', identifier],
      ['title', title],
      ['c', '#101820', 'background'],
      ['c', '#f4f7fb', 'text'],
      ['c', '#4fb477', 'primary'],
    ],
  });
}

function makeActiveTheme(pubkey: string): NostrEvent {
  return makeEvent({
    id: `${pubkey.slice(0, 8)}active`.padEnd(64, '0'),
    pubkey,
    created_at: 200,
    kind: ACTIVE_THEME_KIND,
    tags: [
      ['title', 'Active Theme'],
      ['c', '#202832', 'background'],
      ['c', '#f0f4f8', 'text'],
      ['c', '#a0c878', 'primary'],
    ],
  });
}

function makeContacts(pubkey: string, follows: string[]): NostrEvent {
  return makeEvent({
    id: `${pubkey.slice(0, 8)}contacts`.padEnd(64, '0'),
    pubkey,
    kind: 3,
    tags: follows.map((follow) => ['p', follow]),
  });
}

function createSubscribe(calls: RecordedCall[]): ThemeRelaySubscribe {
  return (filters, onEvent, onEose) => {
    const close = vi.fn();
    calls.push({ filters, close });
    const filter = firstFilter(filters);
    const kinds = filter.kinds ?? [];
    const authors = filter.authors ?? [];

    if (kinds.includes(THEME_DEFINITION_KIND) && authors.length === 0) {
      onEvent(makeTheme(GLOBAL_AUTHOR, 'Global Relay Theme', 'global', 300));
    } else if (kinds.includes(ACTIVE_THEME_KIND) && authors.includes(USER)) {
      onEvent(makeActiveTheme(USER));
    } else if (kinds.includes(3) && authors.includes(USER)) {
      onEvent(makeContacts(USER, [FOLLOW, FOLLOW, 'not-a-pubkey']));
    } else if (kinds.includes(ACTIVE_THEME_KIND) && authors.includes(FOLLOW)) {
      onEvent(makeTheme(FOLLOW, 'Follow Theme', 'follow', 250));
    }

    onEose();
    return { close };
  };
}

describe('playground theme switcher discovery', () => {
  it('discovers user, WoT, and global themes through relay subscriptions', async () => {
    const calls: RecordedCall[] = [];
    const result = await discoverThemeCatalog({
      readPublicKey: async () => USER,
      subscribe: createSubscribe(calls),
      timeoutMs: 10,
    });

    expect(result.pubkey).toBe(USER);
    expect(result.follows).toEqual([FOLLOW]);
    expect(result.counts).toEqual({ user: 1, wot: 1, global: 1 });
    expect(result.themes.map((theme) => `${theme.source}:${theme.title}`)).toEqual([
      'user:Active Theme',
      'wot:Follow Theme',
      'global:Global Relay Theme',
    ]);

    expect(calls.map((call) => firstFilter(call.filters))).toEqual([
      { kinds: [THEME_DEFINITION_KIND], limit: 50, relayCache: 'skip' },
      { kinds: [ACTIVE_THEME_KIND, THEME_DEFINITION_KIND], authors: [USER], limit: 25, relayCache: 'skip' },
      { kinds: [3], authors: [USER], limit: 1, relayCache: 'skip' },
      { kinds: [ACTIVE_THEME_KIND, THEME_DEFINITION_KIND], authors: [FOLLOW], limit: 50, relayCache: 'skip' },
    ]);
    expect(calls.every((call) => call.close.mock.calls.length === 1)).toBe(true);
  });

  it('still discovers global themes when identity is unavailable', async () => {
    const calls: RecordedCall[] = [];
    const result = await discoverThemeCatalog({
      readPublicKey: async () => '',
      subscribe: createSubscribe(calls),
      timeoutMs: 10,
    });

    expect(result.pubkey).toBeNull();
    expect(result.counts).toEqual({ user: 0, wot: 0, global: 1 });
    expect(result.messages).toContain('Not logged in; user and WoT themes skipped.');
    expect(calls.map((call) => firstFilter(call.filters))).toEqual([
      { kinds: [THEME_DEFINITION_KIND], limit: 50, relayCache: 'skip' },
    ]);
  });

  it('parses Hyprgate-compatible theme events and rejects invalid payloads', () => {
    const parsed = parseThemeEvent(makeTheme(USER, 'Valid Theme', 'valid', 10), 'user');
    expect(parsed?.id).toBe(`relay:${THEME_DEFINITION_KIND}:${USER}:valid`);
    expect(parsed?.theme.colors.primary).toBe('#4fb477');

    expect(parseThemeEvent(makeEvent({ tags: [['title', 'Missing d']] }), 'global')).toBeNull();
    expect(parseThemeEvent(makeEvent({ content: 'not empty' }), 'global')).toBeNull();
    expect(parseThemeEvent(makeEvent({
      tags: [
        ['d', 'bad-color'],
        ['title', 'Bad Color'],
        ['c', 'red', 'background'],
        ['c', '#f4f7fb', 'text'],
        ['c', '#4fb477', 'primary'],
      ],
    }), 'global')).toBeNull();
  });

  it('extracts unique hex follows from contact lists', () => {
    expect(parseContactPubkeys(makeContacts(USER, [FOLLOW, FOLLOW, 'bad']))).toEqual([FOLLOW]);
  });
});
