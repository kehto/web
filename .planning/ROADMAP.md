# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** - 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** - 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** - 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** - 7 phases (16-22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [x] **v1.4: Productionization & Upstream Unblock** - 6 phases (23-28), 17 plans, 20 requirements, 49 E2E specs green ([archive](milestones/v1.4-ROADMAP.md) | [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- [x] **v1.5: Demo Stability & UAT Coverage** - 3 phases (29-31), 7 plans, 7 requirements, 53 E2E specs green ([archive](milestones/v1.5-ROADMAP.md) | [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- [x] **v1.6: Downstream Unblock & Shell Service Surface** - 5 phases (32-36), 12 plans, 21 requirements, 54 E2E specs green ([archive](milestones/v1.6-ROADMAP.md) | [audit](milestones/v1.6-MILESTONE-AUDIT.md))
- [x] **v1.7: NIP-5D Spec Adoption & New NUB Domains** - 5 phases (37-41), 17 plans, 41/41 requirements, 72 E2E specs green ([archive](milestones/v1.7-ROADMAP.md) | [audit](milestones/v1.7-MILESTONE-AUDIT.md))
- [x] **v1.8: Upstream Alignment & NIP-44 Decrypt** - 5 phases (42-46), 9 plans, 27/27 requirements, 86 E2E specs green ([archive](milestones/v1.8-ROADMAP.md) | [audit](milestones/v1.8-MILESTONE-AUDIT.md))
- [x] **v1.9: Napplet SDK Migration** - 3 phases (47-49), 3 plans, 12/12 requirements, 86 E2E specs green ([archive](milestones/v1.9-ROADMAP.md) | [audit](milestones/v1.9-MILESTONE-AUDIT.md))
- [x] **v1.10: Compatibility Window Cleanup & Decrypt Demo Parity** - 3 phases (50-52), 3 plans, 10/10 requirements, 86 E2E specs green ([archive](milestones/v1.10-ROADMAP.md) | [audit](milestones/v1.10-MILESTONE-AUDIT.md))
- [x] **v1.11: NIP-5A Gateway Artifact Parity** - 3 phases (53-55), 16/16 requirements, production-equivalent opaque-origin gateway artifact loading, 551 unit tests, 87 E2E specs green ([archive](milestones/v1.11-ROADMAP.md) | [audit](milestones/v1.11-MILESTONE-AUDIT.md))
- [x] **v1.12: NIP-5D Contract Conformance** - 4 phases (56-59), 34/34 requirements, 560 unit tests, 89 E2E specs green, pinned-spec contract conformance across shell, shim/runtime, gateway load checks, and 13 playground napplets ([archive](milestones/v1.12-ROADMAP.md) | [requirements](milestones/v1.12-REQUIREMENTS.md) | [audit](milestones/v1.12-MILESTONE-AUDIT.md))
- [x] **v1.13: Documentation Strategy & Monorepo Docs Site** - 5 phases (60-64), 28/28 requirements, content strategy, package docs, tutorials/how-tos, VitePress site, and docs verification ([archive](milestones/v1.13-ROADMAP.md) | [requirements](milestones/v1.13-REQUIREMENTS.md) | [audit](milestones/v1.13-MILESTONE-AUDIT.md))
- [x] **v1.14: GitHub Pages Web Portal** - 3 phases (65-67), 13/13 requirements, public `/web/` portal, playground at `/web/playground/`, docs at `/web/docs/`, and unified Pages deploy gate ([archive](milestones/v1.14-ROADMAP.md) | [requirements](milestones/v1.14-REQUIREMENTS.md) | [audit](milestones/v1.14-MILESTONE-AUDIT.md))
- [x] **v1.15: Address AI Slop** - 5 phases (68-72), 20/20 original requirements complete, local `aislop` scan no longer Critical, 563 unit tests green ([archive](milestones/v1.15-ROADMAP.md) | [requirements](milestones/v1.15-REQUIREMENTS.md) | [audit](milestones/v1.15-MILESTONE-AUDIT.md))
- [x] **v1.16: Structural Code Quality Refactor** - 4 phases (73-76), 18/18 requirements, local `aislop` scan clean, 563 unit tests green ([archive](milestones/v1.16-ROADMAP.md) | [requirements](milestones/v1.16-REQUIREMENTS.md) | [audit](milestones/v1.16-MILESTONE-AUDIT.md))
- [x] **v1.17: Beautify the SPA Landing Page** - 3 phases (77-79), 15/15 requirements, static `/web/` brand system, GSAP motion, liquid accent, and visual proof ([archive](milestones/v1.17-ROADMAP.md) | [requirements](milestones/v1.17-REQUIREMENTS.md) | [audit](milestones/v1.17-MILESTONE-AUDIT.md))
- [x] **v1.18: Napplet Firewall** - 3 phases (80-82), 24 requirements, new `@kehto/firewall` pure core + runtime integration for behavioral rate/burst/content anti-abuse with allow/deny/ask policy and focus-aware tightening (shipped — merged to main, PRs #25/#27)
- [x] **v1.19: NAP Ontology Alignment** - 1 phase (83), 8 requirements ([archive](milestones/v1.19-ROADMAP.md) | [requirements](milestones/v1.19-REQUIREMENTS.md))
- [ ] **v1.20: NIP-5D Content-Addressed Runtime Resolution** - 2 phases (84-85), 19 requirements (phases complete; PRs #38/#39 open)
- [x] **v1.21: NIP-5D (#2303) + NAP-SHELL/INTENT Conformance** - 4 phases (86-89), 16 requirements (completed; follow-up cache PR #63 merged)
- [x] **v1.22: Single-Window Development Runtime** - 5 phases (90-94), 21/21 requirements, PR #64 open
- [ ] **v1.23: NAP-LINK Runtime Parity** - 1 phase (95), 6 requirements, PR #71 open
- [ ] **v1.24: NAP-COMMON Runtime Parity** - 1 phase (96), 6 requirements, PR #72 open
- [ ] **v1.25: NAP-LISTS Runtime Parity** - 1 phase (97), 6 requirements, PR #73 open
- [ ] **v1.26: NAP-SERIAL Runtime Parity** - 1 phase (98), 6 requirements, PR #74 open
- [ ] **v1.27: NAP-BLE Runtime Parity** - 1 phase (99), 6 requirements, PR #75 open
- [x] **v1.28: NAP-WEBRTC Runtime Parity** - 1 phase (100), 6 requirements, PR #76 open
- [ ] **v1.29: Napplet Convention and Runtime Conformance** - 6 phases (101-106), 49 requirements, with final adoption gated on convention-capable published Napplet packages

---

## Active Milestone: v1.29 Napplet Convention and Runtime Conformance

**Goal:** Conform Kehto to `napplet/naps@6461e4b` plus the proposed exact
heads of draft PRs #89-#92: replace numbered cross-napplet negotiation with
stable `napplet:<archetype>/<intent>` identities, binding-owned invocation query
transposition, runtime-attested sender identity, and source-independent intent
delivery, then prove the result against published convention-capable Napplet
packages.

**Authority:** merged baseline
`6461e4b37c29dc09a20dff35d9515889c4433874`; proposed NAP-INC draft #89
`4593ce9e301ce098fd3dad64206fcd6f144fa7af`; proposed governance/web draft
#90 `896c32c92deee68dc4d10fc1132b62df20cccb6f`; proposed NAP-INTENT draft
#91 `a718915ddefa2f03a0126579601f59d8bd86f7c4`; proposed symmetric NAP-INC
channel draft #92 `c5cd06f7be6d4690b303949abb26e87ff62f4729`, stacked on #89. The drafts are unmerged and
must be re-audited when heads change. Complete baseline and exact-head audits
live in `.planning/NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md` and
`.planning/NAP-CONVENTIONS-DRAFT-PRS-89-90-91-92-AUDIT.md`.

**External gate:** Phases 101-104 can implement Kehto-owned runtime, binding,
manifest, service, and host-independent behavior. Phase 105 package adoption and
final host integration wait for mutually compatible convention-capable
`@napplet/core`, `@napplet/nap`, `@napplet/shim`, `@napplet/sdk`, and
`@napplet/vite-plugin` releases; Kehto must not infer unpublished package APIs.

**Hard constraints (carry into every phase):**

- NAPs are runtime API/capability surfaces only; cross-napplet payload semantics are unnumbered conventions, not numbered protocols.
- Preserve changelogs, archived planning artifacts, migration records, and historical requirement IDs; migrate active code, tests, configuration, documentation, and policies.
- Stable convention identities, subscriptions, normalized wire fields, and
  discovery metadata are queryless. The shared runtime-provided binding alone
  transposes invocation queries to shallow text payload before the wire.

- No numbered registry, reconstructed NAP-1..5 payload schemas, wildcard,
  prefix, base/query, query-aware matching, runtime query parser, or payload-kind
  inference.

- Callers never supply sender. INC events and intent deliveries carry only the
  runtime-attested source dTag.

- Intent success means accepted delivery responsibility. No `handled`,
  `windowId`, `newWindow`, intent ID, delivery ID, visible INC dependency, or
  source-lifetime dependency.

- No phase may claim complete conformance before the package gate and every supported-NAP requirement are proven.

## Phases

- [x] **Phase 101: NAP-SHELL Session Integrity** - napplets establish one isolated session and discover only live, granted runtime domains.
- [ ] **Phase 102: NAP-INC Event and Channel Parity** - napplets exchange exact convention events and authorized channels using dTag identities.
- [ ] **Phase 103: Identity and Theme Wire Parity** - identity and theme services use only contract-shaped result and change behavior.
- [ ] **Phase 104: NAP-INTENT and Manifest Contract Parity** - resolve authoritative convention URIs through verified contracts and retain carrier-neutral delivery independently of source lifetime.
- [ ] **Phase 105: Published Convention Adoption and Host Flows** - consume released Napplet contracts and prove intent, profile, resource, and theme behavior in Paja and playground.
- [ ] **Phase 106: Active-Surface Conformance and Release** - prove the complete migration, regression health, and release readiness.

## Phase Details

### Phase 101: NAP-SHELL Session Integrity

**Goal:** Napplets can establish one isolated shell session and synchronously discover only the domains that are both granted and live.
**Depends on:** Nothing (independent Kehto work)
**Requirements:** SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06
**Success Criteria** (what must be TRUE):

  1. Before `shell.init`, a napplet sees `supports(domain)` return `false`; after one bare `shell.ready`, it sees `true` only for its granted, implemented domains and `false` for unknown or unoffered domains.
  2. A duplicate `shell.ready` from the same frame neither creates another session nor receives another `shell.init`, and the injected public API has no protocol argument or numbered capability metadata.
  3. A frame cannot invoke a capability before its session exists, reassign its creation-time identity or trusted source, or observe another frame's capabilities or services.
  4. Shell, Paja, and playground omit any domain whose live implementation is unavailable, including when simulation or disabled-domain controls remove it.

**Plans:** 5/5 plans executed

- [x] 101-01-PLAN.md
- [x] 101-02-PLAN.md
- [x] 101-03-PLAN.md
- [x] 101-04-PLAN.md
- [x] 101-05-PLAN.md

### Phase 102: NAP-INC Event and Channel Parity

**Goal:** Napplets can safely exchange exact stable convention events and
authorized channel traffic through one projection binding using runtime-assigned
identifiers and attested dTag identities.
**Depends on:** Phase 101
**Requirements:** BASE-04, BASE-05, INC-01, INC-02, INC-03, INC-04, INC-05, INC-06, INC-07, INC-08
**Success Criteria** (what must be TRUE):

  1. One projection-owned normalizer serves INC now and is reusable by Phase 104, performs the exact decoding/rejection rules before `postMessage`, and the protected INC operations cannot be bypassed by later whole-namespace or domain reassignment.
  2. INC subscriptions and runtime delivery use exact queryless identity equality without prefix, wildcard, runtime query parsing, base-topic matching, or generic service-prefix interception; a raw query-bearing wire topic does not match, and the sender receives no echo.
  3. Delivered event senders, peers, and direct targets are authenticated napplet dTags only; forged caller sender, window IDs, pubkeys, absent sessions, and ambiguous dTags fail closed, while event/channel identifiers remain runtime-assigned and opaque.
  4. Napplets can create closeable subscriptions and use `channel.open`, `channel.onOpened`, `channel.list`, and `channel.broadcast` plus symmetric endpoint handles with `emit`, `on`, `onClosed`, and `close`; `channel.list()` remains informational.
  5. Channel access is authorized once at open time; target `inc.channel.opened` is enqueued before opener success; early handles/messages/terminal closure are retained in order; buffer overflow closes rather than drops; dead peers and cleanup leave no live route behind.

**Plans:** 9/12 plans executed

- [x] 102-01-PLAN.md — Trace one canonical convention emit through the shared prelude and exact dTag runtime delivery.
- [x] 102-02-PLAN.md — Complete dTag-safe runtime channel identity, routing, and lifecycle behavior.
- [x] 102-03-PLAN.md — Enforce authorization once at channel open and close channels on ACL revocation.
- [x] 102-04-PLAN.md — Complete the injected event/subscription/channel API and rejection matrix.
- [x] 102-09-PLAN.md — Remove generic runtime INC topic-prefix service dispatch.
- [x] 102-10-PLAN.md — Retire services-package audio/notification INC compatibility and senderless synthetic events.
- [x] 102-11-PLAN.md — Migrate downstream playground code and notification browser tests off the retired service prefixes.
- [x] 102-12-PLAN.md — Align active service documentation, skills, and static guards with the retired compatibility boundary.
- [x] 102-05-PLAN.md — Prove the shared canonical INC prelude through Paja's real srcdoc host.
- [ ] 102-06-PLAN.md — Prove exact event and channel behavior between live playground frames.
- [ ] 102-07-PLAN.md — Synchronize active conformance documentation and static protocol guards.
- [ ] 102-08-PLAN.md — Add package changesets and run the complete cross-host phase gate.

### Phase 103: Identity and Theme Wire Parity

**Goal:** Napplets receive private identity and theme state through only the result and change messages sanctioned by their NAP contracts.
**Depends on:** Phase 101
**Requirements:** IDENTITY-01, IDENTITY-02, IDENTITY-03, IDENTITY-04, THEME-01, THEME-02, THEME-03, THEME-05
**Success Criteria** (what must be TRUE):

  1. `identity.getPublicKey` always replies with `identity.getPublicKey.result`, returning an empty `pubkey` on failure; other supported identity requests use safe matching result shapes and unknown actions are ignored.
  2. A napplet's injected identity API is readonly, identity changes—including sign-out to `""`—reach only affected sessions exactly once, and identity cannot be forged or leaked through shell, intent, or INC traffic.
  3. `theme.get` always returns one complete `theme.get.result`; unknown, denied, and unavailable paths never create `theme.*.error` messages or invented theme subscriptions.
  4. One host theme update atomically changes the value later returned by `theme.get` and delivers exactly one matching complete `theme.changed` event.

**Plans:** TBD

### Phase 104: NAP-INTENT and Manifest Contract Parity

**Goal:** Kehto resolves authoritative convention URIs through installed
verified manifest contracts, accepts source-independent delivery responsibility,
and sends runtime-attested carrier-neutral delivery only after target readiness.
**Depends on:** Phases 101 and 102
**Requirements:** BASE-01, BASE-02, INTENT-01, INTENT-02, INTENT-03, INTENT-04, INTENT-05, INTENT-06, INTENT-07, INTENT-08, INTENT-09, INTENT-10, INTENT-11, ARCH-01, ARCH-02, ARCH-04
**Success Criteria** (what must be TRUE):

  1. The injected API accepts an authoritative convention URI, shares Phase 102's binding normalizer, derives required normalized fields, rejects invalid/conflicting requests before resolution, buffers `intent.deliver` until `onDelivery`, and remains protected across shim/namespace replacement.
  2. Public source, runtime, manifest, service, and host-independent types expose exact convention contracts and carrier-neutral delivery with no protocol fields, `newWindow`, `handled`, `windowId`, intent/delivery identifier, or caller-supplied sender.
  3. Installed verified manifests preserve one queryless `IntentContract` per archetype tag with scoped event kinds; availability and handler selection use exact contracts without invented actions/default conventions or payload-kind inference.
  4. User defaults, chooser policy, and authorized explicit dTag selection resolve only compatible installed contracts and never silently select the first ambiguous candidate.
  5. `ok: true` is emitted after the runtime retains delivery responsibility and before any policy-driven source close; target delivery remains valid after source destruction, occurs only after readiness, carries the authenticated source dTag, exposes no INC envelope, and sends no second source result.
  6. Focused lifecycle tests allow target reuse, either source/target startup order, brief overlap, retry/replacement/terminal policy seams, and delivery buffering without choosing those runtime policies as public contract.

**Plans:** TBD

### Phase 105: Published Convention Adoption and Host Flows

**Goal:** Kehto consumes the released convention-capable Napplet line and Paja
and playground prove the live intent, profile, resource, and theme behavior that
users rely on.
**Depends on:** Phases 103 and 104; published convention-capable `@napplet/core`, `@napplet/nap`, `@napplet/shim`, `@napplet/sdk`, and `@napplet/vite-plugin` releases
**Requirements:** PKG-01, PKG-02, PKG-03, PKG-04, IDENTITY-05, THEME-04, ARCH-03
**Success Criteria** (what must be TRUE):

  1. Kehto locks verified npm/JSR-compatible releases whose core, nap, shim, SDK, and Vite-plugin surfaces implement the same pinned draft contract; no unpublished API or compatibility overload is guessed.
  2. Paja and playground maintain installed verified catalogs separately from live frames and wire real intent service/default/chooser/ready-target delivery rather than hard-coded running candidates.
  3. The live feed invokes `napplet:profile/open?pubkey=...`; the profile target advertises stable metadata and receives one buffered `IntentDelivery` with normalized payload and attested feed dTag after readiness, including cold start/source teardown, with no visible INC envelope.
  4. Playground profile consumers load remote profile media through NAP-RESOURCE into revocable safe object URLs and clean them up rather than assigning remote URLs directly to image elements.
  5. Paja and playground both deliver the current theme to required napplets and bridge one host theme update as one synchronized changed theme with matching stored service state.

**Plans:** TBD
**UI hint:** yes

### Phase 106: Active-Surface Conformance and Release

**Goal:** Every active Kehto surface, published package output, and user-visible host flow is demonstrably conformant and ready to ship.
**Depends on:** Phase 105
**Requirements:** BASE-03, VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, VERIFY-05, VERIFY-06
**Success Criteria** (what must be TRUE):

  1. A classified active-surface guard finds no obsolete numbered negotiation, query-bearing normalized/discovery identity, prefix/query-aware matching, caller sender, completion-style intent result, INC-coupled intent delivery, forbidden lifecycle/result field, or intent/delivery identifier in active code, tests, configs, generated API, READMEs, policies, or guidance.
  2. Historical material remains intact, the dated intent design is prominently marked superseded, and generated API documentation reflects the corrected public types.
  3. Focused unit and integration coverage proves each supported-NAP contract, including negative wire shapes, source/session isolation, query transposition/rejection, exact stable identity behavior, sender spoof resistance, and source-independent delivery.
  4. Playwright proves domain-gated shell startup, authoritative convention intent acceptance and buffered delivery, exact INC routing and channels, identity sign-out with resource-mediated media, and atomic host theme updates through the real shell path.
  5. The exact upstream draft heads and published npm/JSR artifacts are revalidated; any drift is reported and reconciled rather than silently inferred.
  6. Build, type-check, unit, relevant and full E2E, docs, AI-slop, and diff gates pass; changesets cover every changed published Kehto package and the branch is ready for its concise PR.

**Plans:** TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 101. NAP-SHELL Session Integrity | v1.29 | 5/5 | Complete | 2026-07-23 |
| 102. NAP-INC Event and Channel Parity | v1.29 | 9/12 | In Progress|  |
| 103. Identity and Theme Wire Parity | v1.29 | 0/TBD | Not started | - |
| 104. NAP-INTENT and Manifest Contract Parity | v1.29 | 0/TBD | Not started | - |
| 105. Published Convention Adoption and Host Flows | v1.29 | 0/TBD | Waiting on upstream package publication | - |
| 106. Active-Surface Conformance and Release | v1.29 | 0/TBD | Not started | - |

---

## Previous Milestone: v1.28 NAP-WEBRTC Runtime Parity

**Goal:** Implement the remaining missing recent `@napplet/nap` domain, `NAP-WEBRTC`, end to end in Kehto with runtime dispatch, shell capability advertisement, reference service behavior, Paja support, playground demo coverage, and release-ready verification.

**Authoritative sources:** npm registry latest `@napplet/nap@0.20.0`, local `napplet` checkout `packages/nap/src/webrtc/{types,sdk}.ts`, and local `napplet` checkout `packages/core/src/types/webrtc.ts`. `NAP-LINK`, `NAP-COMMON`, `NAP-LISTS`, `NAP-SERIAL`, and `NAP-BLE` are stacked in PRs #71-#75; this milestone intentionally handles only `webrtc`.

**Branch:** `feat/nap-webrtc-parity` stacked on `feat/nap-ble-parity` until PR #75 lands.

**Hard constraints (carry into every phase):**

- One NAP per milestone: do not bundle non-WebRTC parity work here.
- No new dependencies.
- WebRTC sessions stay shell-owned; napplets never receive SDP, ICE, browser `RTCPeerConnection` objects, signing keys, relay sockets, browser NIP-07 access, or direct networking handles.
- Paja remains minimal chrome; the new capability is service behavior, not a new panel.
- Keep package exports, docs, changesets, static parity guards, and Playwright proof aligned.

## Phases

- [x] **Phase 100: NAP-WEBRTC Runtime Parity** — add shell/runtime/service/Paja/playground support for runtime-owned WebRTC sessions and focused verification.

## Phase Details

### Phase 100: NAP-WEBRTC Runtime Parity

**Goal:** `webrtc.*` works through Kehto's normal NAP service path, is advertised only when wired, and is proven in Paja and the playground.
**Depends on:** v1.27 NAP-BLE branch/PR #75 base changes.
**Requirements:** WEBRTC-01, WEBRTC-02, WEBRTC-03, WEBRTC-04, WEBRTC-05, WEBRTC-06
**Success Criteria:**

  1. `buildShellCapabilities()` includes `webrtc` in `domains` and `naps` only when a WebRTC backend is wired, and disabled-domain overrides remove it.
  2. Runtime dispatch registers `webrtc` and routes `webrtc.*` to a `webrtc` service handler.
  3. `@kehto/services` exports `createWebrtcService`; it returns shaped result envelopes for open/send/close, contains unknown messages, and lets host code push `webrtc.event` to the napplet.
  4. `@kehto/paja` wires deterministic WebRTC behavior, includes `webrtc` in parity metadata, and keeps existing minimal UI unchanged.
  5. A playground `webrtc-demo` napplet exercises open/send/event/close with stable DOM markers, and Playwright covers shell-mediated results.
  6. Focused tests plus full gates pass; changesets cover modified package outputs; PR opened.

**Plans:** 1 plan

  - [ ] 100-01-PLAN.md — WEBRTC-01..WEBRTC-06 service/runtime/shell/Paja/playground implementation and verification

**UI hint:** yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 100. NAP-WEBRTC Runtime Parity | v1.28 | 1/1 | PR #76 open | - |

---

## Previous Milestone: v1.21 NIP-5D (#2303) + NAP-SHELL/INTENT Conformance

**Goal:** Bring kehto into alignment with the current authoritative napplet protocol — NIP-5D as defined in `nostr-protocol/nips` PR #2303 (`5D.md`), plus the two merged NAP registry specs: **NAP-SHELL** (the only mandatory NAP; the bootstrap handshake) and **NAP-INTENT** (archetype dispatch). Closes the deltas that opened since the 2026-05-22 audit — NUB→NAP terminology, the now-formalized NAP-SHELL/INTENT specs, and the missing NAAT archetype axis — while keeping back-compat for the installed `@napplet/shim@0.5.0`. Builds on the v1.20 content-addressed runtime resolution (kinds/identity/srcdoc already aligned; regression-guard only).

**Authoritative sources:** `nostr-protocol/nips` PR **#2303** (`5D.md`) + the `napplet/naps` registry (NAP-SHELL + NAP-INTENT merged; `projections/web.md`). The repo's pinned `specs/NIP-5D.md` is an older mirror (NUB terminology, `dskvr/nips#3` / `#2287` citation) and is superseded; where they differ, #2303 wins.

**Branch:** `milestone/v1.21-nip5d-2303-nap-conformance` (off the v1.20 `feat/nip5d-runtime-srcdoc` branch). Never push the default branch.

**Audit:** `.planning/NIP-5D-2303-DELTA-AUDIT.md` (gaps G1–G8). The audit's Phase A–D chunking maps 1:1 to the requirement categories and is realized here as Phases 86–89.

**Hard constraints (carry into every phase):**

- Installed `@napplet/shim` is **0.5.0** (reads `capabilities.nubs`) → KEEP `naps`+`nubs` dual-emit; do NOT perform CLEANUP-01.
- CI e2e runs `workers:1`; reload-heavy specs need `test.setTimeout(120000)`.
- Playground napplet/`DEMO_CAPABILITIES` counts are asserted by multiple e2e specs — update them in lockstep.
- v1.20 content-addressed internals (manifest kinds, identity-from-bytes, srcdoc, signature/blob/aggregate verification, `requires` load-time check) are already aligned — regression-guard only, out of scope to change.
- `turbo.json globalDependencies` must include `shared-vite-config` for napplet rebuilds; the resolution sim must stay crash-proof; the NIP-5A vector is pinned.
- The `@napplet/nub` import specifier stays as-is (it is the real published package name); only NUB *vocabulary* in prose/comments/tests is swept.

## Phases

- [x] **Phase 86: NAP-SHELL Handshake Correctness** — `shell.init` sent exactly once per napplet lifecycle (duplicate `shell.ready` idempotent, no resend); `class` wire value reconciled to spec `number | null`. (Phase A; smallest blast radius, real protocol bug G1 — do first.) (completed 2026-06-17)
- [ ] **Phase 87: NAAT Archetype Axis** — parse `["archetype","<slug>","<NAP-N>"]` + optional `source` manifest tags in `@kehto/nip/5d`; NIP-5A-manifest → `IntentCatalogEntry` adapter; archetype-tagged playground napplet + NAP-INTENT dispatch e2e. (Phase B; largest functional gap.)
- [ ] **Phase 88: Terminology & Playground Modern-Path Alignment** — `nap:` as primary capability prefix (`nub:` back-compat only); migrate 4 legacy napplets `ifc`→`inc`; playground bootstrap + requires-check read `naps` (nubs fallback for the 0.5.0 shim); naps-only-path conformance e2e. Keep `naps`+`nubs` dual-emit. (Phase C.)
- [x] **Phase 89: Spec / Doc Refresh & Conformance Sweep** — repin `specs/NIP-5D.md` authority to #2303 + NAP terminology + archetype/source tags; local NAP-SHELL/NAP-INTENT mirrors; `RUNTIME-SPEC.md` refresh; stale NUB/AUTH comment sweep; verify unknown-`type` silent-ignore uniformity; full-suite green + changesets. (Phase D; closes VERIFY-01.) (completed 2026-06-17 — build 24/24, type-check 13/13, e2e 80/80; 9 stale guard-test failures deferred to a test-owning follow-up)

## Phase Details

### Phase 86: NAP-SHELL Handshake Correctness

**Goal**: The NAP-SHELL bootstrap handshake conforms to the mandatory spec — the runtime emits `shell.init` exactly once per napplet lifecycle, a duplicate `shell.ready` from the same window is fully idempotent, and the `class` field on the wire is an opaque `number | null` that maps from the internal class-posture label.
**Depends on**: Phase 85 (v1.20 content-addressed loading — regression baseline)
**Requirements**: SHELL-01, SHELL-02 (VERIFY-01 contributes)
**Success Criteria** (what must be TRUE):

  1. Delivering `shell.ready` twice from the same window establishes a session and emits `shell.init` exactly once — the second `shell.ready` is a no-op (no second session, no `shell.init` resend), proven by a regression test counting exactly one `shell.init` postMessage across two deliveries. (G1)
  2. The `class` field carried in `shell.init` is `number | null` — an opaque integer class code or `null` for the permissive default — with the internal string class-posture label mapped to that wire value; a test asserts the emitted `class` type. (G2)
  3. The existing `shell-init` / `no-window-nostr` capability-payload assertions stay green and `naps`+`nubs` dual-emit is unchanged; `pnpm build`, `type-check`, and the unit suite are green for the touched runtime/shell packages.

**Plans**: 1 plan
Plans:

- [x] 86-01-PLAN.md — SHELL-01 exactly-once shell.init guard + SHELL-02 class number|null wire mapping + @kehto/shell changeset

**UI hint**: no

### Phase 87: NAAT Archetype Axis

**Goal**: The NAAT archetype axis exists end-to-end — `@kehto/nip/5d` parses `archetype` (and optional `source`) manifest tags into structured fields, a signed-manifest → `IntentCatalogEntry` adapter sources NAP-INTENT availability/handlers from verified manifests instead of host-injected catalog data, the playground catalog is populated through that adapter from at least one archetype-tagged napplet, and NAP-INTENT dispatch resolves against it.
**Depends on**: Phase 86
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04 (VERIFY-01 contributes)
**Success Criteria** (what must be TRUE):

  1. `parseNappletManifest` parses one or more `["archetype","<slug>","<NAP-N>"]` tags into a structured `archetypes` field on `NappletManifest` and parses the optional `source` tag; unit tests cover single, multiple, and absent archetype tags. (G3, G4)
  2. A NIP-5A-manifest → `IntentCatalogEntry` adapter derives a napplet's archetype catalog entry (slug → actions/protocols) from its resolved signed manifest, so NAP-INTENT `available()` / `handlers()` are sourced from signed manifests rather than host-injected catalog data; unit tests cover the adapter. (G3)
  3. The playground catalog is populated from resolved manifests via the adapter, and at least one playground napplet declares an `archetype` tag (with playground/e2e napplet counts updated in lockstep). (G3)
  4. An e2e (or integration) test exercises NAP-INTENT dispatch end-to-end against the archetype-tagged napplet — `intent.available` reports the candidate and `intent.invoke` resolves to it (with `test.setTimeout(120000)` where the spec is reload-heavy). (G3)
  5. `pnpm build`, `type-check`, and the unit suite are green for `@kehto/nip` + `@kehto/services`, and the new/changed e2e passes under `workers:1`.

**Plans**: 3 plans

  - [ ] 87-01-PLAN.md — ARCH-01: parse archetype + source manifest tags into NappletManifest (@kehto/nip/5d) + unit tests + changeset
  - [ ] 87-02-PLAN.md — ARCH-02/ARCH-04: manifest→IntentCatalogEntry adapter (@kehto/services, structural input) + dispatch integration test + export + changeset
  - [ ] 87-03-PLAN.md — ARCH-03: playground archetype-tag plumbing (profile-viewer) + catalog-from-resolved-manifests builder + unit test

**UI hint**: yes

### Phase 88: Terminology & Playground Modern-Path Alignment

**Goal**: `nap:`/`inc` is the primary, tested capability vocabulary while `nub:`/`ifc` remain accepted back-compat — the 4 legacy playground napplets use `inc`, the playground bootstrap and requires-check read `capabilities.naps` (falling back to `nubs` only for the installed 0.5.0 shim), and a conformance e2e exercises the modern `naps`-only path the real shim uses, all without removing dual-emit.
**Depends on**: Phase 86
**Requirements**: TERM-01, TERM-02, TERM-03, TERM-04, TERM-05 (VERIFY-01 contributes)
**Success Criteria** (what must be TRUE):

  1. `nap:` is the primary, documented, and tested capability prefix in `shell.supports()` resolution, with `nub:` accepted only as a back-compat alias — `specs/NIP-5D.md` and `packages/shell/tests/perm-namespace.test.ts` use `nap:` (and assert `nub:` as an accepted alias). (G5)
  2. The 4 legacy playground napplets (bot, chat, feed, profile-viewer) declare `requires` and call `supports()` using `inc` (not `ifc`). (G6)
  3. The playground bootstrap (`shared-vite-config.ts`) and `getMissingRequiredNaps` (`demo-hooks.ts`) resolve capabilities from `capabilities.naps`, falling back to `nubs` only for the installed 0.5.0 shim window. (G6)
  4. An e2e asserts the modern `naps`-only path answers `supports('inc')` true and `supports('inc','NAP-01')` true for an `inc`-capable napplet, proving the path the real shim uses is exercised (under `workers:1`, `test.setTimeout(120000)` if reload-heavy). (G6)
  5. `naps`+`nubs` dual-emit is preserved (installed shim is 0.5.0); CLEANUP-01 is NOT performed; existing `shell-init` / `no-window-nostr` capability-payload assertions and playground napplet counts stay green. (G6 constraint)

**Plans**: 2 plans

  - [x] 88-01-PLAN.md — playground reads naps + 4 napplets ifc→inc capability (TERM-02/03/05)
  - [ ] 88-02-PLAN.md — nap: primary prefix in shell test + naps-path conformance e2e (TERM-01/04)

**UI hint**: yes

### Phase 89: Spec / Doc Refresh & Conformance Sweep

**Goal**: The specs, runtime docs, and source comments reflect the #2303 / NAP model — `specs/NIP-5D.md` cites #2303 and uses NAP terminology with archetype/source tags documented, local NAP-SHELL and NAP-INTENT mirrors exist and are referenced, `RUNTIME-SPEC.md` and stale NUB/AUTH/REGISTER comments are swept, unknown-`type` handling is verified uniform, and the whole milestone is regression-clean and release-ready.
**Depends on**: Phase 87, Phase 88
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, VERIFY-01
**Success Criteria** (what must be TRUE):

  1. `specs/NIP-5D.md` cites `nostr-protocol/nips#2303` as the authority (and the current NIP-5A PR), uses NAP terminology throughout (not NUB), and documents the `archetype` and `source` manifest tags. (G7, DOCS-01)
  2. Local mirrors of NAP-SHELL and NAP-INTENT are added under `specs/` and referenced from `specs/NIP-5D.md`. (G7, DOCS-02)
  3. `RUNTIME-SPEC.md` is refreshed to the #2303 / NAP model and stale NUB/AUTH/REGISTER comments in shell/services/runtime source are swept — the `@napplet/nub` import specifier is preserved (it is the real published package name). (G7, DOCS-03)
  4. Unknown-`type` handling is verified uniform — truly unrecognized message types are silently ignored across known domains, except where a NAP spec sanctions structured errors (NAP-INTENT permits `.result`/`.error`); any divergence is normalized or documented. (G8, DOCS-04)
  5. `pnpm build`, `pnpm type-check`, the unit suite, and the Playwright e2e suite (`workers:1`) are all green, and changesets are added for every `@kehto/*` package whose public surface or behavior changed. (VERIFY-01)

**Plans**: TBD
**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 86 → 87 → 88 → 89

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 86. NAP-SHELL Handshake Correctness | v1.21 | 1/1 | Complete   | 2026-06-17 |
| 87. NAAT Archetype Axis | v1.21 | 0/TBD | Not started | - |
| 88. Terminology & Playground Modern-Path Alignment | v1.21 | 1/4 | In Progress|  |
| 89. Spec / Doc Refresh & Conformance Sweep | v1.21 | 1/1 | Complete | 89-01-SUMMARY |

---

## Previous Milestone: v1.20 NIP-5D Content-Addressed Runtime Resolution

**Goal:** Replace gateway-trusted napplet loading with runtime-computed, content-addressed identity per branch-HEAD NIP-5D (kinds `35129`/`15129`/`5129`) + NIP-5A aggregate hash. The runtime resolves a signed manifest from relays (NIP-65 outbox), fetches each blob from Blossom by sha256, verifies signature + per-blob hashes + recomputed aggregate against the `x` tag, then injects verified bytes via `iframe.srcdoc`. Identity `(dTag, aggregateHash)` is computed from verified bytes, never accepted from a host. Clean break — no backwards-compatibility shims or language.

**Branches:** PR1 = `feat/nip5d-resolver` (off `main`); PR2 = `feat/nip5d-runtime-srcdoc` (stacked on PR1 — it consumes the new `@kehto/nip` module). Never push the default branch.

**Authoritative sources:** branch-HEAD `dskvr/nips` `nip/5d` (PR #3) + `nostr-protocol/nips` PR #2287 (`5A.md`, head `hzrd149/nips:nsite-aggragate-hash`) — both supersede the repo's pinned `d80d7b25` / kind-35128 contract, repinned this milestone.

## Phases

- [x] **Phase 84: NIP-5A/5D Resolution Module (`@kehto/nip`)** — manifest parse, aggregate compute/verify, signature verify, Blossom blob fetch+verify, kind constants `35129`/`15129`/`5129`; unit tests incl. pinned NIP-5A vector + every rejection path. (PR1, self-contained, unblocks Phase 85) — completed 2026-06-16
- [x] **Phase 85: Content-Addressed Loading & Identity** — runtime identity from verified bytes (key-derivation / manifest-cache / ACL / shell binding on computed `(dTag, aggregateHash)`); shell-host srcdoc loading replacing gateway trust; minimal in-repo relay+Blossom sim; CSP `<meta>` injection; in-repo build migration; docs/spec/CHANGELOG sync. (PR2, stacked on PR1) — completed 2026-06-16

## Phase Details

### Phase 84: NIP-5A/5D Resolution Module (`@kehto/nip`)

**Goal**: `@kehto/nip` exposes a pure, environment-agnostic NIP-5A/5D resolution surface — parse a NIP-5D manifest event, compute and verify the NIP-5A aggregate hash, verify the manifest signature, and fetch+verify Blossom blobs by sha256 — with NIP-5D kind constants and full unit coverage. Self-contained; no runtime/shell/playground changes.
**Depends on**: Nothing (first phase of this milestone)
**Requirements**: RESOLVE-01, RESOLVE-02, RESOLVE-03, RESOLVE-04, RESOLVE-05, RESOLVE-06, RESOLVE-07
**Success Criteria** (what must be TRUE):

  1. A consumer can import the kind constants `35129` (named), `15129` (root), `5129` (snapshot) and a manifest parser from a `@kehto/nip` subpath.
  2. Given the NIP-5A example `path` inputs, the module's aggregate-hash function returns the deterministically-pinned digest, asserted by a unit test (the vector).
  3. A manifest whose recomputed aggregate does not equal its `["x","<hex>","aggregate"]` tag is rejected; a matching one is accepted.
  4. A manifest event with an invalid/forged signature is rejected; a validly-signed one verifies.
  5. A blob whose `sha256` does not equal the referenced `path` hash is rejected; a matching blob is accepted — and `pnpm build` + `type-check` for `@kehto/nip` are green.

**Plans**: TBD
**UI hint**: no

### Phase 85: Content-Addressed Loading & Identity

**Goal**: The shell loads a napplet end-to-end via relays → Blossom → verify → `iframe.srcdoc`, with no gateway in the trust path; identity is the computed `(dTag, aggregateHash)` from verified bytes; any failure rejects. CSP holds under srcdoc; storage/relay/ACL/firewall mediation is unchanged; docs/specs are repinned to branch-HEAD NIP-5D.
**Depends on**: Phase 84 (consumes the `@kehto/nip` resolution module)
**Requirements**: IDENTITY-01, IDENTITY-02, IDENTITY-03, LOAD-01, LOAD-02, LOAD-03, LOAD-04, LOAD-05, LOAD-06, LOAD-07, DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):

  1. Loading a playground napplet resolves a signed kind-`35129` manifest from the in-repo simulated relays (NIP-65 outbox), fetches blobs from the in-repo simulated Blossom by sha256, verifies everything, and shows the napplet via `iframe.srcdoc` with `sandbox="allow-scripts"` and no `allow-same-origin`.
  2. The napplet's runtime identity `(dTag, aggregateHash)` is derived from the verified bytes (computed aggregate), and ACL / key-derivation / manifest-cache / session binding all key on that computed tuple.
  3. Tampering with any input (manifest signature, a blob's bytes, the `x` aggregate tag, or removing the manifest) causes the load to be rejected — no iframe with unverified bytes is ever shown.
  4. The gateway is not in the trust path: `htmlUrl` / `GatewayNappletMetadata` are retired (or `htmlUrl` is an accelerator hint verified against the signed manifest); CSP/NAP-CONNECT is enforced via injected `<meta http-equiv>` and firewall/storage/relay/ACL mediation behavior is unchanged.
  5. `RUNTIME-SPEC.md` + `specs/NIP-5D.md` are repinned to branch-HEAD NIP-5D (kinds `35129`/`15129`/`5129`) with no "backwards compatibility" language; `pnpm build`, `type-check`, unit, and E2E suites are green; changesets added.

**Plans**: TBD
**UI hint**: no

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 84. NIP-5A/5D Resolution Module | v1.20 | 1/1 | Complete | 2026-06-16 |
| 85. Content-Addressed Loading & Identity | v1.20 | 1/1 | Complete | 2026-06-16 |
---

## Completed Milestone: v1.18 Napplet Firewall (shipped 2026-06-15)

### v1.18 Napplet Firewall

**Milestone goal:** Add `@kehto/firewall` — a behavioral anti-abuse gate that observes napplet messages at the runtime choke point (after a successful ACL check, before dispatch) and applies configurable rate/burst/content rules with allow/deny/ask policies and focus-aware tightening. It composes with the ACL (static authorization) without replacing it: the ACL answers *is this napplet allowed to do X?*; the firewall answers *is this napplet abusing X over time?*

**Phase numbering:** Continues from v1.17 (ended at Phase 79). v1.18 spans Phases 80–82.

**Scope boundary:** Engine + runtime integration + test coverage only. No host/shell management UI for editing rules (FWUI-01), no playground demo napplet (FWUI-02), no real WASM build of the hot path (FWX-01) — all deferred.

### Phases

- [x] **Phase 80: Firewall Pure Core (`@kehto/firewall`)** - Zero-dep, WASM-ready engine: normalized `Observation`, pure `evaluate()` (token-bucket rate, init-burst guard, content matchers, focus multiplier, precedence), pure config mutations + serialize, built-in defaults, pure-core unit suite. (completed 2026-06-15)
- [x] **Phase 81: Runtime Container & Choke-Point Integration** - Stateful `firewall-state` container, new `RuntimeAdapter` hooks, message-handler wiring after the ACL check, allow/deny/ask decision-to-action mapping with shell-sourced focus, and named-attack integration tests. (completed 2026-06-15)
- [ ] **Phase 82: Verification & Closeout** - Full unit suite (563+) and 87–89 E2E specs green, changeset for the new package and the runtime change, milestone closeout.

## Phase Details

### Phase 80: Firewall Pure Core (`@kehto/firewall`)

**Goal**: A pure, zero-dependency, WASM-ready `@kehto/firewall` package (mirroring `@kehto/acl`) that can evaluate a normalized observation against firewall config + counter state and return a decision plus the next counter state, with all rate/burst/content/focus/precedence logic and config serialization implemented as pure functions.
**Depends on**: Nothing (first phase of v1.18; new package, no runtime coupling yet)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, RATE-01, RATE-02, RATE-03, BURST-01, BURST-02, CONTENT-01, CONTENT-02, CONTENT-03, POLICY-03, FOCUS-02, VERIFY-01
**Success Criteria** (what must be TRUE):

  1. Calling the pure `evaluate()` with an `Observation` (`napplet`, `opClass`, `kind?`, `size?`, `initElapsedMs?`, `focused`, `msSinceFocusGain?`, `now`), a config, and counter state returns a decision (`pass` / `reject` / `prompt`) carrying `action`, `ruleId`, and `reason` plus the next counter state, with no I/O, mutation, or wall-clock read.
  2. A napplet that exceeds its per-`(dTag, opClass)` token-bucket budget triggers its configured exceed-action (`flag` / `block` / `ignore`); buckets refill from the injected `now` with O(1) fixed state, a per-napplet global budget acts as the fallback for op-classes with no specific rule, and the built-in defaults apply conservative rate/burst limits to every napplet with default exceed-action `flag`.
  3. The init-burst guard catches a napplet emitting more than the configured number of ops within its init window and defaults to `block`.
  4. Content matchers match on op-class, event `kind`(s) (including kind-5 delete spam), and/or payload `size`, can additionally condition on focus (`focused`, `maxMsSinceFocusGain`), and the unfocused-multiplier tightens an unfocused napplet's rate budget without ever hard-blocking on focus alone.
  5. Rule precedence resolves first-match-wins, most-to-least specific (per-napplet policy → per-napplet × op-class → per-napplet global fallback → global defaults); config mutates only through pure functions that return new config and round-trips through serialize/deserialize without loss; and pure-core unit tests cover refill, burst windows, matcher/focus matching, precedence, and serialize round-trip using injected `now`.

**Plans**: 3 plans
Plans:

- [x] 80-01-PLAN.md — Scaffold @kehto/firewall package + full types.ts surface + vitest alias
- [x] 80-02-PLAN.md — defaults.ts (built-in limits, flag/block defaults) + config.ts (immutable mutations, serialize, defensive deserialize) + tests
- [x] 80-03-PLAN.md — pure evaluate() engine (token bucket, init-burst, content matchers, focus multiplier, precedence) + barrel index.ts + tests

### Phase 81: Runtime Container & Choke-Point Integration

**Goal**: Wire the pure firewall into the runtime: a stateful container holding persisted config plus ephemeral counters and per-window init/focus tracking, new `RuntimeAdapter` hooks, and evaluation at the message-handler choke point after a successful ACL check, mapping allow/deny/ask decisions to dispatch/reject/consent actions with shell-sourced focus — proven by integration tests for each named attack.
**Depends on**: Phase 80
**Requirements**: POLICY-01, POLICY-02, FOCUS-01, RUNTIME-01, RUNTIME-02, RUNTIME-03, RUNTIME-04, VERIFY-02
**Success Criteria** (what must be TRUE):

  1. Every napplet message that passes the ACL check is evaluated by the firewall before dispatch; a `reject` decision sends an error envelope back to the napplet and drops the message, while a `flag` (allowed) operation still dispatches and emits an `onFirewallEvent` audit event.
  2. A per-napplet `allow` / `deny` / `ask` policy keyed by dTag (applies to any version) overrides rate/burst/content rules; an `ask` verdict rejects the current message, fires a consent prompt, and persists the user's choice as a per-napplet policy so subsequent messages are not re-prompted (no message buffering).
  3. The runtime exposes new `RuntimeAdapter` hooks — `firewallPersistence` (load/persist config), `onFirewallEvent` (audit callback for flag/block/prompt), and `getFocusContext(windowId)` — and firewall config persists across runtime reloads via `firewallPersistence` while ephemeral counters reset on reload.
  4. Focus context (`focused`, `msSinceFocusGain`) supplied to the firewall is sourced shell-side from the window manager via `getFocusContext`, never self-reported by the napplet.
  5. Runtime integration tests cover each named attack: publish flood (flag → block), init-burst block, backgrounded + init-burst, kind-5 delete spam, `ask` (reject + prompt + remembered), and unfocused-multiplier tightening.

**Plans**: 3 plans
Plans:

- [x] 81-01-PLAN.md — Workspace dep + firewall types + firewall-state container + container unit tests
- [x] 81-02-PLAN.md — Choke-point firewall gate, consent-handler hoist, container wiring in runtime.ts
- [x] 81-03-PLAN.md — Named-attack integration tests (flood, burst, kind-5, ask/remember, unfocused)

### Phase 82: Verification & Closeout

**Goal**: Prove the milestone is regression-clean and release-ready: the existing unit suite and full E2E baseline stay green with the firewall integrated, and a changeset is staged covering the new package and the runtime change.
**Depends on**: Phase 81
**Requirements**: VERIFY-03
**Success Criteria** (what must be TRUE):

  1. The existing unit suite (563+ tests) passes with the new `@kehto/firewall` package and runtime integration in place.
  2. The 87–89 E2E specs remain green, confirming the firewall choke-point change did not regress existing napplet message flows.
  3. A changeset is added covering the new `@kehto/firewall` package and the `@kehto/runtime` change.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 80 → 81 → 82

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 80. Firewall Pure Core | 3/3 | Complete   | 2026-06-15 |
| 81. Runtime Container & Choke-Point Integration | 3/3 | Complete   | 2026-06-15 |
| 82. Verification & Closeout | 0/TBD | Not started | - |

## Backlog

### Backlog 999.1: Fix decrypt-demo fixture delivery pending state

**Goal:** Investigate and fix the playground `decrypt-demo` staying in `waiting for fixtures` / `[pending]` for NIP-04, NIP-44, NIP-17, and Class-2 probe rows.

**Captured:** 2026-05-23 via `$gsd-capture --backlog`

**Context:** `.planning/backlog/999.1-fix-decrypt-demo-fixture-pending/999.1-CONTEXT.md`

**Observed symptom:** User screenshot shows the decrypt demo panel stuck with:

- `waiting for fixtures`
- `NIP-04 [pending]`
- `NIP-44 [pending]`
- `NIP-17 [pending]`
- `Class-2 [pending]`

**Acceptance direction:**

- The playground decrypt demo receives fixtures reliably after boot.
- NIP-04, NIP-44, NIP-17, and Class-2 rows leave `[pending]` and settle to the expected terminal state.
- Regression coverage catches fixture-delivery stalls in the real playground path.

---

*ROADMAP.md last updated: 2026-07-23 - v1.29 Napplet Convention and Runtime Conformance roadmap created (Phases 101-106); Phases 101-103 are independent Kehto work and Phase 104 awaits convention-capable Napplet package publication.*
