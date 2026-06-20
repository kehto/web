#!/usr/bin/env node
import { spawn } from 'node:child_process';
import {
  createDevRuntimeHostConfig,
  formatDevRuntimeUrl,
  normalizeDevRuntimeOptions,
  type DevRuntimeCommand,
  type DevRuntimeRawOptions,
  DevRuntimeOptionsError,
} from './index.js';
import { startDevRuntimeServer } from './server.js';

interface CliIo {
  readonly stdout: { write(chunk: string): void };
  readonly stderr: { write(chunk: string): void };
}

interface CliParseResult {
  readonly options?: DevRuntimeRawOptions;
  readonly help: boolean;
}

export interface RunDevRuntimeCliOptions {
  readonly serve?: boolean;
}

export function parseDevRuntimeArgs(args: readonly string[]): CliParseResult {
  const raw: MutableDevRuntimeRawOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') {
      const argv = args.slice(index + 1);
      raw.command = { mode: 'argv', argv };
      break;
    }

    if (arg === '--help' || arg === '-h') {
      return { help: true };
    }

    if (arg === '--target-url' || arg === '-u') {
      raw.targetUrl = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--command' || arg === '-c') {
      raw.command = { mode: 'shell', command: readValue(args, index, arg) };
      index += 1;
      continue;
    }

    if (arg === '--host') {
      raw.host = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--port') {
      raw.port = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--ready-timeout') {
      raw.readyTimeoutMs = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--config') {
      raw.configPath = readValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new DevRuntimeOptionsError(`Unknown option "${arg}". Run kehto-dev-runtime --help for usage.`);
  }

  return { help: false, options: raw };
}

export async function runDevRuntimeCli(
  args: readonly string[] = process.argv.slice(2),
  io: CliIo = defaultIo,
  runOptions: RunDevRuntimeCliOptions = {},
): Promise<number> {
  try {
    const parsed = parseDevRuntimeArgs(args);
    if (parsed.help) {
      io.stdout.write(`${HELP_TEXT}\n`);
      return 0;
    }

    const options = normalizeDevRuntimeOptions(parsed.options ?? {});
    const hostConfig = createDevRuntimeHostConfig(options);
    const shouldServe = runOptions.serve ?? true;
    const child = shouldServe && options.command ? startManagedCommand(options.command) : undefined;
    const server = shouldServe
      ? await startDevRuntimeServer({ options: parsed.options ?? {} }).catch((error: unknown) => {
        child?.kill();
        throw error;
      })
      : undefined;
    const runtimeUrl = server?.url ?? formatDevRuntimeUrl(options);

    io.stdout.write(`Kehto dev runtime\n`);
    io.stdout.write(`Runtime URL: ${runtimeUrl}\n`);
    io.stdout.write(`Target URL: ${hostConfig.target.url}\n`);
    io.stdout.write(`Mode: ${options.mode}\n`);
    io.stdout.write(`HMR: ${hostConfig.target.hmrStrategy}\n`);

    if (options.command) {
      io.stdout.write(`Command: ${formatCommand(options.command)}\n`);
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`kehto-dev-runtime: ${message}\n`);
    return 1;
  }
}

const HELP_TEXT = `Usage:
  kehto-dev-runtime --target-url <url> [options]
  kehto-dev-runtime --target-url <url> [options] -- <command...>

Options:
  --target-url, -u <url>      App dev-server URL to load in the runtime iframe.
  --command, -c <command>     Shell command to start before waiting for target URL.
  -- <command...>             Argv command form; preserves arbitrary framework commands.
  --host <host>               Runtime host. Default: 127.0.0.1.
  --port <port>               Runtime port. Default: 5197.
  --ready-timeout <ms>        Target readiness timeout. Default: 30000.
  --config <path>             Runtime simulation config file. Expanded in Phase 93.
  --help, -h                  Show this help.`;

function readValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new DevRuntimeOptionsError(`${option} requires a value.`);
  }
  return value;
}

function formatCommand(command: DevRuntimeCommand): string {
  return command.mode === 'argv' ? command.argv.join(' ') : command.command;
}

function startManagedCommand(command: DevRuntimeCommand): ManagedChildProcess {
  if (command.mode === 'shell') {
    return spawn(command.command, { shell: true, stdio: 'inherit' });
  }

  const [executable, ...args] = command.argv;
  return spawn(executable, args, { stdio: 'inherit' });
}

type MutableDevRuntimeRawOptions = {
  -readonly [K in keyof DevRuntimeRawOptions]: DevRuntimeRawOptions[K];
};

const defaultIo: CliIo = {
  stdout: { write: (chunk) => process.stdout.write(chunk) },
  stderr: { write: (chunk) => process.stderr.write(chunk) },
};

if (isDirectCli()) {
  void runDevRuntimeCli().then((code) => {
    process.exitCode = code;
  });
}

function isDirectCli(): boolean {
  return typeof process !== 'undefined' && process.argv[1]?.endsWith('/cli.js') === true;
}

declare const process: {
  argv: string[];
  exitCode?: number;
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
};

interface ManagedChildProcess {
  kill(): void;
}
