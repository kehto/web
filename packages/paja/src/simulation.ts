/** JSON primitive accepted in Paja simulation config values. */
export type JsonPrimitive = string | number | boolean | null;
/** JSON value accepted in Paja simulation config values. */
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };
/** JSON object used for Paja simulation fixtures and config/theme values. */
export type JsonRecord = Record<string, JsonValue>;

/** Capability domain names Paja can advertise or disable. */
export type PajaCapabilityDomain =
  | 'relay'
  | 'outbox'
  | 'storage'
  | 'identity'
  | 'keys'
  | 'config'
  | 'resource'
  | 'theme'
  | 'notify'
  | 'media'
  | 'upload'
  | 'intent'
  | 'count'
  | 'link'
  | 'common'
  | 'lists'
  | 'serial'
  | 'ble'
  | 'webrtc'
  | 'cvm'
  | 'inc';

/** Raw simulation controls accepted from CLI args or JSON config. */
export interface PajaSimulationRawOptions {
  /** Per-domain capability overrides. */
  readonly capabilities?: {
    readonly domains?: Partial<Record<PajaCapabilityDomain, boolean>>;
  };
  /** ACL behavior mode for simulated services. */
  readonly acl?: {
    readonly mode?: 'allow' | 'deny';
  };
  readonly firewall?: {
    readonly mode?: 'allow' | 'deny' | 'observe';
  };
  readonly identity?: {
    readonly mode?: 'anonymous' | 'fixed';
    readonly pubkey?: string;
  };
  readonly relay?: {
    readonly mode?: 'live' | 'memory' | 'disabled';
    readonly urls?: readonly string[];
    readonly fixtures?: readonly JsonRecord[];
  };
  readonly storage?: {
    readonly mode?: 'local' | 'memory' | 'disabled';
  };
  readonly cache?: {
    readonly mode?: 'memory' | 'disabled';
  };
  readonly upload?: {
    readonly mode?: 'memory' | 'blossom' | 'disabled';
    readonly rail?: string;
    readonly servers?: readonly string[];
    readonly discoverServers?: boolean;
    readonly maxBytes?: number;
    readonly mimeTypes?: readonly string[];
  };
  readonly media?: {
    readonly enabled?: boolean;
  };
  readonly notifications?: {
    readonly enabled?: boolean;
    readonly grant?: boolean;
  };
  readonly config?: {
    readonly values?: JsonRecord;
  };
  readonly theme?: {
    readonly mode?: 'dark' | 'light';
    readonly values?: JsonRecord;
  };
  readonly intent?: {
    readonly enabled?: boolean;
  };
  readonly cvm?: {
    readonly enabled?: boolean;
  };
}

/** Fully normalized Paja simulation model served to the browser host. */
export interface PajaSimulation {
  /** Capability domains and disabled-domain summary. */
  readonly capabilities: {
    readonly domains: Record<PajaCapabilityDomain, boolean>;
    readonly disabledDomains: readonly PajaCapabilityDomain[];
  };
  readonly acl: {
    readonly mode: 'allow' | 'deny';
  };
  readonly firewall: {
    readonly mode: 'allow' | 'deny' | 'observe';
  };
  readonly identity: {
    readonly mode: 'anonymous' | 'fixed';
    readonly pubkey: string;
  };
  readonly relay: {
    readonly mode: 'live' | 'memory' | 'disabled';
    readonly urls: readonly string[];
    readonly fixtures: readonly JsonRecord[];
  };
  readonly storage: {
    readonly mode: 'local' | 'memory' | 'disabled';
  };
  readonly cache: {
    readonly mode: 'memory' | 'disabled';
  };
  readonly upload: {
    readonly mode: 'memory' | 'blossom' | 'disabled';
    readonly rail?: string;
    readonly servers: readonly string[];
    readonly discoverServers: boolean;
    readonly maxBytes?: number;
    readonly mimeTypes?: readonly string[];
  };
  readonly media: {
    readonly enabled: boolean;
  };
  readonly notifications: {
    readonly enabled: boolean;
    readonly grant: boolean;
  };
  readonly config: {
    readonly values: JsonRecord;
  };
  readonly theme: {
    readonly mode: 'dark' | 'light';
    readonly values: JsonRecord;
  };
  readonly intent: {
    readonly enabled: boolean;
  };
  readonly cvm: {
    readonly enabled: boolean;
  };
}

/** Thrown when Paja simulation options are internally inconsistent. */
export class PajaSimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PajaSimulationError';
  }
}

/** Capability domains exposed by Paja simulation controls. */
export const PAJA_SIMULATION_DOMAINS: readonly PajaCapabilityDomain[] = [
  'relay',
  'outbox',
  'storage',
  'identity',
  'keys',
  'config',
  'resource',
  'theme',
  'notify',
  'media',
  'upload',
  'intent',
  'count',
  'link',
  'common',
  'lists',
  'serial',
  'ble',
  'webrtc',
  'cvm',
  'inc',
];

