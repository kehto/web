/**
 * policy-denials.ts — per-NAP wire projection of a runtime ACL or Firewall denial.
 *
 * NIP-5D defines no generic `<type>.error` reply, and most NAPs carry failures in
 * the request's own `.result` envelope. Each row below is an exact
 * napplet-to-shell request type whose owning NAP states that shape. The domains
 * without rows are answered elsewhere on their own NAP's wire (identity, theme,
 * intent and llm in domain-results.ts; storage, inc and resource in
 * `createDenialResponse`); RUNTIME-SPEC.md lists them. A type its NAP does not
 * define gets no reply at all.
 *
 * Refs checked (napplet/naps):
 * - NAP-CVM    #31 @ 28cf1bdb — "There are no `cvm.*.error` messages; ACL denial
 *   returns the matching `.result` with `error: "policy denied"`. On a shell
 *   error, success payload fields MUST be omitted."
 * - NAP-RELAY  #2 @ 9f30b350 — "`relay.publish.result` includes `ok: false` and an
 *   `error` string on failure. `relay.closed` indicates the shell terminated a
 *   subscription, with an optional `reason`. `relay.query.result` MAY include an
 *   `error` field instead of `events` if the query fails."
 * - NAP-OUTBOX #32 @ 8865f73d — result rows carry `error?` ("Result messages MAY
 *   include `error`"); `outbox.closed` carries `subId`, `reason?`;
 *   `outbox.query.result` keeps its required `events` (empty on denial).
 * - NAP-UPLOAD #33 @ f5cc981e — "The shell SHOULD return a top-level `error` when
 *   no upload was created." `upload.info` / `upload.status` follow the same
 *   rule (spec gap below).
 * - NAP-KEYS   #9 @ 8869a4cf — "The shell MUST respond to `keys.registerAction`
 *   with a `keys.registerAction.result` carrying the same `id`." and
 *   "`keys.registerAction.result` includes an `error` field (string) on
 *   failure. ... When `error` is present, `binding` is undefined."
 *   `keys.forward` / `keys.unregisterAction` are fire-and-forget.
 * - NAP-MEDIA  #10 @ 7806f438 — "`media.session.create.result` includes an
 *   `error` field (string) on failure. ... When `error` is present, the session
 *   was not created."; `sessionId` / `owner` are "Required on successful
 *   creation." Every other napplet request is fire-and-forget. #133 @ 8ea49c33
 *   is stacked on the #10 draft branch, adds torrent sources only and leaves
 *   these rows unchanged, so both refs agree.
 * - NAP-CONFIG #14 @ bed9cb5b — "`config.registerSchema` uses positive-ACK --
 *   every call receives a `config.registerSchema.result` with `ok: true`, or
 *   `ok: false` accompanied by `code` and `error`". `subscribe`, `unsubscribe`
 *   and `openSettings` define no reply.
 * - NAP-COUNT  #69 @ 9353a0c6 — `CountFailure` is `ok: false`, a "Non-empty
 *   machine-readable error code" (`"policy-denied"` is listed), and `reason?`.
 * - NAP-NOTIFY #11 @ 67877ef6 — "`notify.send.result` includes an `error` field
 *   (string) on failure."; "`notify.permission.result` returns `granted: false`
 *   if the shell denies permission. This is not an error".
 * - NAP-DM     #74 @ 2c4e4423 — "Result messages include `error` when the runtime
 *   cannot fulfill a request." and "When `error` is present, other result
 *   fields are undefined."
 * - NAP-FS     #88 @ bd1b9e91 — "A failed result MUST include `error` and MUST omit
 *   all operation-specific success fields."; `"policy-denied"` is an FsError.
 *
 * Domains ACL does not gate, reached only by a legacy Firewall drop
 * (kehto/web#494; heads re-resolved 2026-11-20):
 * - NAP-COMMON #67 @ 8cd0eae8 — "Result messages use `ok: false` plus `error`."
 *   `common.getProfile.result` requires `pubkey`; `common.follows.result`
 *   requires `pubkeys` (spec gaps below).
 * - NAP-LISTS  #68 @ 7cf00cdb — `ListMutationResult` has required `ok`, an
 *   `error` that is a "Machine-readable error code" and a human `reason`;
 *   `lists.supported.result` carries `lists?`, `error?`.
 * - NAP-SERIAL #61 @ 0c6e88ab, NAP-BLE #62 @ b46b8691 — "The runtime MUST
 *   respond to every request with a result message carrying the same `id`";
 *   "When `serial.open.result` includes `error`, it MUST NOT include `session`"
 *   (and the same for `ble.open.result`).
 * - NAP-WEBRTC #59 @ fb4dd6f0 — "Any result message MAY include an `error`
 *   field (string). When `error` is present, other result fields are undefined."
 * - NAP-LINK   #53 @ 100e5c93 — `link.open.result` requires `status`; "Result
 *   messages MAY include `error` when `status` is `"denied"`."
 * - NAP-GAMEPAD #130 @ 0b28f77e — "There are no request/result pairs." and
 *   "The shell MUST send a `gamepad.state` snapshot after each
 *   `gamepad.subscribe`."; `"blocked"` means "host policy denied the runtime".
 * - NAP-IDENTITY (master @ 377bf939) has no rows: the runtime answers a denied
 *   identity request before this table with its safe default
 *   (`createCanonicalDomainResult` in domain-results.ts).
 *
 * Where the NAP lists only common error strings, the runtime's reason passes
 * through unchanged; a fixed code is used only where the NAP mandates one or
 * defines an enumerated code set, or where it separates a machine-readable
 * `error` code from a human `reason` (NAP-LISTS), in which case `error` is
 * `"policy-denied"` and the runtime's reason goes in `reason`.
 *
 * Spec-gap decisions (kehto/web#481; each is the narrowest reply the text
 * permits, raised upstream as a question on the owning draft):
 * - `keys.registerAction`: `actionId` is required on the result. It echoes the
 *   request's `action.id`, as the NAP's error example does, or `''` when the
 *   request carries none.
 * - `config.registerSchema`: `ok: false` and `error` with no `code`. Every
 *   `ConfigSchemaErrorCode` describes a bad schema, so any of them would
 *   misreport a policy denial; the wire table marks `code` optional.
 * - `config.get`: silent. Its reply is `config.values`, which has no `error`
 *   field, and an empty `values` object would break "Missing properties MUST be
 *   populated from `default`". The napplet sees a timeout, not data.
 * - `outbox.resolveRelays`: `plan` is required, so the denial carries
 *   `plan: { relays: [], source: "policy" }` with `error`; the NAP allows a
 *   shell to "return a policy-derived plan when a napplet is not trusted to
 *   inspect relay metadata".
 * - `upload.info` / `upload.status`: the wire table lists `info` / `status`
 *   without `?`, the packaged `@napplet/nap@0.43.0` types mark both optional.
 *   The denial sends only `error`, like `upload.upload`: a status would invent
 *   a rail, timestamp and state for an upload the napplet may not inspect.
 *
 * Spec-gap decisions (kehto/web#494):
 * - `common.getProfile`: `pubkey` is required. The denial echoes the target
 *   when it is already lowercase hex and sends `''` for an npub, nprofile or
 *   anything else, so a denied napplet never gets a NIP-19 decode for free.
 * - `common.follows`: `pubkeys` is required, so the denial sends `[]` with
 *   `ok: false`, as NAP-IDENTITY does for its lists.
 * - `lists.*`: no listed code names a policy denial, so `error` is
 *   `"policy-denied"` (the NAP-COUNT / NAP-FS code) and the runtime's reason goes
 *   in `reason`. `lists.supported.result` has no `reason`, so it gets the code only.
 * - `gamepad.subscribe`: answered with the `"blocked"` snapshot, so the MUST
 *   snapshot still arrives and the binding reports the denial as it would
 *   a host block. `gamepad.unsubscribe` is silent.
 */

