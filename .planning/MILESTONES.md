# Milestones: Kehto Runtime

## v1.7 NIP-5D Spec Adoption & New NUB Domains (Shipped: 2026-04-24)

**Phases completed:** 5 phases (37-41), 17 plans, 24 tasks. Phase 42 (NIP-44 Decrypt) deferred to v1.8 — soft-gate unresolved on napplet/napplet#3.

**Delivered:** Shell resolves class posture synchronously; enforce.ts centralizes cross-NUB enforcement; shell is HTTP-header authority for per-napplet CSP with consent + revocation flows; two new NUB domains (CONFIG 9th + RESOURCE 10th) ship with reference services and demo napplets; carryover polish (nip66 demo wiring, @kehto/wm primitives, HostCacheBridge alias).

**E2E progression:** 54 → 72 passed / 0 failed / 0 skipped (+18 tests across 5 new spec files + 2 domain extensions).

**Key accomplishments:**

- **NIP-5D spec resync (SPEC-04):** `specs/NIP-5D.md` byte-identical to `dskvr/nips` nip/5d at commit `d80d7b25`, pulling in the class-posture delegation paragraph. README Specification section + sync header refreshed.
- **NUB-CLASS adoption (CLASS-01..06, 8-domain invariant spec):** `NappletClass` type + `SessionEntry.class` field + breaking `onNip5dIframeCreate` hook expansion; class resolved synchronously before `shell.init` (C-01 prevention); `CLASS_CAPABILITY_ALLOWLIST` in `enforce.ts` with `class-1`/`class-2` entries + `EnforceResult.reason` field; class check before capability check (D6); `CLASS_BY_DTAG` data-driven map with module-load assertion; `__setNappletClass__` test hook in `main.ts`; SHELL-CLASS-POLICY.md synced from upstream; 8-test parameterized `class-invariant.spec.ts`.
- **NUB-CONNECT adoption (CONNECT-01..07):** `connectStore` singleton keyed `<dTag>:<aggregateHash>` + `ShellBridge.connectStore` surface; Vite `serveNappletCsp` plugin with HTTP-header authority for per-napplet `connect-src` in BOTH dev + preview modes (C-05 prevention); `POST /__connect-grants` sync endpoint with origin allowlist (403 on mismatch); consent modal with 60-second timer, dismiss=deny, timeout=deny, cleartext-origin warning; iframe destroy+recreate on revocation with snapshot-before-mutate Map pattern (infinite-loop bug caught + fixed mid-phase); `pnpm audit:csp` Node script + GitHub Actions Build workflow step (zero meta-CSP whitelist); SHELL-CONNECT-POLICY.md synced from upstream.
- **NUB-CONFIG 9th domain (CONFIG-01..04):** `createConfigService({ getValues, registerSchema?, openSettings?, validator? })` factory with `publishValues` host handle mirroring v1.6 Decision 18 options-as-bridge pattern; config-demo napplet (11th) exercising `config.get` + `config.watch` live round-trip via `__publishConfigValues__` test hook; scope boundary documented — napplet reads, shell writes, NO `config.set`.
- **NUB-RESOURCE 10th domain (RESOURCE-01..06):** `createResourceService({ fetch, isOriginGranted, getConnectGrants })` factory throws at construction if `getConnectGrants` missing (H-03 prevention); in-flight `Map<requestId, AbortController>` for cancel correlation (canonical `canceled` typed-error); resource-demo napplet (12th) with granted + denied fetch panels; `http://localhost:4174/demo-data.json` static fixture auto-granted on demo boot; SHELL-RESOURCE-POLICY.md synced from upstream. `class-invariant.spec.ts` extended 8→10 domains completing E2E-20.
- **Carryover polish (NIP66-06..07, WM-04..07, CACHE-01):** `Nip66Aggregator.stop()` method added with Vitest coverage (idempotent, preserves accumulated relaySet); mock relay pool extended with 3 kind-30166 fixtures; `#nip66-suggestions-list` shell-chrome panel live (replaced `() => null` stub); `beforeunload → aggregator.stop()` cleanup. `@kehto/wm` structural primitives (`LayoutStrategy`, `WindowState`, `WindowPlacement`) ship in 179 lines (< 200 budget) with no-op default strategy replacing the Phase 35 throwing stub; zero algorithm-specific types. `HostCacheBridge = CacheServiceOptions` additive alias closes kehto#1 naming-parity gap.
- **Policy documentation (DOCS-06..07):** All three `SHELL-{CLASS,CONNECT,RESOURCE}-POLICY.md` files present under `docs/policies/` with canonical source headers (napplet/napplet@27e1624) and kehto file:line cross-references; README Policies section references all three.
- **Two critical in-execution bugs caught + fixed:** (1) Phase 39-05 Dev 1 — `runtime.ts` was missing `nubDispatch.registerNub('config', ...)`, silently dropping all config envelopes; fix propagated as explicit Phase 40 acceptance criterion. (2) Phase 39-05 Dev 2 — `shell:connect-revoked` listener iterated live Map while `loadNapplet()` inserted entries, causing infinite destroy+recreate loop; fix: snapshot `[...napps.entries()]` before mutation.

