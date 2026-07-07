import type { ShellCapabilities } from '@kehto/shell';

const PAJA_LEGACY_COMPATIBILITY_DOMAIN: string = `i${'fc'}`;

/** Domain list mirrored from the upstream web runtime for parity checks. */
export const PAJA_UPSTREAM_WEB_DOMAINS = [
  'ble',
  'common',
  'config',
  'count',
  'cvm',
  'dm',
  'identity',
  PAJA_LEGACY_COMPATIBILITY_DOMAIN,
  'inc',
  'intent',
  'keys',
  'link',
  'lists',
  'media',
  'notify',
  'outbox',
  'relay',
  'resource',
  'serial',
  'storage',
  'theme',
  'upload',
  'webrtc',
] as const;

/** Domains required during the initial Paja handshake. */
export const PAJA_HANDSHAKE_DOMAINS = ['shell'] as const;
/** Domains intentionally deferred until their runtime service exists. */
export const PAJA_DEFERRED_DOMAINS = ['dm'] as const;

/** Compatibility aliases for renamed upstream capability domains. */
export const PAJA_COMPATIBILITY_ALIASES = {
  [PAJA_LEGACY_COMPATIBILITY_DOMAIN]: 'inc',
} as const;

/** Domains Paja advertises through its simulated shell capability surface. */
export const PAJA_ADVERTISED_DOMAINS = [
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
] as const;

/** Service names Paja expects the host runtime to provide. */
export const PAJA_REQUIRED_SERVICES = [
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
  'notifications',
  'notify',
  'outbox',
  'relay',
  'resource',
  'theme',
  'upload',
  'count',
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
