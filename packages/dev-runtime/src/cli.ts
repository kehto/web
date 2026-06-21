#!/usr/bin/env node
import { spawn } from 'node:child_process';
import {
  createDevRuntimeHostConfig,
  formatDevRuntimeUrl,
  normalizeDevRuntimeOptions,
  waitForTargetUrl,
  type DevRuntimeCommand,
  type DevRuntimeRawOptions,
  DevRuntimeOptionsError,
} from './index.js';
import { resolveDevRuntimeRawOptions } from './config-file.js';
import { startDevRuntimeServer } from './server.js';
import {
  DEV_RUNTIME_SIMULATION_DOMAINS,
  summarizeDevRuntimeSimulation,
  type DevRuntimeCapabilityDomain,
  type DevRuntimeSimulationRawOptions,
  type JsonValue,
} from './simulation.js';

/**
 * Minimal output streams used by the CLI runner.
 *
 * @remarks
 * Tests and embedders can pass custom streams to capture output without
 * patching global `process.stdout` or `process.stderr`.
 */
export interface CliIo {
  readonly stdout: { write(chunk: string): void };
  readonly stderr: { write(chunk: string): void };
}

/**
 * Parsed CLI arguments before full option normalization.
 */
export interface CliParseResult {
  readonly options?: DevRuntimeRawOptions;
  readonly help: boolean;
}

/**
 * Execution controls for embedding the CLI runner in tests or wrappers.
 */
export interface RunDevRuntimeCliOptions {
  readonly serve?: boolean;
}

