/**
 * @kehto/acl — NAP/NAP domain capability resolution (8 canonical + config,
 * resource, cvm, outbox, upload, intent).
 *
 * Maps NAP message types (e.g., 'relay.subscribe', 'identity.getProfile') to
 * the capability strings required by sender and recipient. This is the
 * canonical source for "which capability does this NAP operation require?"
 * in the @kehto/acl package.
 *
 * Canonical NIP-5D 8 domains: identity, keys, media, notify, relay,
 * storage, inc, theme. Extended in v1.7 with: config (Phase 39, 9th domain),
 * resource (Phase 40, 10th domain). The v1.1 `signer` domain is REMOVED —
 * getPublicKey/getRelays migrated to `identity`; signEvent/nip04/nip44 have
 * no napplet-visible surface (shell handles encryption inside
 * `relay.publishEncrypted`).
 *
 * Zero dependencies. No imports from @napplet/core or any external package.
 *
 * @see packages/acl/src/capabilities.ts for cap string constants + ALL_CAPABILITIES.
 * @see docs/ACL-MIGRATION.md section 2 — Capability Constant to NAP Domain Mapping.
 */

/**
 * Minimal message shape used for capability resolution.
 *
 * Compatible with NappletMessage from @napplet/core, but defined here
 * independently to maintain @kehto/acl's zero-dependency constraint.
 *
 * @param type - NAP message type, e.g. 'relay.subscribe', 'identity.getProfile'
 */
export interface NapMessage {
  readonly type: string;
}

/**
 * Result of resolving what capabilities a NAP message requires.
 *
 * | Field          | Description                                                    |
 * |----------------|----------------------------------------------------------------|
 * | `senderCap`    | Capability the sender must have, or null if no check needed    |
 * | `recipientCap` | Capability the recipient must have, or null if no check needed |
 *
 * @param senderCap - Capability the sender must have, or null if no ACL gate required
 * @param recipientCap - Capability the recipient must have, or null if no recipient check
 */
export interface CapabilityResolution {
  readonly senderCap: string | null;
  readonly recipientCap: string | null;
}

/**
 * `relay.*` — split publish / publishEncrypted / read actions.
 *
 * - `publish`          → sender `relay:write`, recipient `relay:read`.
 * - `publishEncrypted` → sender `relay:write`, recipient `null` (the shell
 *   handles encryption internally; no napplet-visible recipient ACL check).
 * - `subscribe` / `query` / `close` (and `.result` / `event` / `eose` /
 *   `closed` / `publish.result` / `publishEncrypted.result`) → sender
 *   `relay:read`, recipient `null`.
 */
function relayMap(action: string): CapabilityResolution {
  if (action === 'publish') return { senderCap: 'relay:write', recipientCap: 'relay:read' };
  if (action === 'publishEncrypted') return { senderCap: 'relay:write', recipientCap: null };
  return { senderCap: 'relay:read', recipientCap: null };
}

/**
 * `identity.*` — split shell-public reads from gated profile reads.
 *
 * Identity is strictly read-only per NAP-IDENTITY: napplets cannot sign,
 * encrypt, or decrypt (encryption is delegated via `relay.publishEncrypted`).
 *
 * - `getPublicKey` / `getRelays`            → `null`/`null` (shell-public info).
 * - `getProfile` / `getFollows` / `getList` / `getZaps` / `getMutes` /
 *   `getBlocked` / `getBadges` (and any other identity read) → sender
 *   `identity:read`, recipient `null`.
 */
function identityMap(action: string): CapabilityResolution {
  if (action === 'getPublicKey' || action === 'getRelays') {
    return { senderCap: null, recipientCap: null };
  }
  return { senderCap: 'identity:read', recipientCap: null };
}

/**
 * `keys.*` — split forwarding from binding lifecycle.
 *
 * - `forward` / `action`                                    → `keys:forward`.
 * - `registerAction` / `unregisterAction` / `bindings`      → `keys:bind`.
 */
function keysMap(action: string): CapabilityResolution {
  if (action === 'forward' || action === 'action') {
    return { senderCap: 'keys:forward', recipientCap: null };
  }
  return { senderCap: 'keys:bind', recipientCap: null };
}