**Known tech debt (carried to v1.8):** Phase 42 (NIP-44 decrypt) deferred — soft-gate on napplet/napplet#3 unresolved at close (issue OPEN, 0 comments). Provisional local type files (`provisional-{class,connect,resource}.ts`) retire atomically when upstream publishes `@napplet/nub@^0.3.0` (class+connect) and `^0.2.2` (resource). Nyquist validation optional retroactive pass. Cosmetic h2 label in resource-demo references stale port `:5174` (GRANTED_URL correctly uses `:4174`).

**Archive:** [v1.7-ROADMAP.md](milestones/v1.7-ROADMAP.md) | [v1.7-REQUIREMENTS.md](milestones/v1.7-REQUIREMENTS.md) | [v1.7-MILESTONE-AUDIT.md](milestones/v1.7-MILESTONE-AUDIT.md)

---

## v1.6 Downstream Unblock & Shell Service Surface (Shipped: 2026-04-23)

**Phases completed:** 5 phases, 12 plans, 22 tasks

**Key accomplishments:**

- Found during:
- 1. [Rule 1 - Bug] media-controller napplet stalled at `connecting...` on first E2E run
- Shell-reserved chord surface on `createKeysService` — `reservedChords?: ReadonlyArray<string>` option + three reservation gates (Branch A/B keys.forward + Branch B document keydown) + KEYS_SERVICE_VERSION 1.2.0 bump, with 6 new unit tests locking the precedence contract.
- README Keys H2 gains a `### Reserved Chords` sub-section (table row + WM-launcher @example + precedence + normalization prose); demo shell reserves `Ctrl+Shift+R` and exposes a parent-frame `#reserved-chord-last-fired` DOM sentinel so 33-03's Playwright spec can observe shell handler fires without frameLocator traversal.
- Layer-B Playwright spec `tests/e2e/reserved-chord.spec.ts` (106 lines, 8-step) locks the KEYS-04/05 reserved > registered precedence contract against the built `:4174` demo; canonical v1.6 fresh-install iteration loop recorded in `33-ITERATION-LOG.md` at 54 / 0 / 0 (18.5s) — Phase 33 closes with 4/4 REQ-IDs addressed.
- New publishable `@kehto/nip66@0.1.0` workspace — ESM-only tsup build, nostr-tools peer dep, 5-symbol locked public API with stub factory throwing `not implemented — see Plan 34-02`.
- Port hyprgate's `nip66-monitor.ts` (188 lines, module-globals) into `@kehto/nip66`'s `createNip66Aggregator` (closure-scoped factory) via TDD RED → GREEN. 9 vitest tests; all passing; zero module-level state; zero hyprgate-specific symbols; full-repo build + type-check + unit tests green.
- Shipped `@kehto/nip66@0.1.0` publish-shape evidence: 194-line consumer README with canonical SimplePool + ShellAdapter wiring, 21-line initial-publish changeset, 248-line fresh-install iteration log recording 54/0/0 E2E preserved — Phase 34 artifact-complete, closes NIP66-04 + NIP66-05.
- Squash-merged PR #7 (`@kehto/wm@0.0.0` skeleton — canonical WM type vocabulary + throwing factory stub) from dskvr, rebased local main onto the squash commit preserving 3 local docs commits, and verified turbo auto-pickup at 24/24 build + 10/10 type-check with zero source edits authored by the executor.
- Rewrote root README.md line 93 to drop the stale `@napplet/core is not yet on npm` + `pnpm.overrides link:` claim (false since v1.4 first publish), added @kehto/nip66 + @kehto/wm rows to the Packages table, and recorded the canonical full-workspace iteration loop at 54/0/0 with anti-term sweep + DOCS-05 export-presence verification — closing Phase 35 at 5/5 REQ-IDs.
- Deleted 7 vestigial `storage.getItem('<slug>-auth-probe')` calls across 7 demo napplets (composer/feed/hotkey-chord/media-controller/profile-viewer/theme-switcher/toaster) and scrubbed all D-04 / AUTH-probe / shim AUTH completion comment prose from 10 napplet main.ts files and 6 E2E spec files — zero new anti-feature strings introduced, build + type-check still at Phase-35-close baselines of 24/24 and 10/10.
- Ran canonical v1.6 fresh-install iteration loop against post-Plan-36-01 tree; caught a 3-napplet AUTHENTICATED regression introduced by the probe deletions in OUTBOUND-ONLY napplets (composer / theme-switcher / toaster); applied a semantically honest identity.getPublicKey() AUTH-trigger replacement; re-ran to 54/0/0; captured the full v1.6 milestone-wide anti-term sweep (10 patterns, 158 grep-positives, zero napplet-code violations) in 36-ITERATION-LOG.md — closes E2E-18 and v1.6 milestone at 21/21 reqs.

