---
phase: quick-261023-oqs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/playground/package.json
  - package.json
  - pnpm-lock.yaml
  - apps/playground/src/playground-relay-service.ts
  - tests/unit/playground-relay-service.test.ts
  - tests/unit/playground-relay-selection.test.ts
  - .changeset/playground-applesauce-v7.md
autonomous: true
requirements:
  - QUICK-261023-OQS
must_haves:
  truths:
    - "D-01: @kehto/playground resolves applesauce-core 7.0.3, applesauce-relay 7.0.0, applesauce-loaders 7.0.2, rxjs 7.8.2 and nostr-tools >=2.25 from a committed pnpm-lock.yaml; no packages/* manifest changes"
    - "D-04: a relay.subscribe for an author whose kind-10002 is in neither the EventStore nor the worker cache loads it with createAddressLoader from the Indexer relays before the author subscription opens, and that indexer request appears in getRelayActivity"
    - "D-03/D-18: relayCache 'skip' still disables worker-cache reads and writes, including the mailbox step"
    - "D-15/D-18: relay.subscribe with a relay hint subscribes to exactly that relay and makes no indexer request"
    - "D-07: when every relay rejects a publish, relay.publish.result is {type,id,ok:false,error} where error is the first relay message, else the first relay error text, else 'publish failed'"
    - "D-09: destroy() closes the owned RelayPool, destroys the owned RelayLiveness and disposes the EventStore; it never calls close on an injected pool and a second call is a no-op"
    - "D-06: every service pool.request call passes timeout, firstResponseTimeout and RelayGroup.completeAfterFirstRelay, all set to requestTimeoutMs"
  artifacts:
    - path: apps/playground/src/playground-relay-service.ts
      provides: "applesauce v7 relay runtime: liveness pool, address-loader mailbox step, pool-owned timeouts, owned-resource teardown"
      contains: "createAddressLoader("
    - path: tests/unit/playground-relay-service.test.ts
      provides: "rxjs-Observable mock pool plus loader, publish-error-text, request-option and teardown regressions"
      contains: "new Observable"
    - path: pnpm-lock.yaml
      provides: "v7 resolution of the applesauce packages"
      contains: "applesauce-loaders"
    - path: .changeset/playground-applesauce-v7.md
      provides: "patch changeset for @kehto/playground only"
      contains: "'@kehto/playground': patch"
  key_links:
    - from: apps/playground/src/playground-relay-service.ts
      to: applesauce-loaders/loaders createAddressLoader
      via: "a NostrRequest function wrapping this.pool.request, so activity is recorded and v7 request options are applied"
      pattern: "createAddressLoader\\("
    - from: apps/playground/src/playground-relay-service.ts
      to: applesauce-relay RelayPool + RelayLiveness
      via: "the constructor builds an owned pool only when options.relayPool is absent"
      pattern: "new RelayPool\\(\\{ liveness"
    - from: tests/unit/nip5d-conformance-guard.test.ts
      to: apps/playground/src/playground-relay-service.ts
      via: "static markers relay?: string; / message.relay / if (!ok) { / ok: true, / eventId: event.id must survive the refactor"
      pattern: "message\\.relay"
---

<objective>
Upgrade the playground relay service (`apps/playground`, the only applesauce consumer) from applesauce v6 to v7. Adopt the v7 patterns from the user-approved design (`/home/robert/.claude/plans/okay-lets-start-making-polymorphic-walrus.md`):
- the address loader for kind-10002 mailbox lookups;
- a RelayLiveness health tracker on the pool;
- the pool's own timeouts instead of hand-rolled timers.

The public API (`createPlaygroundRelayRuntime`, `PlaygroundRelayRuntime`), NAP-RELAY wire behaviour, relay selection rules and `relayCache: 'skip'` semantics stay unchanged (D-18).

Purpose: keep the playground on the current applesauce line, which noStrudel `master` already runs. The playground gets the v7 fixes: a real `maxRelaysPerUser`, per-filter `limit`, and `RelayGroupError` handling. Dead relays are skipped and owned sockets/timers are torn down on reset.

Output:
- bumped manifests and lockfile;
- the refactored `playground-relay-service.ts`;
- updated and new unit regressions;
- a `@kehto/playground` patch changeset;
- a NAP-RELAY spec-check record in SUMMARY.

Commits are local only. The orchestrator pushes and opens the PR.