const DEFAULT_RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
] as const;
const DEFAULT_CONFIG_VALUES: JsonRecord = {
  runtime: 'kehto paja',
  mode: 'development',
  target: 'single-window',
};

const DEFAULT_THEME_VALUES: JsonRecord = {
  title: 'Kehto Paja',
};

/**
 * Normalize raw simulation options into a complete deterministic model.
 *
 * @param raw - Partial simulation options from CLI args or config.
 * @returns Complete simulation model.
 */
export function normalizePajaSimulation(
  raw: PajaSimulationRawOptions | undefined,
): PajaSimulation {
  const domainOverrides = raw?.capabilities?.domains ?? {};
  const domains = Object.fromEntries(
    PAJA_SIMULATION_DOMAINS.map((domain) => [domain, domainOverrides[domain] ?? true]),
  ) as Record<PajaCapabilityDomain, boolean>;

  const relayMode = raw?.relay?.mode ?? (domains.relay ? 'live' : 'disabled');
  if (!domains.relay && relayMode !== 'disabled') {
    throw new PajaSimulationError('Invalid simulation: relay.mode must be "disabled" when capabilities.domains.relay is false.');
  }
  if (!domains.outbox && relayMode !== 'disabled') {
    throw new PajaSimulationError('Invalid simulation: relay.mode must be "disabled" when capabilities.domains.outbox is false.');
  }
  if (relayMode === 'disabled') {
    domains.relay = false;
    domains.outbox = false;
  }

  const uploadMode = raw?.upload?.mode ?? (domains.upload ? 'memory' : 'disabled');
  if (!domains.upload && uploadMode !== 'disabled') {
    throw new PajaSimulationError('Invalid simulation: upload.mode must be "disabled" when capabilities.domains.upload is false.');
  }
  if (uploadMode === 'disabled') domains.upload = false;

  const intentEnabled = raw?.intent?.enabled ?? domains.intent;
  if (!domains.intent && intentEnabled) {
    throw new PajaSimulationError('Invalid simulation: intent.enabled must be false when capabilities.domains.intent is false.');
  }
  if (!intentEnabled) domains.intent = false;

  if (!domains.relay) domains.count = false;

  const mediaEnabled = raw?.media?.enabled ?? domains.media;
  if (!domains.media && mediaEnabled) {
    throw new PajaSimulationError('Invalid simulation: media.enabled must be false when capabilities.domains.media is false.');
  }
  if (!mediaEnabled) domains.media = false;

  const cvmEnabled = raw?.cvm?.enabled ?? domains.cvm;
  if (!domains.cvm && cvmEnabled) {
    throw new PajaSimulationError('Invalid simulation: cvm.enabled must be false when capabilities.domains.cvm is false.');
  }
  if (!cvmEnabled) domains.cvm = false;

  const notificationsEnabled = raw?.notifications?.enabled ?? domains.notify;
  if (!domains.notify && notificationsEnabled) {
    throw new PajaSimulationError('Invalid simulation: notifications.enabled must be false when capabilities.domains.notify is false.');
  }
  if (!notificationsEnabled) domains.notify = false;

  const storageMode = raw?.storage?.mode ?? (domains.storage ? 'local' : 'disabled');
  if (!domains.storage && storageMode !== 'disabled') {
    throw new PajaSimulationError('Invalid simulation: storage.mode must be "disabled" when capabilities.domains.storage is false.');
  }
  if (storageMode === 'disabled') domains.storage = false;

  const identityMode = raw?.identity?.mode ?? 'anonymous';
  const pubkey = raw?.identity?.pubkey?.trim() ?? '';
  if (identityMode === 'fixed' && !isHexPubkey(pubkey)) {
    throw new PajaSimulationError('Invalid simulation: identity.pubkey must be a 64-character hex string when identity.mode is "fixed".');
  }

  const relayUrls = raw?.relay?.urls ?? DEFAULT_RELAY_URLS;
  if (relayMode !== 'disabled' && relayUrls.length === 0) {
    throw new PajaSimulationError('Invalid simulation: relay.urls must contain at least one URL when relay.mode is enabled.');
  }
  for (const url of relayUrls) {
    if (typeof url !== 'string' || url.trim().length === 0) {
      throw new PajaSimulationError('Invalid simulation: relay.urls entries must be non-empty strings.');
    }
  }

  const uploadRail = raw?.upload?.rail?.trim() || 'dev-memory';
  if (uploadMode === 'memory' && uploadRail.length === 0) {
    throw new PajaSimulationError('Invalid simulation: upload.rail must be non-empty when upload.mode is "memory".');
  }
  const uploadServers = normalizeUploadServers(raw?.upload?.servers ?? []);
  const discoverServers = raw?.upload?.discoverServers ?? uploadMode === 'blossom';
  const maxBytes = raw?.upload?.maxBytes;
  if (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes <= 0)) {
    throw new PajaSimulationError('Invalid simulation: upload.maxBytes must be a positive safe integer.');
  }
  const mimeTypes = normalizeMimeTypes(raw?.upload?.mimeTypes);

  return {
    capabilities: {
      domains,
      disabledDomains: PAJA_SIMULATION_DOMAINS.filter((domain) => !domains[domain]),
    },
    acl: {
      mode: raw?.acl?.mode ?? 'allow',
    },
    firewall: {
      mode: raw?.firewall?.mode ?? 'observe',
    },
    identity: {
      mode: identityMode,
      pubkey: identityMode === 'fixed' ? pubkey : '',
    },
    relay: {
      mode: relayMode,
      urls: relayUrls.map((url) => url.trim()),
      fixtures: raw?.relay?.fixtures ?? [],
    },
    storage: {
      mode: storageMode,
    },
    cache: {
      mode: raw?.cache?.mode ?? 'memory',
    },
    upload: {
      mode: uploadMode,
      ...(uploadMode === 'memory' ? { rail: uploadRail } : {}),
      servers: uploadServers,
      discoverServers,
      ...(maxBytes !== undefined ? { maxBytes } : {}),
      ...(mimeTypes ? { mimeTypes } : {}),
    },
    media: {
      enabled: mediaEnabled,
    },
    notifications: {
      enabled: notificationsEnabled,
      grant: raw?.notifications?.grant ?? true,
    },
    config: {
      values: { ...DEFAULT_CONFIG_VALUES, ...raw?.config?.values },
    },
    theme: {
      mode: raw?.theme?.mode ?? 'dark',
      values: { ...DEFAULT_THEME_VALUES, ...raw?.theme?.values },
    },
    intent: {
      enabled: intentEnabled,
    },
    cvm: {
      enabled: cvmEnabled,
    },
  };
}

