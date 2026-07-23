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
specs in the [`napplet/naps`](https://github.com/napplet/naps) registry. The two
NAPs core to this runtime are maintained at upstream living docs:

- NIP-5D: <https://github.com/nostr-protocol/nips/pull/2303/>
- NAP-SHELL and NAP-INTENT: <https://github.com/napplet/naps>

Local stubs (redirect to upstream): [`specs/NIP-5D.md`](specs/NIP-5D.md),
[`specs/NAP-SHELL.md`](specs/NAP-SHELL.md), [`specs/NAP-INTENT.md`](specs/NAP-INTENT.md)

Current-state delta inventory: `.planning/NIP-5D-2303-DELTA-AUDIT.md`

## NAP-INC Draft Boundary

NAP-INC remains a living draft, not a Kehto-local normative copy. Active INC
guidance is pinned to [NAP-INC PR #89 at
`4593ce9e301ce098fd3dad64206fcd6f144fa7af`](https://github.com/napplet/naps/pull/89),
the [web projection PR #90 at
`896c32c92deee68dc4d10fc1132b62df20cccb6f`](https://github.com/napplet/naps/pull/90),
and its stacked [symmetric-channel clarification PR #92 at
`c5cd06f7be6d4690b303949abb26e87ff62f4729`](https://github.com/napplet/naps/pull/92).
They are drafts; this reference records the implemented boundary and must be
re-audited if any of those heads change.

**Projection-owned query-to-text-payload transposition** occurs only in the
runtime-provided `window.napplet.inc` binding. A convention URI query becomes a
text payload map before the wire message is emitted; the runtime receives only
the stable identity. Runtime routing is exact queryless topic identity lookup:
it does not normalize, prefix/wildcard/query-match, infer a payload kind, or
intercept an `inc` topic for generic/service dispatch. A normalized
query-bearing wire or discovery identity is therefore invalid.

The runtime attests identity from the registered endpoint: delivered topic and
channel events contain a **runtime-attested dTag**, never a caller-supplied
`sender`; IDs and payloads remain opaque. Topic delivery excludes its source.
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

This Phase 102 documentation does not implement NAP-INTENT: **Phase 104** owns
every public #91 intent binding, resolution, and delivery lifecycle change.
**Phase 105** owns adoption of released convention-capable packages. Until then,
Kehto documents this draft boundary without claiming published package
conformance. Historical changelogs, migration records, and archived planning
remain historical evidence rather than active implementation drift.

> **Terminology.** The current term for an extension spec is **NAP**; the
> capability prefix is `nap:`; the cross-napplet domain is `inc`.
> The current protocol helper package is `@napplet/nap`; no current code depends
> on the old helper package. The runtime routes `inc.*` envelopes only.

## Toolchain

Kehto's runtime packages target the current `@napplet` line:

| Package                 | Version  | Role                                            |
| ----------------------- | -------- | ----------------------------------------------- |
| `@napplet/core`         | `0.28.0` | protocol types, constants, `createDispatch` / `registerNap` |
| `@napplet/nap`          | `0.28.0` | NAP capability helpers |
| `@napplet/sdk`          | `0.24.4` | napplet-side SDK (playground napplets)          |
| `@napplet/shim`         | `0.26.8` | napplet-side shim; installs injected `window.napplet.<domain>` objects |
| `@napplet/vite-plugin`  | `0.11.2` | napplet build/sign plugin |

The runtime's domain dispatcher routes via `createDispatch()` + `registerNap()`
from `@napplet/core` (the rename of the former `registerNap` / `NapHandler`
surface). `napplet/web#53` is resolved — the playground builds against
`@napplet/vite-plugin@0.11.2`.

## Content-Addressed Loading & Identity

Napplets are content-addressed. The runtime resolves and renders a napplet from
verified bytes — the gateway is never in the trust path:

1. Resolve the napplet's signed manifest event from relays via NIP-65 outbox
   relay selection (by kind + author, plus `d` for named napplets) and verify the
   event signature. Manifest kinds are `35129` (named/addressable, carries `d`),
   `15129` (root/replaceable), and `5129` (snapshot/regular).
2. Fetch each `path` blob from Blossom by sha256 and verify `sha256(blob)` equals
   the `path` tag hash.
3. Recompute the NIP-5A aggregate from the `path` tags and assert it equals the
   `["x","<hex>","aggregate"]` tag. This aggregate is the napplet's content
   address.
4. Assemble the verified `/index.html` and inject it via `iframe.srcdoc` (with the
   `connect-src` CSP as a `<meta http-equiv>` so the policy holds inside the
   opaque-origin iframe).

A napplet's identity is the `(dTag, aggregateHash)` tuple **computed** from these
verified bytes. The runtime MUST NOT accept identity from a host or gateway. Any
verification failure rejects the load — no iframe is rendered with unverified
bytes. A gateway MAY serve bytes as an accelerator, but its output is verified
against the signed manifest like any other source.

Resolution primitives live in `@kehto/nip/5a` (aggregate hash) and `@kehto/nip/5d`
(manifest parse, signature/aggregate/blob verification, `resolveNapplet`). The
manifest parser also reads the NIP-5D `archetype` (`["archetype","<slug>","<NAP-N>"]`)
and optional `source` tags into structured `archetypes` / `source` fields on
`NappletManifest`.

## Injected Domain Availability

Current NIP-5D runtime availability is expressed by a host-injected
`window.napplet` namespace. The shell prepends this bootstrap to the `srcdoc`
HTML before any authored napplet script runs. The injection is outside the
verified artifact bytes and must be limited to `window.napplet`.

`window.napplet.<domain>` presence means that the shell exposes that NAP domain
to the napplet. Absence means unavailable. Presence does not define operations,
payloads, versions, errors, or diagnostics; those stay owned by the matching NAP
spec.

The playground always injects mandatory `shell`, then adds optional domains from
the verified manifest after stripping permission/protocol entries. Demo napplets
may preflight optional availability by checking required
`window.napplet.<domain>` objects or query the cached NAP-SHELL environment.

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
the playground shim path still reads them.

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
  from the verified manifest bytes (NIP-5A aggregate), bound at iframe creation;
- manifest `requires` tags use short NAP/domain names;
- hosted `window.napplet.<domain>` presence reflects shell-provided runtime
  domain availability before authored scripts execute;
- mandatory `window.napplet.shell` is injected by every Kehto host and caches the
  parent runtime's NAP-SHELL environment for local queries;
- napplets do not receive `window.nostr`, signing keys, encryption keys, direct
  browser storage, IndexedDB, or direct relay WebSockets.

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

- **Unknown action within a known domain** — each domain handler decides. The
  default is silent-ignore (`audio`, `config`, `cvm`, `intent`, `outbox`,
  `resource`, `upload`, and `notification-service` return without replying on an
  unrecognized action).

### Sanctioned structured-error exceptions

Three response shapes are **deliberate, NAP-sanctioned exceptions** to the
silent-ignore default and are NOT divergences to normalize:

- **NAP-INTENT** (`intent` domain) — explicitly sanctions structured errors:
  `intent.*.result` envelopes MAY carry an `error` field (`"unknown archetype"`,
  `"no handler"`, `"unsupported action"`, …). See [`specs/NAP-INTENT.md`](specs/NAP-INTENT.md).

- **storage** (`packages/runtime/src/state-handler.ts`) — the canonical storage
  contract replies with `storage.<action>.result` envelopes whose optional
  `error` field signals failure; an unknown storage action returns a
  `storage.<action>.result` with `error` rather than a bare `.error`. Napplets
  check `!result.error` for success, so the `.result` envelope is the contract,
  not an information leak.

### Documented divergences (not changed)

A small set of read/query-style service handlers reply to an **unrecognized
action** with a `<type>.error` envelope rather than silently ignoring it:
`identity` (`identity-service.ts`), `media` (`media-service.ts`), and `notify`
(`notify-service.ts`). These predate the #2303 silent-ignore tightening, are
relied on by existing unit tests, and emit only a generic `"Unknown <domain>
method"` string (no internal state). Because they are query-domain handlers
responding to a correlated request `id`, and because changing them is a behavior
change outside this docs phase's scope (and not a clear-cut, risk-free
normalization), they are **documented here rather than altered**. Tightening them
to silent-ignore is a candidate for a future behavior-only change, gated on
updating their tests.

The ACL-denial and firewall-reject paths (`packages/runtime/src/runtime.ts`)
follow the same envelope-shaping rule: `storage.*` denials reply via `.result`
(with an `error` field); all other domains reply via `.error`. These are
denial responses to *recognized* messages, not unknown-`type` handling.

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
