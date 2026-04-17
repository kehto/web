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

/** Canonical NIP-5D 8-domain list (every domain a @napplet/nub-* package publishes). */
const CANONICAL_NUB_DOMAINS = [
  'identity', 'storage', 'ifc', 'theme', 'keys', 'media', 'notify',
] as const;

/**
 * Build the shell's static capability set from adapter configuration.
 *
 * NUB capabilities = canonical 8-domain list from @napplet/nub-*:
 *   relay (gated on hooks.relayPool), identity, storage, ifc, theme, keys, media, notify.
 *
 * Sandbox permissions are left empty by default — host apps may extend after
 * construction. All sandbox permission strings are expected in the `perm:<permission>`
 * namespace per specs/NIP-5D.md (see shell.supports() rename).
 *
 * @param hooks - The ShellAdapter provided by the host app
 * @returns ShellCapabilities with nubs and sandbox arrays
 * @example
 * ```ts
 * const caps = buildShellCapabilities(hooks);
 * // caps.nubs => ['relay','identity','storage','ifc','theme','keys','media','notify']
 * //              (relay present when hooks.relayPool is provided)
 * // caps.sandbox => []
 * ```
 */
export function buildShellCapabilities(hooks: ShellAdapter): ShellCapabilities {
  const nubs: string[] = hooks.relayPool
    ? ['relay', ...CANONICAL_NUB_DOMAINS]
    : [...CANONICAL_NUB_DOMAINS];
  return { nubs, sandbox: [] };
}
