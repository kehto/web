import {
  normalizePajaSimulation,
  type PajaSimulation,
  type PajaSimulationRawOptions,
} from './simulation.js';

export type PajaCommand =
  | { readonly mode: 'argv'; readonly argv: readonly string[] }
  | { readonly mode: 'shell'; readonly command: string };

export interface PajaRawOptions {
  readonly targetUrl?: string;
  readonly command?: PajaCommand;
  readonly host?: string;
  readonly port?: number | string;
  readonly readyTimeoutMs?: number | string;
  readonly configPath?: string;
  readonly simulation?: PajaSimulationRawOptions;
}

export type PajaTargetMode = 'iframe-url' | 'runtime-pointer';
export type PajaHmrStrategy = 'iframe-target-url' | 'none';

export interface PajaPointerRuntimeConfig {
  readonly value?: string;
  readonly relays: readonly string[];
  readonly blossomServers: readonly string[];
  readonly maxWaitMs: number;
}

export interface PajaOptions {
  readonly targetUrl: string;
  readonly command?: PajaCommand;
  readonly host: string;
  readonly port: number;
  readonly readyTimeoutMs: number;
  readonly configPath?: string;
  readonly simulation: PajaSimulation;
  readonly mode: 'external-target' | 'managed-command';
}

export interface PajaHostConfig {
  readonly version: 1;
  readonly window: {
    readonly id: string;
    readonly dTag: string;
    readonly aggregateHash: string;
  };
  readonly target: {
    readonly mode: PajaTargetMode;
    readonly url: string;
    readonly hmrStrategy: PajaHmrStrategy;
    readonly command?: PajaCommand;
    readonly pointer?: PajaPointerRuntimeConfig;
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
  readonly simulation: PajaSimulation;
}

export class PajaOptionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PajaOptionsError';
  }
}

export const DEFAULT_PAJA_HOST = '127.0.0.1';
export const DEFAULT_PAJA_PORT = 5197;
export const DEFAULT_READY_TIMEOUT_MS = 30_000;
export const DEFAULT_PAJA_WINDOW_ID = 'kehto-paja-window';
export const DEFAULT_PAJA_DTAG = 'dev-target';
export const DEFAULT_PAJA_AGGREGATE_HASH = 'paja';
export const DEFAULT_PAJA_RUNTIME_WAIT_MS = 5_000;

export function normalizePajaOptions(raw: PajaRawOptions): PajaOptions {
  const targetUrl = normalizeTargetUrl(raw.targetUrl);
  const host = normalizeHost(raw.host);
  const port = normalizePort(raw.port, 'port');
  const readyTimeoutMs = normalizePositiveInteger(
    raw.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS,
    'ready-timeout',
  );
  const command = normalizeCommand(raw.command);
  const configPath = raw.configPath?.trim();
  const simulation = normalizePajaSimulation(raw.simulation);

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

export function createPajaHostConfig(
  options: PajaOptions,
  now: Date = new Date(),
): PajaHostConfig {
  const base = createPajaHostConfigBase(options.simulation);
  return {
    ...base,
    target: {
      mode: 'iframe-url',
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
  };
}

export function createPajaRuntimeHostConfig(
  options: {
    readonly pointer?: string;
    readonly relays?: readonly string[];
    readonly blossomServers?: readonly string[];
    readonly maxWaitMs?: number;
  } = {},
  now: Date = new Date(),
): PajaHostConfig {
  const base = createPajaHostConfigBase(normalizePajaSimulation({}));
  return {
    ...base,
    target: {
      mode: 'runtime-pointer',
      url: 'about:blank',
      hmrStrategy: 'none',
      pointer: {
        ...(options.pointer ? { value: options.pointer } : {}),
        relays: [...(options.relays ?? [])],
        blossomServers: [...(options.blossomServers ?? [])],
        maxWaitMs: normalizePositiveInteger(
          options.maxWaitMs ?? DEFAULT_PAJA_RUNTIME_WAIT_MS,
          'runtime-wait',
        ),
      },
    },
    runtime: {
      host: 'static',
      port: 0,
      readyTimeoutMs: 1,
      reloadToken: createReloadToken(now),
      createdAt: now.toISOString(),
    },
  };
}

export function formatPajaUrl(options: Pick<PajaOptions, 'host' | 'port'>): string {
  return `http://${options.host}:${options.port}/`;
}

function normalizeTargetUrl(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) {
    throw new PajaOptionsError('Missing --target-url. Provide the napplet app URL that the iframe should load.');
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new PajaOptionsError(`Invalid --target-url "${raw}". Expected an absolute http(s) URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new PajaOptionsError(`Invalid --target-url "${raw}". Only http: and https: URLs are supported.`);
  }

  return parsed.href;
}

function normalizeHost(value: string | undefined): string {
  const host = value?.trim() || DEFAULT_PAJA_HOST;
  if (host.length === 0 || host.includes('/')) {
    throw new PajaOptionsError(`Invalid --host "${value ?? ''}". Provide a hostname or IP address.`);
  }
  return host;
}

function normalizePort(value: number | string | undefined, label: string): number {
  return normalizeIntegerInRange(value ?? DEFAULT_PAJA_PORT, label, 0, 65_535);
}

function normalizePositiveInteger(value: number | string, label: string, max = Number.MAX_SAFE_INTEGER): number {
  return normalizeIntegerInRange(value, label, 1, max);
}

function createPajaHostConfigBase(simulation: PajaSimulation): Pick<PajaHostConfig, 'version' | 'window' | 'chrome' | 'simulation'> {
  return {
    version: 1,
    window: {
      id: DEFAULT_PAJA_WINDOW_ID,
      dTag: DEFAULT_PAJA_DTAG,
      aggregateHash: DEFAULT_PAJA_AGGREGATE_HASH,
    },
    chrome: {
      topBar: true,
      bottomBar: true,
      sidePanels: false,
    },
    simulation,
  };
}

function normalizeIntegerInRange(value: number | string, label: string, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new PajaOptionsError(`Invalid --${label} "${String(value)}". Expected an integer from ${min} to ${max}.`);
  }
  return parsed;
}

function normalizeCommand(command: PajaCommand | undefined): PajaCommand | undefined {
  if (!command) return undefined;

  if (command.mode === 'argv') {
    const argv = command.argv.map((part) => part.trim()).filter((part) => part.length > 0);
    if (argv.length === 0) {
      throw new PajaOptionsError('Command mode requires at least one command argument after --.');
    }
    return { mode: 'argv', argv };
  }

  const shellCommand = command.command.trim();
  if (shellCommand.length === 0) {
    throw new PajaOptionsError('--command requires a non-empty command string.');
  }
  return { mode: 'shell', command: shellCommand };
}

function createReloadToken(now: Date): string {
  const iso = now.toISOString();
  return `reload-${iso.replaceAll(/[^0-9A-Za-z]/g, '')}`;
}
