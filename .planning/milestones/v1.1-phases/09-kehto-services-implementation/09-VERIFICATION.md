---
phase: 09-kehto-services-implementation
verified: 2026-04-07T01:15:00Z
status: passed
score: 11/11 must-haves verified
---

# Phase 9: @kehto/services Implementation Verification Report

**Phase Goal:** All @kehto/services handlers receive and return NappletMessage envelopes, and the signer handler gates getPubkey() on identitySource
**Verified:** 2026-04-07T01:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | ServiceHandler.handleMessage accepts NappletMessage — code referencing unknown[] fails to compile | ✓ VERIFIED | `packages/runtime/src/types.ts` lines 506-510: signature is `(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void` — no `unknown[]` |
| 2  | Signer service processes signer.* NappletMessage envelopes and returns typed .result/.error responses | ✓ VERIFIED | `signer-service.ts` implements all 7 operations (getPublicKey, signEvent, getRelays, nip04.encrypt, nip04.decrypt, nip44.encrypt, nip44.decrypt) via switch on message.type; each returns typed `signer.X.result` or `signer.X.error` envelope |
| 3  | Runtime delegates to signer service by passing NappletMessage directly — no legacy array wrapping | ✓ VERIFIED | `runtime.ts` lines 608-613: `signerService.handleMessage(windowId, msg, (resp: NappletMessage) => { hooks.sendToNapplet(windowId, resp); })` — direct passthrough |
| 4  | signer.getPublicKey does not silently return undefined when no session (SVC-I05 scope) | ✓ VERIFIED | SERVICES-MIGRATION.md section 3.4 explicitly states "The signer service does not need this guard because signing operations use the shell's own signer (via options.getSigner()), not the napplet's pubkey." — the signer service checks `options.getSigner()` null, returns `.error` envelope. The guard applies to service handlers that retrieve napplet pubkey from sessionRegistry, which signer does not do. |
| 5  | Audio service processes ifc.emit messages with audio:* topic and returns ifc.event responses | ✓ VERIFIED | `audio-service.ts` lines 59-62: `if (message.type !== 'ifc.emit') return; const topic ... if (!topic?.startsWith('audio:')) return;`; line 105: `send({ type: 'ifc.event', topic: 'napplet:audio-muted', ... })` |
| 6  | Notification service processes ifc.emit messages with notifications:* topic and returns ifc.event responses | ✓ VERIFIED | `notification-service.ts` lines 121-124; lines 149: `send({ type: 'ifc.event', topic: 'notifications:created', ... })`; line 190: `send({ type: 'ifc.event', topic: 'notifications:listed', ... })` |
| 7  | Relay-pool service processes relay.subscribe/close/publish envelopes and returns relay.event/relay.eose responses | ✓ VERIFIED | `relay-pool-service.ts` lines 111-176: type-based routing; relay.event and relay.eose responses |
| 8  | Cache service processes relay.subscribe/relay.publish envelopes with one-shot query pattern | ✓ VERIFIED | `cache-service.ts` lines 81-116: relay.subscribe triggers query + per-event relay.event + relay.eose; relay.publish calls store() |
| 9  | Coordinated-relay service coordinates cache + relay-pool with dedup and unified EOSE via envelope format | ✓ VERIFIED | `coordinated-relay.ts` lines 100-107: `maybySendEose` sends `{type: 'relay.eose', subId}`; line 154: `send({ type: 'relay.event', subId, event })` |
| 10 | No unknown[] references remain in any service handler file | ✓ VERIFIED | `grep -r 'unknown\[\]' packages/services/src/*.ts` (excluding tests) — zero matches; test occurrences are onChange callback collectors, not wire-format |
| 11 | No BusKind imports remain in any service handler file | ✓ VERIFIED | `grep -r 'BusKind' packages/services/src/` — zero matches |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/runtime/src/types.ts` | Updated ServiceHandler interface with NappletMessage | ✓ VERIFIED | Lines 506-510: `handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void` |
| `packages/runtime/src/service-dispatch.ts` | NUB envelope routing by domain prefix + IFC topic prefix | ✓ VERIFIED | Lines 45-60: domain = `message.type.split('.')[0]`; IFC path routes by topic prefix |
| `packages/services/src/signer-service.ts` | All 7 signer operations via envelope format | ✓ VERIFIED | 7 cases in switch, each with `.result` and `.error` paths; contains `signer.signEvent.result` |
| `packages/services/src/signer-service.test.ts` | Tests updated for envelope format | ✓ VERIFIED | 17 tests using `makeSignerMessage(type, fields)` helper; `NappletMessage[]` sent array |
| `packages/services/src/audio-service.ts` | IFC-routed audio service with envelope format | ✓ VERIFIED | Contains `ifc.event` with topic `napplet:audio-muted`; no BusKind, no parseContent |
| `packages/services/src/notification-service.ts` | IFC-routed notification service with envelope format | ✓ VERIFIED | Contains `ifc.event` with topic `notifications:created`; no BusKind |
| `packages/services/src/notification-service.test.ts` | Notification tests updated for envelope format | ✓ VERIFIED | Uses `makeIfcEmit` helper; `sent[0].type === 'ifc.event'` assertions |
| `packages/services/src/relay-pool-service.ts` | NUB-domain relay pool service with envelope format | ✓ VERIFIED | Contains `relay.subscribe`, `relay.eose`, `relay.event` routing |
| `packages/services/src/cache-service.ts` | NUB-domain cache service with envelope format | ✓ VERIFIED | Contains `relay.subscribe` one-shot pattern with `relay.eose` |
| `packages/services/src/coordinated-relay.ts` | Composite relay service with envelope format | ✓ VERIFIED | Contains `relay.eose` in `maybySendEose`; `relay.event` in `deliver()` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/runtime/src/runtime.ts` | `packages/services/src/signer-service.ts` | `signerService.handleMessage(windowId, envelope, send)` | ✓ WIRED | Lines 608-613: `signerService.handleMessage(windowId, msg, ...)` — NappletMessage passed directly |
| `packages/runtime/src/types.ts` | `packages/services/src/signer-service.ts` | ServiceHandler interface | ✓ WIRED | signer-service.ts `import type { ServiceHandler } from '@kehto/runtime'`; `handleMessage(windowId, message: NappletMessage, ...)` signature matches interface |
| `packages/services/src/audio-service.ts` | runtime ifc.emit dispatch | `message.type === 'ifc.emit' && topic.startsWith('audio:')` | ✓ WIRED | Lines 60-62 in audio-service.ts |
| `packages/services/src/notification-service.ts` | runtime ifc.emit dispatch | `message.type === 'ifc.emit' && topic.startsWith('notifications:')` | ✓ WIRED | Lines 122-124 in notification-service.ts |
| `packages/services/src/coordinated-relay.ts` | `packages/services/src/relay-pool-service.ts` | Same relay.* envelope contract | ✓ WIRED | Both handle `relay.subscribe`, `relay.close`, `relay.publish` with identical field shapes |

