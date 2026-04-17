/**
 * core-compat.ts — Local compatibility shims for legacy @napplet/core exports.
 *
 * @napplet/core v0.2.0+ dropped several v1.1-era exports that kehto source still
 * references: `Capability`, `BusKind`, `ALL_CAPABILITIES`, `DESTRUCTIVE_KINDS`,
 * `REPLAY_WINDOW_SECONDS`, `ServiceDescriptor`, plus `TOPICS.STATE_*` entries.
 * Phase 11-01 declared the 8-nub peer-dep set and linked napplet live, which
 * exposed this pre-existing drift against kehto v1.1 semantics. This module
 * mirrors the legacy exports with Phase 12 content updates — the canonical
 * 8-domain capability set replaces the v1.1 signer caps, but the shim itself
 * remains until Phase 14 rewrites the dispatch switch.
 *
 * DRIFT-CORE-06 — tracked deviation (11-02-SUMMARY.md deviation log):
 *   All identifiers here are slated for removal in Phase 14 once the switch
 *   dispatch is rewritten against `@napplet/core` dispatch + nub unions
 *   (DRIFT-CORE-01, DRIFT-CORE-02). The canonical capability source of truth
 *   is now `@kehto/acl/capabilities` — Plan 12-10 aligned the shim's
 *   `Capability` union and `ALL_CAPABILITIES` list with that module.
 *
 * DO NOT add new consumers. Handler code must import from the relevant
 * `@napplet/nub-*` package or from `@kehto/acl/capabilities` instead.
 */

// DRIFT-CORE-06 — Capability string union. Content parity with
// @kehto/acl/capabilities ALL_CAPABILITIES (Plan 12-10 alignment: signer
// caps removed, 7 v1.2 additions). Shim removal scheduled for Phase 14.
export type Capability =
  | 'relay:read'
  | 'relay:write'
  | 'cache:read'
  | 'cache:write'
  | 'hotkey:forward'
  | 'state:read'
  | 'state:write'
  | 'identity:read'
  | 'keys:bind'
  | 'keys:forward'
  | 'media:control'
  | 'notify:send'
  | 'notify:channel'
  | 'theme:read';

// DRIFT-CORE-06 — Canonical 8-domain NIP-5D capability set (kept in content
// sync with @kehto/acl/capabilities ALL_CAPABILITIES). The legacy signer
// capability strings were dropped in Plan 12-10; no napplet-visible signing
// surface remains under NIP-5D.
export const ALL_CAPABILITIES: readonly Capability[] = [
  'relay:read', 'relay:write',
  'cache:read', 'cache:write',
  'hotkey:forward',
  'state:read', 'state:write',
  'identity:read',
  'keys:bind', 'keys:forward',
  'media:control',
  'notify:send', 'notify:channel',
  'theme:read',
] as const;

// DRIFT-CORE-06 — Phase 11-deviation: kinds that required user consent before signing
// in v1.1. NIP-5D has no napplet-visible signing surface (see identity-service.ts
// migration note); this constant is retained only for backward compat with legacy
// v1.1 NIP-01 call sites. Phase 14 removes it alongside the rest of this shim.
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
// dispatch paths (service-discovery, shell commands, state responses). SIGNER_REQUEST
// is retained only for legacy v1.1 call sites; the canonical NIP-5D path has no
// napplet-visible signer surface. IPC_PEER, HOTKEY_FORWARD, SERVICE_DISCOVERY remain
// internal for the v1.1 shell:* topic path until Phase 14 deletes this shim.
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