Decision IDs (the design has no numbering, so they are assigned here for traceability):
- D-01 dependency bumps
- D-02 liveness pool
- D-03 explicit store and cache steps under skipCache
- D-04 address-loader indexer step
- D-05 loader fallback
- D-06 request options
- D-07 publish timeout and error text
- D-08 subscription EOSE comment
- D-09 owned teardown
- D-10 structural type widening
- D-11 descriptor text unchanged
- D-12 selection module untouched
- D-13 service test changes
- D-14 selection test expectations
- D-15 NAP-RELAY guards unchanged
- D-16 docs grep and changeset
- D-17 NAP check record
- D-18 invariants, plus the deferred reactive outbox map / outboxSubscription rewrite, which is NOT planned
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@/home/robert/.claude/plans/okay-lets-start-making-polymorphic-walrus.md
@apps/playground/src/playground-relay-service.ts
@apps/playground/src/playground-relay-selection.ts
@apps/playground/src/playground-worker-relay.ts
@tests/unit/playground-relay-service.test.ts
@tests/unit/playground-relay-selection.test.ts
@tests/unit/nip5d-conformance-guard.test.ts
@apps/playground/package.json
@package.json

Branch: already on `chore/applesauce-v7`, cut from an up-to-date `main` with a clean tree. Do not switch branches, push or open a PR.

<interfaces>
The planner checked these against the published tarballs applesauce-relay@7.0.0, applesauce-loaders@7.0.2 and applesauce-core@7.0.3. After `pnpm install`, the executor MUST re-confirm each one in the installed `.d.ts` files under `apps/playground/node_modules/`.

applesauce-relay (index re-exports group, liveness, pool and types):
- `class RelayPool { constructor(options?: RelayPoolOptions); close(): void; request(relays, filters, opts?: GroupRequestOptions): Observable<NostrEvent>; subscription(relays, filters, opts?): Observable<NostrEvent>; publish(relays, event, opts?: PublishOptions): Promise<PublishResponse[]> }`.
- `RelayPoolOptions` adds `liveness?: PoolLivenessSource | PoolLivenessSource[]`.
- `class RelayLiveness { constructor(options?: LivenessOptions); filter(relays: string[]): string[]; destroy(): void }`. It structurally satisfies PoolLivenessSource. No storage is passed, so state is in-memory only.
- `RelayGroup.completeAfterFirstRelay(timeout?: number): GroupRequestCompleteOperator`, a static method (default 5000).
- `GroupRequestOptions` = `{ id?, timeout?: number (whole-lifetime, emits TimeoutError), firstResponseTimeout?: number | false (default 10s), complete?: GroupRequestCompleteOperator (default completeAfterIdle), eventStore?, ... }`.
- `PublishOptions.timeout?: number | boolean` (whole-operation, default 30s).
- `PublishResponse` = `{ ok: boolean; message?: string; from: string; error?: unknown }`.
- `class RelayGroupError extends AggregateError`.

applesauce-loaders (subpath export `applesauce-loaders/loaders`):
- `createAddressLoader(pool: UpstreamPool, opts?: AddressLoaderOptions): AddressPointerLoader`.
- `UpstreamPool` = `NostrRequest | { request: NostrRequest }`.
- `NostrRequest` = `(relays: string[], filters: Filter[]) => Observable<NostrEvent>`. It must be a real rxjs Observable, because the loader calls `.pipe`.
- `AddressLoaderOptions` includes `bufferTime`, `eventStore`, `cacheRequest`, `lookupRelays: string[] | Observable<string[]>`, `stageTimeout` (default 10000) and `followRelayHints`.
- `AddressPointerLoader` = `((pointer: { kind; pubkey; identifier?; relays?; cache? }) => Observable<NostrEvent>) & { stop(): void }`.
- Loader request filter shape for replaceable pointers: `{ kinds: [10002], authors: [...] }` with NO `limit`.
- Each stage swallows errors (`catchError(() => EMPTY)`), and results are matched per pointer by kind and pubkey.
- `loadUntilSettled` re-requests only while a round resolves some, but not all, of the remaining pointers.

applesauce-core:
- `class EventStore { constructor({ verifyEvent? }); add(e); getByFilters(filters: Filter | Filter[]): E[]; dispose(): void }`.
- `getInboxes`, `getOutboxes` and `selectOptimalRelays` are still exported from `applesauce-core/helpers`.

rxjs 7.8.2 (root entry also exports operators): `Observable`, `lastValueFrom`, `merge`, `takeUntil`, `timer`, `toArray`, `catchError`, `EMPTY`.

NAP-RELAY static guard markers that MUST survive in `apps/playground/src/playground-relay-service.ts`: `relay?: string;`, `message.relay`, `if (!ok) {`, `ok: true,`, `eventId: event.id`.

Markers in `tests/unit/playground-relay-service.test.ts`: `relay: 'wss://explicit.test'`, `expect(pool.log.requests).toHaveLength(0)`, `not.toHaveProperty('accepted')`, `not.toHaveProperty('message')`.
</interfaces>

<package_legitimacy_audit>
## Package Legitimacy Audit

The planner checked these against the npm registry on 2026-10-23. Quick mode has no RESEARCH.md, so the audit is recorded here.

