# Upstream PR #89: NAP-INC Convention URI Transposition

**Researched:** 2026-07-23  
**Upstream authority checked:** `napplet/naps` PR #89 head `34ec29fc4039384a83dbd6b476f83c4fa0d038e6` (`naps/NAP-INC.md`, still marked draft)  
**Scope:** Planning delta only. No Kehto source, test, package, or protocol behavior is changed by this document.

## Project Constraints (from AGENTS.md)

- NAP-facing work must first be checked against the owning `napplet/naps` document and record its exact source/ref; an open draft ref is authoritative only for work explicitly targeting that draft. [VERIFIED: `AGENTS.md`; `napplet/naps@34ec29fc4039384a83dbd6b476f83c4fa0d038e6`]
- Do not invent protocol surface or make a local tool/test convention normative. Any wire-visible behavior must come from the cited NAP. [VERIFIED: `AGENTS.md`]
- When the NAP interface changes, trace the complete Kehto host/runtime/test surface rather than stopping at the first compiling package. [VERIFIED: `AGENTS.md`]
- This branch is planning-only: preserve unrelated dirty work, stage only this artifact, and make one conventional atomic documentation commit. [VERIFIED: `AGENTS.md`; task scope]

## Executive Delta

PR #89 changes only `naps/NAP-INC.md`; it supersedes the old 6461e4b-era ambiguity that made a query-bearing convention topic look like a distinct subscription key. `emit("napplet:<archetype>/<intent>?...")` now has a defined client-side conversion: remove the query, decode it into a text-to-text payload map, then route the resulting queryless topic by exact string equality. [VERIFIED: `git -C /Users/sandwich/Develop/naps diff --name-status 34ec29f^ 34ec29f`; `NAP-INC.md` at `34ec29f`]

The critical boundary is **before the `inc.emit` envelope crosses into the shell**. The upstream injected/SDK `emit` implementation and Kehto's host-injected fallback namespace own the conversion; `packages/runtime/src/inc-handler.ts` must receive only the stable wire topic and continue exact routing. It must not add a second URI parser, wildcard rule, prefix rule, or base/query matcher. [VERIFIED: `NAP-INC.md` “Convention URI transposition” and “Topic routing” at `34ec29f`; `packages/shell/src/napplet-namespace.ts:338-354`; `packages/runtime/src/inc-handler.ts:104-118`]

**Primary recommendation:** Schedule this as a new NAP-INC planning slice after the upstream draft is accepted for Kehto, with a coordinated upstream `@napplet/nap`/shim release chase. Keep NAP-INTENT's `convention` and `payload` opaque; do not add “intent query transposition.” [VERIFIED: `NAP-INC.md` and `NAP-INTENT.md` at `34ec29f`; `.planning/ROADMAP.md:84-98,160-163`]

## Exact Upstream Contract