---

## v1.5 Demo Stability & UAT Coverage (Shipped: 2026-04-20)

**Phases completed:** 3 phases, 7 plans, 9 tasks

**Key accomplishments:**

- Single DEMO_NAPPLETS for-of loop replaces the hardcoded chat+bot-only if-chain in refreshAclPanelsIfNeeded() — all 10 napplets now get their outer topology status sentinel updated to 'authenticated' when their NappletInfo.authenticated flag flips true
- DEMO-02 cascade-fixed by 29-01 refreshAclPanelsIfNeeded refactor; no code change needed; 49/0/0 confirmed
- Service node activity counters wired via NUB envelope-domain routing in installActivityProjection(), with notify→notifications alias and topology.services.includes() guard
- Single-line gate swap in aclAdapter.snapshot() from info.pubkey to info.authenticated — unblocks all 10 NIP-5D napplets from the ACL Capability Matrix modal
- Replaced hardcoded `LANE_NAMES=['Chat','Shell','Bot']` with `deriveLanes()` helper that resolves observed `msg.windowId` → napplet name via the `nappletInfos` map, producing alphabetically-ordered lanes with Shell always centred
- Layer-B Playwright spec polling all 10 DEMO_NAPPLETS status sentinels via expect.poll().toMatchObject() to lock the Phase-29 concurrent-boot AUTH fix in CI
- E2E-16 spec (3 tests: UI-01 service counters, UI-02 ACL matrix, UI-03 sequence lanes) + canonical fresh-build iteration loop green at 53/0/0 + v1.5 anti-term milestone-gate sweep with 0 real violations

---

## v1.4 Productionization & Upstream Unblock (Shipped: 2026-04-19)

**Phases completed:** 6 phases, 17 plans, 33 tasks

**Key accomplishments:**