| Package | Version | Status | Evidence |
|---------|---------|--------|----------|
| applesauce-core | ^7.0.3 | [VERIFIED] | Already a dependency (6.1.0). Sole maintainer hzrd149, which is this repo's git user. Created 2024-09. No install scripts. |
| applesauce-relay | ^7.0.0 | [VERIFIED] | Already a dependency (6.0.3). Same maintainer. Created 2025-03. No install scripts. |
| applesauce-loaders | ^7.0.2 | [VERIFIED] | Same maintainer and monorepo as core/relay. Created 2024-12. Only deps are rxjs, nanoid and applesauce-core. No install scripts. |
| rxjs | ^7.8.2 | [VERIFIED] | Already in the lockfile (7.8.2). Published by the reactivex/rxjs maintainers since 2012. No install scripts. |
| nostr-tools | ^2.25.2 | [VERIFIED] | Already a dependency (2.23.3). Published by fiatjaf from nbd-wtf/nostr-tools. Latest is 2.25.2. No install scripts. |

No [ASSUMED], [SUS] or [SLOP] entries, so no blocking legitimacy checkpoint is required.
</package_legitimacy_audit>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Bump applesauce to v7 and nostr-tools to 2.25, refresh the lockfile and confirm the v7 API surface (D-01, D-12, D-14)</name>
  <files>apps/playground/package.json, package.json, pnpm-lock.yaml, tests/unit/playground-relay-selection.test.ts (only if D-14 applies), apps/playground/src/playground-relay-service.ts (only for the D-10 cast fix described below)</files>
  <action>
Orient first, per CLAUDE.md step 0:
- Run `git status`, `git branch --show-current` (expect `chore/applesauce-v7`), `git log --oneline -3` and `git diff --cached`.
- STOP and report if the tree is unexpectedly dirty.

Per D-01, edit `apps/playground/package.json` dependencies, keeping alphabetical order:
- `applesauce-core` to `^7.0.3`;
- `applesauce-relay` to `^7.0.0`;
- add `applesauce-loaders` `^7.0.2`;
- add `rxjs` `^7.8.2` as a direct dependency, because the service will import from it;
- `nostr-tools` to `^2.25.2`. This satisfies the design's ^2.25 floor at the audited latest.

Per D-01, edit the root `package.json` devDependencies, keeping alphabetical order:
- `nostr-tools` to `^2.25.2`;
- add `applesauce-core` `^7.0.3`, `applesauce-relay` `^7.0.0` and `rxjs` `^7.8.2`, using the same ranges as the playground.

Why the root additions are needed (executor discretion, documented here):
- Files under `tests/unit/` resolve bare imports from the root `node_modules`, and `rxjs`/`applesauce-*` are not hoisted there. That is the same reason `nostr-tools` is already a root devDependency.
- The locked D-13 test changes need `Observable` from rxjs, plus the RelayPool, RelayLiveness and EventStore prototypes for the owned-teardown spies.
- Identical ranges make pnpm link one store instance, so a prototype spy taken in the test observes the instance the service creates.

Do NOT edit any `packages/*/package.json`. Their `nostr-tools` `>=2.23.3 <=2.x` peer ranges and devDependencies stay as they are (D-01).

Install and check the store:
- Run `pnpm install` without `--frozen-lockfile`.
- Confirm that `ls node_modules/.pnpm | grep -E '^applesauce-(core|relay|loaders)@'` shows exactly one directory each, at 7.0.3, 7.0.0 and 7.0.2, and no 6.x entries remain.

Re-confirm every name in the plan's `<interfaces>` block against the installed typings. The files to check are:
- `apps/playground/node_modules/applesauce-relay/dist/{pool,group,liveness,types}.d.ts`
- `apps/playground/node_modules/applesauce-loaders/dist/{types.d.ts,loaders/address-loader.d.ts,helpers/loaders.d.ts}`
- `apps/playground/node_modules/applesauce-core/dist/event-store/event-store.d.ts`

Note any discrepancy for SUMMARY. A discrepancy that breaks D-04 triggers the D-05 fallback in Task 2.

With the service code otherwise UNCHANGED, run build, type-check and the three targeted unit files.

If `tests/unit/playground-relay-selection.test.ts` fails, apply D-14 and D-12:
- Change an expected relay array only when the failure comes from v7's `selectOptimalRelays` now honouring `maxRelaysPerUser > 1`, or from changed `getOutboxes`/`getInboxes` deduplication.
- Add a one-line comment above each changed expectation saying it reflects the applesauce v7 behaviour.
- Never edit `apps/playground/src/playground-relay-selection.ts`. Keep `uniqueRelays`/`normalizeRelayUrl`, which define the playground's canonical URL form.

If type-check fails only at the `new RelayPool() as PlaygroundRelayPool` cast in the service:
- Apply the D-10 widening (see Task 2) in this commit.
- Do not cast through unknown.