/**
 * `notify.*` — split channel/permission registration from send/interaction.
 *
 * - `channel.register` / `permission.request` / `permission.result` → `notify:channel`.
 * - `send` / `dismiss` / `badge` / `send.result` / `action` / `clicked` /
 *   `dismissed` / `controls` (and any other notify action)          → `notify:send`.
 */
function notifyMap(action: string): CapabilityResolution {
  if (
    action === 'channel.register' ||
    action === 'permission.request' ||
    action === 'permission.result'
  ) {
    return { senderCap: 'notify:channel', recipientCap: null };
  }
  return { senderCap: 'notify:send', recipientCap: null };
}

/**
 * `storage.*` — narrowed to the canonical 4 actions (get/keys/set/remove).
 *
 * - `get` / `keys`      → `state:read`.
 * - `set` / `remove`    → `state:write`.
 * - anything else (incl. the removed `clear`) → `null`/`null`. The runtime
 *   storage handler rejects non-canonical actions before ACL resolution so
 *   napplets see the explicit rejection rather than a misleading cap denial.
 */
function storageMap(action: string): CapabilityResolution {
  if (action === 'get' || action === 'keys') return { senderCap: 'state:read', recipientCap: null };
  if (action === 'set' || action === 'remove') return { senderCap: 'state:write', recipientCap: null };
  return { senderCap: null, recipientCap: null };
}

/**
 * `inc.*` — topic + channel sub-protocol.
 *
 * - Write actions (`emit`, `channel.emit`, `channel.broadcast`) → sender
 *   `relay:write`, recipient `relay:read`. Semantically equivalent to relay
 *   publish: point-to-point or fan-out writes gate on relay-write at wire
 *   level even though channel membership ACL is enforced at `channel.open`.
 * - Read / control actions (`subscribe`, `unsubscribe`, `channel.open`,
 *   `channel.list`, `channel.close`)                             → sender
 *   `relay:read`, recipient `null`. Channel open-time ACL semantics: the
 *   caller must already hold `relay:read`, and channel membership is
 *   recorded by the inc handler.
 */
function incMap(action: string): CapabilityResolution {
  if (action === 'emit' || action === 'channel.emit' || action === 'channel.broadcast') {
    return { senderCap: 'relay:write', recipientCap: 'relay:read' };
  }
  return { senderCap: 'relay:read', recipientCap: null };
}

/**
 * `config.*` — NAP-CONFIG reference service (v1.7 Phase 39 / 9th NAP domain).
 *
 * Asymmetric protocol: napplet reads, shell writes. ALL napplet-originated
 * config messages require `config:read`. Shell→napplet pushes
 * (`config.values`, `config.registerSchema.result`, `config.schemaError`)
 * are gated by the recipient's `config:read` cap.
 *
 * Anti-overlap: NAP-STORAGE remains the general key-value surface
 * (`state:read`/`state:write`). NAP-CONFIG is shell-managed per-napplet
 * configuration only — see CONFIG-04 scope boundary docs.
 */
function configMap(action: string): CapabilityResolution {
  // Shell-originated pushes: recipient gate (napplet must hold config:read to see them).
  if (action === 'values' || action === 'registerSchema.result' || action === 'schemaError') {
    return { senderCap: null, recipientCap: 'config:read' };
  }
  // Napplet-originated requests: sender gate.
  return { senderCap: 'config:read', recipientCap: null };
}

/**
 * `resource.*` — NAP-RESOURCE authenticated fetch proxy (v1.7 Phase 40 / 10th NAP domain).
 *
 * Asymmetric protocol: napplet initiates fetch requests, shell proxies and responds.
 *
 * - `bytes` / `bytesMany` / `cancel` (napplet → shell requests)           →
 *   sender `resource:fetch`, recipient `null`. The napplet must hold
 *   `resource:fetch` to issue resource requests or cancel one.
 * - `bytes.result` / `bytes.error` / `bytesMany.result` /
 *   `bytesMany.error` (shell → napplet pushes)                           →
 *   sender `null`, recipient `resource:fetch`. The napplet must hold
 *   `resource:fetch` to receive the result/error push.
 * - Unknown resource.* actions → sender `resource:fetch`, recipient `null`
 *   (default sender gate: napplet must hold resource:fetch to send anything
 *   in the resource domain).
 */