- GitHub Actions Build workflow on push and pull_request — pnpm 10 + Node 20, frozen-lockfile install, turbo build + type-check, concurrency cancel-in-progress, ubuntu-latest runner.
- GitHub Actions Playwright E2E workflow on push and pull_request — pnpm 10 + Node 20, frozen-lockfile install, browser cache keyed on OS + installed Playwright version + pnpm-lock.yaml hash with 2-tier restore-keys ladder, cache-hit/miss branching for system deps vs full install, then `pnpm test:e2e`.
- Refreshed 2 stale JSDoc `@example` blocks citing the deleted `auth-napplet` fixture to use the extant `nub-identity` fixture; zero behavioral change, pure comment edits.
- Deleted packages/runtime/src/core-compat.ts (113-line @napplet/core v1.1 shim) and re-homed every live symbol — Capability to @kehto/acl/capabilities (new subpath export), ServiceDescriptor to packages/runtime/src/types.ts, REPLAY_WINDOW_SECONDS inlined in replay.ts. Narrowed runtime + shell barrels to drop BusKindValue and all NIP-01 constants. Inlined placeholder consts at 7 downstream files so the intermediate state type-checks with all 442 unit tests passing — Plan 24-02 deletes placeholders + dead call sites atomically.
- Deleted all dead NIP-01 dispatch code from @kehto/runtime and @kehto/shell — `resolveCapabilities()` + runtime-flavored `CapabilityResolution`, `handleStateRequest()`, `service-discovery.ts` (file), `requiresPrompt(kind)` (both runtime AclStateContainer + shell acl-store), all `BusKind` / `AUTH_KIND` / `DESTRUCTIVE_KINDS` / `STATE_TOPICS` symbols, and all placeholder const blocks Plan 24-01 inlined as intermediate scaffolding. Narrowed `@kehto/runtime` barrel + rewrote `@kehto/shell` enforcement re-export block to the live NUB-flavored surface (`createNubEnforceGate` + `NubEnforceConfig` + `NubMessage`). Scrubbed runtime + shell READMEs. Recorded E2E-11 iteration loop: 442 unit / 47 e2e green on cold rebuild — Phase 23 baseline preserved exactly. Single atomic commit covers Plan 24-01 + Plan 24-02 work — DRIFT-01 + DRIFT-02 closed together.
- Aggregated changeset version bump
- Replaced stub @kehto/services/keys-service with a real document-level keydown listener, a string-chord parser, three subscription registries, and canonical keys.action envelope emission to the owning napplet on chord match — SDK's keys.onAction(...) now has a working shell-side counterpart.
- Defined and exported the `HostKeysBridge` interface + `HostKeyEvent` type from @kehto/services and extended `createKeysService` with an optional `hostBridge` option that — when provided — delegates chord subscription lifecycle to the bridge (Branch A) and leaves the default document-listener body from Plan 26-01 untouched (Branch B).
- Shipped the apps/demo/napplets/hotkey-chord demo napplet (5 files) built on @napplet/sdk's `keys` namespace (keys.registerAction + keys.onAction), wired it into the demo shell as the 9th DEMO_NAPPLETS entry, demoted keys from stub-only, and installed the window.__grantKeysForward__ host hook that pre-locks Plan 26-04's capability-gate mechanism.
- Shipped `tests/e2e/hotkey-chord.spec.ts` (Layer-B contract covering the full keys.registerAction → page.keyboard.press → SDK onAction → DOM sentinel loop), ran the fresh-build iteration loop (47 → 48 passed, delta +1 exactly), recorded all evidence in `26-ITERATION-LOG.md`, and closed Phase 26 with all four requirement IDs (KEYS-01, KEYS-02, KEYS-03, E2E-12) satisfied.
- navigator.mediaSession mirror with 5-action setActionHandler matrix, media.command push via per-window send capture, silent-audio prime, and last-active-wins multi-session registry
- HostMediaBridge 5-field interface + createBrowserMediaBridge navigator.mediaSession reference impl + hostBridge? option branch in createMediaService; barrel re-exports; 9 new bridge-path tests
- SDK-driven media-controller napplet (5 files) + DEMO_NAPPLETS 10th entry + STUB_ONLY_SERVICES = [] + __grantMediaControl__ host hook; all 8 non-stub NUB domains now exercised end-to-end
- Layer-B media-controller.spec.ts with DUAL-PATH assertion (DOM sentinel + navigator.mediaSession.playbackState + metadata.title via page.evaluate), plus cascaded demo-boot.spec.ts fix and 49-test fresh-build iteration loop closing Phase 27
- Upgraded nub-keys.spec.ts + nub-media.spec.ts from stub-scope to real-backend Layer-A coverage via __registerService__('name', 'real') factory-key branch; extended envelopeLog to capture outbound NIP-5D service-send envelopes so result assertions work without window globals.
- 1. [Rule 1 - Bug] Factory signatures written single-line in README code fences
- apps/demo/README.md created from scratch with 10-napplet inventory table (v1.3→v1.4 history line, STUB_ONLY_SERVICES=[], host-hook catalog) + Phase 28 iteration loop 49/0/0 no-delta confirmed + full v1.4-surface anti-term sweep: 0 real violations documented