/**
 * Parse raw `kehto-dev-runtime` arguments into raw runtime options.
 *
 * @param args - Argument vector without the node executable or script path.
 * @returns Parsed raw options, or a help flag when `--help` is present.
 */
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

    if (applyCoreOption(arg, args, index, raw) || applySimulationOption(arg, args, index, raw)) {
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

    const rawOptions = resolveDevRuntimeRawOptions(parsed.options ?? {});
    const options = normalizeDevRuntimeOptions(rawOptions);
    const hostConfig = createDevRuntimeHostConfig(options);
    const shouldServe = runOptions.serve ?? true;
    const child = shouldServe && options.command ? startManagedCommand(options.command) : undefined;
    let server: Awaited<ReturnType<typeof startDevRuntimeServer>> | undefined;
    if (shouldServe) {
      try {
        if (options.command) {
          await waitForTargetUrl(options.targetUrl, { timeoutMs: options.readyTimeoutMs });
        }
        server = await startDevRuntimeServer({ options: rawOptions });
      } catch (error) {
        child?.kill();
        throw error;
      }
    }
    const runtimeUrl = server?.url ?? formatDevRuntimeUrl(options);

    io.stdout.write(`Kehto dev runtime\n`);
    io.stdout.write(`Runtime URL: ${runtimeUrl}\n`);
    io.stdout.write(`Target URL: ${hostConfig.target.url}\n`);
    io.stdout.write(`Mode: ${options.mode}\n`);
    io.stdout.write(`HMR: ${hostConfig.target.hmrStrategy}\n`);
    io.stdout.write(`Simulation: ${summarizeDevRuntimeSimulation(options.simulation)}\n`);

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
  --config <path>             JSON config file using the same option schema.
  --identity-mode <mode>      anonymous or fixed.
  --identity-pubkey <hex>     Required when identity mode is fixed.
  --relay-mode <mode>         memory or disabled.
  --relay-url <url>           Add a relay URL for memory relay simulation.
  --storage-mode <mode>       local, memory, or disabled.
  --cache-mode <mode>         memory or disabled.
  --upload-mode <mode>        memory or disabled.
  --upload-rail <name>        Upload rail name for memory uploads.
  --media <state>             enabled or disabled.
  --notifications <state>     enabled or disabled.
  --notify-grant <bool>       true or false default notification grant.
  --theme <mode>              dark or light.
  --config-value <key=json>   Add a JSON config value.
  --capability <domain:on|off> Toggle an advertised capability domain.
  --acl-mode <mode>           allow or deny.
  --firewall-mode <mode>      allow, deny, or observe.
  --help, -h                  Show this help.`;

function readValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new DevRuntimeOptionsError(`${option} requires a value.`);
  }
  return value;
}

function applyCoreOption(
  arg: string,
  args: readonly string[],
  index: number,
  raw: MutableDevRuntimeRawOptions,
): boolean {
  switch (arg) {
    case '--target-url':
    case '-u':
      raw.targetUrl = readValue(args, index, arg);
      return true;
    case '--command':
    case '-c':
      raw.command = { mode: 'shell', command: readValue(args, index, arg) };
      return true;
    case '--host':
      raw.host = readValue(args, index, arg);
      return true;
    case '--port':
      raw.port = readValue(args, index, arg);
      return true;
    case '--ready-timeout':
      raw.readyTimeoutMs = readValue(args, index, arg);
      return true;
    case '--config':
      raw.configPath = readValue(args, index, arg);
      return true;
    default:
      return false;
  }
}

function applySimulationOption(
  arg: string,
  args: readonly string[],
  index: number,
  raw: MutableDevRuntimeRawOptions,
): boolean {
  switch (arg) {
    case '--identity-mode':
      setIdentity(raw, { mode: readEnum(args, index, arg, ['anonymous', 'fixed']) });
      return true;
    case '--identity-pubkey':
      setIdentity(raw, { pubkey: readValue(args, index, arg) });
      return true;
    case '--relay-mode':
      setRelay(raw, { mode: readEnum(args, index, arg, ['memory', 'disabled']) });
      return true;
    case '--relay-url':
      setRelay(raw, { urls: [...(raw.simulation?.relay?.urls ?? []), readValue(args, index, arg)] });
      return true;
    case '--storage-mode':
      ensureSimulation(raw).storage = { ...raw.simulation?.storage, mode: readEnum(args, index, arg, ['local', 'memory', 'disabled']) };
      return true;
    case '--cache-mode':
      ensureSimulation(raw).cache = { ...raw.simulation?.cache, mode: readEnum(args, index, arg, ['memory', 'disabled']) };
      return true;
    case '--upload-mode':
      setUpload(raw, { mode: readEnum(args, index, arg, ['memory', 'disabled']) });
      return true;
    case '--upload-rail':
      setUpload(raw, { rail: readValue(args, index, arg) });
      return true;
    case '--media':
      ensureSimulation(raw).media = { ...raw.simulation?.media, enabled: readEnabled(args, index, arg) };
      return true;
    case '--notifications':
      setNotifications(raw, { enabled: readEnabled(args, index, arg) });
      return true;
    case '--notify-grant':
      setNotifications(raw, { grant: readBoolean(args, index, arg) });
      return true;
    case '--theme':
      ensureSimulation(raw).theme = { ...raw.simulation?.theme, mode: readEnum(args, index, arg, ['dark', 'light']) };
      return true;
    case '--config-value':
      setConfigValue(raw, readConfigValue(args, index, arg));
      return true;
    case '--capability':
      setCapability(raw, readCapability(args, index, arg));
      return true;
    case '--acl-mode':
      ensureSimulation(raw).acl = { ...raw.simulation?.acl, mode: readEnum(args, index, arg, ['allow', 'deny']) };
      return true;
    case '--firewall-mode':
      ensureSimulation(raw).firewall = { ...raw.simulation?.firewall, mode: readEnum(args, index, arg, ['allow', 'deny', 'observe']) };
      return true;
    default:
      return false;
  }
}

function formatCommand(command: DevRuntimeCommand): string {
  return command.mode === 'argv' ? command.argv.join(' ') : command.command;
}

function readEnum<const T extends readonly string[]>(
  args: readonly string[],
  index: number,
  option: string,
  allowed: T,
): T[number] {
  const value = readValue(args, index, option);
  if (!allowed.includes(value)) {
    throw new DevRuntimeOptionsError(`${option} must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}

function readEnabled(args: readonly string[], index: number, option: string): boolean {
  const value = readValue(args, index, option);
  if (value === 'enabled') return true;
  if (value === 'disabled') return false;
  throw new DevRuntimeOptionsError(`${option} must be "enabled" or "disabled".`);
}

function readBoolean(args: readonly string[], index: number, option: string): boolean {
  const value = readValue(args, index, option);
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new DevRuntimeOptionsError(`${option} must be "true" or "false".`);
}

