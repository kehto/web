/**
 * core-compat.ts — Local compatibility shims for legacy @napplet/core exports.
 *
 * @napplet/core v0.2.0+ dropped several v1.1-era exports that kehto source still
 * references: `Capability`, `BusKind`, `ALL_CAPABILITIES`, `DESTRUCTIVE_KINDS`,
 * `REPLAY_WINDOW_SECONDS`, `ServiceDescriptor`, plus `TOPICS.STATE_*` entries.
 * Phase 11-01 declared the 8-nub peer-dep set and linked napplet live, which
 * exposed this pre-existing drift against kehto v1.1 semantics. This module
 * mirrors the legacy exports verbatim so the runtime compiles against the
 * current napplet workspace without changing behavior.
 *
 * DRIFT-CORE-06 — Phase 11-deviation (tracked in 11-02-SUMMARY.md deviation log):
 *   All identifiers here are slated for removal. Phase 12 replaces the v1.1 NIP-01
 *   code paths that consume them (see DRIFT-RT-06..10, DRIFT-ACL-05..08); the
 *   canonical NIP-5D surface has no BusKind / ALL_CAPABILITIES / DESTRUCTIVE_KINDS.
 *   Phase 14 will delete this file once the switch dispatch is rewritten against
 *   `@napplet/core` dispatch + nub unions (DRIFT-CORE-01, DRIFT-CORE-02).
 *
 * DO NOT add new consumers. Phase 12+ handler code must import from the relevant
 * `@napplet/nub-*` package instead.
 */

// DRIFT-CORE-06 — Phase 11-deviation: Capability string union; replaced in Phase 12 by
// per-domain capability mappings derived from @napplet/nub-* DOMAIN constants.
export type Capability =
  | 'relay:read'
  | 'relay:write'
  | 'cache:read'
  | 'cache:write'
  | 'hotkey:forward'
  | 'sign:event'
  | 'sign:nip04'
  | 'sign:nip44'
  | 'state:read'
  | 'state:write';

// DRIFT-CORE-06 — Phase 11-deviation: full legacy capability list; v1.1 semantic only.
export const ALL_CAPABILITIES: readonly Capability[] = [
  'relay:read', 'relay:write',
  'cache:read', 'cache:write',
  'hotkey:forward',
  'sign:event', 'sign:nip04', 'sign:nip44',
  'state:read', 'state:write',
] as const;

// DRIFT-CORE-06 — Phase 11-deviation: kinds that require user consent before signing.
// Phase 12 deletes alongside handleSignerMessage (DRIFT-RT-07). v1.1 callers use
// `.has()` — keep Set-shaped to avoid widening their call sites in Phase 11.
export const DESTRUCTIVE_KINDS: ReadonlySet<number> = new Set([0, 3, 5, 10002]);

// DRIFT-CORE-06 — Phase 11-deviation: replay detection window; v1.1 NIP-01 semantic.
// Phase 12 reconsiders replay semantics for the NIP-5D envelope path.
export const REPLAY_WINDOW_SECONDS = 30;

// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor interface removed from
// @napplet/core in napplet phase-81. Kehto's ServiceHandler type still references it.
// Phase 12 replaces ServiceHandler with a nub-domain-aware handler type.
export interface ServiceDescriptor {
  name: string;
  version: string;
  description?: string;
}

// DRIFT-CORE-06 — Phase 11-deviation: BusKind kind constants used by v1.1 NIP-01
// dispatch paths (service-discovery, shell commands, state responses). Phase 12
// deletes SIGNER_REQUEST (DRIFT-RT-06/07); other kinds (IPC_PEER, HOTKEY_FORWARD,
// SERVICE_DISCOVERY) remain internal for the v1.1 shell:* topic path until
// Phase 12 migrates to NUB envelopes.
export const BusKind = {
  IPC_PEER: 29000,
  HOTKEY_FORWARD: 29001,
  SIGNER_REQUEST: 29002,
  SERVICE_DISCOVERY: 29010,
} as const;
export type BusKindValue = typeof BusKind[keyof typeof BusKind];

// DRIFT-CORE-06 — Phase 11-deviation: v1.1 NIP-01 AUTH handshake kind.
// Phase 12 removal tied to AUTH removal (already gone in dispatch.ts, but the
// constant is still referenced by re-exports; keep it for barrel compat).
export const AUTH_KIND = 27200;

// DRIFT-CORE-06 — Phase 11-deviation: static shell bridge URI and protocol-version
// sentinels used by v1.1 shell bootstrap. Phase 12 removes both (napplet namespace
// identifier rather than URI-driven).
export const SHELL_BRIDGE_URI = 'napplet:shell';
export const PROTOCOL_VERSION = '1.1.0';

// DRIFT-CORE-06 — Phase 11-deviation: state-related TOPICS constants removed in
// napplet phase-87 (53ed1da). v1.1 NIP-01 `shell:state-*` path still references
// them via enforce.ts#resolveCapabilities. Phase 12's NUB-dispatch rewrite
// replaces them with @napplet/nub-storage actions (get/set/remove/keys only).
export const STATE_TOPICS = {
  STATE_GET: 'shell:state-get',
  STATE_SET: 'shell:state-set',
  STATE_REMOVE: 'shell:state-remove',
  STATE_CLEAR: 'shell:state-clear',
  STATE_KEYS: 'shell:state-keys',
} as const;
