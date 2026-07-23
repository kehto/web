# Phase 102: NAP-INC Event and Channel Parity - Pattern Map

**Mapped:** 2026-07-23  
**Files analyzed:** 12 expected modified files  
**Analogs found:** 12 / 12

## Authority and scope note

The Phase 102 requirements are owned by `naps/NAP-INC.md`. The checked local
canonical source is `napplet/naps@34ec29f` (`NAP-INC.md`, including the
convention-URI transposition addition). It requires exact routing after the
producer-side transposition of a convention URI query into a payload map.

This conflicts with the older `6461e4b` wording retained in
`.planning/REQUIREMENTS.md:105-119` and `.planning/ROADMAP.md:46-50`, which
say no query stripping. `101-PR89-INC-TRANSPOSITION-RESEARCH.md` correctly
routes the producer-side change here, but describes its authority as a draft.
The planner must make the accepted NAP ref explicit before treating the
transposition behavior as locked. Do not add runtime-side parsing, wildcard,
prefix, base/query matching, or payload schemas.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/runtime/src/inc-handler.ts` | runtime service/dispatcher | event-driven | same file `handleEmit` + channel handlers | exact |
| `packages/runtime/src/runtime.test.ts` | integration test | event-driven | same file channel round trips | exact |
| `packages/runtime/src/dispatch.test.ts` | dispatcher test | request-response/event-driven | same file INC handler block | exact |
| `packages/acl/src/resolve.ts` | policy utility | transform | same file `resolveCapabilitiesNap` INC branch | exact |
| `packages/acl/src/resolve.test.ts` | policy test | transform | same file INC capability table tests | exact |
| `packages/shell/src/napplet-namespace.ts` | injected client API | event-driven/request-response | same file `makeInc` and `request` | exact |
| `packages/shell/src/napplet-namespace.test.ts` | injected API test | event-driven | same file executed-prelude tests | exact |
| `packages/paja/src/browser-target-frame.ts` | host adapter | file-I/O/event-driven | same file `injectNappletNamespacePrelude` path | exact (consumer) |
| `packages/paja/src/browser-host.test.ts` | host integration/source guard | file-I/O/event-driven | same file prelude guard | exact |
| `apps/playground/src/shell-host.ts` | host controller | file-I/O/event-driven | same file origin registration then `srcdoc` injection | exact (consumer) |
| `tests/e2e/nap-inc.spec.ts` | E2E contract test | event-driven | same fixture/harness envelope assertions | exact |
| `tests/e2e/profile-open.spec.ts` | playground E2E | event-driven | same frame `window.napplet.inc` invocation | exact |

## Pattern Assignments

### `packages/runtime/src/inc-handler.ts` (event router and channel state)

**Analog:** the existing single-owner state machine in this file.

Keep INC state private to `createIncRuntime` (`lines 26-46`) and update it at
the handler boundary. The existing exact-topic fanout is the right routing
shape (`lines 120-135`): use `Map<string, Set<string>>`, look up only the
complete stable topic, and skip `subscriberWindowId === windowId`.

```ts
const subscribers = state.subscriptions.get(topic);
if (!subscribers) return;
for (const subscriberWindowId of subscribers) {
  if (subscriberWindowId !== windowId) {
    hooks.sendToNapplet(subscriberWindowId, {
      type: 'inc.event', topic, payload: m.payload, sender: windowId,
    } as NappletMessage);
  }
}
```

Copy this structure, but obtain `sender` from
`sessionRegistry.getEntryByWindowId(windowId)?.dTag`; do not leak the internal
window ID. The session registry is already injected into this factory. A
session-less source is rejected by `runtime.ts:309-312` before it reaches INC.

The channel index is also the direct pattern (`lines 49-82`): every added
channel is indexed under both endpoints and `removeChannel` cleans both
indexes. Preserve shell-generated IDs via `hooks.crypto.randomUUID()`
(`lines 173-182`); never accept a caller-provided ID.

Replace `resolveTarget` (`lines 84-89`) with an exact live-session dTag lookup,
not window-ID or pubkey fallback. Its successful open response (`lines
172-182`), `channel.list` entries (`lines 213-226`), and both channel-event
paths (`lines 185-210`) must all expose dTags. Target identity is an external
dTag only; window IDs and pubkeys are implementation details.

Use existing teardown sequencing (`lines 249-261`) for peer removal, but attach
the canonical `{ reason: 'peer destroyed' }` only to the surviving peer's
`inc.channel.closed` notification. Graceful close (`lines 228-241`) remains a
reason-less close to both parties. Cleanup must happen after the notifications
are composed and must remove every reverse index entry.

**Anti-patterns:** do not parse/normalize topics here; do not echo a topic
event to its sender; do not manufacture result envelopes for emit, unsubscribe,
channel emit, broadcast, or close; do not retain a `target: windowId` migration
path.

### `packages/acl/src/resolve.ts` and `resolve.test.ts` (open-time authorization)

**Analog:** `resolveCapabilitiesNap` INC branch at `resolve.ts:145-156` and
the matrix assertions at `resolve.test.ts:193-260`.

The runtime's global capability gate calls this resolver before INC dispatch.
Its current mapping assigns capabilities to `channel.emit` and
`channel.broadcast`, which would re-authorize every channel message and
contradicts NAP-INC's auth-on-open model. Copy the table-driven test style, but
make policy ownership explicit: `inc.channel.open` is the authorization point;
existing opened channels flow through the runtime without another ACL decision.
Keep ordinary topic emit/subscribe policy separate from channel membership.

The implementation planner must trace `createMessageHandler` in
`runtime.ts:296-345` while changing this mapping so the decision is made once
and no second per-message path survives.

### `packages/shell/src/napplet-namespace.ts` (injected canonical API)

**Analog:** `makeInc` at `lines 338-372`, plus the file-local `request`,
`listen`, `fire`, `id`, and `subscriptionHandle` helpers used by adjacent
domains.

The current fallback is a legacy three-argument adapter:

```ts
emit(topic: string, _extraTags?: string[][], content?: string) {
  let payload: unknown = content;
  if (typeof content === 'string' && content.length > 0) {
    try { payload = JSON.parse(content); } catch { payload = content; }
  }
  fire({ type: 'inc.emit', topic, ...(payload === undefined || payload === '' ? {} : { payload }) });
}
```

Replace this public shape with `emit(topic, payload?)`, and add the canonical
`on`, `channel.open`, `channel.list`, and `channel.broadcast` surface in this
one factory. Correlated operations should follow the established `request`
pattern: send a generated `id`, wait for the matching result envelope, and
return a handle only after validating a successful response. Fire-and-forget
operations must use `fire` alone.

For `on`, retain the local listener-before-subscribe ordering (`lines 353-371`)
and teardown composition, but pass an `IncEvent` with `topic`, `sender`, and
optional `payload` rather than synthesizing a Nostr event (`id`, `pubkey`,
`kind`, tags, JSON content). Each call needs its own listener/subscription;
do not collapse duplicate subscriptions by topic.

Convention query parsing belongs here, before `fire`: only a `napplet:` URI
with a query yields its stable queryless topic plus a string-to-string payload
map. Reject fragments, malformed percent encoding, duplicate decoded names,
and a supplied explicit payload before posting. `+` remains literal, values
remain strings, and a normal non-convention topic remains opaque and unchanged.
Never perform this conversion in `inc-handler.ts`.

### `packages/shell/src/napplet-namespace.test.ts` (executed prelude unit tests)

**Analog:** the evaluated namespace checks at `lines 450-522`, especially the
fake parent listener/postMessage capture rather than source-text-only asserts.

Add direct envelope assertions for canonical emit, including a convention URI
query converted to the stable topic/payload map; assert no postMessage on every
rejected input. Assert exact event delivery, correlated subscribe/open/list
results, closeable `on` and channel listeners, and fire-and-forget envelopes.
Use two independent callback registrations on the same topic to prove no local
deduplication. Legacy three-argument calls should be updated rather than used
as ongoing API conformance proof; package compatibility remains a Phase 104
gate.

### Runtime test ownership: `packages/runtime/src/runtime.test.ts` and `dispatch.test.ts`

**Analog:** `runtime.test.ts:52-236` sets up three real session entries via
`createNip5dSessionEntry`; each case sends envelopes through
`runtime.handleMessage` and filters `ctx.sent` by exact type/window. This is
the primary INC parity suite.

Update its existing channel cases to target/assert dTags instead of window IDs,
then add the missing lifecycle vectors: unknown dTag → correlated open failure;
event and channel sender dTag; exact query-bearing wire topic does not match a
queryless subscription; payload preservation; no sender echo; peer destruction
notifies the survivor with `reason: 'peer destroyed'`, followed by empty list
and no delivery through the removed channel.

Keep `dispatch.test.ts:660-905` for dispatcher contracts: INC reaches this
handler after the global session/policy gates, `inc.subscribe.result` echoes
the request ID, and unsubscribe/emit have no fabricated response. This test
file is also the correct place to prove the ACL mapping change does not create
per-message channel authorization.

### Host consumers: Paja and playground

**Paja analog:** `packages/paja/src/browser-target-frame.ts:67-105` registers
the source identity, resolves a trusted environment, then injects the shared
shell prelude into `srcdoc`. INC API changes should require no Paja-specific
implementation fork: it is a consumer of `@kehto/shell`'s prelude. Extend
`browser-host.test.ts:14-24` only if an integration/static assertion is needed
to guard that both pointer and URL target paths continue to call the shared
prelude; behavioral INC coverage belongs to the shell test or a focused Paja
browser test, not duplicate API implementation.

**Playground analog:** `apps/playground/src/shell-host.ts:477-509` registers the
creation-time dTag before assigning `iframe.srcdoc`, then calls
`injectNappletNamespacePrelude`. It should likewise consume the shell prelude
unchanged. Its E2E test is `tests/e2e/profile-open.spec.ts:18-46`; migrate its
ad hoc `emit(topic, extraTags, content)` invocation to canonical
`emit('napplet:profile/open', { pubkey })` only when the corresponding demo
consumer is moved to the same opaque convention topic. Do not silently retain
the old `profile:open` topic as a protocol alias.

`tests/e2e/nap-inc.spec.ts:25-78` is the fixture/harness analogue for proving
the emitted wire envelopes and correlated subscription result through a real
iframe. Add a separate multi-frame E2E only after the fixture exposes the
canonical public API; avoid overloading its current single-frame readiness
test with channel state-machine details.

## Shared Patterns

### Shell-owned identity translation

**Sources:** `packages/runtime/src/session-registry.ts:84-85`,
`packages/runtime/src/test-utils.ts:216-228`, and
`packages/runtime/src/inc-handler.ts:84-89`.

All external `sender`, `peer`, and channel-open `target` values are dTags. The
runtime maps an internally trusted source window through its session entry; it
never accepts identity from an INC envelope. Test session fixtures should
continue using `createNip5dSessionEntry(windowId, dTag, hash)` so assertions
make window-vs-dTag leaks visible.

### Correlation versus fire-and-forget

**Sources:** `packages/shell/src/napplet-namespace.ts:338-372` and
`packages/runtime/src/inc-handler.ts:138-154,172-182,213-241`.

`subscribe`, `channel.open`, and `channel.list` correlate by `id` and return
only their prescribed `*.result`; `emit`, `unsubscribe`, `channel.emit`,
`channel.broadcast`, and `channel.close` do not gain IDs or results. Closures
are shell-initiated events (`inc.channel.closed`).

### One shared injected prelude, two hosts

**Sources:** `packages/paja/src/browser-target-frame.ts:87-104` and
`apps/playground/src/shell-host.ts:506-509`.

Implement the public INC surface exactly once in `@kehto/shell`; Paja and
playground must use its injected bytes through their existing `srcdoc` paths.
This prevents host-specific wire/API drift and preserves Phase 101's
source-registration-before-execution invariant.

## Commit-wave-safe ownership

| Wave | Owned files | Why this boundary is safe |
|---|---|---|
| 1 — runtime/policy | `packages/runtime/src/inc-handler.ts`, `packages/runtime/src/runtime.test.ts`, `packages/runtime/src/dispatch.test.ts`, `packages/acl/src/resolve.ts`, `packages/acl/src/resolve.test.ts` | Owns wire routing, dTag translation, lifecycle, and the auth-on-open policy together; no shell-prelude overlap. |
| 2 — injected API | `packages/shell/src/napplet-namespace.ts`, `packages/shell/src/napplet-namespace.test.ts` | Owns all public API/query-transposition behavior and can land independently against Wave 1's stable envelopes. |
| 3 — real-host proof | `packages/paja/src/browser-host.test.ts` (only if needed), `tests/e2e/nap-inc.spec.ts`, `tests/e2e/profile-open.spec.ts` | Changes host-facing expectations after the shared prelude exists; do not edit Paja/playground production injection unless a verified host-specific gap appears. |

`apps/playground/src/shell-host.ts` and `packages/paja/src/browser-target-frame.ts`
are reviewed consumer boundaries, not presumed production edits. Keep them out
of concurrent implementation ownership unless a test demonstrates they are not
passing the shared prelude through correctly.

## No Analog Found

| File/Concern | Role | Data Flow | Planner guidance |
|---|---|---|---|
| Canonical query-transposition parser | utility | transform | No existing parser matches NAP-INC's percent-decoding, duplicate-name, fragment, and literal-`+` rules. Create it privately inside `napplet-namespace.ts` or a tightly scoped shell utility with exhaustive unit vectors; do not adapt generic `URLSearchParams` without proving its `+` behavior. |
| Full Paja INC browser behavior test | E2E/integration test | event-driven | No existing Paja INC exercise exists. Add only if shared shell-prelude tests plus playground real-host proof cannot demonstrate Paja consumption; otherwise preserve the package boundary. |

## Metadata

**Analog search scope:** `packages/runtime`, `packages/acl`, `packages/shell`,
`packages/paja`, `apps/playground`, and `tests/e2e`  
**Files scanned:** 23 focused source/test files  
**Pattern extraction date:** 2026-07-23