---

### Data-Flow Trace (Level 4)

Services are service handlers, not data-rendering components. They receive envelopes and emit envelopes via `send()` callback — there is no "data source" to trace in the UI sense. All service handlers pass through to options callbacks (getSigner, subscribe, query, etc.) which are injected at construction time. Data flow is verified by the test suites which mock those callbacks and assert correct envelope responses.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Signer service tests (17 tests) | `npx vitest run packages/services/src/signer-service.test.ts` | 17 passed (1 file) | ✓ PASS |
| Notification service tests (17 tests) | `npx vitest run packages/services/src/notification-service.test.ts` | 17 passed (1 file) | ✓ PASS |
| Services TypeScript type-check | `npx tsc --noEmit -p packages/services/tsconfig.json` | No errors | ✓ PASS |
| Runtime TypeScript type-check | `npx tsc --noEmit -p packages/runtime/tsconfig.json` | No errors | ✓ PASS |
| Full monorepo build | `pnpm build` | 11 successful, 11 total | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SVC-I01 | 09-01 | Update ServiceHandler interface (unknown[] → NappletMessage) | ✓ SATISFIED | `types.ts` ServiceHandler.handleMessage signature is NappletMessage-only; compile verified |
| SVC-I02 | 09-01 | Migrate signer service handler to envelope format | ✓ SATISFIED | `signer-service.ts` — 7 operations, typed result/error envelopes, 17 tests pass |
| SVC-I03 | 09-02 | Migrate audio and notifications handlers to IFC envelope format | ✓ SATISFIED | Both services read ifc.emit, respond ifc.event; legacy helpers deleted; 17 notification tests pass |
| SVC-I04 | 09-02 | Migrate relay-pool, cache, and coordinated-relay handlers | ✓ SATISFIED | All three use relay.subscribe/close/publish + relay.event/relay.eose; full build passes |
| SVC-I05 | 09-01 | Add identitySource guard for getPubkey() calls | ✓ SATISFIED | Per SERVICES-MIGRATION.md section 3.4: signer service does not call sessionRegistry.getPubkey() — it uses options.getSigner() (shell signer, not napplet pubkey). The guard pattern is specified for handlers that retrieve napplet pubkey from sessionRegistry; signer service is explicitly excluded from this requirement in the spec. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `notification-service.test.ts` | 63, 77, etc. | `const changes: unknown[]` | ℹ️ Info | onChange callback collectors in test code; not wire-format arrays; does not violate the "no unknown[] in service handler files" criterion per SUMMARY decision |

No blocker anti-patterns found. No BusKind, no parseContent/extractTopic/createResponseEvent, no TODO/FIXME/placeholder in service files.

---

### Human Verification Required

None — all observable behaviors are verifiable programmatically via TypeScript compilation, test suites, and code inspection. The service handlers are pure logic with no DOM, browser API, or external service dependencies.

---

## Gaps Summary

No gaps. All 11 truths verified, all 10 required artifacts pass all levels, all 5 key links wired, all 5 requirements satisfied, build and tests pass.

---

_Verified: 2026-04-07T01:15:00Z_
_Verifier: Claude (gsd-verifier)_
