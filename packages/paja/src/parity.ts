import type { ShellCapabilities } from '@kehto/shell';

const PAJA_LEGACY_COMPATIBILITY_DOMAIN = `i${'fc'}`;

export const PAJA_UPSTREAM_WEB_DOMAINS = [
  'ble',
  'common',
  'config',
  'cvm',
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
  'shell',
  'storage',
  'theme',
  'upload',
  'webrtc',
] as const;

export const PAJA_HANDSHAKE_DOMAINS = ['shell'] as const;
export const PAJA_DEFERRED_DOMAINS = ['ble', 'common', 'lists', 'serial', 'webrtc'] as const;

export const PAJA_COMPATIBILITY_ALIASES = {
  [PAJA_LEGACY_COMPATIBILITY_DOMAIN]: 'inc',
} as const;

export const PAJA_ADVERTISED_DOMAINS = [
  'relay',
  'outbox',
  'identity',
  'storage',
  'inc',
  'theme',
  'keys',
  'link',
  'media',
  'notify',
  'config',
  'resource',
  'cvm',
  'upload',
  'intent',
] as const;

export const PAJA_REQUIRED_SERVICES = [
  'config',
  'cvm',
  'identity',
  'intent',
  'keys',
  'link',
  'media',
  'notifications',
  'notify',
  'outbox',
  'relay',
  'resource',
  'theme',
  'upload',
] as const;

export function getMissingAdvertisedDomains(capabilities: ShellCapabilities): string[] {
  const advertised = new Set(capabilities.domains);
  return PAJA_ADVERTISED_DOMAINS.filter((domain) => !advertised.has(domain));
}

export function getMissingServices(services: readonly string[]): string[] {
  const wired = new Set(services);
  return PAJA_REQUIRED_SERVICES.filter((service) => !wired.has(service));
}
