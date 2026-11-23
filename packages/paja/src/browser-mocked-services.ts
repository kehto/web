import {
  MOCK_NAPPLET_BINDINGS,
  MOCK_NAP_REGISTRY,
  createMockNapServices,
  installMockServices,
  type InstallMockServicesOptions,
} from '@kehto/mocks';
import type { NappletDomainBinding, ServiceHandler } from '@kehto/shell';

import { PAJA_MOCKED_DOMAINS, isPajaMockedDomain } from './mocked-domains.js';

/** `@kehto/mocks` services Paja registers for NAPs it has no backend for. */
export interface PajaMockedServices {
  /** Domain → mock handler actually installed in the shell adapter's services. */
  readonly services: Readonly<Record<string, ServiceHandler>>;
  /** Mocked domains skipped because the host already defined a real service. */
  readonly skipped: readonly string[];
}

/**
 * Create every mocked domain with one fixed seed so reloads show the same data,
 * and add the handlers to the host's service map. A domain the host already
 * serves keeps its real handler: the mock is skipped with a one-time
 * `KEHTO_MOCK_DOMAIN_ALREADY_DEFINED` warning instead of replacing it.
 *
 * @param target - Shell adapter service map to register the mocks in.
 * @param options - Collision reporting, forwarded to `installMockServices`.
 * @returns The installed mock handlers and the skipped domains.
 * @example
 * ```ts
 * const mocked = createPajaMockedServices(services);
 * services.torrent === mocked.services.torrent; // true
 * ```
 */
export function createPajaMockedServices(
  target: Record<string, ServiceHandler>,
  options: InstallMockServicesOptions = {},
): PajaMockedServices {
  const mocks = createMockNapServices(MOCK_NAP_REGISTRY, { seed: 1, only: PAJA_MOCKED_DOMAINS });
  const { installed, skipped } = installMockServices(target, mocks.services, options);
  const services: Record<string, ServiceHandler> = {};
  for (const domain of installed) services[domain] = mocks.services[domain]!;
  return { services: Object.freeze(services), skipped };
}

/**
 * Napplet-facing bindings for the mocked domains exposed to one frame.
 *
 * @param domains - Domains in the frame's environment.
 * @returns Bindings keyed by mocked domain, for `prepareNappletSrcdoc`.
 * @example
 * ```ts
 * prepareNappletSrcdoc(html, { domains, bindings: pajaMockedBindings(domains) });
 * ```
 */
export function pajaMockedBindings(domains: readonly string[]): Record<string, NappletDomainBinding> {
  // Keyed by the static PAJA_MOCKED_DOMAINS list, as is the Interfaces `◌` mark.
  // A skipped mock (real service already present) can't happen today because
  // that list excludes every advertised domain (mocked-domains.test.ts pins it).
  const out: Record<string, NappletDomainBinding> = {};
  for (const domain of domains) {
    const binding = MOCK_NAPPLET_BINDINGS[domain];
    if (isPajaMockedDomain(domain) && binding) out[domain] = binding;
  }
  return out;
}
