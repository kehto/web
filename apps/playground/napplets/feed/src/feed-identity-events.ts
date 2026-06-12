export type FeedIdentityReader = () => Promise<string>;
export type FeedIdentitySubscription = { close(): void };
export type FeedIdentitySubscriber = (handler: (pubkey: string) => void) => FeedIdentitySubscription;

export interface FeedIdentityEventControllerOptions {
  readPublicKey: FeedIdentityReader;
  subscribeToChanges?: FeedIdentitySubscriber | null;
  onPubkey(pubkey: string): void;
  onLoggedOut(): void;
  onError(error: unknown): void;
}

export interface FeedIdentityEventController {
  start(): Promise<void>;
  refreshNow(): Promise<void>;
  stop(): void;
}

export function createFeedIdentityEventController(
  options: FeedIdentityEventControllerOptions,
): FeedIdentityEventController {
  let stopped = true;
  let inFlight = false;
  let currentPubkey: string | null = null;
  let loggedOutNotified = false;
  let changeSubscription: FeedIdentitySubscription | null = null;

  function applyPubkey(pubkey: string): void {
    if (stopped) return;

    if (!pubkey) {
      currentPubkey = null;
      if (!loggedOutNotified) {
        loggedOutNotified = true;
        options.onLoggedOut();
      }
      return;
    }

    loggedOutNotified = false;
    if (pubkey !== currentPubkey) {
      currentPubkey = pubkey;
      options.onPubkey(pubkey);
    }
  }

  async function refreshNow(): Promise<void> {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      applyPubkey(await options.readPublicKey());
    } catch (error) {
      if (!stopped) options.onError(error);
    } finally {
      inFlight = false;
    }
  }

  function start(): Promise<void> {
    if (!stopped) return Promise.resolve();
    stopped = false;
    changeSubscription = options.subscribeToChanges?.(applyPubkey) ?? null;
    return refreshNow();
  }

  function stop(): void {
    stopped = true;
    changeSubscription?.close();
    changeSubscription = null;
  }

  return { start, refreshNow, stop };
}
