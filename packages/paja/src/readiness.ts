/** Options for polling a target URL until it is ready. */
export interface WaitForTargetUrlOptions {
  /** Total wait budget in milliseconds. */
  readonly timeoutMs: number;
  /** Poll interval in milliseconds. Defaults to 250. */
  readonly intervalMs?: number;
  /** Fetch implementation override for tests. */
  readonly fetch?: ReadinessFetch;
  /** Sleep implementation override for tests. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Clock override for tests. */
  readonly now?: () => number;
}

/** Fetch-like target readiness probe. */
export type ReadinessFetch = (url: string) => Promise<{ readonly status: number }>;

/** Thrown when a target URL does not become ready before the timeout. */
export class ReadinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadinessError';
  }
}

/**
 * Poll a target URL until it returns a non-5xx response or times out.
 *
 * @param url - Target URL to poll.
 * @param options - Timeout and polling controls.
 */
export async function waitForTargetUrl(url: string, options: WaitForTargetUrlOptions): Promise<void> {
  const intervalMs = options.intervalMs ?? 250;
  const fetcher = options.fetch ?? defaultFetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const deadline = now() + options.timeoutMs;
  let lastError = 'no response';

  while (now() <= deadline) {
    try {
      const response = await fetcher(url);
      if (response.status < 500) {
        return;
      }
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(intervalMs);
  }

  throw new ReadinessError(`Timed out waiting ${options.timeoutMs}ms for target URL ${url}: ${lastError}`);
}

async function defaultFetch(url: string): Promise<{ readonly status: number }> {
  return fetch(url, { method: 'GET', redirect: 'follow' });
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
