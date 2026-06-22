export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue>;

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
  | 'link'
  | 'cvm'
  | 'inc';

export interface PajaSimulationRawOptions {
  readonly capabilities?: {
    readonly domains?: Partial<Record<PajaCapabilityDomain, boolean>>;
  };
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
    readonly mode?: 'memory' | 'disabled';
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
    readonly mode?: 'memory' | 'disabled';
    readonly rail?: string;
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

export interface PajaSimulation {
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
    readonly mode: 'memory' | 'disabled';
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
    readonly mode: 'memory' | 'disabled';
    readonly rail: string;
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

export class PajaSimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PajaSimulationError';
  }
}

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
  'link',
  'cvm',
  'inc',
];

const DEFAULT_RELAY_URLS = ['wss://relay.kehto.dev'] as const;
const DEFAULT_CONFIG_VALUES: JsonRecord = {
  runtime: 'kehto paja',
  mode: 'development',
  target: 'single-window',
};

const DEFAULT_THEME_VALUES: JsonRecord = {
  title: 'Kehto Paja',
};

export function normalizePajaSimulation(
  raw: PajaSimulationRawOptions | undefined,
): PajaSimulation {
  const domainOverrides = raw?.capabilities?.domains ?? {};
  const domains = Object.fromEntries(
    PAJA_SIMULATION_DOMAINS.map((domain) => [domain, domainOverrides[domain] ?? true]),
  ) as Record<PajaCapabilityDomain, boolean>;

  const relayMode = raw?.relay?.mode ?? (domains.relay ? 'memory' : 'disabled');
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
  if (relayMode === 'memory' && relayUrls.length === 0) {
    throw new PajaSimulationError('Invalid simulation: relay.urls must contain at least one URL when relay.mode is "memory".');
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
      rail: uploadRail,
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

export function summarizePajaSimulation(simulation: PajaSimulation): string {
  const relay = simulation.relay.mode === 'memory' ? `relay:${simulation.relay.urls.length}` : 'relay:off';
  const identity = simulation.identity.mode === 'fixed' ? 'identity:fixed' : 'identity:anon';
  const storage = `storage:${simulation.storage.mode}`;
  const theme = `theme:${simulation.theme.mode}`;
  const disabled = simulation.capabilities.disabledDomains.length > 0
    ? `off:${simulation.capabilities.disabledDomains.join(',')}`
    : 'off:none';
  return `${identity} ${relay} ${storage} ${theme} ${disabled}`;
}

function isHexPubkey(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}
