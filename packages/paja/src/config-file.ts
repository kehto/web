import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { PajaRawOptions } from './options.js';
import type { PajaSimulationRawOptions } from './simulation.js';
import { PajaSimulationError } from './simulation.js';

export function loadPajaConfigFile(configPath: string): PajaRawOptions {
  const resolved = resolve(configPath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolved, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new PajaSimulationError(`Unable to read --config "${configPath}": ${detail}`);
  }

  if (!isRecord(parsed)) {
    throw new PajaSimulationError(`Invalid --config "${configPath}": expected a JSON object.`);
  }

  return parsed as PajaRawOptions;
}

export function resolvePajaRawOptions(raw: PajaRawOptions): PajaRawOptions {
  if (!raw.configPath?.trim()) return raw;
  return mergePajaRawOptions(loadPajaConfigFile(raw.configPath), raw);
}

export function mergePajaRawOptions(
  base: PajaRawOptions,
  override: PajaRawOptions,
): PajaRawOptions {
  return {
    targetUrl: override.targetUrl ?? base.targetUrl,
    command: override.command ?? base.command,
    host: override.host ?? base.host,
    port: override.port ?? base.port,
    readyTimeoutMs: override.readyTimeoutMs ?? base.readyTimeoutMs,
    configPath: override.configPath ?? base.configPath,
    simulation: mergeSimulationOptions(base.simulation, override.simulation),
  };
}

function mergeSimulationOptions(
  base: PajaSimulationRawOptions | undefined,
  override: PajaSimulationRawOptions | undefined,
): PajaSimulationRawOptions | undefined {
  if (!base) return override;
  if (!override) return base;

  return {
    capabilities: {
      ...base.capabilities,
      ...override.capabilities,
      domains: {
        ...base.capabilities?.domains,
        ...override.capabilities?.domains,
      },
    },
    acl: { ...base.acl, ...override.acl },
    firewall: { ...base.firewall, ...override.firewall },
    identity: { ...base.identity, ...override.identity },
    relay: { ...base.relay, ...override.relay },
    storage: { ...base.storage, ...override.storage },
    cache: { ...base.cache, ...override.cache },
    upload: { ...base.upload, ...override.upload },
    media: { ...base.media, ...override.media },
    notifications: { ...base.notifications, ...override.notifications },
    config: {
      ...base.config,
      ...override.config,
      values: { ...base.config?.values, ...override.config?.values },
    },
    theme: {
      ...base.theme,
      ...override.theme,
      values: { ...base.theme?.values, ...override.theme?.values },
    },
    intent: { ...base.intent, ...override.intent },
    cvm: { ...base.cvm, ...override.cvm },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
