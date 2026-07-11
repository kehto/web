
import type { ShellAdapter, ShellCapabilities } from './types.js';

/**
 * NAP-vocabulary domain list (consumed by @napplet/shim >=0.9.0).
 *
 * Note: `relay` and `outbox` are NOT in this list — both are gated on
 * `hooks.relayPool` (NAP-OUTBOX routes over relays, so it is meaningless
 * without one) and prepended conditionally in buildShellCapabilities below.
 * `link` and `common` are also conditional because shells must wire those
 * service backends before advertising user-visible navigation/social actions.
 * `count` is conditional because shells must wire a count service before
 * advertising runtime-mediated COUNT support.
 * `dm` is conditional because shells must register a runtime-owned DM backend.
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
 * Returns the NAP-SHELL `domains`/`protocols` environment used by local
 * `window.napplet.shell.supports()` queries. Flat `naps` and empty `sandbox`
 * fields remain alongside it for older payload readers.
 *
 * ### naps array (NAP vocabulary)
 * Bare domain `inc` + `inc:NAP-01..inc:NAP-06`.
 * Conditional: `relay`+`outbox` prepended when hooks.relayPool;
 * `upload` appended when hooks.upload;
 * `intent` appended when hooks.intent.isAvailable();
 * `link` appended when hooks.link.isAvailable();
 * `common` appended when hooks.common.isAvailable().
 *
 * The sandbox array is retained as an always-empty compatibility field. Current
 * NIP-5D defines only the `allow-scripts` baseline and does not make additional
 * browser sandbox tokens a napplet capability surface.
 *
 * ### domains array + protocols map (NAP-SHELL)
 * The structured environment delivered to the mandatory shell shim:
 *
 *   - `domains` — bare NAP domain names (the `naps` set MINUS the `inc:NAP-NN`
 *     protocol strings) with the same conditional entries (relay/outbox under
 *     `hooks.relayPool`, upload/intent/link/common under their hooks).
 *   - `protocols` — `{ inc: ['NAP-01'..'NAP-06'] }`, derived from
 *     `NAP_INC_PROTOCOLS` by stripping the `inc:` prefix.
 *
 * `naps`/`sandbox` are emitted as compatibility fields alongside this shape.
 *
 * @param hooks - The ShellAdapter provided by the host app
 * @returns ShellCapabilities with normative local-query data plus legacy fields
 * @example
 * ```ts
 * const caps = buildShellCapabilities(hooks);
 * // caps.domains => ['relay','outbox','identity','storage','inc','theme','keys','media','notify','config','resource','cvm']
 * //               (relay + outbox present when hooks.relayPool is provided; 'upload'/'intent'
 * //                appended under their hooks)
 * // caps.protocols => { inc: ['NAP-01','NAP-02','NAP-03','NAP-04','NAP-05','NAP-06'] }
 * // caps.naps => ['relay','outbox','identity','storage','inc','theme','keys','media','notify','config','resource','cvm',
 * //               'inc:NAP-01','inc:NAP-02','inc:NAP-03','inc:NAP-04','inc:NAP-05','inc:NAP-06']
 * //              (relay + outbox present when hooks.relayPool is provided; 'upload'
 * //               appended when hooks.upload is provided; 'intent' appended when
 * //               hooks.intent.isAvailable() is true)
 * // caps.sandbox => []   // retained for compatibility; not a NAP capability surface
 * ```
 */
export function buildShellCapabilities(hooks: ShellAdapter): ShellCapabilities {
  // domains — NAP-SHELL bare domain list used by local supports() queries.
  // Same membership/order as `naps` but WITHOUT the inc:NAP-NN protocol strings
  // (those move to `protocols`). Conditional entries use the same gates as naps.
  const domains: string[] = hooks.relayPool
    ? ['relay', 'outbox', ...NAP_DOMAINS]
    : [...NAP_DOMAINS];
  if (hooks.upload) domains.push('upload');
  if (hooks.intent?.isAvailable()) domains.push('intent');
  if (hooks.services?.count) domains.push('count');
  if (hooks.link?.isAvailable()) domains.push('link');
  if (hooks.common?.isAvailable()) domains.push('common');
  if (hooks.lists?.isAvailable()) domains.push('lists');
  if (hooks.serial?.isAvailable()) domains.push('serial');
  if (hooks.ble?.isAvailable()) domains.push('ble');
  if (hooks.webrtc?.isAvailable()) domains.push('webrtc');
  if (hooks.dm) domains.push('dm');
  // Current NIP-5D has no optional browser sandbox capability surface.
  // Keep this field empty for old shell.init consumers that still expect it.
  const sandbox: string[] = [];

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
  // NAP-COUNT: advertised only when a runtime count service is wired.
  if (hooks.services?.count) naps.push('count');
  // NAP-LINK: advertised only when the host wires shell-mediated link opening.
  if (hooks.link?.isAvailable()) naps.push('link');
  // NAP-COMMON: advertised only when the host wires common social actions.
  if (hooks.common?.isAvailable()) naps.push('common');
  // NAP-LISTS: advertised only when the host wires list mutation helpers.
  if (hooks.lists?.isAvailable()) naps.push('lists');
  // NAP-SERIAL: advertised only when the host wires runtime-owned serial sessions.
  if (hooks.serial?.isAvailable()) naps.push('serial');
  // NAP-BLE: advertised only when the host wires runtime-owned BLE sessions.
  if (hooks.ble?.isAvailable()) naps.push('ble');
  // NAP-WEBRTC: advertised only when the host wires runtime-owned WebRTC sessions.
  if (hooks.webrtc?.isAvailable()) naps.push('webrtc');
  // NAP-DM: advertised only when the host wires a runtime-owned DM backend.
  if (hooks.dm) naps.push('dm');

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
