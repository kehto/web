/**
 * @kehto/acl — NUB domain capability resolution.
 *
 * Maps NUB message types (e.g., 'relay.subscribe') to the capability strings
 * required by both sender and recipient. This is the canonical source for
 * "which capability does this NUB operation require?" in the @kehto/acl package.
 *
 * Zero dependencies. No imports from @napplet/core or any external package.
 *
 * @see docs/ACL-MIGRATION.md section 2 — Capability Constant to NUB Domain Mapping
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal message shape used for capability resolution.
 *
 * Compatible with NappletMessage from @napplet/core, but defined here
 * independently to maintain @kehto/acl's zero-dependency constraint.
 *
 * @param type - NUB message type, e.g. 'relay.subscribe', 'signer.signEvent'
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

// ─── Resolution ───────────────────────────────────────────────────────────────

/**
 * Resolve the capabilities required by a NUB message.
 *
 * Splits `msg.type` on '.' to obtain `[domain, action]`, then maps to
 * capability strings. Unknown domains return `null/null` (silently ignored).
 *
 * **NUB domain mapping table:**
 *
 * | Domain    | Action(s)                        | senderCap      | recipientCap   |
 * |-----------|----------------------------------|----------------|----------------|
 * | `relay`   | subscribe, query, close          | `relay:read`   | null           |
 * | `relay`   | publish                          | `relay:write`  | `relay:read`   |
 * | `signer`  | getPublicKey, getRelays          | null           | null           |
 * | `signer`  | signEvent                        | `sign:event`   | null           |
 * | `signer`  | nip04.*                          | `sign:nip04`   | null           |
 * | `signer`  | nip44.*                          | `sign:nip44`   | null           |
 * | `storage` | get, keys                        | `state:read`   | null           |
 * | `storage` | set, remove, clear               | `state:write`  | null           |
 * | `ifc`     | emit                             | `relay:write`  | `relay:read`   |
 * | `ifc`     | subscribe, listen                | `relay:read`   | null           |
 * | `theme`   | any                              | null           | null           |
 * | `signer`  | *all*                            | *(DEPRECATED — removed in Phase 12, DRIFT-ACL-05)* |                 |
 * | unknown   | any                              | null           | null           |
 *
 * Note: `ifc` reuses `relay:read`/`relay:write` intentionally — inter-napplet
 * communication is semantically equivalent to relay publish/subscribe from an
 * ACL perspective. See docs/ACL-MIGRATION.md section 2 for rationale.
 *
 * @param msg - Message with a `type` field in NUB format (e.g., 'relay.subscribe')
 * @returns CapabilityResolution with senderCap and recipientCap (each may be null)
 *
 * @example
 * ```ts
 * resolveCapabilitiesNub({ type: 'relay.subscribe' })
 * // => { senderCap: 'relay:read', recipientCap: null }
 *
 * resolveCapabilitiesNub({ type: 'relay.publish' })
 * // => { senderCap: 'relay:write', recipientCap: 'relay:read' }
 *
 * resolveCapabilitiesNub({ type: 'signer.signEvent' })
 * // => { senderCap: 'sign:event', recipientCap: null }
 *
 * resolveCapabilitiesNub({ type: 'signer.getPublicKey' })
 * // => { senderCap: null, recipientCap: null }
 *
 * resolveCapabilitiesNub({ type: 'storage.get' })
 * // => { senderCap: 'state:read', recipientCap: null }
 *
 * resolveCapabilitiesNub({ type: 'storage.set' })
 * // => { senderCap: 'state:write', recipientCap: null }
 *
 * resolveCapabilitiesNub({ type: 'ifc.emit' })
 * // => { senderCap: 'relay:write', recipientCap: 'relay:read' }
 *
 * resolveCapabilitiesNub({ type: 'unknown.action' })
 * // => { senderCap: null, recipientCap: null }
 * ```
 */
export function resolveCapabilitiesNub(msg: NubMessage): CapabilityResolution {
  const [domain, action] = msg.type.split('.');
  switch (domain) {
    // DRIFT-ACL-06 — Phase 12: split publish vs publishEncrypted (publishEncrypted needs sign:nip44 composite gate)
    case 'relay':
      return action === 'publish'
        ? { senderCap: 'relay:write', recipientCap: 'relay:read' }
        : { senderCap: 'relay:read', recipientCap: null };
    // DRIFT-ACL-05 — Phase 12: remove case 'signer' entirely; migrate getPublicKey/getRelays to identity; drop nip04/nip44/signEvent
    case 'signer':
      if (action === 'getPublicKey' || action === 'getRelays') {
        return { senderCap: null, recipientCap: null };
      }
      if (action?.startsWith('nip04')) return { senderCap: 'sign:nip04', recipientCap: null };
      if (action?.startsWith('nip44')) return { senderCap: 'sign:nip44', recipientCap: null };
      return { senderCap: 'sign:event', recipientCap: null };
    // DRIFT-ACL-08 — Phase 12: narrow to get/set/remove/keys only; drop storage.clear (not in @napplet/nub-storage)
    case 'storage':
      return (action === 'get' || action === 'keys')
        ? { senderCap: 'state:read', recipientCap: null }
        : { senderCap: 'state:write', recipientCap: null };
    // DRIFT-ACL-07 — Phase 12: extend branch to cover channel.open/emit/broadcast/list/close (open-time ACL semantics)
    case 'ifc':
      return action === 'emit'
        ? { senderCap: 'relay:write', recipientCap: 'relay:read' }
        : { senderCap: 'relay:read', recipientCap: null };
    case 'theme':
      return { senderCap: null, recipientCap: null };
    default:
      return { senderCap: null, recipientCap: null };
  }
}
