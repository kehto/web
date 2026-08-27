# Phase 102: NAP-INC Event and Channel Parity - Pattern Map

**Mapped:** 2026-07-23  
**Files analyzed:** 23 focused source/test files across 12 planned execution units
**Analogs found:** 12 / 12

## Authority and scope note

Phase 102 uses `naps/NAP-INC.md` at PR #89 head `4593ce9` and the web
projection at PR #90 head `896c32c`, plus symmetric channel PR #92 head
`c5cd06f`. #89 requires exact INC routing and runtime-attested sender; #90 owns
one binding-wide transposition helper; #92 defines symmetric handles,
opened/event/closed ordering, and retention. All remain draft proposed authority.
Do not add runtime-side parsing, wildcard, prefix, base/query matching, payload
schemas, or a `makeInc`-private parser. Phase 102 wires only INC; Phase 104
wires intent.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/runtime/src/inc-handler.ts` | runtime service/dispatcher | event-driven | same file `handleEmit` + channel handlers | exact |
| `packages/runtime/src/runtime.test.ts` | integration test | event-driven | same file channel round trips | exact |
| `packages/runtime/src/dispatch.test.ts` | dispatcher test | request-response/event-driven | same file INC handler block | exact |
| `packages/runtime/src/service-dispatch.ts` | generic service router | request-response | same file domain route before legacy INC fallback | exact removal seam |
| `packages/services/src/notification-service.ts` | canonical registry plus legacy adapter | request-response | `handleNotifyEnvelope` | exact preservation seam |
| `packages/acl/src/resolve.ts` | policy utility | transform | same file `resolveCapabilitiesNap` INC branch | exact |
| `packages/acl/src/resolve.test.ts` | policy test | transform | same file INC capability table tests | exact |
| `packages/shell/src/napplet-namespace.ts` | injected client API | event-driven/request-response | same file `makeInc` and `request` | exact |
| `packages/shell/src/napplet-namespace.test.ts` | injected API test | event-driven | same file executed-prelude tests | exact |
| `packages/paja/src/browser-target-frame.ts` | host adapter | file-I/O/event-driven | same file `injectNappletNamespacePrelude` path | exact (consumer) |
| `packages/paja/src/browser-host.test.ts` | host integration/source guard | file-I/O/event-driven | same file prelude guard | exact |
| `apps/playground/src/shell-host.ts` | host controller | file-I/O/event-driven | same file origin registration then `srcdoc` injection | exact (consumer) |
| `tests/e2e/nap-inc.spec.ts` | E2E contract test | event-driven | same fixture/harness envelope assertions | exact |
| `tests/e2e/profile-open.spec.ts` | future intent flow | event-driven | audited boundary only; migration belongs to Phase 105 | deferred |

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

On successful open, send target `inc.channel.opened` with the authenticated
opener dTag before sending `inc.channel.open.result`. If the target cannot
receive that push, return failure and create no usable channel. This ordering
lets both bindings materialize equivalent handles before any event or closure.

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

Define one serialized projection helper outside `makeInc`, then replace this
public shape with `emit(topic, payload?)` and add the canonical
`on`, `channel.open`, `channel.onOpened`, `channel.list`, and
`channel.broadcast` surface in this one factory. Each handle exposes
`emit/on/onClosed/close`. Correlated operations should follow the established `request`
pattern: send a generated `id`, wait for the matching result envelope, and
return a handle only after validating a successful response. Fire-and-forget
operations must use `fire` alone.

For `on`, retain the local listener-before-subscribe ordering (`lines 353-371`)
and teardown composition, but pass an `IncEvent` with `topic`, `sender`, and
optional `payload` rather than synthesizing a Nostr event (`id`, `pubkey`,
`kind`, tags, JSON content). Each call needs its own listener/subscription;
do not collapse duplicate subscriptions by topic.

Create the target handle from `inc.channel.opened`, retain it until at least
one `channel.onOpened` callback receives it, buffer early events until at least
one handle `on` callback exists, and retain terminal `inc.channel.closed` for a
later `onClosed`. If the implementation chooses finite buffers, overflow must
fire `inc.channel.close` and terminate rather than silently discard. Treat
`channel.list()` records as plain snapshots, never handles.

Convention query parsing belongs in the shared prelude binding before `fire`:
a `napplet:` URI with a query yields stable queryless identity plus a
string-to-string payload map. `makeInc` uses it now and Phase 104 must reuse it
from `makeIntent` rather than grow a second parser. Reject fragments, malformed percent
encoding, duplicate decoded names, and a supplied explicit payload before
posting. `+` remains literal and values remain strings. Never perform this
conversion in `inc-handler.ts`.

The namespace/domain proxy assignment at `lines 1136-1138,1166-1210` can
currently replace the injected INC implementation when a shim loads. Protect
INC convention operations during both INC-domain and whole-namespace
assignment. Tests must perform each replacement before calling queried INC.
Do not change intent proxy behavior until Phase 104.

### `packages/shell/src/napplet-namespace.test.ts` (executed prelude unit tests)

**Analog:** the evaluated namespace checks at `lines 450-522`, especially the
fake parent listener/postMessage capture rather than source-text-only asserts.

Add direct envelope assertions for canonical emit, including a convention URI
query converted to stable identity/payload; assert no postMessage on every
rejected input. Replace the INC domain and whole namespace with shim-shaped
objects and prove the INC binding cannot be bypassed.
Assert exact event delivery, correlated subscribe/open/list results, closeable
`on` and channel listeners, and fire-and-forget envelopes.
Use two independent callback registrations on the same topic to prove no local
deduplication. Legacy three-argument calls should be updated rather than used
as ongoing API conformance proof; package compatibility remains a Phase 105
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
unchanged and preserve the binding after bundled shim assignment. Do not
migrate `tests/e2e/profile-open.spec.ts` to canonical INC: draft #91 requires
the final profile flow to use intent invocation/delivery, which belongs to
Phase 105. Use neutral Phase 102 test endpoints for INC browser proof.

`tests/e2e/nap-inc.spec.ts:25-78` is the fixture/harness analogue for proving
the emitted wire envelopes and correlated subscription result through a real
iframe. Add a separate multi-frame E2E only after the fixture exposes the
canonical public API; avoid overloading its current single-frame readiness
test with channel state-machine details.

### Legacy prefix routes have no replacement protocol

`packages/runtime/src/service-dispatch.ts` must route service envelopes only by
`message.type` domain. Its generic `inc.emit` `topic.split(':')[0]` fallback is
not an INC subscription and must be deleted. Likewise,
`createNotificationService` keeps its direct canonical `notify.*` registry
path but drops `notifications:*`; dormant `createAudioService`, whose only
input is `audio:*`, is removed rather than mapped to an invented domain.
Active playground visualization and package/skill docs must stop recognizing
those legacy prefixes. Historical changelogs and migration guides remain
unchanged.

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

### Correlation, pushes, and fire-and-forget

**Sources:** `packages/shell/src/napplet-namespace.ts:338-372` and
`packages/runtime/src/inc-handler.ts:138-154,172-182,213-241`.

`subscribe`, `channel.open`, and `channel.list` correlate by `id` and return
only their prescribed `*.result`; `emit`, `unsubscribe`, `channel.emit`,
`channel.broadcast`, and `channel.close` do not gain IDs or results.
`inc.channel.opened`, `.event`, and `.closed` are shell pushes with no request
ID. The target opened push is enqueued before opener success.

### One shared injected prelude, two hosts

**Sources:** `packages/paja/src/browser-target-frame.ts:87-104` and
`apps/playground/src/shell-host.ts:506-509`.

Implement the convention binding and public INC surface exactly once in
`@kehto/shell`; Paja and playground must use its injected bytes through their
existing `srcdoc` paths, including after the actual shim bundle assigns its
namespace. This prevents host-specific wire/API drift and preserves Phase 101's
source-registration-before-execution invariant.

## Commit-wave-safe ownership

| Wave | Plans / owned surfaces | Why this boundary is safe |
|---|---|---|
| 1 | 102-01 tracer across shared prelude and exact runtime event path | Establishes the canonical envelope and trusted sender path before expansion. |
| 2 | 102-02 runtime channels; 102-04 injected API; 102-09 generic dispatch; 102-10 services package | Four disjoint owners consume the tracer and establish runtime, binding, and compatibility-retirement behavior. |
| 3 | 102-03 ACL/revocation; 102-11 playground/E2E migration; 102-12 docs/skills/guard | ACL consumes runtime teardown while executable and guidance migrations consume Plans 09/10 with no same-wave file overlap. |
| 4 | 102-05 Paja proof; 102-06 playground INC proof | Both real hosts consume completed shared behavior through disjoint test ownership. |
| 5 | 102-07 active runtime/shell/policy guidance and final structural guard | Consumes both host summaries and extends the Plan 102-12 guard after its migration boundary is stable. |
| 6 | 102-08 Changesets and complete focused/full gate | Runs only after every behavior, host, and documentation artifact exists. |

`apps/playground/src/shell-host.ts` and `packages/paja/src/browser-target-frame.ts`
are reviewed consumer boundaries, not presumed production edits. Keep them out
of concurrent implementation ownership unless a test demonstrates they are not
passing the shared prelude through correctly.

## No Analog Found

| File/Concern | Role | Data Flow | Planner guidance |
|---|---|---|---|
| Canonical query-transposition parser | projection utility | transform | No existing parser matches the draft percent-decoding, duplicate-name, fragment, and literal-`+` rules. Create it once inside the serialized prelude, use it for INC now, and leave it reusable for Phase 104 intent. |
| Symmetric channel retention buffers | public binding | event-driven | No current analog retains target handles, early events, and terminal closure. Implement exactly from PR #92 and prove ordering; `ChannelInfo` remains informational. |
| Full Paja INC browser behavior test | E2E/integration test | event-driven | No existing Paja INC exercise exists. Add only if shared shell-prelude tests plus playground real-host proof cannot demonstrate Paja consumption; otherwise preserve the package boundary. |

## Metadata

**Analog search scope:** `packages/runtime`, `packages/acl`, `packages/shell`,
`packages/paja`, `apps/playground`, and `tests/e2e`  
**Files scanned:** 23 focused source/test files  
**Pattern extraction date:** 2026-07-23
