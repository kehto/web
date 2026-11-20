# Kehto Runtime Protocol Reference

This document is an internal reference for Kehto's active NIP-5D runtime model.
It is not an independent protocol authority.

Authoritative source for NIP-5D conformance:
[`nostr-protocol/nips` PR **#2303**](https://github.com/nostr-protocol/nips/pull/2303)
(`5D.md`), with the NIP-5A "Aggregate Hash" from
[`nostr-protocol/nips`](https://github.com/nostr-protocol/nips/blob/master/5A.md)
(`5A.md`). Content-addressed resolution adopted in milestone v1.20; NAP-SHELL /
NAP-INTENT conformance in v1.21. The current draft also includes the injected
domain-object clarification from `dskvr/nips#4`, merged into the NIP-5D branch
behind PR #2303 on 2026-06-26.

Protocol message domains are defined by **NAP** (Nostr Applet Protocol) extension
specs in the [`napplet/naps`](https://github.com/napplet/naps) registry. Active
authority for NAP-INTENT, NAP-INC, NAP-IDENTITY, NAP-THEME, and NAP-SHELL is
merged `napplet/naps` master
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`. The core NAP references are:

- NIP-5D: <https://github.com/nostr-protocol/nips/pull/2303/>
- NAP-SHELL and NAP-INTENT: <https://github.com/napplet/naps>

Local stubs (redirect to upstream): [`specs/NIP-5D.md`](specs/NIP-5D.md),
[`specs/NAP-SHELL.md`](specs/NAP-SHELL.md), [`specs/NAP-INTENT.md`](specs/NAP-INTENT.md)

Current-state delta inventory: `.planning/NIP-5D-2303-DELTA-AUDIT.md`

## NAP-INC Boundary

NAP-INC remains marked draft, not a Kehto-local normative copy. Active INC
guidance is pinned to merged
[`naps/NAP-INC.md`](https://github.com/napplet/naps/blob/377bf939c6c906817084b43dd21d424de646dbc2/naps/NAP-INC.md)
on `napplet/naps` master
`377bf939c6c906817084b43dd21d424de646dbc2`. This reference records the
implemented boundary and must be re-audited when that source changes.

**Published-projection query-to-text-payload transposition** occurs only in the
runtime-provided `window.napplet.inc` binding. A convention URI query becomes a
text payload map before the wire message is emitted; the runtime receives only
the exact stable convention topic identity. Runtime routing is exact lookup: it routes an
opaque topic, including `?` and `#`, by its complete text and does not
normalize, prefix/wildcard/query-match, infer a payload kind, or intercept an
`inc` topic for generic/service dispatch. A normalized query-bearing convention
wire or discovery identity is therefore invalid.

The runtime attests identity from the registered endpoint: delivered topic and
channel events contain a **runtime-attested endpoint identifier**, never a caller-supplied
`sender`; IDs and payloads remain opaque. Topic delivery excludes its source.
`target`, `sender`, and `peer` are runtime-assigned endpoint identifiers: opaque text, one per live registered
endpoint, taken from the injected `crypto.randomUUID`, and carrying no manifest `d` tag, artifact hash, window ID,
instance ID, or ordering. An identifier is assigned on first use, lasts until that registration is replaced or
unregistered, and is never reused; a replacement registration is a new endpoint whose old channels close as
`peer destroyed`. Root and snapshot manifests without a `d` tag get identifiers like any other endpoint. A `d` tag is
never resolved as a channel target (`KEHTO_INC_DTAG_TARGET_RETIRED` in
[the compatibility register](https://github.com/kehto/web/blob/main/docs/compatibility.md)). Napplets learn a peer
from an attested `sender`/`peer`; a host selects one with `Runtime.getIncEndpointId(windowId)`.
Channel ACL authorization is open-only: target liveness and policy are checked
at `inc.channel.open`, not per message. A target receives
`inc.channel.opened` before the opener result, after which both endpoints hold
equivalent handles. `channel.onOpened`, handle `on`, and `onClosed` retain
inbound/early/terminal lifecycle state in order; bounded retention closes on
overflow, and deterministic close/endpoint destruction tears down both sides.
`channel.list` is informational only, not an authorization or liveness oracle.

The downstream ambiguity tracker is
[`kehto/web#203`](https://github.com/kehto/web/issues/203), with the upstream
resolution recorded in [its clarification reply](https://github.com/kehto/web/issues/203#issuecomment-5060904495).
The obsolete opener-only interpretation is not current guidance.

NAP-INTENT uses structured requests and a single final result after target
selection, readiness, and convention dispatch. The selected convention reaches
the target over runtime-attested NAP-INC; no separate intent delivery lifecycle
exists. Historical changelogs, migration records, and archived planning remain
historical evidence rather than active implementation guidance.

> **Terminology.** The current term for an extension spec is **NAP**; the
> capability prefix is `nap:`; the cross-napplet domain is `inc`.
> The current protocol helper package is `@napplet/nap`; no current code depends
> on the old helper package. The runtime routes active NAP envelopes, including
> `inc.*` and `intent.*`.

## Toolchain

Kehto's runtime packages target the current `@napplet` line:

| Package                 | Version  | Role                                            |
| ----------------------- | -------- | ----------------------------------------------- |
| `@napplet/core`         | `0.38.0` | host packages (`packages/*`): protocol types, constants, `createDispatch` / `registerNap` |
| `@napplet/nap`          | `0.37.0` | host packages: NAP capability helpers and the packaged `llm` types |
| `@napplet/core` / `@napplet/nap` | `0.32.0` | fixture napplets (`tests/fixtures/napplets/*`) keep the exact 0.32.0 pins |
| `@napplet/sdk`          | `0.28.0` | napplet-side SDK (fixture napplets)             |
| `@napplet/shim`         | `0.30.0` | generic non-shell NAP domains; does not supply mandatory shell |
| `@napplet/vite-plugin`  | `0.16.2` | napplet build/sign plugin (NIP-5D presentation media and source pins) |
| `@napplet/conformance`  | `0.20.5` | registry-audited conformance artifact; not a Kehto dependency |

The runtime's domain dispatcher routes via `createDispatch()` + `registerNap()`
from `@napplet/core` (the rename of the former `registerNap` / `NapHandler`
surface). The NAP-INTENT patch artifacts are from napplet/web#199 source
`3037200c932488f14f7f369b8583c39c9c16510a`, merged as
`b3f0007867eac109fa4917fac9c285d3b7cc6155`, and Version Packages #198 head
`a79e7f4638f70f4557d4183faee9348847bb8cc7`, merged as release source
`dc1d24153c759152b6ba31a6ec9bea967798f2df`.

## Published Intent Contract

NAP-INTENT public `Intent*` request, result, and catalog types are the canonical
published core / nap declarations (the 0.32.0 line for fixture napplets; host packages build on core 0.38.0 / nap 0.37.0); Kehto retains no local mirror.
`intent.invoke` accepts a structured `IntentRequest`, defaults `action` to
`open`, and produces one final `IntentResult` after target selection, readiness,
and convention dispatch. A successful result includes `handled`, `handler`,
`windowId`, and `convention`; the target receives the selected convention
through runtime-attested `inc.event`.

The request `archetype` selects the handler role, while `convention` shapes the
opaque payload. They are orthogonal N:M values: a manifest role may advertise a
convention whose URI archetype token differs from that role's slug.

## Content-Addressed Loading & Identity

Napplets are content-addressed. The runtime resolves and renders a napplet from
verified bytes — the gateway is never in the trust path:

1. Resolve the napplet's signed manifest event from relays via NIP-65 outbox
   relay selection (by kind + author, plus `d` for named napplets) and verify the
   event signature. Manifest kinds are `35129` (named/addressable, carries `d`),
   `15129` (root/replaceable), and `5129` (snapshot/regular).
2. Require one lowercase-hex `x` hash, fetch the `/index.html` blob from Blossom,
   and verify its SHA-256 against the signed hash.
3. Bind `(dTag, artifactHash)` before execution. Existing Kehto host, ACL, and cache
   APIs call this field `aggregateHash`; for current events it is the artifact hash.
4. Inject the verified bytes through `iframe.srcdoc`, adding the runtime namespace
   and CSP outside the bytes used to compute identity. Gateways remain untrusted.

`@kehto/nip/5d` normalizes current events and explicit legacy aggregate events.
Legacy parsing and NIP-5A verification live in `legacy-manifest.ts`; loaders and
caches share signature and blob checks across both formats. Legacy identity stays
unchanged. See [event-schema migration](docs/migrations/NIP-5D-EVENT-SCHEMA.md).

Current `content` is a plain-text description. `z` and `i` advertise independent
roles and accepted intents, including parameter names; their N:M projection feeds
the intent catalog. `R` requirements are checked against host availability; `O`
integrations never block load. Neither grants capabilities. Icons remain generic
unless verified and decoded independently; lineage and HTML metadata never supply
execution authority. NAP-SHELL is always available regardless of declarations.

## Injected Domain Availability

Current NIP-5D runtime availability is expressed by a host-injected
`window.napplet` namespace. The shell prepends this bootstrap to the `srcdoc`
HTML before any authored napplet script runs. The injection is outside the
verified artifact bytes and must be limited to `window.napplet`.

`window.napplet.<domain>` presence means that the shell exposes that NAP domain
to the napplet. Absence means unavailable. Presence does not define operations,
payloads, versions, errors, or diagnostics; those stay owned by the matching NAP
spec.

Hosts such as Paja inject mandatory `shell`, then add optional domains from
the verified manifest after stripping permission/protocol entries. Napplets
may preflight optional availability by checking required
`window.napplet.<domain>` objects or query the cached NAP-SHELL environment.

### Published shell-package exception

NAP-SHELL at `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24` remains mandatory.
The pinned shim 0.30.0 and the fixture-line core 0.32.0 omit a generic mandatory
`window.napplet.shell` surface, so Kehto retains its host-owned, parent-bound
prelude. This is a locked upstream package-drift exception, not a claim that
the shim supplies shell.

## NAP-SHELL Handshake

Every napplet bootstraps through the mandatory NAP-SHELL two-message handshake
(see [`specs/NAP-SHELL.md`](specs/NAP-SHELL.md)):

1. The napplet posts `{ "type": "shell.ready" }` once its receiver is live.
2. The runtime establishes the session (bound to the creation-time NIP-5A
   identity) and replies **exactly once** with `shell.init`, carrying the
   capability environment and `services`.

`shell.init` is sent exactly once per napplet lifecycle. A duplicate `shell.ready`
from the same registered window lifecycle is idempotent — no second session and no
`shell.init` resend.

### Capability environment shape

`shell.init` carries Kehto's NAP-SHELL capability environment:

```ts
capabilities: {
  domains: string[],                    // bare NAP domains, e.g. ['relay','identity','inc',…]
  protocols: Record<string, string[]>,  // numbered protocols, e.g. { inc: ['NAP-01'…'NAP-06'] }
}
```

`shell.supports('relay')` resolves locally against `domains`, and
`shell.supports('inc','NAP-01')` resolves locally against `protocols['inc']`.
For older consumers, Kehto also emits the flat `naps` and empty `sandbox` fields.
Host-extended `perm:`-prefixed `sandbox` entries are folded into `domains`.
Removal of the legacy fields is tracked as CLEANUP-01 and is NOT performed while
a supported consumer still reads them.

## Active Runtime Model

Kehto hosts napplets as sandboxed iframes and routes JSON object envelopes over
`postMessage`.

The active NIP-5D primitives are:

- iframe sandbox baseline is `allow-scripts`;
- `allow-same-origin` is forbidden;
- both directions use `postMessage(message, '*')`;
- shell trust is derived from `MessageEvent.source`, not `event.origin`;
- active wire messages are objects with a string `type` in `domain.action` form;
- unknown sources and unrecognized `type` values are silently ignored (see
  [Unknown-`type` handling](#unknown-type-handling));
- napplet identity is the `(dTag, aggregateHash)` tuple computed by the runtime
  from verified artifact bytes (legacy: NIP-5A aggregate), bound at iframe creation;
- manifest `R`/`O` tags use bare NAP domains (legacy: `requires`);
- hosted `window.napplet.<domain>` presence reflects shell-provided runtime
  domain availability before authored scripts execute;
- mandatory `window.napplet.shell` is injected by every Kehto host and caches the
  parent runtime's NAP-SHELL environment for local queries;
- napplets do not receive `window.nostr`, signing keys, encryption keys, direct
  browser storage, IndexedDB, or direct relay WebSockets.

## Encrypted publish

`relay.publishEncrypted` fails closed (kehto/web#482). NAP-RELAY #2 at
`9f30b350` says "The shell MUST encrypt content and sign event templates from
`relay.publishEncrypted`", and a failed publish is a `.result` with `ok: false`
and `error`. If the signer has no `encrypt` for the requested scheme, the reply
is `ok: false`, `error: "encryption unavailable: <scheme>"`, before any approval
prompt or relay plan. If `encrypt` yields no string, an empty string or the
plaintext itself, the reply is `ok: false`, `error: "encryption failed"`.
Either way nothing is signed or published. The NAP has no fixed error codes
here, so these strings are Kehto's diagnostics. Spec-gap decision: the API
text's "NIP-44 by default, NIP-04 as fallback" is read as naming the
alternative value. An omitted `encryption` with a signer that only has NIP-04
still fails, and Kehto never downgrades silently.

## Unknown-`type` handling

NIP-5D requires that messages with an unrecognized `type` be **silently ignored**,
both to keep the protocol forward-compatible and to prevent capability probing.
A NAP MAY define error envelopes only for the messages it recognizes.

Kehto applies this rule on two levels:

- **Unknown domain** — the domain dispatcher
  (`createNapEnvelopeDispatcher`, `packages/runtime/src/runtime.ts`) registers a
  handler per known NAP domain via `registerNap`. An envelope whose `domain`
  segment matches no registered NAP is silently dropped (no reply). Envelopes
  without a `.` separator, or non-object messages, are also dropped.

- **Unknown action within a known domain** — silently dropped by every runtime
  handler and every `@kehto/services` reference service (kehto/web#465). A
  service drops the message and calls the shared
  `createUnrecognizedTypeDiagnostic()` from `@kehto/runtime`, which warns the
  host once per domain/type as `[KEHTO_UNRECOGNIZED_MESSAGE_TYPE]`, at most 16
  types per instance, without payloads or ids. That includes the retired
  `storage.clear` (not in NAP-STORAGE #3 `4f4cf0ca`) and a `webrtc.stats`
  request (NAP-WEBRTC #59 `fb4dd6f0` defines `stats` only as a pushed event).
  `tests/unit/nip5d-conformance-guard.test.ts` drives every reference service,
  the runtime with and without ACL denial, every NAP mock and the Paja
  multiplayer stubs with undefined types and fails on any reply.

A NAP may define error results only for messages it recognizes. A known type
with a malformed payload still gets its domain's specified failure result: for
example `storage.<action>.result` with `error`, structured `intent.*.result`
errors, or `webrtc.sendBytes.result` with `"unsupported"` on a shell without
byte payloads, as NAP-WEBRTC requires.

The ACL-denial and firewall-reject paths (`packages/runtime/src/runtime.ts`,
`legacy-firewall-gate.ts`) answer *recognized* requests on the owning NAP's
failure wire. `storage.*`, `inc.subscribe`/`inc.channel.open`, `intent.*`,
`llm.*` and runtime-owned `identity.*`/`theme.*` keep their existing shapes.
`packages/runtime/src/policy-denials.ts` holds one row per exact request type,
with the napplet/naps ref and sentence it implements:

| Domain | Ref | Denial wire |
|--------|-----|-------------|
| `cvm` | #31 `28cf1bdb` | matching `.result`, `error: "policy denied"`, no success fields |
| `relay` | #2 `9f30b350` | `publish`/`publishEncrypted` → `.result` `ok: false`; `query` → `.result` `error`; `subscribe` → `relay.closed`; `close` silent |
| `outbox` | #32 `8865f73d` | `getEvent`/`query`/`publish`/`resolveRelays` → `.result` (`events: []` for query, `ok: false` for publish, `plan: { relays: [], source: "policy" }` for resolveRelays); `subscribe` → `outbox.closed`; `close` silent |
| `upload` | #33 `f5cc981e` | `info`/`upload`/`status` → `.result` with top-level `error` only |
| `keys` | #9 `8869a4cf` | `registerAction` → `.result` echoing `actionId`, `error`, no `binding`; `forward`/`unregisterAction` silent |
| `media` | #10 `7806f438` | `session.create` → `.result` with `error`; `session.update`/`session.destroy`/`state`/`capabilities`/`command` silent |
| `config` | #14 `bed9cb5b` | `registerSchema` → `.result` `ok: false`, `error`, no `code`; `get`/`subscribe`/`unsubscribe`/`openSettings` silent |
| `count` | #69 `9353a0c6` | `count.query.result` `ok: false`, `error: "policy-denied"`, `reason` |
| `notify` | #11 `67877ef6` | `send` → `.result` `error`; `permission.request` → `granted: false`; `dismiss`/`badge`/`channel.register` silent |
| `dm` | #74 `2c4e4423` | every request's `.result` with `error` only |
| `fs` | #88 `bd1b9e91` | every request's `.result`, `error: "policy-denied"` |
| `common` | #67 `8cd0eae8` | every request's `.result` `ok: false`, `error`; `getProfile` adds `pubkey` (hex target or `''`), `follows` adds `pubkeys: []` |
| `lists` | #68 `7cf00cdb` | `add`/`remove` → `.result` `ok: false`, `error: "policy-denied"`, `reason`; `supported` → `.result` `error: "policy-denied"` |
| `serial` | #61 `0c6e88ab` | every request's `.result` with `error` (no `session` on `open`) |
| `ble` | #62 `b46b8691` | every request's `.result` with `error` (no `session` on `open`) |
| `webrtc` | #59 `fb4dd6f0` | every request's `.result` with `error` only |
| `link` | #53 `100e5c93` | `link.open.result` `status: "denied"`, `error` |
| `gamepad` | #130 `0b28f77e` | `subscribe` → `gamepad.state` `available: false`, `reason: "blocked"`, `focused: false`, `pads: []`; `unsubscribe` silent |

The runtime's reason (`denied: <capability>` or `firewall: <reason>`) passes
through except where the NAP mandates a code or enumerates one, or separates a
machine-readable `error` code from a human `reason` (NAP-LISTS): there `error`
is `"policy-denied"` and the runtime's reason goes in `reason`.

Every request type the domains above define now has a row; none is answered with
an invented `<type>.error`. ACL does not gate `common`, `lists`, `serial`,
`ble`, `webrtc`, `link` or `gamepad`, so only the legacy Firewall gate reaches
their rows (kehto/web#494). `identity.*` has no row: both gates answer it first
with its runtime-owned safe default. `resource.*` keeps `.error`, which NAP-RESOURCE #80
defines. MEDIA has two open drafts: #133 (`8ea49c33`) is stacked on the #10
draft branch, adds torrent sources only and leaves these rows unchanged, so #10
is cited.

Spec-gap decisions (kehto/web#481), each the narrowest reply the NAP text
permits, with an upstream question for the owning draft:

- `keys.registerAction`: `actionId` is required on the result; the denial
  echoes the request's `action.id` (`''` when absent), as the NAP's error
  example does.
- `config.registerSchema`: `ok: false` with `error` and no `code`, because
  every `ConfigSchemaErrorCode` describes an invalid schema. `config.get` is
  silent: `config.values` has no `error` field and empty values would break the
  default-resolution MUST, so the napplet sees its request time out (Kehto's
  injected `config.get()` rejects after the request timeout instead of at once).
- `outbox.resolveRelays`: `plan` is required, so the denial sends the empty
  policy-derived plan the NAP allows for untrusted napplets, plus `error`.
- `upload.info`: `info` is required, so the denial sends `info: { rails: [] }`
  with `error`, the fully redacted disclosure NAP-UPLOAD allows for untrusted
  napplets (kehto/web#518).
- `upload.status`: bounded spec gap (napplet/naps#33 @ f5cc981e,
  kehto/web#518). `status` is required, but a denied lookup has no honest
  rail, state or timestamp for `UploadStatus`, so the denial sends only
  `error`, like `upload.upload`, rather than invent upload state.

Spec-gap decisions (kehto/web#494):

- `common.getProfile`: `pubkey` is required; the denial echoes a lowercase-hex
  target and sends `''` for an npub, nprofile or anything else, so a denied
  napplet gets no NIP-19 decode. `common.follows` sends `pubkeys: []`.
- `lists.*`: `error` is a machine-readable code and none of the listed codes
  names a policy denial, so the denial uses `"policy-denied"` (as NAP-COUNT and
  NAP-FS do) and puts the runtime's reason in `reason`.
- `gamepad.subscribe`: NAP-GAMEPAD has no request/result pairs but requires a
  snapshot after each subscribe, so the denial sends the `"blocked"` snapshot.

`kehto conformance` covers both gates: `catalog/acl-denial` and
`catalog/firewall-denial`.

A denied type that the owning NAP does not define as a napplet
request gets no reply in any domain (`isSilentUnknownDenial`).

## Retired Drift

Older drafts in this repo described an iframe protocol using NIP-01-like array
verbs and identity negotiation through `REGISTER`, `IDENTITY`, and `AUTH`. Those
terms do not describe active NIP-5D protocol identity.

NIP-5D identity is shell-assigned when the iframe is created. A napplet does not
negotiate protocol identity by sending `REGISTER`, answering `AUTH`, receiving
`IDENTITY`, or constructing a NIP-01 relay session.

Host-page user or signer authentication may still exist as shell-internal product
behavior. That must remain separate from NIP-5D protocol identity.

## Extension Decisions

Extension and demo-surface decisions for this milestone live in:

- `docs/policies/NIP-5D-CONFORMANCE.md`

Any remaining NIP-5D deviation must be recorded there as a deliberate NAP
extension or a demo/test-only exception.
