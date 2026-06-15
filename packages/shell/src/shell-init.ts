
import type { ShellAdapter, ShellCapabilities } from './types.js';

/**
 * Legacy NUB-vocabulary domain list (consumed by @napplet/nub and <=0.8.x shims).
 * Keeps the exact pre-0.9.0 vocabulary: `ifc` domain instead of `inc`.
 *
 * Note: `relay` and `outbox` are NOT in this list — both are gated on
 * `hooks.relayPool` (NAP-OUTBOX routes over relays, so it is meaningless
 * without one) and prepended conditionally in buildShellCapabilities below.
 */
const LEGACY_NUB_DOMAINS = [
  'identity', 'storage', 'ifc', 'theme', 'keys', 'media', 'notify',
  'config', 'resource', 'connect', 'class', 'cvm',
] as const;

/**
 * Legacy IFC protocol entries for the `nubs` array.
 * Retained byte-for-byte so <=0.8.x shims and @napplet/nub continue to work.
 */
const LEGACY_IFC_PROTOCOLS = [
  'ifc:NAP-01',
  'ifc:NUB-01',
  'ifc:NUB-02',
  'ifc:NUB-03',
  'ifc:NUB-04',
  'ifc:NUB-05',
  'ifc:NUB-06',
] as const;

/**
 * NAP-vocabulary domain list (consumed by @napplet/shim >=0.9.0).
 * Substitutes bare `inc` for `ifc` (the NAP rename) — no `ifc` or `NUB-NN`
 * identifiers appear here.
 *
 * Note: `relay` and `outbox` are NOT in this list — prepended conditionally
 * when hooks.relayPool is present.
 */
const NAP_DOMAINS = [
  'identity', 'storage', 'inc', 'theme', 'keys', 'media', 'notify',
  'config', 'resource', 'connect', 'class', 'cvm',
] as const;

/**
 * NAP protocol IDs for the `naps` array.
 * Maps the six legacy ifc:NUB-01..06 to inc:NAP-01..06, and replaces
 * ifc:NAP-01 with inc:NAP-01 (no duplicate). Contains NO `ifc` or `NUB-NN`
 * identifiers.
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
 * Returns BOTH `naps` (NAP vocabulary, primary — consumed by @napplet/shim >=0.9.0)
 * and `nubs` (legacy vocabulary — consumed by @napplet/nub and <=0.8.x shims)
 * for one back-compat release (D2/D3, ALIGN-01..04). Dual-emit is intentional;
 * removal is tracked as CLEANUP-01.
 *
 * ### naps array (NAP vocabulary)
 * Bare domain `inc` (rename of `ifc`) + `inc:NAP-01..inc:NAP-06`.
 * Conditional: `relay`+`outbox` prepended when hooks.relayPool;
 * `upload` appended when hooks.upload;
 * `intent` appended when hooks.intent.isAvailable().
 * Contains NO `ifc` or `NUB-NN` identifiers.
 *
 * ### nubs array (legacy vocabulary)
 * Bare domain `ifc`, `ifc:NUB-01..06`, `ifc:NAP-01`.
 * Same conditional appends as naps, using legacy vocabulary.
 *
 * Sandbox permissions are left empty by default — host apps may extend after
 * construction. Sandbox entries (and any host-app extensions) MUST use the
 * canonical `perm:<permission>` form — e.g. `'perm:popups'`, `'perm:modals'`,
 * `'perm:downloads'`. Napplets rely on the `perm:` prefix to distinguish
 * sandbox permissions from NUB-capability lookups; see specs/NIP-5D.md lines 81-94.
 *
 * @param hooks - The ShellAdapter provided by the host app
 * @returns ShellCapabilities with naps (NAP vocab), nubs (legacy vocab), and sandbox (perm:-prefixed) arrays
 * @example
 * ```ts
 * const caps = buildShellCapabilities(hooks);
 * // caps.naps => ['relay','outbox','identity','storage','inc','theme','keys','media','notify','config','resource','connect','class','cvm',
 * //               'inc:NAP-01','inc:NAP-02','inc:NAP-03','inc:NAP-04','inc:NAP-05','inc:NAP-06']
 * //              (relay + outbox present when hooks.relayPool is provided; 'upload'
 * //               appended when hooks.upload is provided; 'intent' appended when
 * //               hooks.intent.isAvailable() is true; no ifc or NUB-NN identifiers)
 * // caps.nubs => ['relay','outbox','identity','storage','ifc','theme','keys','media','notify','config','resource','connect','class','cvm',
 * //               'ifc:NAP-01','ifc:NUB-01','ifc:NUB-02','ifc:NUB-03','ifc:NUB-04','ifc:NUB-05','ifc:NUB-06']
 * //              (legacy vocabulary, unchanged for back-compat)
 * // caps.sandbox => []   // host app may extend with 'perm:popups', etc.
 * ```
 */
export function buildShellCapabilities(hooks: ShellAdapter): ShellCapabilities {
  // naps — NAP vocabulary (primary; consumed by @napplet/shim >=0.9.0)
  const naps: string[] = hooks.relayPool
    ? ['relay', 'outbox', ...NAP_DOMAINS, ...NAP_INC_PROTOCOLS]
    : [...NAP_DOMAINS, ...NAP_INC_PROTOCOLS];
  // NAP-UPLOAD: advertised only when the host wires an upload backend.
  if (hooks.upload) naps.push('upload');
  // NAP-INTENT: advertised only when the host wires an available intent dispatcher.
  if (hooks.intent?.isAvailable()) naps.push('intent');

  // nubs — legacy vocabulary (back-compat; consumed by @napplet/nub and <=0.8.x shims)
  const nubs: string[] = hooks.relayPool
    ? ['relay', 'outbox', ...LEGACY_NUB_DOMAINS, ...LEGACY_IFC_PROTOCOLS]
    : [...LEGACY_NUB_DOMAINS, ...LEGACY_IFC_PROTOCOLS];
  // NAP-UPLOAD: same conditional in legacy vocabulary.
  if (hooks.upload) nubs.push('upload');
  // NAP-INTENT: same conditional in legacy vocabulary.
  if (hooks.intent?.isAvailable()) nubs.push('intent');

  return { naps, nubs, sandbox: [] };
}
