import { relaySubscribe } from '@napplet/nub/relay/sdk';

export const THEME_DEFINITION_KIND = 36767;
export const ACTIVE_THEME_KIND = 16767;

const CONTACT_LIST_KIND = 3;
const DEFAULT_DISCOVERY_TIMEOUT_MS = 3_000;
const MAX_TRUSTED_AUTHORS = 80;
const MAX_EVENTS_PER_SCOPE = 50;

export type ThemeSource = 'user' | 'wot' | 'global';

export interface ThemePayload {
  title?: string;
  colors: {
    background: string;
    text: string;
    primary: string;
  };
}

export interface DiscoveredTheme {
  id: string;
  source: ThemeSource;
  title: string;
  author: string;
  createdAt: number;
  eventKind: typeof ACTIVE_THEME_KIND | typeof THEME_DEFINITION_KIND;
  theme: ThemePayload;
}

export interface ThemeDiscoveryResult {
  pubkey: string | null;
  follows: string[];
  themes: DiscoveredTheme[];
  counts: Record<ThemeSource, number>;
  messages: string[];
  errors: string[];
}

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface NostrFilter {
  kinds?: number[];
  authors?: string[];
  limit?: number;
  since?: number;
  until?: number;
  relayCache?: 'skip';
  [key: string]: unknown;
}

export type ThemeRelaySubscribe = (
  filters: NostrFilter | NostrFilter[],
  onEvent: (event: NostrEvent) => void,
  onEose: () => void,
) => { close(): void };

export interface DiscoverThemeCatalogOptions {
  readPublicKey: () => Promise<string>;
  subscribe?: ThemeRelaySubscribe;
  timeoutMs?: number;
}

interface EventGroup {
  source: ThemeSource;
  events: NostrEvent[];
}

export async function discoverThemeCatalog(
  options: DiscoverThemeCatalogOptions,
): Promise<ThemeDiscoveryResult> {
  const subscribe = options.subscribe ?? relaySubscribe as ThemeRelaySubscribe;
  const timeoutMs = options.timeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS;
  const messages: string[] = [];
  const errors: string[] = [];

  const globalEventsPromise = requestEventsFromRelay(
    subscribe,
    [{ kinds: [THEME_DEFINITION_KIND], limit: MAX_EVENTS_PER_SCOPE, relayCache: 'skip' }],
    timeoutMs,
  ).catch((error: unknown) => {
    errors.push(`global discovery failed: ${formatError(error, 'relay read failed')}`);
    return [];
  });

  const pubkey = await readIdentityPubkey(options.readPublicKey, errors);
  let follows: string[] = [];
  let userEvents: NostrEvent[] = [];
  let wotEvents: NostrEvent[] = [];

  if (pubkey) {
    const [nextUserEvents, contactEvents] = await Promise.all([
      requestEventsFromRelay(
        subscribe,
        [{ kinds: [ACTIVE_THEME_KIND, THEME_DEFINITION_KIND], authors: [pubkey], limit: 25, relayCache: 'skip' }],
        timeoutMs,
      ).catch((error: unknown) => {
        errors.push(`user discovery failed: ${formatError(error, 'relay read failed')}`);
        return [];
      }),
      requestEventsFromRelay(
        subscribe,
        [{ kinds: [CONTACT_LIST_KIND], authors: [pubkey], limit: 1, relayCache: 'skip' }],
        timeoutMs,
      ).catch((error: unknown) => {
        errors.push(`WoT contacts failed: ${formatError(error, 'relay read failed')}`);
        return [];
      }),
    ]);

    userEvents = nextUserEvents;
    follows = parseContactPubkeys(newestEvent(contactEvents)).slice(0, MAX_TRUSTED_AUTHORS);
    if (follows.length > 0) {
      wotEvents = await requestEventsFromRelay(
        subscribe,
        [{ kinds: [ACTIVE_THEME_KIND, THEME_DEFINITION_KIND], authors: follows, limit: MAX_EVENTS_PER_SCOPE, relayCache: 'skip' }],
        timeoutMs,
      ).catch((error: unknown) => {
        errors.push(`WoT theme discovery failed: ${formatError(error, 'relay read failed')}`);
        return [];
      });
    } else {
      messages.push('No follow list found for WoT theme discovery.');
    }
  } else {
    messages.push('Not logged in; user and WoT themes skipped.');
  }

  const globalEvents = await globalEventsPromise;
  const themes = mergeThemeEvents([
    { source: 'global', events: globalEvents },
    { source: 'wot', events: wotEvents },
    { source: 'user', events: userEvents },
  ]);

  return {
    pubkey,
    follows,
    themes,
    counts: countThemes(themes),
    messages,
    errors,
  };
}

export function parseContactPubkeys(event: NostrEvent | null): string[] {
  if (!event) return [];
  const pubkeys = new Set<string>();
  for (const tag of event.tags) {
    if (tag[0] === 'p' && isHexPubkey(tag[1])) pubkeys.add(tag[1].toLowerCase());
  }
  return [...pubkeys];
}