function resourceMap(action: string): CapabilityResolution {
  // Shell-originated pushes: recipient gate (napplet must hold resource:fetch to see them).
  if (action === 'bytes.result' || action === 'bytes.error' || action === 'bytesMany.result' || action === 'bytesMany.error') {
    return { senderCap: null, recipientCap: 'resource:fetch' };
  }
  // Napplet-originated requests: sender gate (bytes, cancel, and any unknown).
  return { senderCap: 'resource:fetch', recipientCap: null };
}

/**
 * `cvm.*` — NAP-CVM ContextVM bridge. Single `cvm:call` cap gates the domain.
 *
 * - `discover` / `request` / `close` (napplet → shell requests) →
 *   sender `cvm:call`, recipient `null`. The napplet must hold `cvm:call`
 *   to query servers or send MCP messages.
 * - `discover.result` / `request.result` / `close.result` / `event`
 *   (shell → napplet pushes) → sender `null`, recipient `cvm:call`. The push
 *   is gated against the receiving napplet's cap so a napplet without
 *   `cvm:call` never sees CVM results or server-pushed events.
 * - Unknown `cvm.*` actions → sender `cvm:call` (default sender gate).
 */
function cvmMap(action: string): CapabilityResolution {
  // Shell-originated pushes: recipient gate.
  if (action === 'event' || action.endsWith('.result') || action.endsWith('.error')) {
    return { senderCap: null, recipientCap: 'cvm:call' };
  }
  // Napplet-originated requests: sender gate (discover, request, close, unknown).
  return { senderCap: 'cvm:call', recipientCap: null };
}

/**
 * `outbox.*` — NAP-OUTBOX outbox-aware relay routing (12th NAP domain).
 *
 * Split read/write like the `relay` domain, but with dedicated caps so a shell
 * can grant outbox routing independently of raw relay access:
 *
 * - `publish` (napplet → shell)                       → sender `outbox:write`,
 *   recipient `null`. The shell signs and fans the event out to the relevant
 *   write relays; there is no napplet-visible recipient ACL check.
 * - `query` / `subscribe` / `close` / `resolveRelays` (and any other
 *   napplet-originated request)                        → sender `outbox:read`,
 *   recipient `null`.
 * - `event` / `eose` / `closed` / `*.result` / `*.error` (shell → napplet
 *   pushes)                                            → sender `null`,
 *   recipient `outbox:read`. The push is gated against the receiving napplet's
 *   cap so a napplet without `outbox:read` never sees results or streamed
 *   events.
 */
function outboxMap(action: string): CapabilityResolution {
  // Shell-originated pushes: recipient gate (napplet must hold outbox:read to see them).
  if (
    action === 'event' ||
    action === 'eose' ||
    action === 'closed' ||
    action.endsWith('.result') ||
    action.endsWith('.error')
  ) {
    return { senderCap: null, recipientCap: 'outbox:read' };
  }
  // Publish is the write op.
  if (action === 'publish') return { senderCap: 'outbox:write', recipientCap: null };
  // Napplet-originated reads: query, subscribe, close, resolveRelays, unknown.
  return { senderCap: 'outbox:read', recipientCap: null };
}

/**
 * `upload.*` — NAP-UPLOAD shell-mediated file/blob upload (13th NAP domain).
 *
 * A single `upload:write` cap gates the domain — uploading is the sensitive op
 * (network egress + identity-linking), and `status` only inspects the requesting
 * napplet's own uploads, so it rides the same grant rather than a separate read
 * cap.
 *
 * - `upload` / `status` (and any other napplet-originated request) → sender
 *   `upload:write`, recipient `null`.
 * - `upload.result` / `status.result` / `status.changed` / `*.error` (shell →
 *   napplet pushes) → sender `null`, recipient `upload:write`. The push is gated
 *   against the receiving napplet's cap so a napplet without `upload:write`
 *   never sees results or progress updates.
 */
function uploadMap(action: string): CapabilityResolution {
  // Shell-originated pushes: recipient gate.
  if (
    action === 'status.changed' ||
    action.endsWith('.result') ||
    action.endsWith('.error')
  ) {
    return { senderCap: null, recipientCap: 'upload:write' };
  }
  // Napplet-originated requests: sender gate (upload, status, unknown).
  return { senderCap: 'upload:write', recipientCap: null };
}

