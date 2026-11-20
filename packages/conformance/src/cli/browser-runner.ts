/**
 * cli/browser-runner.ts — Drive the harness page in headless Chromium.
 *
 * Playwright is an optional peer dependency, loaded only when a run starts.
 */
import type { ConformanceRun, RunOptions } from '../model.js';
import { HARNESS_GLOBAL } from './server.js';

/** The slice of a Playwright page the runner uses. */
interface PageLike {
  goto(url: string): Promise<unknown>;
  waitForFunction(script: string, arg: unknown, options: { timeout: number }): Promise<unknown>;
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  on(event: 'pageerror', listener: (error: Error) => void): void;
}

/** The slice of a Playwright browser type the runner uses. */
export interface ChromiumLike {
  launch(options?: { headless?: boolean; executablePath?: string }): Promise<{ newPage(): Promise<PageLike>; close(): Promise<void> }>;
}

/** Thrown when Playwright or its Chromium is missing. */
export class BrowserUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BrowserUnavailableError';
  }
}

/**
 * Load Chromium from the optional `@playwright/test` peer.
 *
 * @returns Playwright's `chromium` browser type.
 * @throws {BrowserUnavailableError} When the peer is not installed.
 */
export async function loadChromium(): Promise<ChromiumLike> {
  try {
    const specifier = '@playwright/test';
    const module = (await import(specifier)) as { chromium?: ChromiumLike };
    if (!module.chromium) throw new Error('@playwright/test has no chromium export');
    return module.chromium;
  } catch (error) {
    throw new BrowserUnavailableError(
      'kehto conformance needs @playwright/test and its Chromium: pnpm add -D @playwright/test && npx playwright install chromium',
      { cause: error },
    );
  }
}

/**
 * Run the catalog inside the harness page.
 *
 * @param chromium - Browser type to launch.
 * @param url - Harness page URL.
 * @param options - Run options passed through to the engine.
 * @returns The run.
 */
export async function runInBrowser(chromium: ChromiumLike, url: string, options: RunOptions): Promise<ConformanceRun> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  let browser;
  try { browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) }); }
  catch (error) { throw new BrowserUnavailableError(`Chromium failed to launch: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => { pageErrors.push(error.message); });
    await page.goto(url);
    await page.waitForFunction(`Boolean(window.${HARNESS_GLOBAL})`, undefined, { timeout: 15_000 }).catch(() => {
      throw new Error(`The harness bundle did not load${pageErrors.length ? `: ${pageErrors.join('; ')}` : ''}`);
    });
    return await page.evaluate(
      async ({ global, run }) => {
        const api = (window as unknown as Record<string, { runKehtoConformance(options: RunOptions): Promise<ConformanceRun> }>)[global];
        return api!.runKehtoConformance(run);
      },
      { global: HARNESS_GLOBAL, run: options },
    );
  } finally {
    await browser.close();
  }
}