Commit:
- Commit only the touched paths with `git commit --only -- <paths>`.
- Before committing, re-check `git diff --cached` and `git log -1`.
- Message: `chore(playground): bump applesauce to v7 and nostr-tools to 2.25`.
- Add the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
  </action>
  <verify>
    <automated>cd /home/robert/Projects/kehto-web && pnpm install && pnpm build && pnpm type-check && pnpm vitest run tests/unit/playground-relay-service.test.ts tests/unit/playground-relay-selection.test.ts tests/unit/nip5d-conformance-guard.test.ts && test "$(ls node_modules/.pnpm | grep -cE '^applesauce-(core|relay|loaders)@')" -eq 3 && ls node_modules/.pnpm | grep -E '^applesauce-relay@7\.0\.0' && ls node_modules/.pnpm | grep -E '^applesauce-loaders@7\.0\.2' && test -z "$(git diff HEAD~1 --name-only -- packages/)"</automated>
  </verify>
  <done>
- Both manifests carry the D-01 ranges, and the lockfile resolves exactly applesauce-core 7.0.3, applesauce-relay 7.0.0 and applesauce-loaders 7.0.2.
- `git diff HEAD~1 -- packages/` is empty.
- Build, type-check, playground-relay-service, playground-relay-selection and nip5d-conformance-guard are all green.
- Any selection-test expectation change carries an applesauce v7 comment.
- One deps commit exists.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Refactor playground-relay-service.ts onto v7 (liveness pool, address-loader mailbox step, pool timeouts, owned teardown) with regressions (D-02..D-11, D-13, D-15, D-18)</name>
  <files>apps/playground/src/playground-relay-service.ts, tests/unit/playground-relay-service.test.ts</files>
  <behavior>
- Existing "resolves missing NIP-65 mailboxes through Indexer relays before author subscriptions" (D-04, D-13): `pool.log.requests[0]` equals `{ relays: ['wss://nip66.indexer', 'wss://fallback.indexer'], filters: [{ kinds: [10002], authors: ['alice'] }] }`. The loader-built filter carries no `limit`. A new `pool.log.order` records `['request', 'subscription']`, and the subscription relays still contain `wss://alice.write` but not `wss://alice.read`.
- Existing "tracks relay activity ordered by latest access" stays green unchanged. `wss://nip66.indexer` keeps `requestCount: 2, eventsReceived: 2`, because the loader's upstream request goes through the recording wrapper and `loadUntilSettled` does not retry a round that resolves none of its pointers.
- New "passes v7 request options to every pool.request" (D-06): the logged request options have `timeout: 25`, `firstResponseTimeout: 25` and a function `complete`.
- New "reports the relay error text when every relay rejects without a message" (D-07): with `publishResponses: [{ ok: false, from: 'wss://alice.write', error: new Error('rate-limited') }]`, the reply equals `{ type: 'relay.publish.result', id, ok: false, error: 'rate-limited' }` and has no `message`, `accepted`, `event` or `eventId` property. The existing 'blocked' message test keeps passing, so message takes precedence over error.
- New "destroy() unsubscribes and leaves an injected pool open" (D-09): an injected mock pool with a `close` vi.fn and a spied subscription teardown. After an open subscription and `runtime.destroy()` called twice, the subscription teardown runs exactly once, `close` is never called and nothing throws.
- New "destroy() closes the owned pool, liveness and store" (D-09, D-02): `createPlaygroundRelayRuntime({ cache })` with no `relayPool`, plus `vi.spyOn` on `RelayPool.prototype.close`, `RelayLiveness.prototype.destroy` and `EventStore.prototype.dispose`. After `destroy()` twice, each spy has been called exactly once. Restore the spies in `afterEach`.
- Existing relay-hint, NIP-65/NIP-66 routing, finite-limit cache, relayCache skip and publish tests stay green with their assertions unchanged (D-15, D-18).
  </behavior>
  <action>
RED first: convert the test mock, then add the behaviour cases above to `tests/unit/playground-relay-service.test.ts` before touching the service.

Mock changes, per D-13:
- `createPool` returns rxjs `new Observable<NostrEvent>(...)` from both `request` and `subscription`. Keep emission on `queueMicrotask`, and `request` completes after emitting.
- `request` also pushes its third argument into a new `log.requestOptions` array.
- Both methods push `'request'` or `'subscription'` into a new `log.order` array.
- `publishResponses` items gain an optional `error?: unknown`.
- `createPool` accepts an optional `onSubscriptionTeardown` callback, which the subscription Observable's teardown calls.
- Keep `log.requests` entries as `{ relays, filters }` only, so the existing `toEqual` checks still hold.
- Keep every NAP guard marker listed in `<interfaces>` verbatim.

Run the file and confirm the new cases fail for the expected reasons. Then implement in `apps/playground/src/playground-relay-service.ts`.

Imports:
- `createAddressLoader` from `applesauce-loaders/loaders`;
- `RelayGroup`, `RelayLiveness` and `RelayPool` from `applesauce-relay`;
- `EMPTY`, `Observable`, `catchError`, `lastValueFrom`, `merge`, `takeUntil`, `timer` and `toArray` from `rxjs`. Drop any of these that end up unused.

