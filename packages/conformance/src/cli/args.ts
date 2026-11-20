/**
 * cli/args.ts — Parse `kehto conformance` arguments.
 */
import type { ConformanceProfile } from '../model.js';
import type { ReporterName } from '../reporters/index.js';

/** Parsed headless options. */
export interface ConformanceCliOptions {
  readonly profile: ConformanceProfile;
  readonly domains: readonly string[];
  readonly reporter: ReporterName;
  readonly out?: string;
  readonly readyTimeoutMs?: number;
  readonly settleMs?: number;
  /** Serve the live web UI instead of running headless. */
  readonly ui: boolean;
  /** Command to run alongside the UI, e.g. a watch build. */
  readonly exec?: string;
  /** Port for the UI (or headless harness) server. */
  readonly port?: number;
  /** Open the UI in a browser. */
  readonly open: boolean;
}

/** A usage error; the CLI exits with code 2. */
export class ConformanceUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConformanceUsageError';
  }
}

const PROFILES: readonly ConformanceProfile[] = ['minimal', 'full'];
const REPORTER_NAMES: readonly ReporterName[] = ['pretty', 'json', 'junit'];

function positive(flag: string, raw: string | undefined, unit = 'milliseconds'): number {
  const parsed = Number(raw);
  if (raw === undefined || !Number.isInteger(parsed) || parsed <= 0 || (unit !== 'milliseconds' && parsed > 65535)) {
    throw new ConformanceUsageError(`${flag} needs a positive integer (${unit})`);
  }
  return parsed;
}

function valueOf(args: readonly string[], index: number, flag: string): string {
  const next = args[index + 1];
  if (next === undefined || next.startsWith('--')) throw new ConformanceUsageError(`${flag} needs a value`);
  return next;
}

/**
 * Parse arguments.
 *
 * @param args - Arguments after `conformance`.
 * @returns `{ help: true }` or the parsed options.
 * @throws {ConformanceUsageError} On an unknown option or bad value.
 * @example
 * ```ts
 * parseConformanceArgs(['--profile', 'minimal', '--reporter', 'junit']);
 * ```
 */
export function parseConformanceArgs(args: readonly string[]): { readonly help: true } | { readonly help: false; readonly options: ConformanceCliOptions } {
  let profile: ConformanceProfile = 'full';
  let reporter: ReporterName = 'pretty';
  const domains: string[] = [];
  let out: string | undefined;
  let readyTimeoutMs: number | undefined;
  let settleMs: number | undefined;
  let exec: string | undefined;
  let port: number | undefined;
  let ui = false;
  let open = true;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index] as string;
    if (flag === '--help' || flag === '-h') return { help: true };
    if (flag === '--ui') { ui = true; continue; }
    if (flag === '--no-open') { open = false; continue; }
    const takes = ['--profile', '--domain', '--reporter', '--out', '--ready-timeout', '--settle', '--exec', '--port'];
    if (!takes.includes(flag)) throw new ConformanceUsageError(`Unknown option "${flag}". Run kehto conformance --help for usage.`);
    const raw = valueOf(args, index, flag);
    index += 1;
    if (flag === '--profile') {
      if (!PROFILES.includes(raw as ConformanceProfile)) throw new ConformanceUsageError(`--profile must be one of ${PROFILES.join(', ')}`);
      profile = raw as ConformanceProfile;
    } else if (flag === '--reporter') {
      if (!REPORTER_NAMES.includes(raw as ReporterName)) throw new ConformanceUsageError(`--reporter must be one of ${REPORTER_NAMES.join(', ')}`);
      reporter = raw as ReporterName;
    } else if (flag === '--domain') domains.push(raw);
    else if (flag === '--out') out = raw;
    else if (flag === '--exec') exec = raw;
    else if (flag === '--port') port = positive(flag, raw, 'a port number');
    else if (flag === '--ready-timeout') readyTimeoutMs = positive(flag, raw);
    else settleMs = positive(flag, raw);
  }
  if (!ui && (exec !== undefined || !open)) throw new ConformanceUsageError('--exec and --no-open need --ui');
  if (ui && out) throw new ConformanceUsageError('--out writes a headless report; it cannot be combined with --ui');
  return {
    help: false,
    options: {
      profile, domains, reporter,
      ...(out ? { out } : {}),
      ...(readyTimeoutMs ? { readyTimeoutMs } : {}),
      ...(settleMs ? { settleMs } : {}),
      ui, open,
      ...(exec ? { exec } : {}),
      ...(port ? { port } : {}),
    },
  };
}

/** `kehto conformance --help` text. */
export const CONFORMANCE_HELP = `Usage:
  kehto conformance [options]

Runs the @kehto/conformance catalog against a real Kehto runtime and shell in
headless Chromium (needs the optional @playwright/test peer and its Chromium).

Options:
  --profile <minimal|full>      Profile to run. Default: full.
  --domain <name>               Restrict domain cases to a domain. Repeatable.
                                NIP-5D core and NAP-SHELL checks always run.
  --reporter <pretty|json|junit> Output format. Default: pretty.
  --out <file>                  Write the report to a file instead of stdout.
  --ready-timeout <ms>          Longest a probe step waits for a reply. Default: 2000.
  --settle <ms>                 Quiet window used to prove nothing was sent. Default: 120.
  --ui                          Serve the live web UI instead of running headless.
  --exec <command>              With --ui: run a command alongside (e.g. "pnpm build --watch");
                                each rebuild of the served bundle triggers one debounced re-run.
  --port <number>               Port for the UI or harness server. Default: a free port.
  --no-open                     With --ui: print the URL instead of opening a browser.
  --help, -h                    Show this help.

Exit codes:
  0  every applicable check passed (spec gaps are printed and counted); --ui exits 0 on Ctrl-C
  1  one or more error-severity checks failed
  2  usage, target boot or harness error`;
