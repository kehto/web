# @kehto/runtime

## Relay approval boundary

Relay requests create an immutable destination plan before approval. Registered
services use `RelayPlanningServiceHandler`; direct adapters use
`subscribeToRelays()` and `publishToRelays()`. Approval encloses buffer/cache
delivery, encryption, signing, and transport. See [compatibility](/compatibility)
for the retained legacy diagnostics.

Scoped approvals are available through `RuntimeAdapter.permissions`, source-bound
`SessionEntry.permissionPrincipal`, and `ServiceRuntimeContext.authorizeOperation`.
The reference LINK service and declared extension routes are integrated; other
service scope migration is ongoing. `runtime.permissions.admit` and
`isAdmissionCurrent` support pre-execution interface approval; built-in interface
dispatch requires the resulting grants. Prompt budgets are independently blocking.
See [the approval guide](/firewall-approvals) for storage, cancellation,
revocation, and independent rate-budget contracts.

Browser-agnostic protocol engine for NIP-5D napplet hosting.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. Runtime APIs and NAP dispatch contracts are not final.

## Install

```bash
pnpm add @kehto/runtime @kehto/acl @napplet/core @napplet/nap
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/runtime/package.json`, `packages/runtime/src/index.ts` |
| Version | `0.29.2` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@noble/hashes`, `@noble/curves` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.32.0 <0.42.0` |
| `@napplet/nap` | `>=0.32.0 <0.41.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| Factory | `createRuntime`, `Runtime` |
| Adapter types | `RuntimeAdapter`, `SendToNapplet`, `RelayPoolAdapter`, `CacheAdapter`, `AuthAdapter`, `Signer`, `ConfigAdapter`, `HotkeyAdapter`, `CryptoAdapter`, `WindowManagerAdapter`, `RelayConfigAdapter`, `DmAdapter` |
| Enforcement | `createEnforceGate`, `createNapEnforceGate`, `resolveCapabilitiesNap`, `formatDenialReason`, `EnforceResult`, `EnforceConfig`, `NapEnforceConfig`, `IdentityResolver`, `AclChecker`, `NapMessage` |
| Session and manifests | `createSessionRegistry`, `createNappKeyRegistry`, `createManifestCache`, `SessionRegistry`, `NappKeyRegistry`, `ManifestCache` |
| State and replay | `createAclState`, `handleStorageNap`, `cleanupNappState`, `createReplayDetector`, `createEventBuffer`, `matchesFilter`, `matchesAnyFilter`, `RING_BUFFER_SIZE` |
| Service dispatch | `routeServiceMessage`, `notifyServiceWindowDestroyed`, `ServiceHandler`, `ServiceRegistry`, `ServiceInfo` |
| Re-exports | `Capability`, `ALL_CAPABILITIES`, `ServiceDescriptor` |

## Scope Boundaries

- Owns message dispatch, ACL gates, service routing, storage handling, manifest cache, replay checks, and runtime lifecycle.
- `aclState.setStateQuota(pubkey, dTag, aggregateHash, bytes)` updates the live
  principal-scoped storage quota without changing grants, blocking, or stored data.
  Accepts safe integer byte counts from zero through `Number.MAX_SAFE_INTEGER`;
  invalid input throws `RangeError` before mutation. Save with `persist()`.
  Storage enforcement counts UTF-8 bytes including scoped keys; reducing the
  quota does not evict values. This host API conforms to [NAP-STORAGE draft #3
  at `4f4cf0ca7ecbd24c284a5d63bcd85e3de6af37ca`](https://github.com/napplet/naps/blob/4f4cf0ca7ecbd24c284a5d63bcd85e3de6af37ca/naps/NAP-STORAGE.md).

- Optional host-owned limiters implement `TemporalPolicy`; runtime never imports
  their implementation. See Independent rate limits below for explicit setup.
- ACL listing and lookup return `AclEntryExternal` with required `dTag` and
  `aggregateHash` fields. Feed those fields into keyed revoke/block/quota methods;
  listing `pubkey` remains empty because it is not the principal key. Results are
  detached copies, remain identifiable after reload, and preserve existing
  serialized keys. Custom producers must provide the two identity fields.

- `RuntimeAdapter.aclDefaultPolicy` sets the policy for identities with no stored
  entry. `'restrictive'` starts them with nothing granted. When it's omitted, the
  policy is `'permissive'` unless persisted ACL state stores another one. When it's
  set, it replaces the policy in persisted state on load, so an earlier permissive
  save can't reopen a restrictive host. Stored entries are kept as they are, so a
  host moving to `'restrictive'` should clear entries it no longer trusts. With
  `RuntimeAdapter.permissions` it's a ceiling: admission can still approve an interface,
  but an operation the ACL denies is refused with no prompt until the host grants the
  capability.
- ACL mutations and revoke/block observers take effect in memory before an
  explicit save. `aclState.persist()` and `aclState.clear()` return `true` when
  their synchronous backend call succeeds and `false` when it throws. Failure
  retains the live change; reload can still restore the prior durable policy.
  Check the result and retry after correcting storage. `clear()` resets live
  state to the configured default even when its backend call fails. Runtime
  teardown remains best-effort. This is host API policy, outside the NAP wire.

- Revoking `relay:read` or blocking a principal retires ordinary relay subscriptions
  across its exact `dTag` and aggregate hash, closes service/adapter backends, and
  sends `relay.closed` with reason `denied: relay:read`. Events and EOSE queued by
  retired subscriptions remain suppressed after regrant and `subId` reuse.
  This host policy conforms to [NAP-RELAY draft PR #2 at
  `9f30b3505335a52c574ff570576687d6467021ff`](https://github.com/napplet/naps/blob/9f30b3505335a52c574ff570576687d6467021ff/naps/NAP-RELAY.md).
- Follows draft NAP-RELAY PR #2 at
  `0be8abce18beb46ca37bd4ddd042f58d30b4eedc`: `relay.publish` accepts an
  unsigned template, signs it through the shell-owned signer, publishes only
  the signed event, and returns canonical `{ ok, event, eventId }` or
  `{ ok: false, error }`. Async relay adapters settle before success is
  reported; failures are not buffered and release their pending replay
  reservation so the same deterministic signed event can be retried.
- Passes the originating runtime window to `AuthAdapter.getSigner(windowId?)`
  when available. This is policy-neutral context for host runtimes; Kehto does
  not prescribe prompting, persistence, grant scope, or denial policy.
- Routes the NAP-COUNT `count.query` domain through a registered `count` service. The runtime validates non-empty filters and returns `count.query.result` refusals such as `invalid-filter` or `count-unavailable` instead of emulating counts by fetching event payloads.
- Keeps ACL and firewall rejection of `outbox.query` on the canonical
  `outbox.query.result` wire with the request `id`, `events: []`, and `error`, as
  defined by draft [NAP-OUTBOX PR #32 at
  `4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e`](https://github.com/napplet/naps/pull/32).
- Routes service-only NAP domains such as `dm` and `fs` through registered handlers, so protocol backends stay outside core runtime dispatch.
- Does not own browser `window`, iframe creation, DOM, `postMessage` listeners, or localStorage implementation details.
- Browser concerns live in `@kehto/shell`.

## Registered extension routing

Outside the built-in NAP domains, a service needs an exact
`ServiceHandler.messageCapabilities` map and an explicit `isDomainAllowed` grant.
Each inbound type maps to an existing ACL capability or explicit `null`. The
runtime checks the live source, block state, declared ACL requirement, and
firewall before delivery. Unknown types are silent; denial does not invent an
extension error envelope. Static and dynamic registration follow the same path.
Pending replies remain bound to that registration and source lifecycle and
recheck current domain/ACL policy. Built-in NAP routing retains its own contracts.
Shell -> napplet pushes into a custom domain require an exact
`ServiceHandler.pushCapabilities` map and go through
`ServiceRuntimeContext.sendToEligibleNapplet`, which applies the same source,
domain-grant, and ACL gates and returns whether the push was delivered.

When a registered `relay` service accepts a `relay.publish`, that service owns
storage and fan-out of the event (publisher echo, per-subscription relay scope);
the runtime ring buffer only fans out publishes it coordinates itself through the
adapter relay pool.

Registration is not namespace injection or capability authorization. The host
owns the extension's protocol and, for browsers, its pre-execution binding.
`routeServiceMessage` bypasses policy and must not handle untrusted ingress.
See [Register a service](/how-tos/register-service#domains-outside-the-built-in-dispatcher)
for examples, lifecycle rules, and specification bounds.

## API Reference

### Registration and initialization limits

`sessionRegistry.unregister(windowId)` removes registration and lookup state for
that window, including the empty-pubkey NIP-5D path, and clears its pending update.
It is idempotent and preserves a newer window's lookup when both share a pubkey.
Use `getEntryByWindowId` for per-window identity in that case.

Each trusted `runtime.sessionRegistry.register(windowId, entry)` starts a fresh
initialization budget, even when a replacement iframe retains the logical window
ID. Duplicate `shell.ready` messages do not re-register a live source, and neither
request fields nor `destroyWindow()` alone reset the budget. An explicitly installed legacy adapter using its suggested startup
guard rejects operation 21 within three seconds; ordinary per-napplet rate
limits remain shared across registrations and versions.

`createSessionRegistry(notifier?, onRegister?)` supports a host registration callback.
When a legacy adapter is explicitly installed, runtime calls its `resetInitBudget(windowId)`, which retires only
that startup counter. Custom `FirewallStateContainer` implementations must implement
`resetInitBudget(initKey)` while preserving other counters and policy.

This is Kehto host policy, conformant with the source-bound, idempotent lifecycle in
[NAP-SHELL at `a040914`](https://github.com/napplet/naps/blob/a040914b4bbd3a5cd8a14b0f316a723c968ebfb2/naps/NAP-SHELL.md).
It changes no NIP-5D wire messages or NAP-THEME result behavior.

- Generated module: <a href="../api/modules/_kehto_runtime.html" target="_self"><code>docs/api/modules/_kehto_runtime.html</code></a>

## GAMEPAD integration

This non-normative guidance defers to the living [NAP-GAMEPAD](https://github.com/napplet/naps/pull/108). Services export `createGamepadService` and `browserGamepadOptions`; shell exports `denyNappletControllerAccess`. Paja registers one host reader and denies native gamepad/HID/USB paths before frame execution. Source-bound subscriptions receive immediate full snapshots; only the visible host's input owner gets live controls. Focus loss supplies neutral controls and timestamp zero; unsubscribe, window destruction, and service removal release polling. Non-browser or denied native readers report the proposal's unavailable reasons. See [Controller input](https://github.com/kehto/web/blob/main/docs/gamepad.md).

## LLM integration

This non-normative guidance defers to the living [NAP-LLM](https://github.com/napplet/naps/pull/134) (checked at `5e93bdf`). Services export `createLlmService`, `LlmServiceError`, the provider mappers and `LLM_PROVIDER_PRESETS`; shell exports `getShellDomainState` and the `LlmHooks` adapter field; acl exports `llm:generate`. The runtime routes `llm.*` to one registered service and answers every sanctioned request with exactly one `llm.<op>.result`, shaping missing-service and ACL failures as `{ code: 'unsupported' }`. Hosts implement `LlmConnectionHost`; the service enforces schema, handle ownership, a per-window live-handle bound (`maxHandlesPerWindow`), consent before submission, duplicate ids, cancellation and deadline races, ordered deltas and safe errors, and passes `select`/`authorize` a `{ signal }` that withdraws stale prompts. `createHttpLlmProvider({ stream: true })` streams provider output into `llm.delta` as block start/delta/end events. Results carry `content` parts (text, thinking and tool calls); tool calls and results are validated and relayed, and Kehto never executes one. Advertisement stays binary on the wire while hosts report a third `unconfigured` state until the user adds a connection. See [Language models](https://github.com/kehto/web/blob/main/docs/llm.md).

## Media sessions

See [Media playback](https://github.com/kehto/web/blob/main/docs/media.md) for NAP-MEDIA draft authority, shell-owned audio/video,
shared host controls, endpoint cleanup, and command API migration.

## Independent rate limits

Rate limiting is optional and lives in `@kehto/rate-limit`, not runtime or Firewall.
Supply `PermissionAdapter.rateLimiter` and/or `promptRateLimiter` to opt in;
omitting either installs no default counters or limits for that traffic.

```ts
import { createRateLimiter, defaultRateLimitConfig } from '@kehto/rate-limit';
const limiter = createRateLimiter(defaultRateLimitConfig());
const permissions = { ...approvalAdapter, rateLimiter: limiter };
limiter.setConfig({ ...limiter.config, unfocusedMultiplier: 0.5 });
```

Hold the limiter to inspect `config` or call `setConfig`, which validates without
resetting counters. Runtime passes trusted identity/lifecycle observations and
retires lifecycle counters on teardown. Approval, ACL and source checks remain
independent. Without scoped permissions, hosts may explicitly install
`legacyFirewall` from `@kehto/rate-limit/legacy`; the default installs neither.

### Cancelling one approved operation

Services may pass a request-owned signal as the fifth argument to
`ServiceRuntimeContext.authorizeOperation(windowId, operation, requirements,
execute, signal)`. Aborting it settles that request as `cancelled`, dismisses its
prompt through the prompt signal, and aborts the signal passed to `execute`.
Sibling requests keep their own lifetimes. Late approval answers cannot create
grants; late action results are discarded. The service must still observe the
execution signal before each later side effect and apply its protocol's
cancellation response rules.

A cancelled queued request settles immediately, but later equivalent requests
still wait behind the active prompt. Retained queue entries count toward the
queue bound until their predecessor settles. Request listeners are removed when
the operation settles. An already-aborted signal never opens a prompt or invokes
the action.

Registered extensions revalidate their exact capability declaration after approval
and before sending deferred replies. Replacing, removing, or changing that
declaration invalidates the captured operation; a late answer grants nothing.
