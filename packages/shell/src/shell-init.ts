
import type { ShellAdapter, ShellCapabilities } from './types.js';

/**
 * Canonical Kehto-hosted domain list: 8 v1.2 original domains, config,
 * resource, and the Phase 56-classified connect/class NUB extensions.
 * Every domain is implemented by the shell/runtime or explicit shell policy.
 *
 * Note: `relay` is NOT in this list — it is gated on `hooks.relayPool` and
 * prepended conditionally in buildShellCapabilities below.
 */
const CANONICAL_NUB_DOMAINS = [
  'identity', 'storage', 'ifc', 'theme', 'keys', 'media', 'notify',
  'config', 'resource', 'connect', 'class', 'cvm',
] as const;

const SUPPORTED_IFC_PROTOCOLS = [
  'ifc:NAP-01',
  'ifc:NUB-01',
  'ifc:NUB-02',
  'ifc:NUB-03',
  'ifc:NUB-04',
  'ifc:NUB-05',
  'ifc:NUB-06',
] as const;

/**
 * Build the shell's static capability set from adapter configuration.
 *
 * NUB capabilities = Kehto-hosted domain list from @napplet/nub subpaths,
 * plus relay (gated on hooks.relayPool):
 *   relay (gated on hooks.relayPool), identity, storage, ifc, theme,
 *   keys, media, notify, config, resource, connect, class.
 *
 * Sandbox permissions are left empty by default — host apps may extend after
 * construction. Sandbox entries returned here (and any host-app extensions)
 * MUST use the canonical `perm:<permission>` form — e.g. `'perm:popups'`,
 * `'perm:modals'`, `'perm:downloads'`. Napplets rely on the `perm:` prefix to
 * distinguish sandbox permissions from NUB-capability lookups (bare names,
 * resolved against `caps.nubs`); see specs/NIP-5D.md lines 81-94.
 *
 * @param hooks - The ShellAdapter provided by the host app
 * @returns ShellCapabilities with nubs (bare-named) and sandbox (perm:-prefixed) arrays
 * @example
 * ```ts
 * const caps = buildShellCapabilities(hooks);
 * // caps.nubs => ['relay','identity','storage','ifc','theme','keys','media','notify','config','resource','connect','class','cvm']
 * //              (relay present when hooks.relayPool is provided; bare names only)
 * // caps.sandbox => []   // host app may extend with 'perm:popups', etc.
 * ```
 */
export function buildShellCapabilities(hooks: ShellAdapter): ShellCapabilities {
  const nubs: string[] = hooks.relayPool
    ? ['relay', ...CANONICAL_NUB_DOMAINS, ...SUPPORTED_IFC_PROTOCOLS]
    : [...CANONICAL_NUB_DOMAINS, ...SUPPORTED_IFC_PROTOCOLS];
  return { nubs, sandbox: [] };
}