| Concern | Required behavior | Planning consequence |
|---|---|---|
| Developer-facing call | A convention URI may be supplied to `emit`; its path is the stable topic and its query is shallow payload sugar. [VERIFIED: `NAP-INC.md` at `34ec29f`] | Support this only in the injected/SDK `emit` entry point. |
| Wire message | `inc.emit` carries the queryless stable topic and the transposed payload; `inc.event` preserves that topic unchanged. [VERIFIED: `NAP-INC.md` at `34ec29f`] | Runtime routing needs no URI transformation. |
| Query values | Decode each unique `name=value` as text; do not coerce `"false"`, `"42"`, or `"null"`; `+` is literal `+`, not a space. [VERIFIED: `NAP-INC.md` at `34ec29f`] | Use a parser whose form-decoding behavior is audited; do not use an API that silently changes `+` to space. |
| Invalid calls | A fragment, malformed percent escape, repeated decoded name, or explicit payload together with a query must be rejected before emission. Structured/non-text data uses explicit payload with a queryless topic. [VERIFIED: `NAP-INC.md` at `34ec29f`] | Reject locally before `postMessage`; no invalid `inc.emit` envelope may be sent. |
| Topic routing | Routing is exact equality over the resulting stable topic; no parse/decode/normalize/prefix/wildcard behavior belongs in routing. [VERIFIED: `NAP-INC.md` at `34ec29f`] | Keep `subscriptions.get(topic)` as the routing primitive; test a raw query-bearing topic never base-matches a queryless subscription. |
| Error wire shape | `inc.emit` remains fire-and-forget with no result envelope. The NAP requires rejection before emission but defines no `inc.emit.error` response. [VERIFIED: `NAP-INC.md` at `34ec29f`] | Surface invalid calls as a synchronous local throw; do **not** invent `inc.emit.error`. The exact JavaScript error class/message is an implementation choice. [ASSUMED] |

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Required boundary |
|---|---|---|---|
| Parse/validate convention URI supplied to `emit` | Browser/client injected API | Upstream `@napplet/nap` shim/SDK | Convert before the `inc.emit` `postMessage`. [VERIFIED: `NAP-INC.md` at `34ec29f`] |
| Stable-topic fan-out and sender exclusion | Kehto API/backend runtime | Browser transport | Match exact strings only; forward topic unchanged. [VERIFIED: `NAP-INC.md` at `34ec29f`; `packages/runtime/src/inc-handler.ts:104-118`] |
| Host-provided fallback namespace | Frontend server / host injection | Browser/client | `packages/shell/src/napplet-namespace.ts` is injected into both playground and Paja `srcdoc` paths, so it must match the canonical emit behavior. [VERIFIED: `packages/shell/src/napplet-namespace.ts:46-61`; `apps/playground/src/shell-host.ts:499`; `packages/paja/src/browser-target-frame.ts:87,101`] |
| Intent resolution | API/backend runtime | Browser/client | Preserve `convention` and `payload` as NAP-INTENT fields; it is not an INC URI parser. [VERIFIED: `NAP-INTENT.md` at `34ec29f`] |

## Current Kehto and Package Baseline

### Legacy API that must be bridged deliberately

The installed `@napplet/nap@0.28.0` exposes `incEmit(topic, extraTags?, content?)` and delegates to `window.napplet.inc.emit(topic, extraTags, content)`. Its shim parses the third string as JSON where possible; Kehto's injected `makeInc().emit` has the same three-argument legacy shape. [VERIFIED: `node_modules/.pnpm/@napplet+nap@0.28.0/node_modules/@napplet/nap/dist/inc/{sdk,shim}.d.ts`; `packages/shell/src/napplet-namespace.ts:338-354`]

This means a source-compatible Kehto fallback cannot simply assume all callers already use canonical `emit(topic, payload?)`. Plan the upstream package release and Kehto fallback together: preserve the legacy argument adapter only while the published package still calls it, but make the canonical two-argument path perform PR #89 validation/transposition. That adapter is implementation compatibility, not a new wire contract. [VERIFIED: installed `@napplet/nap@0.28.0` declarations; `NAP-INC.md` at `34ec29f`] [ASSUMED: temporary compatibility adapter shape]

The runtime currently does exact `Map` lookup but emits `sender: windowId`, and the channel path also exposes/accepts window identifiers. These are existing INC-03 defects independent of URI transposition and remain in the same future NAP-INC plan, because the upstream draft still requires dTag sender/peer identities. [VERIFIED: `packages/runtime/src/inc-handler.ts:83-204`; `NAP-INC.md` at `34ec29f`; `.planning/NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md:129-141`]

### Files a future NAP-INC plan must touch or inspect

