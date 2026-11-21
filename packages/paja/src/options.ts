import { normalizePajaResourceProxyUrl } from './browser-resource-proxy-setting.js';
import type { NappletCspOptions } from '@kehto/shell';
import {
  normalizePajaSimulation,
  type PajaSimulation,
  type PajaSimulationRawOptions,
} from './simulation.js';
import {
  getPajaSetting,
  getPajaSettingDefault,
  normalizePajaSettings,
  type PajaSettingValues,
} from './settings.js';

/** Command configuration for a managed Paja target process. */
export type PajaCommand =
  /** Spawn an executable with argv preserved exactly after `--`. */
  | { readonly mode: 'argv'; readonly argv: readonly string[] }
  /** Run a shell command string. */
  | { readonly mode: 'shell'; readonly command: string };

/** Raw, unnormalized options accepted from CLI arguments or config files. */
/**
 * Dev-facing setting for the experimental nested-browsing-context lock
 * ([[EXPERIMENTAL]]): `on` always applies it, `off` never does, and `auto`
 * (the default) applies it only to napplets granted a privacy-sensitive NAP
 * domain, where exfiltration by an untrusted app has real consequences.
 */
export type PajaNestedContextLockSetting = 'on' | 'off' | 'auto';

/** Dev-facing experimental host policies for Paja, resolved per napplet. */
export interface PajaExperimentalConfig {
  /** Nested-browsing-context lock policy. Default: `auto`. */
  readonly nestedContextLock?: PajaNestedContextLockSetting;
}

export interface PajaRawOptions {
  /** App dev-server URL that Paja should load. */
  readonly targetUrl?: string;
  /** Optional managed command to start before serving Paja. */
  readonly command?: PajaCommand;
  /** Hostname or IP address for the Paja HTTP server. */
  readonly host?: string;
  /** Runtime HTTP port. */
  readonly port?: number | string;
  /** Target readiness timeout in milliseconds. */
  readonly readyTimeoutMs?: number | string;
  /** Optional JSON config file path. */
  readonly configPath?: string;
  /** Opt-in experimental host policies (dev-facing). */
  readonly experimental?: PajaExperimentalConfig;
  /** Simulation controls for injected shell domains. */
  readonly simulation?: PajaSimulationRawOptions;
  /** Overrides for registered Paja settings, keyed by setting key. */
  readonly settings?: Readonly<Record<string, unknown>>;
}

/** Paja target loading mode. */
export type PajaTargetMode = 'iframe-url' | 'runtime-pointer';
/** Hot-module-reload strategy for the hosted target. */
export type PajaHmrStrategy = 'iframe-target-url' | 'none';

/** Runtime-pointer resolution config embedded into the Paja host page. */
export interface PajaPointerRuntimeConfig {
  /** Optional naddr/nevent pointer to resolve at boot. */
  readonly value?: string;
  /** Relay hints used to resolve the pointer. */
  readonly relays: readonly string[];
  /** Blossom server hints used for artifact blob fetches. */
  readonly blossomServers: readonly string[];
  /** Maximum pointer-resolution wait in milliseconds. */
  readonly maxWaitMs: number;
}

/** Normalized Paja runtime options. */
export interface PajaOptions {
  /** Absolute target URL for iframe-url mode. */
  readonly targetUrl: string;
  /** Optional managed target command. */
  readonly command?: PajaCommand;
  /** Paja server host. */
  readonly host: string;
  /** Paja server port. */
  readonly port: number;
  /** Target readiness timeout in milliseconds. */
  readonly readyTimeoutMs: number;
  /** Optional config path retained for host diagnostics. */
  readonly configPath?: string;
  /** Normalized simulation model. */
  readonly simulation: PajaSimulation;
  /** Normalized experimental policies. */
  readonly experimental: PajaExperimentalConfig;
  /** Validated setting overrides from the config file. */
  readonly settings: PajaSettingValues;
  /** Whether Paja owns a managed command or attaches to an external target. */
  readonly mode: 'external-target' | 'managed-command';
}

/** Serialized host-page config served to the browser runtime. */
export interface PajaHostConfig {
  /** Host CSP overrides for verified runtime-pointer documents, validated by shell. */
  readonly csp?: NappletCspOptions;
  /** Opt-in experimental host policies (dev-facing, resolved per napplet). */
  readonly experimental?: PajaExperimentalConfig;
  /** Browser-scope setting defaults from the config file; GUI overrides win. */
  readonly settings?: PajaSettingValues;
  /**
   * Static builds only: the standalone NAP-RESOURCE proxy that makes the
   * mandatory DNS-time private-IP checks. Without one, network schemes are off.
   */
  readonly resource?: { readonly proxyUrl?: string };
  /** Config schema version. */
  readonly version: 1;
  /** Window identity used for the development target. */
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

/** Thrown when raw Paja options cannot be normalized. */
export class PajaOptionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PajaOptionsError';
  }
}