---

## v1.3 Demo Functional & Playwright Parity (Shipped: 2026-04-18)

**Phases completed:** 7 phases, 43 plans, 68 tasks

**Key accomplishments:**

- Seven obsolete v1.1 signer/AUTH/BusKind spec files deleted from tests/e2e/, leaving an 11-spec v1.2-aligned baseline with zero anti-term hits
- @playwright/test bumped to ^1.54.0 (resolved 1.59.1), playwright.config.ts migrated to array-form webServer with harness :4173 + demo :4174, and turbo build:napplets pipeline task wired into @kehto/demo#build
- Shipped waitForNappletReady + aclBeforeEach Playwright helpers under tests/e2e/helpers/ barrel, and sanity-migrated acl-enforcement.spec.ts to use the shared fixture (4 inline setup lines replaced by 1 helper call)
- Purged all BusKind/AUTH_KIND/window.nostr/signer-service/kind===29001 references from 9 apps/demo/src files; renamed DemoProtocolPath union to canonical identity-request/relay-publish-signed; wired notification-demo to ifc.emit envelopes
- `createDemoHooks()` extended from 2 to 5 registered services (+ 3 topology-only); all 8 NIP-5D topology nodes visible on boot with stub-only visual markers on keys/media
- Post-connect identity.getPublicKey diagnostic probe routed through real identity ServiceHandler; test-sign button calls signer.signEvent host-internally — zero window.nostr surface in demo
- MessageTap extended with NIP-5D envelope capture; debugger/flow-animator/sequence-diagram rewired to display and route on literal envelope `type` strings instead of NIP-01 verb+BusKind lookups
- 1. [Rule 1 - Bug] Fixed Capability type arrays referencing deleted v1.1 capabilities
- SATISFIED
- Bot napplet rewritten from raw NIP-01 window.addEventListener AUTH to @napplet/sdk async init() pattern; ipc and storage exercised end-to-end; #status-text posts 'authenticated' after shim AUTH resolves
- Chat napplet rewritten from raw window.addEventListener NIP-01 dispatch to @napplet/sdk (ipc.emit/on + storage), with #chat-status DOM hook for E2E auth assertions after shim AUTH completes
- Two Playwright Layer-B specs locking the @napplet/sdk migration: napplet-auth asserts both iframes reach 'authenticated', ifc-roundtrip proves the chat→bot→chat ipc envelope path end-to-end at :4174
- Full 20-test v1.3 Layer-B suite passed on first build+run iteration — SDK migration from Plans 18-01..03 is regression-free with zero fix cycles needed
- @kehto/demo-composer napplet skeleton and SDK-wired main.ts exercising relay.publish + relay.publishEncrypted (NIP-44) with deterministic D-02 DOM contract
- One-liner:
- @kehto/demo-toaster buildable napplet dispatching notify.create/list/dismiss NIP-5D envelopes via raw window.parent.postMessage with a single narrowly-guarded message handler (Plan 19-03 SDK gap deviation)
- 4 Layer-B Playwright specs locking NAP-03/04/05 contracts with frame.evaluate click pattern for sandboxed cross-origin iframes and NIP-5D session pre-registration fix in demo shell-host.
- One-liner:
- v1.3 Layer-B suite (13 specs, 27 tests) fully green via 3-iteration loop that fixed nub-relay relay.publish.error handling and turbo cache poisoning from external workspace packages
- In-memory SimplePool-shaped mock relay pool with 5 kind:1 fixture events, wired into createDemoHooks() to unblock feed napplet relay.subscribe delivery
- feed napplet (@kehto/demo-feed) — relay.subscribe to { kinds:[1], limit:5 } with DOM sentinel connecting->authenticated->subscribed->loaded(5) and #feed-list rendering 5 fixture events from the Phase 20-01 mock relay pool
- profile-viewer napplet wiring identity.getPublicKey + identity.getProfile with 'connecting...' -> 'authenticated' -> 'loaded' DOM sentinel and truncated pubkey display
- One-liner:
- File 1: `apps/demo/napplets/preferences/index.html`
- DEMO_NAPPLETS extended to 8 entries, demo.publishTheme listener bridges theme-switcher postMessage to relay.publishTheme fan-out, completing the theme-broadcast round-trip and NAP-09 coverage gate
- 3 serial-mode Layer-B Playwright specs covering feed relay.subscribe, profile-viewer identity.getPublicKey, and theme-switcher → preferences theme.changed round-trip — all asserting against demo at :4174
- 4-cycle iteration loop closes Phase 20: 5 root-cause fixes (registry fan-out, identity response, relay observable, debugger display, stale spec) achieve 39 E2E specs green with NAP-09 6-domain coverage gate satisfied
- Six SDK-based fixture napplets (nub-identity/ifc/notify/relay/storage/theme) scaffolded, built clean to dist/, and registered in pnpm workspace; turbo.json build:napplets extended to track fixture dist outputs
- nub-identity.spec.ts
- 1. [Rule 1 - Bug] handler.descriptor required by runtime.registerService()
- Total iterations:
- 1. [Rule 1 - Documentation Bug] Task 1 verify regex conflict with plan mandate
- Rewrote root README as the v1.3 reference-integration narrative (apps/demo + 4 @kehto packages + quick integration example) and archived 6 legacy docs/ migration snapshots under docs/migrations/ with terminal-state headers; operationalizes DOCS-03.
- None.
- 1. [Rule 3 - Blocking] Working-tree leak cleanup after `git checkout main`
- 4 v1.3 `patch`-bump changeset files authored for @kehto/{acl,runtime,shell,services}, each citing the DEMO-/NAP-/E2E-/DOCS- requirement IDs its package work covers; REL-04 evidence appended to 22-ITERATION-LOG.md with file paths, ls -la, line counts, frontmatter heads, citation counts, and anti-term grep proof.
- 7 legacy spec files deleted via `git rm`; `pnpm test:e2e` reports 47 passed / 0 failed / 0 skipped / 18.4s (exit 0); E2E-10 closed; ROADMAP Phase 22 Success Criterion 1 verifiably satisfied.
- Fresh-build `pnpm build` + `pnpm test:e2e` loop recorded in 22-ITERATION-LOG.md against the post-22-07 zero-skip baseline (47 passed / 0 failed / 0 skipped / 16.7s on iteration 1); E2E-11 formally closed per D-08; v1.3 milestone READY TO CLOSE with all 9 requirements CLOSED.