import type { NappletMessage } from '@napplet/core';

/** Build a denial from the request id, the runtime's reason, and the request. */
type DenialProjection = (id: string, reason: string, message: NappletMessage) => NappletMessage | null;

/** `<type>.result` carrying only `id` and the given (or passed-through) error. */
function resultError(type: string, error?: string, fields: Record<string, unknown> = {}): DenialProjection {
  return (id, reason) => ({ type: `${type}.result`, id, ...fields, error: error ?? reason } as NappletMessage);
}

/** Subscription denials close the napplet's subscription id. */
function closed(type: 'relay.closed' | 'outbox.closed'): DenialProjection {
  return (_id, reason, message) => {
    const subId = (message as NappletMessage & { subId?: unknown }).subId;
    return typeof subId === 'string' ? { type, subId, reason } as NappletMessage : null;
  };
}

/** The NAP defines no reply for this request, so a denial is silent. */
const silent: DenialProjection = () => null;

/** NAP-KEYS: `actionId` is required on the result, so echo the request's. */
const keysRegisterAction: DenialProjection = (id, reason, message) => {
  const action = (message as NappletMessage & { action?: { id?: unknown } }).action;
  const actionId = typeof action?.id === 'string' ? action.id : '';
  return { type: 'keys.registerAction.result', id, actionId, error: reason } as NappletMessage;
};