/**
 * `intent.*` — NAP-INTENT archetype intent dispatch (14th NAP domain).
 *
 * Split read/write so a read-only class can introspect available handlers but
 * cannot dispatch (mirrors `outbox` / `relay`, where the write op is the
 * sensitive one — here `invoke` is a focus-stealing cross-napplet navigation):
 *
 * - `invoke` (napplet → shell)                          → sender `intent:write`,
 *   recipient `null`. The shell resolves the archetype to a handler, creates or
 *   focuses its window, and delivers the payload.
 * - `available` / `handlers` (and any other napplet-originated request)  →
 *   sender `intent:read`, recipient `null`. Read-side catalog introspection.
 * - `changed` / `*.result` / `*.error` (shell → napplet pushes)         →
 *   sender `null`, recipient `intent:read`. The push is gated against the
 *   receiving napplet's cap so a napplet without `intent:read` never sees
 *   availability updates or invoke results.
 */
function intentMap(action: string): CapabilityResolution {
  // Shell-originated pushes: recipient gate (napplet must hold intent:read to see them).
  if (action === 'changed' || action.endsWith('.result') || action.endsWith('.error')) {
    return { senderCap: null, recipientCap: 'intent:read' };
  }
  // Invoke is the write op (cross-napplet dispatch / focus-steal).
  if (action === 'invoke') return { senderCap: 'intent:write', recipientCap: null };
  // Napplet-originated reads: available, handlers, unknown.
  return { senderCap: 'intent:read', recipientCap: null };
}

/**
 * `theme.*` — napplet read gate vs shell-initiated push.
 *
 * - `get` / `get.result` (and any other napplet-originated query) →
 *   sender `theme:read`, recipient `null`.
 * - `changed` (shell → napplet push)                              →
 *   sender `null`, recipient `theme:read`. The push is gated against the
 *   receiving napplet's cap so a napplet without `theme:read` never sees
 *   the update.
 *
 * Note: theme's runtime/service wiring lands in Phase 13. The ACL gate is
 * defined here in Phase 12 so the cap surface is canonical ahead of the
 * runtime work.
 */
function themeMap(action: string): CapabilityResolution {
  if (action === 'changed') return { senderCap: null, recipientCap: 'theme:read' };
  return { senderCap: 'theme:read', recipientCap: null };
}

