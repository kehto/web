/**
 * cli.ts — The headless Node runner behind `kehto conformance`.
 *
 * Serves the self-contained browser bundle on loopback, opens it in headless
 * Chromium through the optional `@playwright/test` peer, runs the catalog
 * against the first-party Kehto target, and renders the result.
 *
 * @module
 */
import { writeFileSync } from 'node:fs';
import { ConformanceUsageError, CONFORMANCE_HELP, parseConformanceArgs, type ConformanceCliOptions } from './cli/args.js';
import { BrowserUnavailableError, loadChromium, runInBrowser, type ChromiumLike } from './cli/browser-runner.js';
import { startHarnessServer } from './cli/server.js';
import type { ConformanceRun, RunOptions } from './model.js';
import { formatReport } from './reporters/index.js';

export { parseConformanceArgs, ConformanceUsageError, CONFORMANCE_HELP } from './cli/args.js';
export type { ConformanceCliOptions } from './cli/args.js';
export { BrowserUnavailableError } from './cli/browser-runner.js';
export type { ChromiumLike, PageLike } from './cli/browser-runner.js';
export { startHarnessServer } from './cli/server.js';
export type { HarnessServer } from './cli/server.js';

/** Output streams. */
export interface ConformanceCliIo {
  readonly stdout: { write(chunk: string): void };
  readonly stderr: { write(chunk: string): void };
}

/** Embedding controls for wrappers and tests. */
export interface RunConformanceCliOptions {
  /** Replace the browser run, e.g. with a canned result. */
  readonly execute?: (options: RunOptions) => Promise<ConformanceRun>;
  /** Browser type to launch instead of the `@playwright/test` peer. */
  readonly chromium?: ChromiumLike;
  /** Bundle to serve. Default: `dist/browser/conformance.js` next to this module. */
  readonly bundle?: URL;
}

const defaultIo: ConformanceCliIo = {
  stdout: { write: (chunk) => process.stdout.write(chunk) },
  stderr: { write: (chunk) => process.stderr.write(chunk) },
};

async function executeHeadless(options: RunOptions, embed: RunConformanceCliOptions): Promise<ConformanceRun> {
  const chromium = embed.chromium ?? await loadChromium();
  const server = await startHarnessServer(embed.bundle ?? new URL('./browser/conformance.js', import.meta.url));
  try { return await runInBrowser(chromium, server.url, options); }
  finally { await server.close(); }
}

function toRunOptions(options: ConformanceCliOptions): RunOptions {
  return {
    profile: options.profile,
    domains: options.domains,
    ...(options.readyTimeoutMs ? { readyTimeoutMs: options.readyTimeoutMs } : {}),
    ...(options.settleMs ? { settleMs: options.settleMs } : {}),
  };
}

/**
 * Run `kehto conformance`.
 *
 * @param args - Arguments after `conformance`.
 * @param io - Output streams.
 * @param embed - Embedding controls.
 * @returns `0` all applicable checks passed, `1` an error-severity check failed, `2` usage or harness error.
 * @example
 * ```ts
 * process.exitCode = await runConformanceCli(['--profile', 'minimal']);
 * ```
 */
export async function runConformanceCli(
  args: readonly string[], io: ConformanceCliIo = defaultIo, embed: RunConformanceCliOptions = {},
): Promise<number> {
  let parsed;
  try { parsed = parseConformanceArgs(args); }
  catch (error) {
    if (!(error instanceof ConformanceUsageError)) throw error;
    io.stderr.write(`kehto conformance: ${error.message}\n`);
    return 2;
  }
  if (parsed.help) {
    io.stdout.write(`${CONFORMANCE_HELP}\n`);
    return 0;
  }
  const { options } = parsed;
  let run: ConformanceRun;
  try { run = await (embed.execute ?? ((runOptions) => executeHeadless(runOptions, embed)))(toRunOptions(options)); }
  catch (error) {
    const prefix = error instanceof BrowserUnavailableError ? 'browser unavailable' : 'harness error';
    io.stderr.write(`kehto conformance: ${prefix}: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
  const report = formatReport(run, options.reporter);
  if (options.out) {
    writeFileSync(options.out, report, 'utf8');
    io.stdout.write(`${run.statement}\nWrote ${options.reporter} report to ${options.out}\n`);
  } else {
    io.stdout.write(report);
  }
  return run.ok ? 0 : 1;
}
