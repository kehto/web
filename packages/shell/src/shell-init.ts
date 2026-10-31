import type { OriginIdentity } from './origin-registry.js';
import type { ShellAdapter, ShellCapabilities, ShellDomainState, ShellEnvironment } from './types.js';
import { readShellExtensionState, resolveShellExtensions, type ShellExtension } from './shell-extensions.js';

function shellExtensions(hooks: ShellAdapter): readonly ShellExtension[] {
  return resolveShellExtensions(hooks.extensions, Object.keys(hooks.services ?? {}));
}

const RUNTIME_NATIVE_DOMAINS = [
  'shell', 'relay', 'identity', 'storage', 'inc', 'theme', 'keys', 'media', 'notify',
] as const;

const SERVICE_ONLY_DOMAINS = [
  'outbox', 'config', 'resource', 'cvm', 'upload', 'intent', 'link', 'common',
  'lists', 'serial', 'ble', 'webrtc', 'dm', 'count',
  'fs', 'gamepad', 'llm',
] as const;

/**
 * Build the shell's immutable live capability snapshot from adapter wiring.
 *
 * @param hooks - The ShellAdapter provided by the host app.
 * @returns Domain-only ShellCapabilities for the current live wiring.
 * @example
 * ```ts
 * const caps = buildShellCapabilities(hooks);
 * // caps.domains => ['relay', 'identity', 'storage', 'inc', 'theme', 'keys', 'media', 'notify']
 * ```
 */
export function buildShellCapabilities(hooks: ShellAdapter): ShellCapabilities {
  const disabled = new Set(hooks.capabilities?.disabledDomains ?? []);
  const domains: string[] = RUNTIME_NATIVE_DOMAINS.filter((domain) => !disabled.has(domain));

  for (const domain of SERVICE_ONLY_DOMAINS) {
    if (!disabled.has(domain) && isServiceDomainLive(hooks, domain)) domains.push(domain);
  }

  // Experimental x- domains are advertised exactly like built-in ones unless
  // the host disabled them or their own state() reports `disabled`.
  for (const extension of shellExtensions(hooks)) {
    if (!disabled.has(extension.domain) && readShellExtensionState(extension) !== 'disabled') domains.push(extension.domain);
  }

  return Object.freeze({ domains: freezeList(domains) });
}

/**
 * Resolve a trusted creation identity's immutable NAP-SHELL environment.
 *
 * This host-adapter API is intentionally not part of `window.napplet`: it
 * bounds host policy to current runtime wiring before `shell.init` crosses into
 * an untrusted iframe.
 *
 * @param hooks - Shell host wiring and optional per-identity grant policy.
 * @param identity - The source's creation-time identity.
 * @returns A fresh immutable environment whose entries are exact live subsets.
 */
export function resolveShellEnvironment(
  hooks: ShellAdapter,
  identity: OriginIdentity,
): ShellEnvironment {
  const capabilities = buildShellCapabilities(hooks);
  const disabled = new Set(hooks.capabilities?.disabledDomains ?? []);
  const services = getLiveServices(hooks, capabilities.domains, disabled);
  const available = Object.freeze({
    domains: freezeList(capabilities.domains),
    services: freezeList(services),
  });
  const granted = hooks.capabilities?.resolveEnvironment?.(identity, available) ?? available;

  return Object.freeze({
    capabilities: Object.freeze({
      domains: freezeList(intersectInOrder(available.domains, granted.domains)),
    }),
    services: freezeList(intersectInOrder(available.services, granted.services)),
  });
}

function isServiceDomainLive(hooks: ShellAdapter, domain: string): boolean {
  if (!hooks.services?.[domain]) return false;

  switch (domain) {
    case 'outbox': return Boolean(hooks.relayPool);
    case 'upload': return hooks.upload?.getUploader() !== null && hooks.upload?.getUploader() !== undefined;
    case 'intent': return hooks.intent?.isAvailable() === true;
    case 'link': return hooks.link?.isAvailable() === true;
    case 'common': return hooks.common?.isAvailable() === true;
    case 'lists': return hooks.lists?.isAvailable() === true;
    case 'serial': return hooks.serial?.isAvailable() === true;
    case 'ble': return hooks.ble?.isAvailable() === true;
    case 'webrtc': return hooks.webrtc?.isAvailable() === true;
    case 'llm': return hooks.llm ? hooks.llm.isAvailable() : true;
    default: return true;
  }
}

/**
 * Report the host-facing advertisement state of one bare NAP domain.
 *
 * Advertisement itself stays binary on the wire (NIP-5D domain presence), but a
 * host UI needs the third state: the domain is advertised while the user has not
 * configured its backend yet. Only hooks that expose `isConfigured()` (today
 * `llm`) or an experimental extension's `state()` can report `unconfigured`;
 * every other advertised domain is `supported`, and anything not advertised is
 * `disabled`.
 *
 * Spec gap: the host-only `unconfigured` state is a bounded Kehto spec-gap
 * policy. napplet/naps master `43cb3a4` defines no interface state, so wire
 * advertisement stays binary and `unconfigured` never reaches a napplet.
 *
 * @param hooks - The ShellAdapter provided by the host app.
 * @param domain - Bare NAP domain name such as `llm`.
 * @returns `supported`, `unconfigured` or `disabled`.
 * @example
 * ```ts
 * getShellDomainState(hooks, 'llm'); // 'unconfigured' until a connection is saved
 * ```
 */
export function getShellDomainState(hooks: ShellAdapter, domain: string): ShellDomainState {
  if (!buildShellCapabilities(hooks).domains.includes(domain)) return 'disabled';
  const extension = shellExtensions(hooks).find((entry) => entry.domain === domain);
  if (extension) return readShellExtensionState(extension);
  const configurable: unknown = Reflect.get(hooks, domain);
  const isConfigured = configurable && typeof configurable === 'object' ? (configurable as { isConfigured?: unknown }).isConfigured : undefined;
  return typeof isConfigured === 'function' && !isConfigured.call(configurable) ? 'unconfigured' : 'supported';
}

function getLiveServices(
  hooks: ShellAdapter,
  domains: readonly string[],
  disabled: ReadonlySet<string>,
): string[] {
  const liveDomains = new Set(domains);
  const services = Object.keys(hooks.services ?? {}).filter((name) => {
    if (disabled.has(name)) return false;
    return !SERVICE_ONLY_DOMAINS.includes(name as typeof SERVICE_ONLY_DOMAINS[number]) || liveDomains.has(name);
  });
  for (const extension of shellExtensions(hooks)) {
    if (liveDomains.has(extension.domain)) services.push(extension.domain);
  }
  return services;
}

function intersectInOrder(available: readonly string[], requested: readonly string[]): string[] {
  const requestedSet = new Set(requested);
  return available.filter((entry) => requestedSet.has(entry));
}

function freezeList(values: readonly string[]): readonly string[] {
  return Object.freeze([...values]);
}