const CVM_REQUESTS = ['cvm.discover', 'cvm.request', 'cvm.close', 'cvm.registry.list',
  'cvm.registry.has', 'cvm.registry.describe', 'cvm.registry.call'] as const;
const DM_REQUESTS = ['dm.status', 'dm.conversations', 'dm.messages', 'dm.send', 'dm.subscribe', 'dm.unsubscribe'] as const;
const FS_REQUESTS = ['fs.info', 'fs.pickFile', 'fs.pickFiles', 'fs.pickDirectory', 'fs.pickSaveFile', 'fs.stat',
  'fs.list', 'fs.read', 'fs.write', 'fs.mkdir', 'fs.remove', 'fs.move', 'fs.watch', 'fs.unwatch'] as const;

const MEDIA_NOTICES = ['media.session.update', 'media.session.destroy', 'media.state', 'media.capabilities', 'media.command'] as const;
const CONFIG_NOTICES = ['config.get', 'config.subscribe', 'config.unsubscribe', 'config.openSettings'] as const;

const COMMON_ACTIONS = ['common.encodeNip19', 'common.decodeNip19', 'common.follow', 'common.unfollow',
  'common.react', 'common.report'] as const;
const SESSION_REQUESTS = ['serial.open', 'serial.write', 'serial.close',
  'ble.open', 'ble.services', 'ble.read', 'ble.write', 'ble.subscribe', 'ble.unsubscribe', 'ble.close',
  'webrtc.open', 'webrtc.send', 'webrtc.sendBytes', 'webrtc.close'] as const;

/** NAP-COMMON: `pubkey` is required, so echo a lowercase-hex target and send `''` otherwise. */
const commonGetProfile: DenialProjection = (id, reason, message) => {
  const target = (message as NappletMessage & { target?: unknown }).target;
  const pubkey = typeof target === 'string' && /^[0-9a-f]{64}$/.test(target) ? target : '';
  return { type: 'common.getProfile.result', id, ok: false, pubkey, error: reason } as NappletMessage;
};

/** NAP-LISTS: `error` is a machine-readable code; the runtime's reason goes in `reason`. */
function listsMutation(type: 'lists.add' | 'lists.remove'): DenialProjection {
  return (id, reason) => ({ type: `${type}.result`, id, ok: false, error: 'policy-denied', reason } as NappletMessage);
}

/** NAP-GAMEPAD: no request/result pairs; a subscribe gets the "blocked" snapshot. */
const gamepadBlocked: DenialProjection = () => (
  { type: 'gamepad.state', available: false, reason: 'blocked', focused: false, pads: [] } as NappletMessage
);