Types (D-10, staying structural so mocks can be injected):
- `PublishResponse` gains `error?: unknown`.
- Add a `PlaygroundRelayRequestOptions` type: `id?: string`, `timeout?: number`, `firstResponseTimeout?: number | false`, and `complete?` typed as the return type of `RelayGroup.completeAfterFirstRelay`.
- `PlaygroundRelayPool.request` takes `PlaygroundRelayRequestOptions`.
- `subscription` and `publish` keep their shapes.
- `PlaygroundRelayRuntimeOptions` and `PlaygroundRelayRuntime` are byte-for-byte unchanged (D-18).

Constructor (D-02):
- When `options.relayPool` is absent, create `new RelayLiveness()` with no storage, because the playground is ephemeral.
- Then create `new RelayPool({ liveness })`, keeping the RelayLiveness instance in `ownedLiveness` and the pool in `ownedPool`.
- When `options.relayPool` is present, both fields are null and `this.pool` is the injected object.

Add a private `requestOptions()` (D-06) returning:
- `timeout: this.requestTimeoutMs`;
- `firstResponseTimeout: this.requestTimeoutMs`;
- `complete: RelayGroup.completeAfterFirstRelay(this.requestTimeoutMs)`.

Add a private `requestEvents(relays, filters)`. It returns an rxjs Observable that adapts any structural pool:
- On subscribe, call `recordRelayAccess(relays, 'request')`.
- Call `this.pool.request(relays, filters, this.requestOptions())`.
- Forward each event after `recordRelayEvents(relays, 1)`, and forward error and complete.
- Return a teardown that unsubscribes the inner handle.
- Turn a synchronous throw from `pool.request` into `subscriber.error`.

This wrapper is the loader's UpstreamPool. Passing a NostrRequest function is a documented v7 form, and it keeps the indexer step visible in relay activity, which the existing activity test and the relay-activity e2e rely on.

In `createRelayPoolHooks`, also pass `this.requestOptions()` in the `request` path, so every pool.request uses the same v7 completion policy (D-06, discretion).

`resolveMailboxes` (D-03, D-04):
- Keep the EventStore step and the `!skipCache` worker-cache step exactly as they are. Do NOT pass `cacheRequest` or any persist-to-cache helper to the loader, because either would read or write the cache regardless of `skipCache`.
- Keep the indexer list computation and its empty early return.
- Then create a per-call loader with `createAddressLoader(<the requestEvents wrapper>, { eventStore: this.eventStore, lookupRelays: indexers, bufferTime: 0 })`.
- Collect the results with `lastValueFrom(merge(...missingAfterCache.map((pubkey) => loader({ kind: 10002, pubkey }))).pipe(takeUntil(timer(this.requestTimeoutMs)), toArray()))`.
- Wrap that in try/catch (catch yields an empty list) and call `loader.stop()` in `finally`, so in-flight upstream requests are dropped.
- Feed the result to the existing `absorb`. `absorb` keeps its kind and pubkey check and the conditional cache write.

D-05 fallback, only if the loader path cannot pass the behaviour cases:
- Retain a private `requestRelays` implemented as `lastValueFrom(this.requestEvents(relays, filters).pipe(catchError(() => EMPTY), toArray()))`. This keeps the partial events emitted before a TimeoutError or RelayGroupError.
- Use it for the indexer step with the existing 10002 filter.
- Keep the loader test's filter expectation consistent with that path.
- Record the failure evidence and "D-05 fallback" in SUMMARY.

If D-04 succeeds, delete the old promise-collector `requestRelays`, which then has no callers, together with its hand-rolled outer request timer.

`publishToRelays` (D-07):
- Delete the racing publish timeout wrapper and await `Promise.resolve(this.pool.publish(relays, event, { timeout: this.publishTimeoutMs }))`. v7 converts each relay timeout into an `{ ok: false }` entry.
- Keep the try/catch, which returns an empty list.
- Add a module function `publishFailureText(responses)`. It returns the first non-empty string `message`; otherwise the first `error`, as its `.message` for Error instances or the string itself; otherwise `'publish failed'`. Never serialise an error object or stack.
- Use it in `handlePublish`, keeping the `if (!ok) {` block, and in the hooks `publish` throw.

`handleSubscribe` (D-08):
- Keep `pool.subscription` and the local EOSE timer unchanged.
- Add one short comment at the `error` handler: v7 subscriptions never emit EOSE, hence the timer, and they error with RelayGroupError once every relay fails, which is reported as relay.eose.

`destroy()` (D-09):
- Make it idempotent with a `destroyed` flag.
- After the existing subscription and hook cleanup, call `this.ownedPool?.close()`, then `this.ownedLiveness?.destroy()`, then `this.eventStore.dispose()`. The store is always created internally.
- Never call anything on an injected pool.

Keep the descriptor text `'Playground Applesauce relay service with worker cache and outbox relay selection'` unchanged (D-11).

