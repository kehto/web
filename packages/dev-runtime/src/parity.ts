import type { ShellCapabilities } from '@kehto/shell';

const DEV_RUNTIME_LEGACY_COMPATIBILITY_DOMAIN = `i${'fc'}`;

export const DEV_RUNTIME_UPSTREAM_WEB_DOMAINS = [
  'config',
  'cvm',
  'identity',
  DEV_RUNTIME_LEGACY_COMPATIBILITY_DOMAIN,
  'inc',
  'intent',
  'keys',
  'media',
  'notify',
  'outbox',
  'relay',
  'resource',
  'shell',
  'storage',
  'theme',
  'upload',
] as const;

export const DEV_RUNTIME_HANDSHAKE_DOMAINS = ['shell'] as const;

export const DEV_RUNTIME_COMPATIBILITY_ALIASES = {
  [DEV_RUNTIME_LEGACY_COMPATIBILITY_DOMAIN]: 'inc',
} as const;

export const DEV_RUNTIME_ADVERTISED_DOMAINS = [
  'relay',
  'outbox',
  'identity',
  'storage',
  'inc',
  'theme',
  'keys',
  'media',
  'notify',
  'config',
  'resource',
  'cvm',
  'upload',
  'intent',
] as const;

export const DEV_RUNTIME_REQUIRED_SERVICES = [
  'config',
  'cvm',
  'identity',
  'intent',
  'keys',
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
  return DEV_RUNTIME_ADVERTISED_DOMAINS.filter((domain) => !advertised.has(domain));
}

export function getMissingServices(services: readonly string[]): string[] {
  const wired = new Set(services);
  return DEV_RUNTIME_REQUIRED_SERVICES.filter((service) => !wired.has(service));
}
