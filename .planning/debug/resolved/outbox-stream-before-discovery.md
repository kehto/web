---
status: resolved
trigger: "Resolve https://github.com/kehto/web/issues/190"
created: 2026-07-11
updated: 2026-07-11
---

# Outbox stream before discovery

## Symptoms

- **Expected:** Open validated caller-hint, policy, or fallback relay reads immediately; resolve NIP-65 relay lists concurrently; attach discovered author relays to the same deduplicating collector; stream verified events before planning completes; apply one overall deadline to planning and collection; use the same immediate-fanout rule for `outbox.subscribe`.
- **Actual:** `createRelayPoolOutboxRouter().query()` awaited `loadRelayLists()` before any relay read. A loader that never settled prevented both relay work and finite `timeoutMs` completion.
- **Errors:** No thrown error. Returned query promise remained pending after its deadline and no relay subscription opened.
- **Timeline:** Reported against `@kehto/services` 0.16.1 on 2026-07-11. Prior working state not claimed.
- **Reproduction:** Construct the router with a usable fallback relay and a `loadRelayLists` promise that never settles; call `query(..., { timeoutMs: 1 })`; observe no subscription and unresolved result after 100 ms.

## Current Focus

- hypothesis: Confirmed and fixed — `resolvePlan()` serialized NIP-65 loading ahead of query collection and subscription attachment.
- test: Focused Vitest regressions for hanging/rejected discovery, incremental query delivery, dynamic relay attachment, EOSE gating, deadline enforcement, deduplication, close, and subscribe parity.
- expecting: Seed relays open synchronously for Promise-based discovery; one deadline bounds planning, verification, and collection; draft wire query stays aggregate.
- next_action: none
- reasoning_checkpoint: Merged napplet/naps master `5fd9946` has no NAP-OUTBOX. Draft PR #32 head `4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e` is authority for this change: wire query remains one-shot, subscribe owns wire streaming, and relay-set changes stay runtime-owned. Therefore `queryStream` is a Kehto router API, not a new wire message.
- tdd_checkpoint: Red — 4 focused failures proved zero seed reads, missing stream API, discovery rejection, and blocked subscribe. Green — 39 focused router tests pass after the dynamic collector implementation.

## Evidence

- timestamp: 2026-07-11T22:06:15+02:00
  observation: Current implementation failed four new regressions; hanging discovery opened zero relays, `queryStream` was absent, rejected discovery escaped, and subscribe opened zero relays.
- timestamp: 2026-07-11T22:20:03+02:00
  observation: Focused router, outbox service, and Paja host suites passed 72/72 after the behavior-preserving type split.
- timestamp: 2026-07-11T22:20:43+02:00
  observation: Full `pnpm test:unit` passed 103 files and 1362 tests on latest main.
- timestamp: 2026-07-11T22:21:00+02:00
  observation: `pnpm build` passed 32/32 tasks; `pnpm type-check` passed 17/17 tasks; `pnpm docs:check` passed strict TypeDoc, VitePress, and nine-package audit.
- timestamp: 2026-07-11T22:20:18+02:00
  observation: `pnpm dlx aislop@0.12.0 scan` scored 100/100 with no issues.

## Eliminated

- hypothesis: The NAP wire needs a new query event message.
  reason: Draft PR #32 keeps `outbox.query.result` aggregate and reserves `outbox.event` for subscriptions; incremental query delivery belongs at the Kehto router API.

## Resolution

- root_cause: `queryImpl()` awaited `resolvePlan()` before the collector armed its timeout, while `startSubscription()` also awaited the same plan before attaching relays. A never-settling loader therefore blocked all reads and deadline completion.
- fix: Added a router-level incremental query handle; start allowed hints/fallback reads immediately for asynchronous discovery; attach discovered author write relays to the same collector; gate EOSE completion on settled discovery and verification; force completion at the overall deadline; apply the same seed-first discovery model to subscriptions.
- verification: Full build, type-check, 1362 unit tests, strict docs audit, focused Paja integration, `git diff --check`, and AI-slop 100/100 passed.
- files_changed: .changeset/fast-relays-stream.md, docs/packages/services.md, packages/services/README.md, packages/services/src/index.ts, packages/services/src/outbox-service.ts, packages/services/src/relay-pool-outbox-router.ts, packages/services/src/relay-pool-outbox-router.test.ts, packages/services/src/relay-pool-outbox-types.ts
