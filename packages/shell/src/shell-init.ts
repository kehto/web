
import type { ShellAdapter, ShellCapabilities } from './types.js';

/**
 * NAP-vocabulary domain list (consumed by @napplet/shim >=0.9.0).
 *
 * Note: `relay` and `outbox` are NOT in this list — both are gated on
 * `hooks.relayPool` (NAP-OUTBOX routes over relays, so it is meaningless
 * without one) and prepended conditionally in buildShellCapabilities below.
 * `link` and `common` are also conditional because shells must wire those
 * service backends before advertising user-visible navigation/social actions.
 */
const NAP_DOMAINS = [
  'identity', 'storage', 'inc', 'theme', 'keys', 'media', 'notify',
  'config', 'resource', 'cvm',
] as const;

/**
 * NAP protocol IDs for the `naps` array: `inc:NAP-01..inc:NAP-06`.
 */
const NAP_INC_PROTOCOLS = [
  'inc:NAP-01',
  'inc:NAP-02',
  'inc:NAP-03',
  'inc:NAP-04',
  'inc:NAP-05',
  'inc:NAP-06',
] as const;

/**
 * Build the shell's static capability set from adapter configuration.
 *
 * Returns the conformant NAP-SHELL `domains`/`protocols` shape (consumed by
 * `@napplet/shim >=0.13` via `@napplet/nap@0.12`'s `createShellEnvironment` +
 * `makeSupports`) alongside the flat `naps` array (consumed by
 * `@napplet/shim >=0.9.0`) and the `sandbox` array.
 *
 * ### naps array (NAP vocabulary)
 * Bare domain `inc` + `inc:NAP-01..inc:NAP-06`.
 * Conditional: `relay`+`outbox` prepended when hooks.relayPool;
 * `upload` appended when hooks.upload;
 * `intent` appended when hooks.intent.isAvailable();
 * `link` appended when hooks.link.isAvailable();
 * `common` appended when hooks.common.isAvailable().
 *
 * Sandbox permissions are left empty by default — host apps may extend after
 * construction. Sandbox entries (and any host-app extensions) MUST use the
 * canonical `perm:<permission>` form — e.g. `'perm:popups'`, `'perm:modals'`,
 * `'perm:downloads'`. Napplets rely on the `perm:` prefix to distinguish
 * sandbox permissions from NAP-capability lookups; see the living NIP-5D at
 * https://github.com/nostr-protocol/nips/pull/2303/
 *
 * ### domains array + protocols map (conformant NAP-SHELL — @napplet/core@0.12)
 * The structured shape the released `@napplet/shim@0.13` actually reads via
 * `@napplet/nap@0.12`'s `createShellEnvironment` + `makeSupports`:
 *
 *   - `domains` — bare NAP domain names (the `naps` set MINUS the `inc:NAP-NN`
 *     protocol strings) with the same conditional entries (relay/outbox under
 *     `hooks.relayPool`, upload/intent/link/common under their hooks). Any `perm:<x>`
 *     sandbox entries are appended here too — the 0.13 shim resolves
 *     `supports('perm:<x>')` as a plain `domains` membership check.
 *   - `protocols` — `{ inc: ['NAP-01'..'NAP-06'] }`, derived from
 *     `NAP_INC_PROTOCOLS` by stripping the `inc:` prefix.
 *
 * Emitted as a SUPERSET alongside `naps`/`sandbox` (TERM-05 back-compat).
 *
 * @param hooks - The ShellAdapter provided by the host app
 * @returns ShellCapabilities with domains/protocols (conformant 0.13 shape) plus
 *          naps (NAP vocab) and sandbox (perm:-prefixed) arrays
 * @example
 * ```ts
 * const caps = buildShellCapabilities(hooks);
 * // caps.domains => ['relay','outbox','identity','storage','inc','theme','keys','media','notify','config','resource','cvm']
 * //               (relay + outbox present when hooks.relayPool is provided; 'upload'/'intent'
 * //                appended under their hooks; perm:<x> sandbox entries appended when extended)
 * // caps.protocols => { inc: ['NAP-01','NAP-02','NAP-03','NAP-04','NAP-05','NAP-06'] }
 * // caps.naps => ['relay','outbox','identity','storage','inc','theme','keys','media','notify','config','resource','cvm',
 * //               'inc:NAP-01','inc:NAP-02','inc:NAP-03','inc:NAP-04','inc:NAP-05','inc:NAP-06']
 * //              (relay + outbox present when hooks.relayPool is provided; 'upload'
 * //               appended when hooks.upload is provided; 'intent' appended when
 * //               hooks.intent.isAvailable() is true)
 * // caps.sandbox => []   // host app may extend with 'perm:popups', etc.
 * ```
 */