export function parseThemeEvent(event: NostrEvent, source: ThemeSource): DiscoveredTheme | null {
  if (event.kind !== ACTIVE_THEME_KIND && event.kind !== THEME_DEFINITION_KIND) return null;
  if (event.content.trim().length > 0) return null;

  const title = getThemeTitle(event) ?? (event.kind === ACTIVE_THEME_KIND ? 'Active Profile Theme' : null);
  if (!title) return null;

  const colors = parseColorTags(event.tags);
  if (!colors) return null;

  const id = getThemeId(event);
  if (!id) return null;

  return {
    id,
    source,
    title,
    author: event.pubkey,
    createdAt: event.created_at,
    eventKind: event.kind,
    theme: {
      title,
      colors,
    },
  };
}

export function requestEventsFromRelay(
  subscribe: ThemeRelaySubscribe,
  filters: NostrFilter | NostrFilter[],
  timeoutMs = DEFAULT_DISCOVERY_TIMEOUT_MS,
): Promise<NostrEvent[]> {
  return new Promise<NostrEvent[]>((resolve, reject) => {
    const events: NostrEvent[] = [];
    let done = false;
    let subscription: { close(): void } | null = null;
    let closeAfterSubscribe = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (subscription) {
        subscription.close();
      } else {
        closeAfterSubscribe = true;
      }
      resolve(events);
    };

    const timer = setTimeout(finish, timeoutMs);

    try {
      subscription = subscribe(filters, (event) => {
        events.push(event);
      }, finish);
      if (closeAfterSubscribe) subscription.close();
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

function mergeThemeEvents(groups: EventGroup[]): DiscoveredTheme[] {
  const byId = new Map<string, DiscoveredTheme>();

  for (const group of groups) {
    for (const event of group.events) {
      const parsed = parseThemeEvent(event, group.source);
      if (!parsed) continue;

      const existing = byId.get(parsed.id);
      if (existing && sourcePriority(existing.source) > sourcePriority(parsed.source)) continue;
      if (existing && existing.source === parsed.source && existing.createdAt > parsed.createdAt) continue;

      byId.set(parsed.id, parsed);
    }
  }

  return [...byId.values()].sort((a, b) => {
    const priority = sourcePriority(b.source) - sourcePriority(a.source);
    if (priority !== 0) return priority;
    return b.createdAt - a.createdAt || a.title.localeCompare(b.title);
  });
}

function countThemes(themes: DiscoveredTheme[]): Record<ThemeSource, number> {
  return themes.reduce<Record<ThemeSource, number>>((counts, theme) => {
    counts[theme.source] += 1;
    return counts;
  }, { user: 0, wot: 0, global: 0 });
}

function sourcePriority(source: ThemeSource): number {
  if (source === 'user') return 3;
  if (source === 'wot') return 2;
  return 1;
}

async function readIdentityPubkey(
  readPublicKey: () => Promise<string>,
  errors: string[],
): Promise<string | null> {
  try {
    const pubkey = await readPublicKey();
    return normalizePubkey(pubkey);
  } catch (error) {
    errors.push(`identity discovery failed: ${formatError(error, 'identity read failed')}`);
    return null;
  }
}

function newestEvent(events: NostrEvent[]): NostrEvent | null {
  return events.reduce<NostrEvent | null>((latest, event) => {
    if (!latest || event.created_at > latest.created_at) return event;
    return latest;
  }, null);
}

function getThemeId(event: NostrEvent): string | null {
  if (event.kind === ACTIVE_THEME_KIND) return `user:${ACTIVE_THEME_KIND}:${event.pubkey}`;

  const identifier = getTagValue(event, 'd')?.trim();
  if (!identifier || identifier.length > 128) return null;
  return `relay:${THEME_DEFINITION_KIND}:${event.pubkey}:${identifier}`;
}

function getThemeTitle(event: NostrEvent): string | null {
  const title = getTagValue(event, 'title')?.trim();
  if (!title || title.length > 120) return null;
  return title;
}

function getTagValue(event: NostrEvent, name: string): string | undefined {
  return event.tags.find((tag) => tag[0] === name)?.[1];
}

function parseColorTags(tags: string[][]): ThemePayload['colors'] | null {
  const colors = new Map<keyof ThemePayload['colors'], string>();
  for (const tag of tags) {
    if (tag[0] !== 'c') continue;
    const value = tag[1];
    const role = tag[2];
    if (!isColorRole(role) || !isHexColor(value)) return null;
    if (colors.has(role)) return null;
    colors.set(role, value.toLowerCase());
  }

  const background = colors.get('background');
  const text = colors.get('text');
  const primary = colors.get('primary');
  if (!background || !text || !primary) return null;

  return { background, text, primary };
}

function isColorRole(value: string | undefined): value is keyof ThemePayload['colors'] {
  return value === 'background' || value === 'text' || value === 'primary';
}

function isHexColor(value: string | undefined): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizePubkey(pubkey: string | null | undefined): string | null {
  if (typeof pubkey !== 'string') return null;
  const normalized = pubkey.toLowerCase();
  return isHexPubkey(normalized) ? normalized : null;
}

function isHexPubkey(value: string | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return fallback;
}