| Surface | File | Why |
|---|---|---|
| Host-injected API | `packages/shell/src/napplet-namespace.ts` | Owns Kehto's fallback `emit` implementation before postMessage. [VERIFIED: source lines 338-354] |
| Prelude unit coverage | `packages/shell/src/napplet-namespace.test.ts` | Already executes the injected namespace and asserts the legacy INC envelope. [VERIFIED: source lines 450-522] |
| Runtime topic delivery | `packages/runtime/src/inc-handler.ts` | Keep exact matching, correct sender dTag mapping, and prove no second parsing. [VERIFIED: source lines 83-160] |
| Runtime integration coverage | `packages/runtime/src/runtime.test.ts`, `packages/runtime/src/dispatch.test.ts` | Existing coverage proves channels/subscribe dispatch but not topic event fan-out or PR #89 negative cases. [VERIFIED: `runtime.test.ts:52-236`; `dispatch.test.ts:183-190`] |
| Published API dependency | `@napplet/nap` INC shim/SDK and `@napplet/shim` | Current 0.28.0 API is still the legacy three-argument adapter, so Kehto must not claim package conformance until an upstream release is verified. [VERIFIED: installed 0.28.0 declarations; `.planning/REQUIREMENTS.md:31-43`] |
| Playground real host | `apps/playground/src/shell-host.ts`, `tests/e2e/profile-open.spec.ts` | Playground injects the prelude; the current profile test directly calls legacy `window.napplet.inc.emit`. [VERIFIED: `shell-host.ts:499`; `profile-open.spec.ts:34-46`] |
| Paja real host | `packages/paja/src/browser-target-frame.ts`, `packages/paja/src/browser-host.test.ts` | Paja also injects the same prelude and needs a behavioral regression, not merely a static import check. [VERIFIED: `browser-target-frame.ts:87,101`; `browser-host.test.ts:17-22`] |

## Prescriptive Implementation Pattern

1. Accept an opaque non-convention topic unchanged. For a `napplet:` convention URI without a query, emit it unchanged with any explicit payload. [VERIFIED: `NAP-INC.md` at `34ec29f`]
2. Only when the `emit` input is a convention URI **and has a query**, validate the absence of a fragment, parse unique decoded `name=value` pairs without form-style `+` conversion, reject malformed percent data/repeated names/explicit payload, then call the existing fire path with the queryless topic and text map payload. [VERIFIED: `NAP-INC.md` at `34ec29f`]
3. Do not accept a raw query-bearing wire message as a signal to redo conversion. The runtime treats the received topic as opaque and exact; the valid producer-side path already emitted the stable topic. [VERIFIED: `NAP-INC.md` at `34ec29f`; `packages/runtime/src/inc-handler.ts:104-118`]
4. Do not change subscription matching. Consumers subscribe to the queryless stable topic. [VERIFIED: `NAP-INC.md` at `34ec29f`]
5. Preserve the existing distinct task of translating `windowId` to the sender/peer dTag at runtime delivery; query parsing must not be coupled to identity translation. [VERIFIED: `packages/runtime/src/inc-handler.ts:104-204`; `NAP-INC.md` at `34ec29f`]

## Required Tests

| Layer | Positive proof | Negative / boundary proof |
|---|---|---|
| Injected API unit | `emit('napplet:profile/open?pubkey=a%20b&plus=a+b')` posts exactly `{ type: 'inc.emit', topic: 'napplet:profile/open', payload: { pubkey: 'a b', plus: 'a+b' } }`. [VERIFIED: `NAP-INC.md` at `34ec29f`] | Fragment, malformed `%`, repeated decoded key, and an explicit payload with a query each throw before posting; no `inc.emit.error` is fabricated. [VERIFIED: `NAP-INC.md` at `34ec29f`] |
| Type preservation | Query values `false`, `42`, and `null` arrive as strings. [VERIFIED: `NAP-INC.md` at `34ec29f`] | Structured payload works only with a queryless topic. [VERIFIED: `NAP-INC.md` at `34ec29f`] |
| Runtime unit | Subscribe `napplet:profile/open`, send the stable wire topic, then assert one receiver event has the unchanged stable topic, payload, sender dTag, and no sender echo. [VERIFIED: `NAP-INC.md` at `34ec29f`] | A direct raw `inc.emit` topic containing `?pubkey=...` does not base-match the queryless subscription and is not normalized. [VERIFIED: `NAP-INC.md` at `34ec29f`] |
| Host integration | Execute the canonical emit path through both playground and Paja `srcdoc` injection. [VERIFIED: `apps/playground/src/shell-host.ts:499`; `packages/paja/src/browser-target-frame.ts:87,101`] | Keep the existing legacy package call covered until the verified upstream package upgrade removes that compatibility need. [VERIFIED: installed `@napplet/nap@0.28.0` declarations] |
| Package gate | Verify the selected released `@napplet/nap`/shim exposes and exercises the canonical API before calling package conformance complete. [VERIFIED: `.planning/REQUIREMENTS.md:31-43`] | Do not infer unpublished package behavior from this NAP-only PR. [VERIFIED: `.planning/REQUIREMENTS.md:11-13`; `AGENTS.md`] |

