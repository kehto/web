import {
  MOCK_NAPPLET_BINDINGS,
  MOCK_NAP_REGISTRY,
  createMockNapServices,
  type MockClassService,
} from '@kehto/mocks';
import type { NappletDomainBinding, ServiceHandler } from '@kehto/shell';

import { PAJA_MOCKED_DOMAINS, isPajaMockedDomain } from './mocked-domains.js';

/** `@kehto/mocks` services Paja registers for NAPs it has no backend for. */
export interface PajaMockedServices {
  /** Domain → mock handler, merged into the shell adapter's services. */
  readonly services: Readonly<Record<string, ServiceHandler>>;
  /**
   * Send the mocked NAP-CLASS assignment once a window is ready. The real
   * envelope precedes every other shell message; the mock can only follow
   * `shell.ready`, which is close enough for a development workshop.
   *
   * @param windowId - Window that just completed NAP-SHELL readiness.
   */
  onWindowReady(windowId: string): void;
}

/**
 * Create every mocked domain with one fixed seed so reloads show the same data,
 * and register the handlers in the host's service map.
 *
 * @param target - Shell adapter service map to register the mocks in.
 * @returns The mock handlers and lifecycle hook.
 * @example
 * ```ts
 * const mocked = createPajaMockedServices(services);
 * services.torrent === mocked.services.torrent; // true
 * ```
 */
export function createPajaMockedServices(target: Record<string, ServiceHandler>): PajaMockedServices {
  const mocks = createMockNapServices(MOCK_NAP_REGISTRY, { seed: 1, only: PAJA_MOCKED_DOMAINS });
  Object.assign(target, mocks.services);
  return {
    services: mocks.services,
    onWindowReady(windowId) {
      const classService = mocks.services.class as MockClassService | undefined;
      // A refused push (domain disabled for this window) returns false and is harmless.
      classService?.assign(windowId);
    },
  };
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
  const out: Record<string, NappletDomainBinding> = {};
  for (const domain of domains) {
    const binding = MOCK_NAPPLET_BINDINGS[domain];
    if (isPajaMockedDomain(domain) && binding) out[domain] = binding;
  }
  return out;
}
