
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
  // NAP-CVM — ContextVM bridge (11th domain): call MCP-over-Nostr servers.
  'cvm:call',
  // NAP-OUTBOX — outbox-aware relay routing (12th domain): read = query/
  // subscribe/resolveRelays/close; write = publish (shell-signed fanout).
  'outbox:read', 'outbox:write',
  // NAP-UPLOAD — shell-mediated file/blob upload (13th domain): a single write
  // cap gates the network-egress + identity-linking upload op; status queries
  // ride the same grant (a napplet only inspects its own uploads).
  'upload:write',
] as const;

/** Union of every capability string in ALL_CAPABILITIES. */
export type Capability = typeof ALL_CAPABILITIES[number];

/** identity.getProfile/getFollows/getList/getZaps/getMutes/getBlocked/getBadges */
export const CAP_IDENTITY_READ   = 'identity:read' as const;
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
/** outbox.query / outbox.subscribe / outbox.close / outbox.resolveRelays (read-side outbox access) */
export const CAP_OUTBOX_READ     = 'outbox:read' as const;
/** outbox.publish (shell-signed, outbox-aware publish fanout) */
export const CAP_OUTBOX_WRITE    = 'outbox:write' as const;
/** upload.upload / upload.status (shell-mediated file/blob upload + status query) */
export const CAP_UPLOAD_WRITE    = 'upload:write' as const;