## Explicitly Deferred: NAP-INTENT Query Transposition

Do **not** add URI-query parsing, decoding, or payload mutation to `intent.invoke`, `IntentOpenOptions`, intent resolution, manifest catalog entries, or a handler’s `convention` field. At this same exact ref, NAP-INTENT says the convention names an opaque payload shape, keeps the payload opaque, and only says delivery commonly uses an INC topic event or cold-start state. It defines no NAP-INTENT query-transposition algorithm and PR #89 changes no NAP-INTENT file. [VERIFIED: `napplet/naps@34ec29f:naps/NAP-INTENT.md:15-22,95-98,122-127,212-219`; `git diff --name-status 34ec29f^ 34ec29f`]

If an intent eventually chooses a query-bearing convention and uses INC delivery, only the ordinary **INC `emit`** boundary may transpose it under the NAP-INC rule; the intent request's payload stays opaque. Any different intent-layer behavior is a specification gap that must be proposed upstream before implementation. [VERIFIED: `NAP-INC.md` and `NAP-INTENT.md` at `34ec29f`; `AGENTS.md`]

## Scope Routing and Open Questions

- This does not reopen current Phase 101: its active plan explicitly excludes INC, INTENT, and convention-package migration. Route the runtime/prelude work to the unplanned Phase 102 NAP-INC parity slice; route the published-package upgrade to Phase 104; retain live profile-flow adoption in Phase 105. [VERIFIED: `.planning/phases/101-nap-shell-session-integrity/101-05-PLAN.md:196-201`; `.planning/ROADMAP.md:84-98,160-163`]
- The current roadmap/requirements intentionally say “no query stripping” because they were pinned to `6461e4b`; those statements are stale **if** Kehto adopts PR #89. Update them only when the team explicitly accepts this draft/merged ref as the new phase authority, rather than silently mixing two protocol baselines. [VERIFIED: `.planning/REQUIREMENTS.md:105-119,185-187`; `.planning/ROADMAP.md:46-56`; `NAP-INC.md` at `34ec29f`]
- The NAP says “rejected before emission” but does not prescribe a JavaScript exception class or text. Keep tests to observable rejection and absence of postMessage unless a published upstream API later specifies a public error contract. [VERIFIED: `NAP-INC.md` at `34ec29f`] [ASSUMED: exact local error class/message]

## Assumptions Log

| ID | Assumption | Risk if wrong |
|---|---|---|
| A1 | A temporary overload can preserve legacy `emit(topic, extraTags?, content?)` callers while canonical two-argument callers use the PR #89 path. | It could retain legacy behavior too long or conflict with the eventual published API. |
| A2 | A local synchronous throw is the appropriate JavaScript realization of “rejected before emission.” | A published upstream shim could later specify a distinct public error shape. |

## Sources

- [VERIFIED: local canonical draft] `git -C /Users/sandwich/Develop/naps show 34ec29fc4039384a83dbd6b476f83c4fa0d038e6:naps/NAP-INC.md`
- [VERIFIED: local canonical draft] `git -C /Users/sandwich/Develop/naps show 34ec29fc4039384a83dbd6b476f83c4fa0d038e6:naps/NAP-INTENT.md`
- [VERIFIED: supplied PR evidence] `/tmp/napplet-naps-pr89.patch`
- [VERIFIED: installed package baseline] `@napplet/nap@0.28.0` INC declarations under `node_modules/.pnpm`
- [VERIFIED: Kehto codebase] `packages/shell/src/napplet-namespace.ts`, `packages/runtime/src/inc-handler.ts`, associated tests, Paja/playground injection hosts
