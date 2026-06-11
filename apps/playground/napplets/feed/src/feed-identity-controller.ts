export type FeedIdentityReader = () => Promise<string>;
export type FeedIdentitySchedule<TimerHandle> = (
  callback: () => Promise<void>,
  delayMs: number,
) => TimerHandle;
export type FeedIdentityCancel<TimerHandle> = (handle: TimerHandle) => void;

export interface FeedIdentityControllerOptions<TimerHandle = ReturnType<typeof setTimeout>> {
  readPublicKey: FeedIdentityReader;
  onPubkey(pubkey: string): void;
  onLoggedOut(): void;
  onError(error: unknown): void;
  loggedOutRetryDelayMs?: number;
  connectedRefreshDelayMs?: number;
  schedule?: FeedIdentitySchedule<TimerHandle>;
  cancel?: FeedIdentityCancel<TimerHandle>;
}

export interface FeedIdentityController {
  start(): Promise<void>;
  refreshNow(): Promise<void>;
  stop(): void;
}

const DEFAULT_LOGGED_OUT_RETRY_DELAY_MS = 1_000;
const DEFAULT_CONNECTED_REFRESH_DELAY_MS = 5_000;

function defaultSchedule(callback: () => Promise<void>, delayMs: number): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    void callback();
  }, delayMs);
}

function defaultCancel(handle: ReturnType<typeof setTimeout>): void {
  clearTimeout(handle);
}

export function createFeedIdentityController<TimerHandle = ReturnType<typeof setTimeout>>(
  options: FeedIdentityControllerOptions<TimerHandle>,
): FeedIdentityController {
  const loggedOutRetryDelayMs = options.loggedOutRetryDelayMs ?? DEFAULT_LOGGED_OUT_RETRY_DELAY_MS;
  const connectedRefreshDelayMs = options.connectedRefreshDelayMs ?? DEFAULT_CONNECTED_REFRESH_DELAY_MS;
  const schedule = options.schedule ?? (defaultSchedule as FeedIdentitySchedule<TimerHandle>);
  const cancel = options.cancel ?? (defaultCancel as FeedIdentityCancel<TimerHandle>);

  let stopped = true;
  let inFlight = false;
  let timer: TimerHandle | null = null;
  let currentPubkey: string | null = null;
  let loggedOutNotified = false;

  function clearTimer(): void {
    if (timer === null) return;
    cancel(timer);
    timer = null;
  }

  function scheduleRefresh(delayMs: number): void {
    if (stopped || timer !== null) return;
    timer = schedule(async () => {
      timer = null;
      await refreshNow();
    }, delayMs);
  }

  async function refreshNow(): Promise<void> {
    if (stopped || inFlight) return;
    clearTimer();
    inFlight = true;

    try {
      const pubkey = await options.readPublicKey();
      if (stopped) return;

      if (!pubkey) {
        currentPubkey = null;
        if (!loggedOutNotified) {
          loggedOutNotified = true;
          options.onLoggedOut();
        }
        scheduleRefresh(loggedOutRetryDelayMs);
        return;
      }

      loggedOutNotified = false;
      if (pubkey !== currentPubkey) {
        currentPubkey = pubkey;
        options.onPubkey(pubkey);
      }
      scheduleRefresh(connectedRefreshDelayMs);
    } catch (error) {
      if (!stopped) options.onError(error);
    } finally {
      inFlight = false;
    }
  }

  function start(): Promise<void> {
    if (!stopped) return Promise.resolve();
    stopped = false;
    return refreshNow();
  }

  function stop(): void {
    stopped = true;
    clearTimer();
  }

  return { start, refreshNow, stop };
}
