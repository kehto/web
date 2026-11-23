/**
 * core/install.ts — Add mocks to a host service map without replacing what the
 * host already defines.
 */
/** Stable identifier on the warning for a mock skipped because its domain was already defined. */
export const MOCK_DOMAIN_ALREADY_DEFINED = 'KEHTO_MOCK_DOMAIN_ALREADY_DEFINED';

/**
 * Options for `installMockServices`.
 *
 * @example
 * ```ts
 * const options: InstallMockServicesOptions = { onCollision: (domain) => skipped.push(domain) };
 * ```
 */
export interface InstallMockServicesOptions {
  /**
   * Called once for each mock skipped because `target` already defines its
   * domain. Defaults to one `console.warn` per skipped domain per call.
   */
  onCollision?: (domain: string, message: string) => void;
}

/**
 * Result of `installMockServices`.
 *
 * @example
 * ```ts
 * const { installed, skipped } = installMockServices(services, mocks.services);
 * ```
 */
export interface InstalledMockServices {
  /** Domains whose mock was added to the target map. */
  readonly installed: readonly string[];
  /** Domains the target already defined; their mocks were not installed. */
  readonly skipped: readonly string[];
}

/**
 * Add mock handlers to a host service map, leaving every domain the host
 * already defines untouched. A real backend always wins over a mock, so the
 * mocks can fill gaps in any order without throwing or shadowing a handler.
 *
 * @param target - Host service map (for example `ShellAdapter.services`).
 * @param mocks - Mock handlers by domain, usually `createMockNapServices(...).services`.
 * @param options - Collision reporting.
 * @returns Domains installed and domains skipped as already defined.
 * @example
 * ```ts
 * const services = { relay: realRelay };
 * const mocks = createMockNapServices(MOCK_NAP_REGISTRY, { only: ['relay', 'torrent'] });
 * installMockServices(services, mocks.services); // keeps realRelay, adds torrent, warns once for relay
 * ```
 */
export function installMockServices<THandler>(
  target: Record<string, THandler>,
  mocks: Readonly<Record<string, THandler>>,
  options: InstallMockServicesOptions = {},
): InstalledMockServices {
  const report = options.onCollision ?? ((_domain: string, message: string) => console.warn(message));
  const installed: string[] = [];
  const skipped: string[] = [];
  for (const [domain, mock] of Object.entries(mocks)) {
    if (Object.hasOwn(target, domain) && target[domain] !== undefined) {
      skipped.push(domain);
      report(domain, `[${MOCK_DOMAIN_ALREADY_DEFINED}] Skipped the "${domain}" mock: the host already defines a "${domain}" service, which stays in place. Drop "${domain}" from the mocks (\`except\` or \`only\`) to silence this. Warned once per skipped domain per installMockServices call.`);
      continue;
    }
    target[domain] = mock;
    installed.push(domain);
  }
  return { installed: Object.freeze(installed), skipped: Object.freeze(skipped) };
}