Do not implement a reactive outbox map, and do not adopt `outboxSubscription` or `subscriptionMap`. Those are deferred (D-18).

Stay within `.aislop/config.yml` limits: 700 lines per file, 150 lines per function, nesting depth 5.

GREEN: run the file until every case passes, then run type-check.

Commit in two steps, each green, using `git commit --only -- <paths>` after checking `git diff --cached` and `git log -1`:
1. `refactor(playground): adopt applesauce v7 loader, liveness and pool timeouts`. Include the service plus the minimal existing-test edits: the mock Observable conversion and the loader filter expectation.
2. `test(playground): cover v7 request options, publish error text and owned teardown`. Include the new cases.

Add the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` to both commits.

If splitting makes an intermediate commit red, make a single `refactor(playground): ...` commit instead and note that in SUMMARY.
  </action>
  <verify>
    <automated>cd /home/robert/Projects/kehto-web && pnpm vitest run tests/unit/playground-relay-service.test.ts tests/unit/playground-relay-selection.test.ts tests/unit/nip5d-conformance-guard.test.ts && pnpm type-check && F=apps/playground/src/playground-relay-service.ts && test "$(grep -v '^\s*//' $F | grep -c 'Promise.race')" -eq 0 && test "$(grep -v '^\s*//' $F | grep -c 'setTimeout(finish')" -eq 0 && grep -q 'new RelayLiveness()' $F && grep -q 'RelayGroup.completeAfterFirstRelay(' $F && grep -q 'firstResponseTimeout' $F && grep -q 'eventStore.dispose()' $F && grep -q "description: 'Playground Applesauce relay service with worker cache and outbox relay selection'" $F && { grep -q 'createAddressLoader(' $F || grep -q 'D-05 fallback' .planning/quick/261023-oqs-upgrade-playground-relay-service-to-appl/261023-oqs-SUMMARY.md; } && test "$(wc -l < $F)" -le 700</automated>
  </verify>
  <done>
- All behaviour cases pass. Existing tests are unchanged apart from the D-13 mock conversion and the loader filter shape.
- nip5d-conformance-guard is green with no edits.
- Type-check is green.
- The service has no racing publish timeout and no hand-rolled request timer.
- The pool is built with RelayLiveness when owned, and destroy() tears down only owned resources and is idempotent.
- The indexer step uses createAddressLoader through the recording wrapper, or the documented D-05 fallback.
- Public API types and the descriptor text are unchanged.
- One or two green commits exist.
  </done>
</task>

<task type="auto">
  <name>Task 3: Changeset, docs sweep, NAP-RELAY spec check and full verification gates (D-16, D-17, D-15, D-18)</name>
  <files>.changeset/playground-applesauce-v7.md</files>
  <action>
Changeset (D-16):
- Create `.changeset/playground-applesauce-v7.md` with frontmatter `'@kehto/playground': patch` only.
- Body, one to three sentences: the playground relay service now runs on applesauce v7; it adds a RelayLiveness-backed pool, loads kind-10002 mailboxes through the address loader and relies on pool-owned request and publish timeouts; NAP-RELAY wire behaviour is unchanged.
- Do not add any `@kehto/*` package entry, because no package's shipped output changes.

Docs sweep (D-16):
- Run `grep -rn "applesauce" --include='*.md' . | grep -v node_modules | grep -v '^./.planning' | grep -v '/dist/'`.
- Expect only the generic mentions in `packages/nip/src/66/README.md` and the generated `docs/api` media copy. Edit none of them.
- Also grep `docs/` and `apps/playground` for the strings `6.0.3`, `6.1.0` and `applesauce-relay@6`, and fix any stale hit. None is expected.
- No `docs/compatibility.md` entry is needed, because no compatibility path is retained.

NAP-RELAY spec check (D-17), per CLAUDE.md NAP/NIP-5D guardrails:
- `napplet/naps` master (planner saw `19de5ce1cea40cd4c76089cdd8126e9f87648049`) has no `naps/NAP-RELAY.md`. The owning spec is the open draft PR napplet/naps#2 (planner saw head `9f30b3505335a52c574ff570576687d6467021ff`).
- Re-fetch the current values with `gh api repos/napplet/naps/commits/master --jq .sha` and `gh pr view 2 -R napplet/naps --json headRefOid`, and read `naps/NAP-RELAY.md` at that head.
- Also compare against the installed `@napplet/nap` 0.32.0 relay types.
- Confirm the service still matches these wire messages:
  - `relay.subscribe` takes `id`, `subId`, `filters` and an optional `relay`;
  - `relay.event` carries `subId` plus a `result` RelayEventResult with a relayHints sidecar;
  - `relay.eose` carries `subId`;
  - `relay.close` tears down by `subId`;
  - `relay.publish` is answered by `relay.publish.result` with `id`, `ok`, and either `event` plus `eventId` or a string `error`.
- Record the checked refs and the verdict, "conformant, wire behaviour unchanged", in SUMMARY for the PR body.

Run every gate and record its output in SUMMARY:
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `pnpm test:e2e`. This builds first and runs the whole Playwright suite, which includes the playground relay specs `relay-activity`, `relay-subscribe`, `relay-publish` and `nap-relay`. If the full run fails, run those specs alone with `npx playwright test tests/e2e/relay-activity.spec.ts tests/e2e/relay-subscribe.spec.ts tests/e2e/relay-publish.spec.ts tests/e2e/nap-relay.spec.ts` to separate a regression from a pre-existing flake, and report both.
- The AI-slop gate: `npx aislop@0.12.0 scan --changes --base origin/main` must score 100/100. The full `npx aislop@0.12.0 scan` must show no new diagnostics against the recorded pre-existing 95/100 baseline. Fix any finding in changed files. Do not touch `.aislop/config.yml`.
- `git diff --check`

Commit the changeset with `git commit --only -- .changeset/playground-applesauce-v7.md` after checking `git diff --cached` and `git log -1`:
- Message: `chore(changeset): note playground applesauce v7 upgrade`.
- Trailer: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

Do NOT push and do NOT open a PR. The orchestrator ships.
  </action>
  <verify>
    <automated>cd /home/robert/Projects/kehto-web && grep -q "'@kehto/playground': patch" .changeset/playground-applesauce-v7.md && test "$(grep -c '@kehto/' .changeset/playground-applesauce-v7.md)" -eq 1 && pnpm build && pnpm type-check && pnpm test:unit && pnpm docs:check && pnpm test:e2e && npx aislop@0.12.0 scan --changes --base origin/main && git diff --check && test -z "$(git status --porcelain -- apps packages tests .changeset package.json pnpm-lock.yaml)"</automated>
    <human-check>Non-blocking, recorded for the PR reviewer. Run `pnpm --filter @kehto/playground dev`, then check three things:
- a feed napplet loads events from live relays;
- the relay activity chrome lists the indexer relays first, then the author outbox relays;
- publishing a note reports a relay acknowledgement.
If live relays are reachable, the executor attempts this and records the result. Otherwise it records "not run (no live relay access)".</human-check>
  </verify>
  <done>
- The changeset names only `@kehto/playground` (patch).
- The docs sweep is clean.
- SUMMARY records the NAP-RELAY ref (the napplet/naps#2 head SHA and the master SHA) with a conformant verdict.
- build, type-check, test:unit, docs:check and test:e2e are green, or a pre-existing flake is isolated with evidence.
- The changed-file aislop scan is 100/100 and the full scan shows no new findings.
- The working tree has no uncommitted changes in tracked source.
- Three or four local commits exist and none has been pushed.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| public relays → playground relay service | Kind-10002 mailboxes, events and OK/CLOSED verdicts from untrusted relays cross here (indexer lookups, subscriptions, publish responses) |
| napplet iframe → relay service (via shell) | Untrusted relay.subscribe filters/relay hints and relay.publish events; surface unchanged by this task |
| npm registry → pnpm-lock.yaml | New/bumped third-party code enters the playground bundle |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-oqs-01 | Spoofing/Tampering | resolveMailboxes loader results | medium | mitigate | The loader matches results to pointers by kind and pubkey, and `absorb` keeps its `kind === 10002 && needed.includes(pubkey)` gate. A relay cannot inject another author's mailbox into relay selection. The Task 2 loader test proves alice's mailbox routes to `wss://alice.write` only. |
| T-oqs-02 | Spoofing | EventStore `verifyEvent: () => true` | low | accept | Pre-existing playground behaviour, unchanged by this task. The playground is an ephemeral demo host and signature policy is out of scope for a dependency upgrade. |
| T-oqs-03 | Denial of Service | mailbox step / pool.request | medium | mitigate | `takeUntil(timer(requestTimeoutMs))` bounds the loader, and `loader.stop()` in `finally` drops in-flight upstream requests. Every pool.request carries `timeout`, `firstResponseTimeout` and `completeAfterFirstRelay(requestTimeoutMs)`. RelayLiveness skips relays that keep failing. |
| T-oqs-04 | Information Disclosure | publishFailureText → relay.publish.result.error | low | mitigate | Only a string `message` or `Error.message` is forwarded, never an error object or stack. The Task 2 test asserts the exact `error: 'rate-limited'` value and the absence of extra properties. |
| T-oqs-05 | Denial of Service | destroy() resource teardown | low | mitigate | The owned pool is closed, the owned liveness destroyed and the store disposed, idempotently. Injected pools are untouched. Both paths are covered by Task 2 spies. |
| T-oqs-06 | Tampering | relayCache 'skip' cache isolation | medium | mitigate | No `cacheRequest` or persist helper is given to the loader, and cache writes stay behind `!skipCache` in `absorb`/`deliver`. The existing skip test asserts `cache.stored` is empty. |
| T-oqs-SC | Tampering | npm installs (applesauce-*, rxjs, nostr-tools) | high | mitigate | Every package is [VERIFIED] in the embedded legitimacy audit: known maintainers, existing lockfile lineage and no install lifecycle scripts. Versions are pinned by the committed lockfile, and Task 1 asserts exactly one store copy of each applesauce package. |
</threat_model>

<verification>
- `pnpm build`, `pnpm type-check`, `pnpm test:unit`, `pnpm docs:check` and `pnpm test:e2e` are green.
- The AI-slop changed-file scan is 100/100, and the full scan shows no new findings.
- `tests/unit/nip5d-conformance-guard.test.ts` and the relay-hint regression in `tests/unit/playground-relay-service.test.ts` are unchanged and green (D-15).
- `git diff main --stat -- packages/` is empty: no published `@kehto/*` output changed and no peer ranges were touched.
- `git log main..HEAD --format=%B` shows Conventional Commit subjects and the Claude Opus 5.5 trailer on every commit.
- SUMMARY records the NAP-RELAY draft ref checked, the v7 `.d.ts` confirmations, any D-14 selection changes, whether D-05 fallback was used, the e2e result and the manual-check status.
</verification>

<success_criteria>
- The playground runs on applesauce-core 7.0.3, applesauce-relay 7.0.0 and applesauce-loaders 7.0.2 with nostr-tools ^2.25.
- Kind-10002 mailbox lookups go through `createAddressLoader` against the Indexer relays and stay visible in relay activity.
- The pool is health-tracked by RelayLiveness, and request and publish timeouts are pool-owned.
- Publish failures carry the first relay message or error text.
- destroy() releases only owned resources.
- The public API, NAP-RELAY wire behaviour, relay selection rules and relayCache 'skip' semantics are unchanged.
- Every gate is green, and the changes are committed locally in Conventional Commits with the required trailer, ready for the orchestrator to push and open the PR.
</success_criteria>

<source_audit>
## Multi-Source Coverage Audit

| Source | Item | Covered by |
|--------|------|-----------|
| GOAL | Upgrade the playground relay service to applesauce v7 | Tasks 1–3 |
| REQ | None (quick task; synthetic ID QUICK-261023-OQS) | n/a |
| CONTEXT | D-01: dependency bumps, root/playground nostr-tools, lockfile, packages/* untouched | Task 1 |
| CONTEXT | D-02: RelayPool with RelayLiveness, no storage, mock injection intact | Task 2 |
| CONTEXT | D-03: explicit store → cache steps and skipCache semantics | Task 2 |
| CONTEXT | D-04: createAddressLoader indexer step via lastValueFrom/merge/toArray, bounded and caught | Task 2 |
| CONTEXT | D-05: requestRelays fallback | Task 2 (conditional, recorded in SUMMARY) |
| CONTEXT | D-06: request options timeout/firstResponseTimeout/completeAfterFirstRelay, partial events on error | Task 2 |
| CONTEXT | D-07: publish timeout via pool, try/catch, failure error text | Task 2 |
| CONTEXT | D-08: subscription plus EOSE timer, RelayGroupError comment | Task 2 |
| CONTEXT | D-09: destroy closes owned pool and disposes store only | Task 2 |
| CONTEXT | D-10: structural type widening | Task 2 (Task 1 if the cast breaks) |
| CONTEXT | D-11: descriptor text unchanged | Task 2 (grep gate) |
| CONTEXT | D-12: selection module untouched | Task 1 |
| CONTEXT | D-13: rxjs mocks plus three regressions | Task 2 |
| CONTEXT | D-14: selection expectations only where v7 changes them | Task 1 |
| CONTEXT | D-15: NAP-RELAY guards green and unchanged | Tasks 2, 3 |
| CONTEXT | D-16: docs grep and @kehto/playground patch changeset | Task 3 |
| CONTEXT | D-17: NAP-RELAY ref recorded | Task 3 |
| CONTEXT | D-18: invariants kept; reactive outbox map / outboxSubscription excluded (deferred) | Tasks 2, 3 |
| RESEARCH | v7 APIs verified against installed .d.ts before use | Task 1 (plus planner pre-check in `<interfaces>`) |
| RESEARCH | nostr-tools ^2.24+ requirement | Task 1 |
| RESEARCH | Gates: build, type-check, test:unit, docs:check, test:e2e, aislop 100 | Task 3 |
</source_audit>

<output>
Create `.planning/quick/261023-oqs-upgrade-playground-relay-service-to-appl/261023-oqs-SUMMARY.md` when done. It must include:
- the commit SHAs;
- the gate outputs;
- the NAP-RELAY spec ref and verdict;
- the v7 `.d.ts` confirmations;
- whether D-05 fallback or a D-14 selection change occurred;
- the e2e and manual-check status;
- the out-of-scope note that the reactive outbox map and outboxSubscription rewrite are deferred.
</output>