/** Default loopback host for the Paja HTTP server. */
export const DEFAULT_PAJA_HOST = '127.0.0.1';
/** Default Paja HTTP port. */
export const DEFAULT_PAJA_PORT = 5197;
/** Default readiness timeout for the target URL. */
export const DEFAULT_READY_TIMEOUT_MS = 30_000;
/** Default development window id used in host config. */
export const DEFAULT_PAJA_WINDOW_ID = 'kehto-paja-window';
/** Default development `d` tag used for target identity. */
export const DEFAULT_PAJA_DTAG = 'dev-target';
/** Default development aggregate hash used for target identity. */
export const DEFAULT_PAJA_AGGREGATE_HASH = 'paja';
/** Built-in default pointer resolution wait in runtime-pointer mode; the effective value is the `target.runtimeWaitMs` setting. */
export const DEFAULT_PAJA_RUNTIME_WAIT_MS = getPajaSettingDefault('target.runtimeWaitMs');

/**
 * Normalize raw CLI/config options into a validated Paja runtime config.
 *
 * @param raw - Raw options from CLI parsing or a config file.
 * @returns Fully normalized runtime options.
 */

/**
 * Validate config-file setting overrides. Unlike browser storage, a config file
 * is authored on purpose, so any unknown key or out-of-range value is an error.
 *
 * @param raw - The config file's `settings` object.
 * @returns Validated overrides.
 * @example
 * normalizePajaConfigSettings({ 'server.resourceTimeoutMs': 60000 });
 */
export function normalizePajaConfigSettings(raw: unknown): PajaSettingValues {
  const { values, rejected } = normalizePajaSettings(raw);
  if (rejected.length > 0) throw new PajaOptionsError(`Invalid settings: ${rejected.join('; ')}`);
  return values;
}

function browserSettings(settings: PajaSettingValues | undefined): PajaSettingValues | undefined {
  if (!settings) return undefined;
  const browser = normalizePajaSettings(settings, 'browser').values;
  return Object.keys(browser).length > 0 ? browser : undefined;
}

/** Normalize and validate the dev-facing experimental config. Default: auto. */
export function normalizePajaExperimental(
  raw: PajaExperimentalConfig | undefined,
): PajaExperimentalConfig {
  const setting = raw?.nestedContextLock ?? 'auto';
  if (setting !== 'on' && setting !== 'off' && setting !== 'auto') {
    throw new Error(`experimental.nestedContextLock must be "on", "off", or "auto"; got ${String(setting)}`);
  }
  return { nestedContextLock: setting };
}

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
  const experimental = normalizePajaExperimental(raw.experimental);
  const settings = normalizePajaConfigSettings(raw.settings);

  return {
    targetUrl,
    command,
    host,
    port,
    readyTimeoutMs,
    configPath: configPath && configPath.length > 0 ? configPath : undefined,
    simulation,
    experimental,
    settings,
    mode: command ? 'managed-command' : 'external-target',
  };
}

/**
 * Create browser host-page config for iframe-url mode.
 *
 * @param options - Normalized Paja options.
 * @param now - Clock value used for reload token and timestamps.
 * @returns Serializable host-page config.
 */
export function createPajaHostConfig(
  options: PajaOptions,
  now: Date = new Date(),
): PajaHostConfig {
  const base = createPajaHostConfigBase(options.simulation);
  const settings = browserSettings(options.settings);
  return {
    ...base,
    ...(options.experimental ? { experimental: options.experimental } : {}),
    ...(settings ? { settings } : {}),
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

/**
 * Create browser host-page config for runtime-pointer mode.
 *
 * @param options - Pointer, relay, and Blossom hints.
 * @param now - Clock value used for reload token and timestamps.
 * @returns Serializable host-page config.
 */
export function createPajaRuntimeHostConfig(
  options: {
    readonly csp?: NappletCspOptions;
    readonly experimental?: PajaExperimentalConfig;
    readonly pointer?: string;
    readonly relays?: readonly string[];
    readonly blossomServers?: readonly string[];
    readonly maxWaitMs?: number;
    readonly simulation?: PajaSimulationRawOptions;
    readonly settings?: Readonly<Record<string, unknown>>;
    /** Standalone resource proxy URL (HTTPS, or HTTP on loopback). */
    readonly resourceProxyUrl?: string;
  } = {},
  now: Date = new Date(),
): PajaHostConfig {
  const base = createPajaHostConfigBase(normalizePajaSimulation(options.simulation));
  const proxyUrl = options.resourceProxyUrl === undefined ? undefined : normalizePajaResourceProxyUrl(options.resourceProxyUrl);
  if (options.resourceProxyUrl !== undefined && proxyUrl === null) {
    throw new Error('resourceProxyUrl must be an HTTPS URL (HTTP only for localhost) without credentials, query or fragment.');
  }
  const settings = browserSettings(options.settings === undefined ? undefined : normalizePajaConfigSettings(options.settings));
  return {
    ...base,
    ...(settings ? { settings } : {}),
    ...(options.csp ? { csp: options.csp } : {}),
    ...(options.experimental ? { experimental: options.experimental } : {}),
    ...(proxyUrl ? { resource: { proxyUrl } } : {}),
    target: {
      mode: 'runtime-pointer',
      url: 'about:blank',
      hmrStrategy: 'none',
      pointer: {
        ...(options.pointer ? { value: options.pointer } : {}),
        relays: [...(options.relays ?? [])],
        blossomServers: [...(options.blossomServers ?? [])],
        maxWaitMs: normalizePositiveInteger(
          options.maxWaitMs ?? getPajaSetting('target.runtimeWaitMs'),
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

/**
 * Format the local Paja runtime URL for display and CLI output.
 *
 * @param options - Host and port pair.
 * @returns HTTP URL for the Paja runtime.
 */
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