---

## Completed

### v1.0: NIP-5D Migration & Gap Analysis

**Shipped:** 2026-04-07
**Phases:** 5 | **Plans:** 7 | **Requirements:** 17/17

**Key Accomplishments:**

1. Gap analysis with wire format before/after for 19 NUB message types and 6 silent failure points
2. ACL identity key schema migration design (pubkey:dTag:hash → dTag:hash) with localStorage migration utility
3. NUB domain-prefix dispatch design replacing NIP-01 verb switch, AUTH removal inventory (~24% of runtime.ts)
4. SessionEntry identity anchor: Option B (empty string + identitySource discriminant)
5. Shell migration: window.nostr injection via postMessage handshake, shell.supports() capability advertisement
6. All 6 service handler migrations from NIP-01 arrays to NappletMessage envelopes

**Deliverables:**

- `docs/GAP-ANALYSIS.md` (567 lines)
- `docs/ACL-MIGRATION.md` (346 lines)
- `docs/RUNTIME-MIGRATION.md` (897 lines)
- `docs/SHELL-MIGRATION.md` (663 lines)
- `docs/SERVICES-MIGRATION.md` (1023 lines)

**Archive:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

### v1.1: NIP-5D Migration Implementation

**Shipped:** 2026-04-07
**Phases:** 4 | **Plans:** 8 | **Requirements:** 16/16