/**
 * Format a compact, human-readable simulation summary.
 *
 * @param simulation - Normalized simulation model.
 * @returns One-line summary used by CLI and host-page chrome.
 */
export function summarizePajaSimulation(simulation: PajaSimulation): string {
  const relay = simulation.relay.mode === 'disabled' ? 'relay:off' : `relay:${simulation.relay.mode}:${simulation.relay.urls.length}`;
  const identity = simulation.identity.mode === 'fixed' ? 'identity:fixed' : 'identity:anon';
  const storage = `storage:${simulation.storage.mode}`;
  const upload = simulation.upload.mode === 'memory'
    ? 'upload:memory:simulator'
    : simulation.upload.mode === 'blossom'
      ? `upload:blossom:${simulation.upload.servers.length}`
      : 'upload:off';
  const theme = `theme:${simulation.theme.mode}`;
  const disabled = simulation.capabilities.disabledDomains.length > 0
    ? `off:${simulation.capabilities.disabledDomains.join(',')}`
    : 'off:none';
  return `${identity} ${relay} ${storage} ${upload} ${theme} ${disabled}`;
}

/** Normalize an ordered list of shell-owned Blossom server base URLs. */
export function normalizeUploadServers(servers: readonly string[]): string[] {
  const normalized: string[] = [];
  for (const value of servers) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new PajaSimulationError('Invalid simulation: upload.servers entries must be non-empty URLs.');
    }
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new PajaSimulationError(`Invalid simulation: upload server "${value}" is not a valid URL.`);
    }
    if (url.username || url.password) {
      throw new PajaSimulationError('Invalid simulation: upload server URLs must not contain credentials.');
    }
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopbackHost(url.hostname))) {
      throw new PajaSimulationError('Invalid simulation: upload servers require HTTPS, except loopback HTTP for development.');
    }
    if (url.search || url.hash) {
      throw new PajaSimulationError('Invalid simulation: upload server URLs must not contain a query or fragment.');
    }
    const result = url.href.replace(/\/+$/, '');
    if (!normalized.includes(result)) normalized.push(result);
  }
  return normalized;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '[::1]'
    || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

function normalizeMimeTypes(mimeTypes: readonly string[] | undefined): string[] | undefined {
  if (mimeTypes === undefined) return undefined;
  const normalized: string[] = [];
  for (const value of mimeTypes) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new PajaSimulationError('Invalid simulation: upload.mimeTypes entries must be non-empty strings.');
    }
    const mimeType = value.trim();
    if (!normalized.includes(mimeType)) normalized.push(mimeType);
  }
  return normalized;
}

function isHexPubkey(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}
