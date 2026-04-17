/**
 * @kehto/acl — NUB domain capability resolution (8-domain canonical).
 *
 * Maps NUB message types (e.g., 'relay.subscribe', 'identity.getProfile') to
 * the capability strings required by sender and recipient. This is the
 * canonical source for "which capability does this NUB operation require?"
 * in the @kehto/acl package.
 *
 * Canonical NIP-5D 8 domains: identity, keys, media, notify, relay,
 * storage, ifc, theme. The v1.1 `signer` domain is REMOVED — getPublicKey/
 * getRelays migrated to `identity`; signEvent/nip04/nip44 have no
 * napplet-visible surface (shell handles encryption inside
 * `relay.publishEncrypted`).
 *
 * Zero dependencies. No imports from @napplet/core or any external package.
 *
 * @see packages/acl/src/capabilities.ts for cap string constants + ALL_CAPABILITIES.
 * @see docs/ACL-MIGRATION.md section 2 — Capability Constant to NUB Domain Mapping.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal message shape used for capability resolution.
 *
 * Compatible with NappletMessage from @napplet/core, but defined here
 * independently to maintain @kehto/acl's zero-dependency constraint.
 *
 * @param type - NUB message type, e.g. 'relay.subscribe', 'identity.getProfile'
 */
export interface NubMessage {
  readonly type: string;
}

/**
 * Result of resolving what capabilities a NUB message requires.
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

// ─── Per-domain resolvers ─────────────────────────────────────────────────────

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
 * `ifc.*` — topic + channel sub-protocol.
 *
 * - Write actions (`emit`, `channel.emit`, `channel.broadcast`) → sender
 *   `relay:write`, recipient `relay:read`. Semantically equivalent to relay
 *   publish: point-to-point or fan-out writes gate on relay-write at wire
 *   level even though channel membership ACL is enforced at `channel.open`.
 * - Read / control actions (`subscribe`, `unsubscribe`, `channel.open`,
 *   `channel.list`, `channel.close`)                             → sender
 *   `relay:read`, recipient `null`. Channel open-time ACL semantics: the
 *   caller must already hold `relay:read`, and channel membership is
 *   recorded by the ifc handler.
 */
function ifcMap(action: string): CapabilityResolution {
  if (action === 'emit' || action === 'channel.emit' || action === 'channel.broadcast') {
    return { senderCap: 'relay:write', recipientCap: 'relay:read' };
  }
  return { senderCap: 'relay:read', recipientCap: null };
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

// ─── Resolution ───────────────────────────────────────────────────────────────

/**
 * Resolve the capabilities required by a NUB message.
 *
 * Splits `msg.type` on '.' to obtain `[domain, action]`, then dispatches to
 * a per-domain mapper. Unknown domains return `null/null` (silently ignored).
 *
 * **NUB domain mapping table (8 canonical domains):**
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
 * | `ifc`      | `emit`, `channel.emit`, `channel.broadcast`                 | `relay:write`   | `relay:read`  |
 * | `ifc`      | `subscribe`, `unsubscribe`, `channel.open/list/close`       | `relay:read`    | `null`        |
 * | `theme`    | `get`, `get.result`                                         | `theme:read`    | `null`        |
 * | `theme`    | `changed` (shell → napplet push)                            | `null`          | `theme:read`  |
 * | unknown    | any                                                         | `null`          | `null`        |
 *
 * The `signer` domain is REMOVED — signer messages fall through to the
 * default null/null branch. `getPublicKey`/`getRelays` migrated to
 * `identity`; napplet-visible signing does not exist in NIP-5D (shell
 * signs internally for `relay.publishEncrypted`).
 *
 * @param msg - Message with a `type` field in NUB format (e.g., 'relay.subscribe')
 * @returns CapabilityResolution with senderCap and recipientCap (each may be null)
 *
 * @example
 * ```ts
 * resolveCapabilitiesNub({ type: 'relay.subscribe' })
 * // => { senderCap: 'relay:read', recipientCap: null }
 *
 * resolveCapabilitiesNub({ type: 'relay.publishEncrypted' })
 * // => { senderCap: 'relay:write', recipientCap: null }
 *
 * resolveCapabilitiesNub({ type: 'identity.getProfile' })
 * // => { senderCap: 'identity:read', recipientCap: null }
 *
 * resolveCapabilitiesNub({ type: 'keys.forward' })
 * // => { senderCap: 'keys:forward', recipientCap: null }
 *
 * resolveCapabilitiesNub({ type: 'ifc.channel.broadcast' })
 * // => { senderCap: 'relay:write', recipientCap: 'relay:read' }
 *
 * resolveCapabilitiesNub({ type: 'theme.changed' })
 * // => { senderCap: null, recipientCap: 'theme:read' }
 *
 * resolveCapabilitiesNub({ type: 'signer.signEvent' })
 * // => { senderCap: null, recipientCap: null }   // domain removed
 * ```
 */
export function resolveCapabilitiesNub(msg: NubMessage): CapabilityResolution {
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
    case 'ifc':      return ifcMap(action);
    case 'theme':    return themeMap(action);
    default:         return { senderCap: null, recipientCap: null };
  }
}