function readConfigValue(
  args: readonly string[],
  index: number,
  option: string,
): { key: string; value: JsonValue } {
  const raw = readValue(args, index, option);
  const separator = raw.indexOf('=');
  if (separator <= 0) {
    throw new DevRuntimeOptionsError(`${option} expects key=json.`);
  }
  const key = raw.slice(0, separator).trim();
  if (!key) {
    throw new DevRuntimeOptionsError(`${option} expects a non-empty key.`);
  }
  try {
    return { key, value: JSON.parse(raw.slice(separator + 1)) as JsonValue };
  } catch {
    throw new DevRuntimeOptionsError(`${option} value for "${key}" must be valid JSON.`);
  }
}

function readCapability(
  args: readonly string[],
  index: number,
  option: string,
): { domain: DevRuntimeCapabilityDomain; enabled: boolean } {
  const raw = readValue(args, index, option);
  const [domainRaw, stateRaw] = raw.split(':') as [string | undefined, string | undefined];
  if (!domainRaw || (stateRaw !== 'on' && stateRaw !== 'off')) {
    throw new DevRuntimeOptionsError(`${option} expects domain:on or domain:off.`);
  }
  if (!DEV_RUNTIME_SIMULATION_DOMAINS.includes(domainRaw as DevRuntimeCapabilityDomain)) {
    throw new DevRuntimeOptionsError(`${option} unknown domain "${domainRaw}".`);
  }
  return {
    domain: domainRaw as DevRuntimeCapabilityDomain,
    enabled: stateRaw === 'on',
  };
}

function setIdentity(raw: MutableDevRuntimeRawOptions, identity: NonNullable<DevRuntimeSimulationRawOptions['identity']>): void {
  ensureSimulation(raw).identity = { ...raw.simulation?.identity, ...identity };
}

function setRelay(raw: MutableDevRuntimeRawOptions, relay: NonNullable<DevRuntimeSimulationRawOptions['relay']>): void {
  ensureSimulation(raw).relay = { ...raw.simulation?.relay, ...relay };
}

function setUpload(raw: MutableDevRuntimeRawOptions, upload: NonNullable<DevRuntimeSimulationRawOptions['upload']>): void {
  ensureSimulation(raw).upload = { ...raw.simulation?.upload, ...upload };
}

function setNotifications(
  raw: MutableDevRuntimeRawOptions,
  notifications: NonNullable<DevRuntimeSimulationRawOptions['notifications']>,
): void {
  ensureSimulation(raw).notifications = { ...raw.simulation?.notifications, ...notifications };
}

function setConfigValue(
  raw: MutableDevRuntimeRawOptions,
  entry: { key: string; value: JsonValue },
): void {
  ensureSimulation(raw).config = {
    ...raw.simulation?.config,
    values: {
      ...raw.simulation?.config?.values,
      [entry.key]: entry.value,
    },
  };
}

function setCapability(
  raw: MutableDevRuntimeRawOptions,
  entry: { domain: DevRuntimeCapabilityDomain; enabled: boolean },
): void {
  ensureSimulation(raw).capabilities = {
    ...raw.simulation?.capabilities,
    domains: {
      ...raw.simulation?.capabilities?.domains,
      [entry.domain]: entry.enabled,
    },
  };
}

function ensureSimulation(raw: MutableDevRuntimeRawOptions): MutableDevRuntimeSimulationRawOptions {
  raw.simulation ??= {};
  return raw.simulation as MutableDevRuntimeSimulationRawOptions;
}

function startManagedCommand(command: DevRuntimeCommand): ManagedChildProcess {
  if (command.mode === 'shell') {
    return spawn(command.command, { shell: true, stdio: 'inherit' });
  }

  const [executable, ...args] = command.argv;
  if (!executable) {
    throw new DevRuntimeOptionsError('Argv command mode requires an executable.');
  }
  return spawn(executable, args, { stdio: 'inherit' });
}

type MutableDevRuntimeRawOptions = {
  -readonly [K in keyof DevRuntimeRawOptions]: DevRuntimeRawOptions[K];
};

type MutableDevRuntimeSimulationRawOptions = {
  -readonly [K in keyof DevRuntimeSimulationRawOptions]: DevRuntimeSimulationRawOptions[K];
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
