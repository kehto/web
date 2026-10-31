import type { ShellCapabilities } from '@kehto/shell';

/** The exact host-visible shell environment shape shared by bootstrap and init. */
export type PajaShellEnvironment = Readonly<{
  capabilities: ShellCapabilities;
  services: readonly string[];
}>;

const PAJA_LEGACY_COMPATIBILITY_DOMAIN: string = `i${'fc'}`;

/** Domain list mirrored from the upstream web runtime for parity checks. */
export const PAJA_UPSTREAM_WEB_DOMAINS = [
  'ble',
  'common',
  'config',
  'count',
  'cvm',
  'dm',
  'fs',
  'gamepad',
  'identity',
  PAJA_LEGACY_COMPATIBILITY_DOMAIN,
  'inc',
  'intent',
  'keys',
  'link',
  'lists',
  'llm',
  'media',
  'notify',
  'outbox',
  'relay',
  'resource',
  'serial',
  'shell',
  'storage',
  'theme',
  'upload',
  'webrtc',
] as const;

/** Retained compatibility export; no domain requires a Paja handshake. */
export const PAJA_HANDSHAKE_DOMAINS = [] as const;
/** Upstream domains intentionally deferred because no runtime implementation exists. */
export const PAJA_DEFERRED_DOMAINS = [] as const;

/** Compatibility aliases for renamed upstream capability domains. */
export const PAJA_COMPATIBILITY_ALIASES = {
  [PAJA_LEGACY_COMPATIBILITY_DOMAIN]: 'inc',
} as const;

/** Domains Paja may advertise when each corresponding host backend is live. */
export const PAJA_ADVERTISED_DOMAINS = [
  'shell',
  'gamepad',
  'relay',
  'outbox',
  'identity',
  'storage',
  'inc',
  'theme',
  'keys',
  'link',
  'common',
  'lists',
  'serial',
  'ble',
  'webrtc',
  'media',
  'notify',
  'config',
  'resource',
  'cvm',
  'upload',
  'intent',
  'count',
  'dm',
  'fs',
  'llm',
] as const;

/** Service names Paja expects the host runtime to provide. */
export const PAJA_REQUIRED_SERVICES = [
  'gamepad',
  'config',
  'cvm',
  'identity',
  'intent',
  'keys',
  'link',
  'common',
  'lists',
  'serial',
  'ble',
  'webrtc',
  'media',
  'notify',
  'outbox',
  'relay',
  'resource',
  'theme',
  'upload',
  'count',
  'dm',
  'fs',
] as const;

/**
 * Find advertised Paja domains missing from a shell capability snapshot.
 *
 * @param capabilities - Shell capability snapshot to inspect.
 * @returns Advertised domains not present in the snapshot.
 */
export function getMissingAdvertisedDomains(capabilities: ShellCapabilities): string[] {
  const advertised = new Set(capabilities.domains);
  return PAJA_ADVERTISED_DOMAINS.filter((domain) => !advertised.has(domain));
}

/**
 * Find required service names missing from a runtime service list.
 *
 * @param services - Runtime service names to inspect.
 * @returns Required service names that are absent.
 */
export function getMissingServices(services: readonly string[]): string[] {
  const wired = new Set(services);
  return PAJA_REQUIRED_SERVICES.filter((service) => !wired.has(service));
}

/**
 * Compare the observable membership of two independently resolved Paja shell
 * environments. Resolver calls intentionally return different frozen objects.
 */
export function hasEqualPajaEnvironmentMembership(
  left: PajaShellEnvironment,
  right: PajaShellEnvironment,
): boolean {
  return left.capabilities.domains.length === right.capabilities.domains.length
    && left.capabilities.domains.every((domain, index) => domain === right.capabilities.domains[index])
    && left.services.length === right.services.length
    && left.services.every((service, index) => service === right.services[index]);
}

/**
 * Report advertised domains that are neither Paja-advertised built-ins nor the
 * configured experimental `x-` extension domains. A non-empty result means the
 * host advertised something it does not account for.
 *
 * @param capabilities - Advertised shell capabilities.
 * @param extensionDomains - Domains of loaded Paja extensions.
 * @returns Unexpected domains in advertisement order.
 * @example
 * ```ts
 * getUnexpectedAdvertisedDomains(caps, ['x-echo']); // []
 * ```
 */
export function getUnexpectedAdvertisedDomains(
  capabilities: ShellCapabilities,
  extensionDomains: readonly string[] = [],
): string[] {
  const known = new Set<string>([...PAJA_ADVERTISED_DOMAINS, ...extensionDomains]);
  return capabilities.domains.filter((domain) => !known.has(domain));
}
