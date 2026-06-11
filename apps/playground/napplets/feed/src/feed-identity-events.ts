export type FeedIdentityReader = () => Promise<string>;

type FeedIdentityEventTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export interface FeedIdentityEventControllerOptions {
  readPublicKey: FeedIdentityReader;
  onPubkey(pubkey: string): void;
  onLoggedOut(): void;
  onError(error: unknown): void;
  eventTarget?: FeedIdentityEventTarget | null;
  acceptMessage?: (event: MessageEvent) => boolean;
}

export interface FeedIdentityEventController {
  start(): Promise<void>;
  refreshNow(): Promise<void>;
  stop(): void;
}

function getDefaultEventTarget(): FeedIdentityEventTarget | null {
  return typeof window === 'undefined' ? null : window;
}

function acceptParentMessage(event: MessageEvent): boolean {
  return typeof window === 'undefined' ? true : event.source === window.parent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function readIdentityChangedPubkey(data: unknown): string | null {
  if (!isRecord(data)) return null;
  if (data.type !== 'identity.changed') return null;
  return typeof data.pubkey === 'string' ? data.pubkey : null;
}

export function createFeedIdentityEventController(
  options: FeedIdentityEventControllerOptions,
): FeedIdentityEventController {
  const eventTarget = options.eventTarget ?? getDefaultEventTarget();
  const acceptMessage = options.acceptMessage ?? acceptParentMessage;

  let stopped = true;
  let inFlight = false;
  let currentPubkey: string | null = null;
  let loggedOutNotified = false;

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

  function handleMessage(event: MessageEvent): void {
    if (!acceptMessage(event)) return;
    const pubkey = readIdentityChangedPubkey(event.data);
    if (pubkey === null) return;
    applyPubkey(pubkey);
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
    eventTarget?.addEventListener('message', handleMessage as EventListener);
    return refreshNow();
  }

  function stop(): void {
    stopped = true;
    eventTarget?.removeEventListener('message', handleMessage as EventListener);
  }

  return { start, refreshNow, stop };
}
