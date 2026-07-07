#!/usr/bin/env node
/**
 * Top-level Kehto command router.
 *
 * @module
 */
import {
  runPajaCli,
  type CliIo,
  type RunPajaCliOptions,
} from '@kehto/paja/cli';

/** Execution controls for the top-level Kehto CLI router. */
export interface RunKehtoCliOptions {
  /** Options forwarded to the `kehto paja` subcommand. */
  readonly paja?: RunPajaCliOptions;
}

/**
 * Run the top-level Kehto CLI command router.
 *
 * @param args - Argument vector without the node executable or script path.
 * @param io - Output streams used by the command.
 * @param options - Execution controls for embedded test runners.
 * @returns Process exit code.
 *
 * @example
 * ```ts
 * await runKehtoCli(['paja', '--target-url', 'http://127.0.0.1:5173']);
 * ```
 */
export async function runKehtoCli(
  args: readonly string[] = process.argv.slice(2),
  io: CliIo = defaultIo,
  options: RunKehtoCliOptions = {},
): Promise<number> {
  const [command, ...rest] = args;

  if (!command || command === '--help' || command === '-h') {
    io.stdout.write(`${HELP_TEXT}\n`);
    return 0;
  }

  if (command === 'paja') {
    return runPajaCli(rest, io, options.paja);
  }

  io.stderr.write(`kehto: unknown command "${command}". Run kehto --help for usage.\n`);
  return 1;
}

const HELP_TEXT = `Usage:
  kehto <command> [options]

Commands:
  paja    Run a napplet app inside the Paja local authoring workshop.

Examples:
  kehto paja --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1
  kehto paja --config kehto.dev.json

Options:
  --help, -h    Show this help.`;

const defaultIo: CliIo = {
  stdout: { write: (chunk) => process.stdout.write(chunk) },
  stderr: { write: (chunk) => process.stderr.write(chunk) },
};

if (isDirectCli()) {
  void runKehtoCli().then((code) => {
    process.exitCode = code;
  });
}

/**
 * Detect whether the module is being executed as the CLI entrypoint.
 *
 * @param entryPath - Process entry path to inspect.
 * @returns `true` when the path looks like the built Kehto CLI entry.
 */
export function isDirectCli(entryPath = process.argv[1]): boolean {
  if (!entryPath) return false;
  return entryPath.endsWith('/index.js') || entryPath.endsWith('/kehto');
}

declare const process: {
  argv: string[];
  exitCode?: number;
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
};
