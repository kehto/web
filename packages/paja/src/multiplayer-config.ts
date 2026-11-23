import type { CvmRegistryFamily } from '@kehto/services';
import { normalizePermissionScope } from '@kehto/firewall';
import { getPajaSetting } from './settings.js';

/** Host-owned static ICE configuration; credentials never enter napplet messages. */
export interface PajaIceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

/** Explicit multiplayer signaling settings; no provider or application is inferred from a URL. */
export interface PajaMultiplayerConfig {
  /** Documented Nostr signaling format, selected by the operator. */
  profile: 'soy-rtc/1';
  /** Relays used for signaling and the shared CVM transport, independently of social relay routing. */
  relays: string[];
  /**
   * Local family labels and verified tool hash pins for CVM providers.
   * @deprecated Configure CVM families at `simulation.cvm.registry`, which needs no
   * signaling profile. Tracked as `PAJA_MULTIPLAYER_REGISTRY` in docs/compatibility.md.
   */
  registry?: CvmRegistryFamily[];
  /** Optional operator-managed STUN/TURN endpoints and credentials. */
  iceServers?: PajaIceServer[];
  /** Shared namespace for unsigned local development targets only. Verified targets derive theirs from the signed event. */
  developmentNamespace?: string;
}

const HEX = /^[0-9a-f]{64}$/u;
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown): string {
  const max = getPajaSetting('multiplayer.textMaxChars');
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Expected nonempty text (at most ${String(max)} characters).`);
  return value;
}
export function normalizePajaCvmRelays(value: unknown): string[] {
  const max = getPajaSetting('multiplayer.maxRelays');
  if (!Array.isArray(value) || !value.length || value.length > max) throw new Error(`Configure 1–${String(max)} relay URLs.`);
  return [...new Set(value.map(item => {
    if (typeof item !== 'string') throw new Error('Invalid relay URL.');
    const url = new URL(item);
    if (!['ws:', 'wss:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Relay URLs must be WS(S) origins without credentials.');
    return url.origin;
  }))];
}

export function normalizePajaCvmFamily(value: unknown): CvmRegistryFamily {
  if (!record(value) || !record(value.server) || typeof value.server.pubkey !== 'string' || !HEX.test(value.server.pubkey)) throw new Error('Each registry family needs a provider public key.');
  const maxTools = getPajaSetting('multiplayer.maxTools');
  if (!Array.isArray(value.tools) || !value.tools.length || value.tools.length > maxTools) throw new Error(`Each family needs 1–${String(maxTools)} tool name/hash pins.`);
  const tools = value.tools.map(tool => {
    if (!record(tool) || typeof tool.schemaHash !== 'string' || !HEX.test(tool.schemaHash)) throw new Error('Each tool needs its CEP-15 schema hash.');
    return { name: text(tool.name), schemaHash: tool.schemaHash };
  });
  if (new Set(tools.map(tool => tool.name)).size !== tools.length) throw new Error('Family tool names must be unique.');
  return {
    family: text(value.family), server: { pubkey: value.server.pubkey, relays: normalizePajaCvmRelays(value.server.relays) }, tools,
    ...(value.description === undefined ? {} : { description: text(value.description) }),
    ...(value.categories === undefined ? {} : { categories: Array.isArray(value.categories) ? value.categories.map(text) : (() => { throw new Error('Categories must be a text list.'); })() }),
  };
}

function iceServer(value: unknown): PajaIceServer {
  const maxUrls = getPajaSetting('multiplayer.maxIceUrls');
  if (!record(value) || !Array.isArray(value.urls) || !value.urls.length || value.urls.length > maxUrls) throw new Error(`Each ICE server needs 1–${String(maxUrls)} URLs.`);
  const urls = value.urls.map(url => normalizePermissionScope({ kind: 'ice', value: url }).value);
  if (value.username !== undefined && typeof value.username !== 'string') throw new Error('Invalid ICE username.');
  if (value.credential !== undefined && typeof value.credential !== 'string') throw new Error('Invalid ICE credential.');
  return { urls, ...(value.username === undefined ? {} : { username: value.username }), ...(value.credential === undefined ? {} : { credential: value.credential }) };
}

/**
 * Validate a CVM family list from a file or host settings.
 * @param value - Parsed JSON array of families.
 * @param field - Config path named in errors.
 * @returns Detached, validated families.
 * @example
 * ```ts
 * normalizePajaCvmRegistry([], 'cvm.registry');
 * ```
 */
export function normalizePajaCvmRegistry(value: unknown, field: string): CvmRegistryFamily[] {
  const maxRegistry = getPajaSetting('multiplayer.maxRegistryFamilies');
  if (!Array.isArray(value) || value.length > maxRegistry) throw new Error(`${field} must list at most ${String(maxRegistry)} registry families.`);
  return value.map(normalizePajaCvmFamily);
}

/**
 * Validate a provider-neutral multiplayer signaling configuration from a file or host settings.
 * A legacy `registry` is kept only when non-empty; an empty one is a no-op and is dropped.
 * @param value - Parsed JSON; undefined means the host's default transport.
 * @returns A detached, validated configuration, or undefined.
 * @example
 * ```ts
 * normalizePajaMultiplayer({ profile: 'soy-rtc/1', relays: ['wss://relay.example'] });
 * ```
 */
export function normalizePajaMultiplayer(value: unknown): PajaMultiplayerConfig | undefined {
  if (value === undefined) return undefined;
  if (!record(value) || value.profile !== 'soy-rtc/1') throw new Error('Select a supported multiplayer signaling profile.');
  const maxIce = getPajaSetting('multiplayer.maxIceServers');
  const registry = value.registry === undefined ? [] : normalizePajaCvmRegistry(value.registry, 'multiplayer.registry');
  if (value.iceServers !== undefined && (!Array.isArray(value.iceServers) || value.iceServers.length > maxIce)) throw new Error(`Configure at most ${String(maxIce)} ICE servers.`);
  return { profile: value.profile, relays: normalizePajaCvmRelays(value.relays), ...(registry.length ? { registry } : {}),
    ...(Array.isArray(value.iceServers) ? { iceServers: value.iceServers.map(iceServer) } : {}),
    ...(value.developmentNamespace === undefined ? {} : { developmentNamespace: text(value.developmentNamespace) }) };
}
