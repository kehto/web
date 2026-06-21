export interface WaitForTargetUrlOptions {
  readonly timeoutMs: number;
  readonly intervalMs?: number;
  readonly fetch?: ReadinessFetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

export type ReadinessFetch = (url: string) => Promise<{ readonly status: number }>;

export class ReadinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadinessError';
  }
}

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