**Key Accomplishments:**

1. @kehto/acl: 2-segment identity keys, NUB domain resolution, localStorage migration (75 tests)
2. @kehto/runtime: NUB dispatch (envelope-only), AUTH removed (~269 lines), 4 domain handlers (61 tests)
3. @kehto/shell: Envelope-only guard, window.nostr injection, capability advertisement, ACL migration trigger
4. @kehto/services: All 6 handlers migrated to NappletMessage envelope format (34 tests)

**Archive:** [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) | [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)

### v1.2: NIP-5D Conformance & Full NUB Coverage

**Shipped:** 2026-04-17
**Phases:** 6 | **Plans:** 19 | **Requirements:** 26/26

**Delivered:** Kehto fully conforms to the canonical NIP-5D spec (`dskvr/nips` branch `nip/5d`) and covers all 8 napplet NUB domains end-to-end with formal `createDispatch()`/`registerNub()`/`dispatch()` routing.

**Key Accomplishments:**

1. Canonical NIP-5D pinned at `specs/NIP-5D.md` (byte-identical to `dskvr/nips` nip/5d); README `## Specification` section anchors the sync source. Cross-package drift audit (`docs/v1.2-NIP-5D-AUDIT.md`, 40 DRIFT rows across 5 stable namespaces) closes SPEC-01/02/03.
2. Shell conformance: hard-deleted `window.nostr` injection (reversed v1.1 `SH-I02`), introduced `perm:<permission>` namespace for sandbox permissions via `shell.supports()`, routed signing/encryption through shell-internal `relay.publish` / `relay.publishEncrypted` (NIP-44 default, NIP-04 opt-in).
3. All 8 napplet nub packages consumed as peer deps at `^0.2.0`; every hand-copied NUB type migrated to `import type { ... } from '@napplet/nub-<domain>'`. `@napplet/core` range bumped `>=0.1.0` → `^0.2.0`.
4. Seven non-theme nubs (identity, ifc, keys, media, notify, relay, storage) fully dispatched with reference services; signer domain split (identity takes read-only pubkey/relays; sign/encrypt subsumed into relay.publishEncrypted) and removed entirely.
5. Theme NUB implemented end-to-end: runtime dispatch + reference service + shell adapter API (`bridge.publishTheme`) + ACL enforcement test. All 8 domains now covered.
6. Dispatch refactor: hand-rolled switch replaced with napplet/core's `createDispatch()` + 8 `registerNub()` calls using per-runtime instance + closure-scoped `windowId` bridge. Zero domain-specific branching remains in `runtime.ts`.
7. Shell per-domain proxies + keys-forwarder (host→napplet keydown pump) + barrel cleanup (5 new proxies exported; no signer residuals).

**Validation:** 449 tests passing / 0 skipped; `pnpm build` + `pnpm type-check` green; 4 changesets staged (`.changeset/v1-2-{acl,runtime,shell,services}.md`, all minor bumps).

**Known intentional debt:**

- `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06) preserves `@napplet/core` v0.1 legacy exports. Preserved intentionally until napplet/core restores the symbols upstream.

**Archive:** [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) | [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) | [v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md)