const POLICY_DENIALS: Readonly<Record<string, DenialProjection>> = Object.freeze({
  ...Object.fromEntries(CVM_REQUESTS.map((type) => [type, resultError(type, 'policy denied')])),
  'relay.subscribe': closed('relay.closed'),
  'relay.close': silent,
  'relay.publish': resultError('relay.publish', undefined, { ok: false }),
  'relay.publishEncrypted': resultError('relay.publishEncrypted', undefined, { ok: false }),
  'relay.query': resultError('relay.query'),
  'outbox.getEvent': resultError('outbox.getEvent'),
  'outbox.query': resultError('outbox.query', undefined, { events: [] }),
  'outbox.subscribe': closed('outbox.closed'),
  'outbox.close': silent,
  'outbox.publish': resultError('outbox.publish', undefined, { ok: false }),
  'outbox.resolveRelays': resultError('outbox.resolveRelays', undefined, { plan: { relays: [], source: 'policy' } }),
  'upload.info': resultError('upload.info'),
  'upload.upload': resultError('upload.upload'),
  'upload.status': resultError('upload.status'),
  'keys.registerAction': keysRegisterAction,
  'keys.forward': silent,
  'keys.unregisterAction': silent,
  'media.session.create': resultError('media.session.create'),
  ...Object.fromEntries(MEDIA_NOTICES.map((type) => [type, silent])),
  'config.registerSchema': resultError('config.registerSchema', undefined, { ok: false }),
  ...Object.fromEntries(CONFIG_NOTICES.map((type) => [type, silent])),
  'count.query': (id, reason) => ({ type: 'count.query.result', id, ok: false, error: 'policy-denied', reason } as NappletMessage),
  'notify.send': resultError('notify.send'),
  'notify.permission.request': (id) => ({ type: 'notify.permission.result', id, granted: false } as NappletMessage),
  'notify.dismiss': silent,
  'notify.badge': silent,
  'notify.channel.register': silent,
  ...Object.fromEntries(DM_REQUESTS.map((type) => [type, resultError(type)])),
  ...Object.fromEntries(FS_REQUESTS.map((type) => [type, resultError(type, 'policy-denied')])),
  // Domains ACL does not gate; only the legacy Firewall reaches these (kehto/web#494).
  ...Object.fromEntries(COMMON_ACTIONS.map((type) => [type, resultError(type, undefined, { ok: false })])),
  'common.getProfile': commonGetProfile,
  'common.follows': resultError('common.follows', undefined, { ok: false, pubkeys: [] }),
  'lists.supported': resultError('lists.supported', 'policy-denied'),
  'lists.add': listsMutation('lists.add'),
  'lists.remove': listsMutation('lists.remove'),
  ...Object.fromEntries(SESSION_REQUESTS.map((type) => [type, resultError(type)])),
  'link.open': resultError('link.open', undefined, { status: 'denied' }),
  'gamepad.subscribe': gamepadBlocked,
  'gamepad.unsubscribe': silent,
});

/**
 * Project a denied napplet request onto its owning NAP's failure wire.
 *
 * @param message - The denied napplet-to-shell envelope.
 * @param reason - Runtime diagnostic, used only where the NAP has no fixed code.
 * @returns The denial envelope, `null` when the NAP defines no reply, or
 *   `undefined` when no NAP-specific row exists for this type.
 * @example
 * createPolicyDenialResult({ type: 'cvm.request', id: 'denied-1' } as NappletMessage, 'denied: cvm:call');
 * // => { type: 'cvm.request.result', id: 'denied-1', error: 'policy denied' }
 */
export function createPolicyDenialResult(message: NappletMessage, reason: string): NappletMessage | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(POLICY_DENIALS, message.type)) return undefined;
  const rawId = (message as NappletMessage & { id?: unknown }).id;
  return POLICY_DENIALS[message.type](typeof rawId === 'string' ? rawId : '', reason, message);
}

