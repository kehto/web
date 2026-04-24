/**
 * shell-init.ts — Shell initialization utilities.
 *
 * Provides buildShellCapabilities() — derives the shell's static NUB capability
 * set from the ShellAdapter configuration, used in the shell.ready / shell.init
 * handshake so napplets can query shell.supports() synchronously.
 *
 * Canonical NIP-5D forbids the shell from injecting a NIP-07 proxy object on
 * the napplet iframe's global scope (specs/NIP-5D.md line 44 + Security §6).
 * This module therefore does NOT expose any signing proxy to napplet code.
 * Signing/encryption is mediated by the shell through relay.publish and
 * relay.publishEncrypted — never via a napplet-visible API surface.
 */

import type { ShellAdapter, ShellCapabilities } from './types.js';

/**
 * Canonical 10-domain list (8 v1.2 original domains + config (Phase 39) +
 * resource (Phase 40)). Every domain @napplet/nub exports as a subpath.
 *
 * Note: `relay` is NOT in this list — it is gated on `hooks.relayPool` and
 * prepended conditionally in buildShellCapabilities below.
 */
const CANONICAL_NUB_DOMAINS = [
  'identity', 'storage', 'ifc', 'theme', 'keys', 'media', 'notify',
  'config', 'resource',
] as const;

/**
 * Build the shell's static capability set from adapter configuration.
 *
 * NUB capabilities = 10-domain list (8 v1.2 + config + resource) from
 * @napplet/nub subpaths, plus relay (gated on hooks.relayPool):
 *   relay (gated on hooks.relayPool), identity, storage, ifc, theme,
 *   keys, media, notify, config, resource.
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
 * // caps.nubs => ['relay','identity','storage','ifc','theme','keys','media','notify','config','resource']
 * //              (relay present when hooks.relayPool is provided; bare names only)
 * // caps.sandbox => []   // host app may extend with 'perm:popups', etc.
 * ```
 */
export function buildShellCapabilities(hooks: ShellAdapter): ShellCapabilities {
  const nubs: string[] = hooks.relayPool
    ? ['relay', ...CANONICAL_NUB_DOMAINS]
    : [...CANONICAL_NUB_DOMAINS];
  return { nubs, sandbox: [] };
}
