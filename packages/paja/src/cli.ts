#!/usr/bin/env node
import { spawn } from 'node:child_process';
import {
  createPajaHostConfig,
  formatPajaUrl,
  normalizePajaOptions,
  waitForTargetUrl,
  type PajaCommand,
  type PajaRawOptions,
  PajaOptionsError,
} from './index.js';
import { resolvePajaRawOptions } from './config-file.js';
import { startPajaServer } from './server.js';
import {
  PAJA_SIMULATION_DOMAINS,
  summarizePajaSimulation,
  type PajaCapabilityDomain,
  type PajaSimulationRawOptions,
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
  readonly options?: PajaRawOptions;
  readonly help: boolean;
}

/**
 * Execution controls for embedding the CLI runner in tests or wrappers.
 */
export interface RunPajaCliOptions {
  readonly serve?: boolean;
}

/**
 * Parse raw `kehto paja` arguments into raw runtime options.
 *
 * @param args - Argument vector without the node executable or script path.
 * @returns Parsed raw options, or a help flag when `--help` is present.
 */
export function parsePajaArgs(args: readonly string[]): CliParseResult {
  const raw: MutablePajaRawOptions = {};

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

    throw new PajaOptionsError(`Unknown option "${arg}". Run kehto paja --help for usage.`);
  }

  return { help: false, options: raw };
}

export async function runPajaCli(
  args: readonly string[] = process.argv.slice(2),
  io: CliIo = defaultIo,
  runOptions: RunPajaCliOptions = {},
): Promise<number> {
  try {
    const parsed = parsePajaArgs(args);
    if (parsed.help) {
      io.stdout.write(`${HELP_TEXT}\n`);
      return 0;
    }

    const rawOptions = resolvePajaRawOptions(parsed.options ?? {});
    const options = normalizePajaOptions(rawOptions);
    const hostConfig = createPajaHostConfig(options);
    const shouldServe = runOptions.serve ?? true;
    let child: ManagedChildProcess | undefined;
    let server: Awaited<ReturnType<typeof startPajaServer>> | undefined;
    if (shouldServe) {
      try {
        server = await startPajaServer({ options: rawOptions });
        writeRuntimeSummary(io, server.url, hostConfig, options);

        if (options.command) {
          child = startManagedCommand(options.command);
          await waitForTargetUrl(options.targetUrl, { timeoutMs: options.readyTimeoutMs });
        }
      } catch (error) {
        child?.kill();
        await server?.close().catch(() => undefined);
        throw error;
      }
    }
    const runtimeUrl = server?.url ?? formatPajaUrl(options);

    if (!shouldServe) {
      writeRuntimeSummary(io, runtimeUrl, hostConfig, options);
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`kehto paja: ${message}\n`);
    return 1;
  }
}

function writeRuntimeSummary(
  io: CliIo,
  runtimeUrl: string,
  hostConfig: ReturnType<typeof createPajaHostConfig>,
  options: ReturnType<typeof normalizePajaOptions>,
): void {
    io.stdout.write(`Kehto Paja\n`);
    io.stdout.write(`Runtime URL: ${runtimeUrl}\n`);
    io.stdout.write(`Target URL: ${hostConfig.target.url}\n`);
    io.stdout.write(`Mode: ${options.mode}\n`);
    io.stdout.write(`HMR: ${hostConfig.target.hmrStrategy}\n`);
    io.stdout.write(`Simulation: ${summarizePajaSimulation(options.simulation)}\n`);

    if (options.command) {
      io.stdout.write(`Command: ${formatCommand(options.command)}\n`);
    }
}

const HELP_TEXT = `Usage:
  kehto paja --target-url <url> [options]
  kehto paja --target-url <url> [options] -- <command...>

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
    throw new PajaOptionsError(`${option} requires a value.`);
  }
  return value;
}

function applyCoreOption(
  arg: string,
  args: readonly string[],
  index: number,
  raw: MutablePajaRawOptions,
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
  raw: MutablePajaRawOptions,
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

function formatCommand(command: PajaCommand): string {
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
    throw new PajaOptionsError(`${option} must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}

function readEnabled(args: readonly string[], index: number, option: string): boolean {
  const value = readValue(args, index, option);
  if (value === 'enabled') return true;
  if (value === 'disabled') return false;
  throw new PajaOptionsError(`${option} must be "enabled" or "disabled".`);
}

