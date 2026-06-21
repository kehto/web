import {
  normalizeDevRuntimeSimulation,
  type DevRuntimeSimulation,
  type DevRuntimeSimulationRawOptions,
} from './simulation.js';

export type DevRuntimeCommand =
  | { readonly mode: 'argv'; readonly argv: readonly string[] }
  | { readonly mode: 'shell'; readonly command: string };

export interface DevRuntimeRawOptions {
  readonly targetUrl?: string;
  readonly command?: DevRuntimeCommand;
  readonly host?: string;
  readonly port?: number | string;
  readonly readyTimeoutMs?: number | string;
  readonly configPath?: string;
  readonly simulation?: DevRuntimeSimulationRawOptions;
}

export interface DevRuntimeOptions {
  readonly targetUrl: string;
  readonly command?: DevRuntimeCommand;
  readonly host: string;
  readonly port: number;
  readonly readyTimeoutMs: number;
  readonly configPath?: string;
  readonly simulation: DevRuntimeSimulation;
  readonly mode: 'external-target' | 'managed-command';
}

export interface DevRuntimeHostConfig {
  readonly version: 1;
  readonly window: {
    readonly id: string;
    readonly dTag: string;
    readonly aggregateHash: string;
  };
  readonly target: {
    readonly url: string;
    readonly hmrStrategy: 'iframe-target-url';
    readonly command?: DevRuntimeCommand;
  };
  readonly runtime: {
    readonly host: string;
    readonly port: number;
    readonly readyTimeoutMs: number;
    readonly configPath?: string;
    readonly reloadToken: string;
    readonly createdAt: string;
  };
  readonly chrome: {
    readonly topBar: true;
    readonly bottomBar: true;
    readonly sidePanels: false;
  };
  readonly simulation: DevRuntimeSimulation;
}

export class DevRuntimeOptionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DevRuntimeOptionsError';
  }
}

export const DEFAULT_DEV_RUNTIME_HOST = '127.0.0.1';
export const DEFAULT_DEV_RUNTIME_PORT = 5197;
export const DEFAULT_READY_TIMEOUT_MS = 30_000;
export const DEFAULT_DEV_RUNTIME_WINDOW_ID = 'kehto-dev-runtime-window';
export const DEFAULT_DEV_RUNTIME_DTAG = 'dev-target';
export const DEFAULT_DEV_RUNTIME_AGGREGATE_HASH = 'dev-runtime';

export function normalizeDevRuntimeOptions(raw: DevRuntimeRawOptions): DevRuntimeOptions {
  const targetUrl = normalizeTargetUrl(raw.targetUrl);
  const host = normalizeHost(raw.host);
  const port = normalizePort(raw.port, 'port');
  const readyTimeoutMs = normalizePositiveInteger(
    raw.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS,
    'ready-timeout',
  );
  const command = normalizeCommand(raw.command);
  const configPath = raw.configPath?.trim();
  const simulation = normalizeDevRuntimeSimulation(raw.simulation);

  return {
    targetUrl,
    command,
    host,
    port,
    readyTimeoutMs,
    configPath: configPath && configPath.length > 0 ? configPath : undefined,
    simulation,
    mode: command ? 'managed-command' : 'external-target',
  };
}

export function createDevRuntimeHostConfig(
  options: DevRuntimeOptions,
  now: Date = new Date(),
): DevRuntimeHostConfig {
  return {
    version: 1,
    window: {
      id: DEFAULT_DEV_RUNTIME_WINDOW_ID,
      dTag: DEFAULT_DEV_RUNTIME_DTAG,
      aggregateHash: DEFAULT_DEV_RUNTIME_AGGREGATE_HASH,
    },
    target: {
      url: options.targetUrl,
      hmrStrategy: 'iframe-target-url',
      command: options.command,
    },
    runtime: {
      host: options.host,
      port: options.port,
      readyTimeoutMs: options.readyTimeoutMs,
      configPath: options.configPath,
      reloadToken: createReloadToken(now),
      createdAt: now.toISOString(),
    },
    chrome: {
      topBar: true,
      bottomBar: true,
      sidePanels: false,
    },
    simulation: options.simulation,
  };
}

export function formatDevRuntimeUrl(options: Pick<DevRuntimeOptions, 'host' | 'port'>): string {
  return `http://${options.host}:${options.port}/`;
}

function normalizeTargetUrl(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) {
    throw new DevRuntimeOptionsError('Missing --target-url. Provide the napplet app URL that the iframe should load.');
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new DevRuntimeOptionsError(`Invalid --target-url "${raw}". Expected an absolute http(s) URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new DevRuntimeOptionsError(`Invalid --target-url "${raw}". Only http: and https: URLs are supported.`);
  }

  return parsed.href;
}

function normalizeHost(value: string | undefined): string {
  const host = value?.trim() || DEFAULT_DEV_RUNTIME_HOST;
  if (host.length === 0 || host.includes('/')) {
    throw new DevRuntimeOptionsError(`Invalid --host "${value ?? ''}". Provide a hostname or IP address.`);
  }
  return host;
}

function normalizePort(value: number | string | undefined, label: string): number {
  return normalizeIntegerInRange(value ?? DEFAULT_DEV_RUNTIME_PORT, label, 0, 65_535);
}

function normalizePositiveInteger(value: number | string, label: string, max = Number.MAX_SAFE_INTEGER): number {
  return normalizeIntegerInRange(value, label, 1, max);
}

function normalizeIntegerInRange(value: number | string, label: string, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new DevRuntimeOptionsError(`Invalid --${label} "${String(value)}". Expected an integer from ${min} to ${max}.`);
  }
  return parsed;
}

function normalizeCommand(command: DevRuntimeCommand | undefined): DevRuntimeCommand | undefined {
  if (!command) return undefined;

  if (command.mode === 'argv') {
    const argv = command.argv.map((part) => part.trim()).filter((part) => part.length > 0);
    if (argv.length === 0) {
      throw new DevRuntimeOptionsError('Command mode requires at least one command argument after --.');
    }
    return { mode: 'argv', argv };
  }

  const shellCommand = command.command.trim();
  if (shellCommand.length === 0) {
    throw new DevRuntimeOptionsError('--command requires a non-empty command string.');
  }
  return { mode: 'shell', command: shellCommand };
}

function createReloadToken(now: Date): string {
  const iso = now.toISOString();
  return `reload-${iso.replaceAll(/[^0-9A-Za-z]/g, '')}`;
}
