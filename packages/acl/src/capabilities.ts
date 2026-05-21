/**
 * @kehto/acl — String capability constants.
 *
 * Canonical capability strings for NIP-5D ACL gating (v1.2 milestone).
 * Complements the bit constants in types.ts (CAP_RELAY_READ etc.) — these
 * string literals are what the runtime + shell read/write in grant/revoke
 * paths and what resolveCapabilitiesNub returns.
 *
 * Zero runtime dependencies. The eight canonical NIP-5D domains are
 * identity, keys, media, notify, relay, storage, ifc, theme; capabilities
 * here cover each domain's gated actions.
 */

/**
 * All capability strings recognized by @kehto/acl.
 *
 * Ordering: v1.1 surface first (relay/cache/hotkey/state), then the
 * v1.2 additions for the seven nubs + theme. The v1.1 `sign:event`,
 * `sign:nip04`, `sign:nip44` strings were intentionally removed — no
 * napplet-visible signing exists in canonical NIP-5D; signing flows
 * through shell-internal `relay.publishEncrypted` instead.
 */
export const ALL_CAPABILITIES = [
  // v1.1 kept:
  'relay:read', 'relay:write',
  'cache:read', 'cache:write',
  'hotkey:forward',
  'state:read', 'state:write',
  // v1.2 additions (seven nubs + theme):
  'identity:read',
  'keys:bind', 'keys:forward',
  'media:control',
  'notify:send', 'notify:channel',
  'theme:read',
  // v1.7 Phase 39 — NUB-CONFIG reference service (9th domain):
  'config:read',
  // v1.7 Phase 40 — NUB-RESOURCE reference service (10th domain):
  'resource:fetch',
  // v1.8 Phase 45 — NUB-IDENTITY decrypt gate:
  'identity:decrypt',
] as const;

/** Union of every capability string in ALL_CAPABILITIES. */
export type Capability = typeof ALL_CAPABILITIES[number];

// ─── Per-cap string constants (grep-friendly call sites) ────────────────────
//
// The v1.1 capability strings (relay:read, relay:write, cache:read,
// cache:write, hotkey:forward, state:read, state:write) are used
// throughout the codebase as bare literals; constants for them are
// deliberately omitted here to keep the surface minimal.
// The v1.2 additions below each get a named constant because they are
// the newly-introduced surface and benefit from greppable call sites.

/** identity.getProfile/getFollows/getList/getZaps/getMutes/getBlocked/getBadges */
export const CAP_IDENTITY_READ   = 'identity:read' as const;
/** identity.decrypt (class-1 only; shell-mediated decrypt) */
export const CAP_IDENTITY_DECRYPT = 'identity:decrypt' as const;
/** keys.registerAction / keys.unregisterAction / keys.bindings */
export const CAP_KEYS_BIND       = 'keys:bind' as const;
/** keys.forward / keys.action */
export const CAP_KEYS_FORWARD    = 'keys:forward' as const;
/** media.* (all actions) */
export const CAP_MEDIA_CONTROL   = 'media:control' as const;
/** notify.send / notify.dismiss / notify.badge / notify.action / notify.clicked / notify.dismissed / notify.controls / notify.send.result */
export const CAP_NOTIFY_SEND     = 'notify:send' as const;
/** notify.channel.register / notify.permission.request / notify.permission.result */
export const CAP_NOTIFY_CHANNEL  = 'notify:channel' as const;
/** theme.get / theme.changed */
export const CAP_THEME_READ      = 'theme:read' as const;
/** config.get / config.subscribe / config.unsubscribe / config.registerSchema / config.openSettings */
export const CAP_CONFIG_READ     = 'config:read' as const;
/** resource.bytes / resource.cancel (inbound) + resource.bytes.result / resource.bytes.error (outbound) */
export const CAP_RESOURCE_FETCH  = 'resource:fetch' as const;