function readBoolean(args: readonly string[], index: number, option: string): boolean {
  const value = readValue(args, index, option);
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new PajaOptionsError(`${option} must be "true" or "false".`);
}

function readConfigValue(
  args: readonly string[],
  index: number,
  option: string,
): { key: string; value: JsonValue } {
  const raw = readValue(args, index, option);
  const separator = raw.indexOf('=');
  if (separator <= 0) {
    throw new PajaOptionsError(`${option} expects key=json.`);
  }
  const key = raw.slice(0, separator).trim();
  if (!key) {
    throw new PajaOptionsError(`${option} expects a non-empty key.`);
  }
  try {
    return { key, value: JSON.parse(raw.slice(separator + 1)) as JsonValue };
  } catch {
    throw new PajaOptionsError(`${option} value for "${key}" must be valid JSON.`);
  }
}

function readCapability(
  args: readonly string[],
  index: number,
  option: string,
): { domain: PajaCapabilityDomain; enabled: boolean } {
  const raw = readValue(args, index, option);
  const [domainRaw, stateRaw] = raw.split(':') as [string | undefined, string | undefined];
  if (!domainRaw || (stateRaw !== 'on' && stateRaw !== 'off')) {
    throw new PajaOptionsError(`${option} expects domain:on or domain:off.`);
  }
  if (!PAJA_SIMULATION_DOMAINS.includes(domainRaw as PajaCapabilityDomain)) {
    throw new PajaOptionsError(`${option} unknown domain "${domainRaw}".`);
  }
  return {
    domain: domainRaw as PajaCapabilityDomain,
    enabled: stateRaw === 'on',
  };
}

function setIdentity(raw: MutablePajaRawOptions, identity: NonNullable<PajaSimulationRawOptions['identity']>): void {
  ensureSimulation(raw).identity = { ...raw.simulation?.identity, ...identity };
}

function setRelay(raw: MutablePajaRawOptions, relay: NonNullable<PajaSimulationRawOptions['relay']>): void {
  ensureSimulation(raw).relay = { ...raw.simulation?.relay, ...relay };
}

function setUpload(raw: MutablePajaRawOptions, upload: NonNullable<PajaSimulationRawOptions['upload']>): void {
  ensureSimulation(raw).upload = { ...raw.simulation?.upload, ...upload };
}

function setNotifications(
  raw: MutablePajaRawOptions,
  notifications: NonNullable<PajaSimulationRawOptions['notifications']>,
): void {
  ensureSimulation(raw).notifications = { ...raw.simulation?.notifications, ...notifications };
}

function setConfigValue(
  raw: MutablePajaRawOptions,
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
  raw: MutablePajaRawOptions,
  entry: { domain: PajaCapabilityDomain; enabled: boolean },
): void {
  ensureSimulation(raw).capabilities = {
    ...raw.simulation?.capabilities,
    domains: {
      ...raw.simulation?.capabilities?.domains,
      [entry.domain]: entry.enabled,
    },
  };
}

function ensureSimulation(raw: MutablePajaRawOptions): MutablePajaSimulationRawOptions {
  raw.simulation ??= {};
  return raw.simulation as MutablePajaSimulationRawOptions;
}

function startManagedCommand(command: PajaCommand): ManagedChildProcess {
  if (command.mode === 'shell') {
    return spawn(command.command, { shell: true, stdio: 'inherit' });
  }

  const [executable, ...args] = command.argv;
  if (!executable) {
    throw new PajaOptionsError('Argv command mode requires an executable.');
  }
  return spawn(executable, args, { stdio: 'inherit' });
}

type MutablePajaRawOptions = {
  -readonly [K in keyof PajaRawOptions]: PajaRawOptions[K];
};

type MutablePajaSimulationRawOptions = {
  -readonly [K in keyof PajaSimulationRawOptions]: PajaSimulationRawOptions[K];
};

const defaultIo: CliIo = {
  stdout: { write: (chunk) => process.stdout.write(chunk) },
  stderr: { write: (chunk) => process.stderr.write(chunk) },
};

if (isDirectPajaCli()) {
  void runPajaCli().then((code) => {
    process.exitCode = code;
  });
}

export function isDirectPajaCli(entryPath = process.argv[1]): boolean {
  if (!entryPath) return false;
  return entryPath.endsWith('/cli.js') || entryPath.endsWith('/paja');
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
