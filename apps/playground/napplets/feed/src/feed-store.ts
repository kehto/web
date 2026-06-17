import type { NostrEvent, NostrFilter, Subscription } from '@napplet/core';
import { relaySubscribe } from '@napplet/nap/relay/sdk';

type FeedRelaySubscribe = (
  filters: NostrFilter | NostrFilter[],
  onEvent: (event: NostrEvent) => void,
  onEose: () => void,
) => Subscription;

export interface FeedProfile {
  name?: string;
  display_name?: string;
  picture?: string;
}

export interface FeedState {
  pubkey: string | null;
  contactCount: number;
  profiles: Map<string, FeedProfile>;
  timeline: NostrEvent[];
  loading: boolean;
  loaded: boolean;
  eventCount: number;
  error: string | null;
}

export interface FeedStore {
  state: FeedState;
  init(pubkey: string): void;
  clear(): void;
  destroy(): void;
}

export function createFeedStore(
  onUpdate: () => void = () => {},
  subscribe: FeedRelaySubscribe = relaySubscribe,
): FeedStore {
  const state: FeedState = {
    pubkey: null,
    contactCount: 0,
    profiles: new Map(),
    timeline: [],
    loading: false,
    loaded: false,
    eventCount: 0,
    error: null,
  };
  const seenIds = new Set<string>();
  let contactSub: Subscription | null = null;
  let timelineSub: Subscription | null = null;
  let liveSub: Subscription | null = null;
  const profileSubs = new Set<Subscription>();
  const loadingProfilePubkeys = new Set<string>();
  const profileCreatedAt = new Map<string, number>();

  function notify(): void {
    onUpdate();
  }

  function closeSubscriptions(): void {
    contactSub?.close();
    timelineSub?.close();
    liveSub?.close();
    for (const sub of profileSubs) sub.close();
    contactSub = null;
    timelineSub = null;
    liveSub = null;
    profileSubs.clear();
  }

  function closeTimelineSubscriptions(): void {
    timelineSub?.close();
    liveSub?.close();
    timelineSub = null;
    liveSub = null;
  }

  function reset(pubkey: string): void {
    closeSubscriptions();
    seenIds.clear();
    loadingProfilePubkeys.clear();
    profileCreatedAt.clear();
    state.pubkey = pubkey;
    state.contactCount = 0;
    state.profiles.clear();
    state.timeline = [];
    state.loading = true;
    state.loaded = false;
    state.eventCount = 0;
    state.error = null;
    notify();
  }

  function clear(): void {
    closeSubscriptions();
    seenIds.clear();
    loadingProfilePubkeys.clear();
    profileCreatedAt.clear();
    state.pubkey = null;
    state.contactCount = 0;
    state.profiles.clear();
    state.timeline = [];
    state.loading = false;
    state.loaded = false;
    state.eventCount = 0;
    state.error = null;
    notify();
  }

  function insertEvent(event: NostrEvent): void {
    let low = 0;
    let high = state.timeline.length;

    while (low < high) {
      const mid = (low + high) >> 1;
      const candidate = state.timeline[mid];
      if (candidate && candidate.created_at > event.created_at) low = mid + 1;
      else high = mid;
    }

    state.timeline.splice(low, 0, event);
  }

  function addEvent(event: NostrEvent): void {
    if (seenIds.has(event.id)) return;
    seenIds.add(event.id);
    insertEvent(event);
    state.eventCount = state.timeline.length;
    subscribeToProfile(event.pubkey);
    notify();
  }

  function createTimelineFilter(pubkeys: string[]): NostrFilter {
    return { kinds: [1], authors: pubkeys };
  }

  function startTimelineSubscription(filter: NostrFilter): void {
    timelineSub = subscribe(
      [{ ...filter, limit: 50 }],
      addEvent,
      () => {
        state.loading = false;
        state.loaded = true;
        notify();
      },
    );
  }

  function startLiveSubscription(filter: NostrFilter): void {
    liveSub = subscribe(
      [{ ...filter, since: Math.floor(Date.now() / 1000) }],
      addEvent,
      () => {},
    );
  }

  function extractContactPubkeys(event: NostrEvent): string[] {
    const pubkeys = new Set<string>();
    for (const tag of event.tags) {
      if (tag[0] === 'p' && typeof tag[1] === 'string' && tag[1].length > 0) {
        pubkeys.add(tag[1]);
      }
    }
    return [...pubkeys];
  }

  function optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  function parseProfileEvent(event: NostrEvent): FeedProfile | null {
    if (event.kind !== 0) return null;

    try {
      const metadata = JSON.parse(event.content) as Record<string, unknown>;
      return {
        name: optionalString(metadata.name),
        display_name: optionalString(metadata.display_name),
        picture: optionalString(metadata.picture),
      };
    } catch {
      return null;
    }
  }

  function subscribeToProfile(pubkey: string): void {
    if (pubkey.length === 0 || state.profiles.has(pubkey) || loadingProfilePubkeys.has(pubkey)) return;

    loadingProfilePubkeys.add(pubkey);
    let sub: Subscription | null = null;
    let closeAfterSubscribe = false;
    const finish = () => {
      loadingProfilePubkeys.delete(pubkey);
      if (sub) {
        profileSubs.delete(sub);
        sub.close();
      } else {
        closeAfterSubscribe = true;
      }
    };

    sub = subscribe(
      [{ kinds: [0], authors: [pubkey], limit: 1 }],
      (event) => {
        if (event.kind !== 0 || event.pubkey !== pubkey) return;
        const latestCreatedAt = profileCreatedAt.get(pubkey);
        if (latestCreatedAt !== undefined && latestCreatedAt > event.created_at) return;

        const profile = parseProfileEvent(event);
        if (!profile) return;

        profileCreatedAt.set(pubkey, event.created_at);
        state.profiles.set(pubkey, profile);
        notify();
      },
      finish,
    );

    if (closeAfterSubscribe) {
      sub.close();
    } else {
      profileSubs.add(sub);
    }
  }

  function startFollowingFeed(pubkeys: string[]): void {
    closeTimelineSubscriptions();
    state.contactCount = pubkeys.length;
    state.loading = true;
    state.loaded = false;
    notify();

    if (pubkeys.length === 0) {
      state.loading = false;
      state.loaded = true;
      notify();
      return;
    }

    const filter = createTimelineFilter(pubkeys);
    startTimelineSubscription(filter);
    startLiveSubscription(filter);
  }

  function init(pubkey: string): void {
    reset(pubkey);
    const kind3Events: NostrEvent[] = [];
    contactSub = subscribe(
      [{ kinds: [3], authors: [pubkey] }],
      (event) => {
        if (event.kind === 3) kind3Events.push(event);
      },
      () => {
        const latestKind3 = kind3Events.sort((a, b) => b.created_at - a.created_at)[0];
        startFollowingFeed(latestKind3 ? extractContactPubkeys(latestKind3) : []);
      },
    );
  }

  function destroy(): void {
    closeSubscriptions();
  }

  return { state, init, clear, destroy };
}