export function buildShellCapabilities(hooks: ShellAdapter): ShellCapabilities {
  // domains — conformant NAP-SHELL bare domain list (@napplet/shim >=0.13).
  // Same membership/order as `naps` but WITHOUT the inc:NAP-NN protocol strings
  // (those move to `protocols`). Conditional entries use the same gates as naps.
  const domains: string[] = hooks.relayPool
    ? ['relay', 'outbox', ...NAP_DOMAINS]
    : [...NAP_DOMAINS];
  if (hooks.upload) domains.push('upload');
  if (hooks.intent?.isAvailable()) domains.push('intent');
  if (hooks.link?.isAvailable()) domains.push('link');
  if (hooks.common?.isAvailable()) domains.push('common');
  if (hooks.lists?.isAvailable()) domains.push('lists');
  // Sandbox permissions are perm:<x>-prefixed and resolved by the 0.13 shim as
  // plain domains membership (no separate permission namespace). Empty by
  // default — fold any host-extended sandbox entries in alongside the domains.
  const sandbox: string[] = [];
  domains.push(...sandbox);

  // protocols — conformant NAP-SHELL per-domain numbered protocol map.
  // Derive { inc: ['NAP-01'..'NAP-06'] } by stripping the `inc:` prefix from
  // NAP_INC_PROTOCOLS so domains/protocols stay the single source of truth.
  const protocols: Record<string, string[]> = {};
  for (const entry of NAP_INC_PROTOCOLS) {
    const [domain, protocol] = entry.split(':') as [string, string];
    (protocols[domain] ??= []).push(protocol);
  }

  // naps — NAP vocabulary (consumed by @napplet/shim >=0.9.0)
  const naps: string[] = hooks.relayPool
    ? ['relay', 'outbox', ...NAP_DOMAINS, ...NAP_INC_PROTOCOLS]
    : [...NAP_DOMAINS, ...NAP_INC_PROTOCOLS];
  // NAP-UPLOAD: advertised only when the host wires an upload backend.
  if (hooks.upload) naps.push('upload');
  // NAP-INTENT: advertised only when the host wires an available intent dispatcher.
  if (hooks.intent?.isAvailable()) naps.push('intent');
  // NAP-LINK: advertised only when the host wires shell-mediated link opening.
  if (hooks.link?.isAvailable()) naps.push('link');
  // NAP-COMMON: advertised only when the host wires common social actions.
  if (hooks.common?.isAvailable()) naps.push('common');
  // NAP-LISTS: advertised only when the host wires list mutation helpers.
  if (hooks.lists?.isAvailable()) naps.push('lists');

  return applyCapabilityOverrides(
    { domains, protocols, naps, sandbox },
    hooks.capabilities?.disabledDomains ?? [],
  );
}

function applyCapabilityOverrides(
  capabilities: ShellCapabilities,
  disabledDomains: readonly string[],
): ShellCapabilities {
  if (disabledDomains.length === 0) return capabilities;

  const disabled = new Set(disabledDomains);
  const protocols: Record<string, string[]> = {};
  for (const [domain, supportedProtocols] of Object.entries(capabilities.protocols)) {
    if (!disabled.has(domain)) protocols[domain] = supportedProtocols;
  }

  return {
    domains: capabilities.domains.filter((entry) => !disabled.has(entry)),
    protocols,
    naps: capabilities.naps.filter((entry) => !disabled.has(entry.split(':')[0] ?? entry)),
    sandbox: capabilities.sandbox,
  };
}