/**
 * Napplet-to-shell types per capability-gated domain, from each NAP's wire
 * table: NAP-RELAY #2 @ 9f30b350, NAP-COUNT #69 @ 9353a0c6, NAP-KEYS #9 @
 * 8869a4cf, NAP-MEDIA #10 @ 7806f438, NAP-NOTIFY #11 @ 67877ef6, NAP-STORAGE #3
 * @ 4f4cf0ca, NAP-CONFIG #14 @ bed9cb5b, NAP-RESOURCE #80 @ ae5b9c64, NAP-CVM
 * #31 @ 28cf1bdb, NAP-OUTBOX #32 @ 8865f73d, NAP-UPLOAD #33 @ f5cc981e, NAP-DM
 * #74 @ 2c4e4423, NAP-FS #88 @ bd1b9e91, NAP-LLM #134 @ 5e93bdfc, NAP-COMMON
 * #67 @ 8cd0eae8, NAP-LISTS #68 @ 7cf00cdb, NAP-SERIAL #61 @ 0c6e88ab, NAP-BLE
 * #62 @ b46b8691, NAP-WEBRTC #59 @ fb4dd6f0, NAP-LINK #53 @ 100e5c93,
 * NAP-GAMEPAD #130 @ 0b28f77e, and NAP-IDENTITY / NAP-INC / NAP-THEME /
 * NAP-INTENT on master @ 377bf939. Every runtime-dispatched domain has a row,
 * so a firewall drop of a defined request gets the reply its NAP defines (or
 * none, where the NAP defines none).
 */
const NAPPLET_REQUEST_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  relay: ['subscribe', 'close', 'publish', 'publishEncrypted', 'query'],
  count: ['query'],
  identity: ['getPublicKey', 'getRelays', 'getProfile', 'getFollows', 'getList', 'getZaps', 'getMutes', 'getBlocked', 'getBadges'],
  keys: ['forward', 'registerAction', 'unregisterAction'],
  media: ['session.create', 'session.update', 'session.destroy', 'state', 'capabilities', 'command'],
  notify: ['send', 'dismiss', 'badge', 'channel.register', 'permission.request'],
  storage: ['get', 'set', 'remove', 'keys'],
  inc: ['emit', 'subscribe', 'unsubscribe', 'channel.open', 'channel.emit', 'channel.broadcast', 'channel.list', 'channel.close'],
  theme: ['get'],
  config: ['registerSchema', 'get', 'subscribe', 'unsubscribe', 'openSettings'],
  resource: ['info', 'bytes', 'bytesMany', 'cancel'],
  cvm: CVM_REQUESTS.map((type) => type.slice('cvm.'.length)),
  outbox: ['getEvent', 'query', 'subscribe', 'close', 'publish', 'resolveRelays'],
  upload: ['info', 'upload', 'status'],
  intent: ['invoke', 'available', 'handlers'],
  dm: DM_REQUESTS.map((type) => type.slice('dm.'.length)),
  fs: FS_REQUESTS.map((type) => type.slice('fs.'.length)),
  llm: ['select', 'describe', 'generate', 'cancel'],
  common: ['getProfile', 'follows', 'follow', 'unfollow', 'react', 'report', 'encodeNip19', 'decodeNip19'],
  lists: ['supported', 'add', 'remove'],
  serial: ['open', 'write', 'close'],
  ble: ['open', 'services', 'read', 'write', 'subscribe', 'unsubscribe', 'close'],
  webrtc: ['open', 'send', 'sendBytes', 'close'],
  link: ['open'],
  gamepad: ['subscribe', 'unsubscribe'],
};

const NAPPLET_REQUEST_TYPES: ReadonlySet<string> = new Set(Object.entries(NAPPLET_REQUEST_ACTIONS)
  .flatMap(([domain, actions]) => actions.map((action) => `${domain}.${action}`)));

/**
 * Whether a denied envelope must stay silent because its owning NAP does not
 * define it as a napplet-to-shell message.
 *
 * NIP-5D (nostr-protocol/nips#2303 @ dskvr/nips@f60550c3): "Messages with an
 * unrecognized `type` MUST be silently ignored." A denial is still a reply, so
 * an unknown type gets none whether or not ACL would allow it. NAP-CVM #31 @
 * 28cf1bdb repeats it: "Truly unknown message types retain the silent-ignore
 * behavior defined by NIP-5D."
 *
 * @param message - The denied envelope.
 * @returns `true` unless the type is a napplet request its NAP defines.
 * @example
 * isSilentUnknownDenial({ type: 'notify.bogus' } as NappletMessage); // => true
 * isSilentUnknownDenial({ type: 'notify.send' } as NappletMessage); // => false
 */
export function isSilentUnknownDenial(message: NappletMessage): boolean {
  return !NAPPLET_REQUEST_TYPES.has(message.type);
}
