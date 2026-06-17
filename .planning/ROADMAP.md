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
- [ ] **v1.21: NIP-5D (#2303) + NAP-SHELL/INTENT Conformance** - 4 phases (86-89), 16 requirements (active)

---

## Active Milestone: v1.21 NIP-5D (#2303) + NAP-SHELL/INTENT Conformance

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

- [ ] **Phase 86: NAP-SHELL Handshake Correctness** — `shell.init` sent exactly once per napplet lifecycle (duplicate `shell.ready` idempotent, no resend); `class` wire value reconciled to spec `number | null`. (Phase A; smallest blast radius, real protocol bug G1 — do first.)
- [ ] **Phase 87: NAAT Archetype Axis** — parse `["archetype","<slug>","<NAP-N>"]` + optional `source` manifest tags in `@kehto/nip/5d`; NIP-5A-manifest → `IntentCatalogEntry` adapter; archetype-tagged playground napplet + NAP-INTENT dispatch e2e. (Phase B; largest functional gap.)
- [ ] **Phase 88: Terminology & Playground Modern-Path Alignment** — `nap:` as primary capability prefix (`nub:` back-compat only); migrate 4 legacy napplets `ifc`→`inc`; playground bootstrap + requires-check read `naps` (nubs fallback for the 0.5.0 shim); naps-only-path conformance e2e. Keep `naps`+`nubs` dual-emit. (Phase C.)
- [ ] **Phase 89: Spec / Doc Refresh & Conformance Sweep** — repin `specs/NIP-5D.md` authority to #2303 + NAP terminology + archetype/source tags; local NAP-SHELL/NAP-INTENT mirrors; `RUNTIME-SPEC.md` refresh; stale NUB/AUTH comment sweep; verify unknown-`type` silent-ignore uniformity; full-suite green + changesets. (Phase D; closes VERIFY-01.)

## Phase Details

### Phase 86: NAP-SHELL Handshake Correctness
**Goal**: The NAP-SHELL bootstrap handshake conforms to the mandatory spec — the runtime emits `shell.init` exactly once per napplet lifecycle, a duplicate `shell.ready` from the same window is fully idempotent, and the `class` field on the wire is an opaque `number | null` that maps from the internal class-posture label.
**Depends on**: Phase 85 (v1.20 content-addressed loading — regression baseline)
**Requirements**: SHELL-01, SHELL-02 (VERIFY-01 contributes)
**Success Criteria** (what must be TRUE):
  1. Delivering `shell.ready` twice from the same window establishes a session and emits `shell.init` exactly once — the second `shell.ready` is a no-op (no second session, no `shell.init` resend), proven by a regression test counting exactly one `shell.init` postMessage across two deliveries. (G1)
  2. The `class` field carried in `shell.init` is `number | null` — an opaque integer class code or `null` for the permissive default — with the internal string class-posture label mapped to that wire value; a test asserts the emitted `class` type. (G2)
  3. The existing `shell-init` / `no-window-nostr` capability-payload assertions stay green and `naps`+`nubs` dual-emit is unchanged; `pnpm build`, `type-check`, and the unit suite are green for the touched runtime/shell packages.
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD
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
| 86. NAP-SHELL Handshake Correctness | v1.21 | 0/TBD | Not started | - |
| 87. NAAT Archetype Axis | v1.21 | 0/TBD | Not started | - |
| 88. Terminology & Playground Modern-Path Alignment | v1.21 | 0/TBD | Not started | - |
| 89. Spec / Doc Refresh & Conformance Sweep | v1.21 | 0/TBD | Not started | - |

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

*ROADMAP.md last updated: 2026-06-17 - v1.21 NIP-5D (#2303) + NAP-SHELL/INTENT Conformance roadmap created (Phases 86-89); v1.20 phases complete (PRs #38/#39 open).*
