
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
  // NAP-CVM — ContextVM bridge (11th domain): call MCP-over-Nostr servers.
  'cvm:call',
] as const;

/** Union of every capability string in ALL_CAPABILITIES. */
export type Capability = typeof ALL_CAPABILITIES[number];

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
/** cvm.discover / cvm.request / cvm.close (inbound) + cvm.*.result / cvm.event (outbound) */
export const CAP_CVM_CALL        = 'cvm:call' as const;