/**
 * Resolve the capabilities required by a NAP message.
 *
 * Splits `msg.type` on '.' to obtain `[domain, action]`, then dispatches to
 * a per-domain mapper. Unknown domains return `null/null` (silently ignored).
 *
 * **NAP domain mapping table (8 canonical domains):**
 *
 * | Domain     | Action(s)                                                    | senderCap       | recipientCap  |
 * |------------|--------------------------------------------------------------|-----------------|---------------|
 * | `relay`    | `subscribe`, `query`, `close`, results/pushes                | `relay:read`    | `null`        |
 * | `relay`    | `publish`                                                    | `relay:write`   | `relay:read`  |
 * | `relay`    | `publishEncrypted`                                           | `relay:write`   | `null`        |
 * | `identity` | `getPublicKey`, `getRelays`                                 | `null`          | `null`        |
 * | `identity` | `getProfile/getFollows/getList/getZaps/getMutes/...`        | `identity:read` | `null`        |
 * | `keys`     | `forward`, `action`                                         | `keys:forward`  | `null`        |
 * | `keys`     | `registerAction`, `unregisterAction`, `bindings`            | `keys:bind`     | `null`        |
 * | `media`    | any                                                         | `media:control` | `null`        |
 * | `notify`   | `channel.register`, `permission.request`, `permission.result` | `notify:channel`| `null`        |
 * | `notify`   | `send`, `dismiss`, `badge`, `clicked`, `action`, ...        | `notify:send`   | `null`        |
 * | `storage`  | `get`, `keys`                                               | `state:read`    | `null`        |
 * | `storage`  | `set`, `remove`                                             | `state:write`   | `null`        |
 * | `storage`  | any other (incl. removed `clear`)                           | `null`          | `null`        |
 * | `inc`      | `emit`, `channel.emit`, `channel.broadcast`                | `relay:write`   | `relay:read`  |
 * | `inc`      | `subscribe`, `unsubscribe`, `channel.open/list/close`      | `relay:read`    | `null`        |
 * | `theme`    | `get`, `get.result`                                         | `theme:read`    | `null`        |
 * | `theme`    | `changed` (shell → napplet push)                            | `null`          | `theme:read`  |
 * | `config`   | `get`, `subscribe`, `unsubscribe`, `registerSchema`, `openSettings` | `config:read` | `null`     |
 * | `config`   | `values`, `registerSchema.result`, `schemaError` (shell → napplet pushes) | `null` | `config:read` |
 * | `resource` | `bytes`, `bytesMany`, `cancel` (napplet → shell requests)  | `resource:fetch`| `null`        |
 * | `resource` | `bytes*.result`, `bytes*.error` (shell → napplet pushes)   | `null`          | `resource:fetch` |
 * | `intent`   | `invoke` (napplet → shell)                                  | `intent:write`  | `null`        |
 * | `intent`   | `available`, `handlers` (napplet → shell)                   | `intent:read`   | `null`        |
 * | `intent`   | `changed`, `*.result`, `*.error` (shell → napplet pushes)   | `null`          | `intent:read` |
 * | unknown    | any                                                         | `null`          | `null`        |
 *
 * The `signer` domain is REMOVED — signer messages fall through to the
 * default null/null branch. `getPublicKey`/`getRelays` migrated to
 * `identity`; napplet-visible signing does not exist in NIP-5D (shell
 * signs internally for `relay.publishEncrypted`).
 *
 * @param msg - Message with a `type` field in NAP format (e.g., 'relay.subscribe')
 * @returns CapabilityResolution with senderCap and recipientCap (each may be null)
 *
 * @example
 * ```ts
 * resolveCapabilitiesNap({ type: 'relay.subscribe' })
 * // => { senderCap: 'relay:read', recipientCap: null }
 *
 * resolveCapabilitiesNap({ type: 'relay.publishEncrypted' })
 * // => { senderCap: 'relay:write', recipientCap: null }
 *
 * resolveCapabilitiesNap({ type: 'identity.getProfile' })
 * // => { senderCap: 'identity:read', recipientCap: null }
 *
 * resolveCapabilitiesNap({ type: 'keys.forward' })
 * // => { senderCap: 'keys:forward', recipientCap: null }
 *
 * resolveCapabilitiesNap({ type: 'inc.channel.broadcast' })
 * // => { senderCap: 'relay:write', recipientCap: 'relay:read' }
 *
 * resolveCapabilitiesNap({ type: 'theme.changed' })
 * // => { senderCap: null, recipientCap: 'theme:read' }
 *
 * resolveCapabilitiesNap({ type: 'signer.signEvent' })
 * // => { senderCap: null, recipientCap: null }   // domain removed
 * ```
 */
export function resolveCapabilitiesNap(msg: NapMessage): CapabilityResolution {
  const dotIdx = msg.type.indexOf('.');
  if (dotIdx === -1) return { senderCap: null, recipientCap: null };
  const domain = msg.type.slice(0, dotIdx);
  const action = msg.type.slice(dotIdx + 1);

  switch (domain) {
    case 'relay':    return relayMap(action);
    case 'identity': return identityMap(action);
    case 'keys':     return keysMap(action);
    case 'media':    return { senderCap: 'media:control', recipientCap: null };
    case 'notify':   return notifyMap(action);
    case 'storage':  return storageMap(action);
    case 'inc':      return incMap(action);
    case 'theme':    return themeMap(action);
    case 'config':   return configMap(action);
    case 'resource': return resourceMap(action);   // Phase 40 (RESOURCE-02)
    case 'cvm':      return cvmMap(action);         // NAP-CVM ContextVM bridge
    case 'outbox':   return outboxMap(action);      // NAP-OUTBOX outbox-aware relay routing
    case 'upload':   return uploadMap(action);      // NAP-UPLOAD shell-mediated file/blob upload
    case 'intent':   return intentMap(action);      // NAP-INTENT archetype intent dispatch
    default:         return { senderCap: null, recipientCap: null };
  }
}
