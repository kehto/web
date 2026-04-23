# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.6 — Downstream Unblock & Shell Service Surface

**Shipped:** 2026-04-23
**Phases:** 5 (32–36) | **Plans:** 12 | **Tasks:** 22

### What Was Built

- **Phase 32 — NUB Dep Consolidation.** All 4 `@kehto/*` packages migrated from 8 split `@napplet/nub-*` peer deps → consolidated `@napplet/nub@^0.2.1` with subpath imports. 35-file atomic commit; 4 minor-bump changesets; dual-instance pitfall structurally eliminated in kehto importer blocks. Hit + documented an upstream packaging bug (SEED-001): `@napplet/nub@0.2.1` shipped with unresolved `workspace:*` — added `pnpm.overrides @napplet/nub>@napplet/core: ^0.2.1` as transient workaround.
- **Phase 33 — Reserved Chord Surface + E2E-17.** `createKeysService` accepts `reservedChords?: ReadonlyArray<string>`; reservation gates at 3 dispatch sites (Branch A/B `keys.forward` + Branch B document keydown). Precedence contract `reserved > registered` locked by a Layer-B Playwright spec against the built `:4174` demo. TDD RED→GREEN cycle; 6 new unit tests; `KEYS_SERVICE_VERSION` bumped 1.1.0 → 1.2.0. E2E baseline rose 53 → 54.
- **Phase 34 — `@kehto/nip66@0.1.0` Extract & Publish.** New framework-agnostic publishable package. `createNip66Aggregator` factory + pluggable `Nip66RelayPool` interface (consumers implement; decouples from any specific pool lib). Closure-scoped state — multi-instance safe, unit-testable. 9 vitest tests, `nostr-tools` as sole peer dep, zero `@napplet/*` footprint. 194-line README with SimplePool + `ShellAdapter.getNip66Suggestions` wiring example.
- **Phase 35 — WM Skeleton + README Cleanup.** Squash-merged PR #7 (`@kehto/wm@0.0.0` skeleton) from dskvr with authorship preserved. Generic WM type vocabulary + throwing `createWmService` factory stub. Root README line 93 rewritten: dropped stale `@napplet/core not on npm` + `pnpm.overrides link:` claim; Packages table extended with `@kehto/nip66` + `@kehto/wm` rows.
- **Phase 36 — PERF-01 Rescoped + Milestone Close E2E-18.** Audit-first rescope revealed v1.5's "chat boot 18+ serial storage.get round-trips" claim inaccurate. Real target: 7 vestigial `storage.getItem('<slug>-auth-probe')` calls surviving from v1.2-deprecated D-04 pattern. Deleted all 7 + scrubbed comment prose across 10 napplets + 6 E2E specs. Outbound-only napplets (composer/theme-switcher/toaster) replaced probe with `identity.getPublicKey()` AUTH-trigger call — a Rule 1 auto-fix caught by the iteration loop. v1.6 milestone-wide anti-term sweep clean; 54/0/0 preserved end-to-end.

### What Worked

- **Audit-first mid-milestone rescopes.** Both CACHE-01..05 (dropped from Phase 33) and PERF-01 (rescoped Phase 36) turned out to be based on inaccurate v1.5 audit observations. Instead of barrelling through, pausing to audit the current code BEFORE planning caught both cases and turned them into either "no work needed" (CACHE) or "different, smaller, honest work" (PERF). Pattern: when a carryover item surfaces during `/gsd:discuss-phase`, audit before executing. Committed as Decision 19 in PROJECT.md.
- **User pushback as grey-area input.** The CACHE-02 "blocker" framing I initially presented was pushed back on by the user ("if our code already supports the functionality, then just leave a comment on the issue") — that reframe was correct. Similarly for PERF-01: user's single-line "AUTH is deprecated entirely" rescoped a stuck phase into a cleanup task. User input at grey-area moments is high-signal; the autonomous flow's pause-only-for-decisions rule paid off.
- **SEED-001 pattern for upstream-dependent follow-ups.** Rather than file an upstream issue for the `@napplet/nub@0.2.1` packaging bug immediately (risk: upstream fixes before anyone reads), captured as a seed that surfaces at the next `@napplet/nub` bump. Lets the follow-up be re-verified at trigger time — file only if still broken. Documented as Decision 22 in PROJECT.md.
- **Squash-merge via `gh pr merge` for external-contributor skeleton PRs.** Phase 35 merged dskvr's PR #7 preserving authorship via GitHub's default squash behavior. Cleaner than local replication (which would lose attribution) and cleaner than merge commits (history noise for a 4-file skeleton).
- **Strict atomic commits for cross-file migrations.** Phase 32's 35-file migration committed atomically — `package.json` + imports + lockfile all land together. Intermediate states wouldn't type-check; splitting would have produced broken bisect points. Atomic commit discipline established in v1.4 (DRIFT cleanup) continued to pay off.

### What Was Inefficient

- **Authoring CACHE/PERF requirements without code audit.** Both CACHE-01..05 and PERF-01 were drafted during milestone-start from v1.5 audit claims, without verifying the claims against current code. Result: 2 of the milestone's 5 planned categories needed rescoping mid-flight. Lesson: at requirements-definition time, open the target file and verify the claim lines up with code. Costs ~5 min per requirement category; saves 30+ min of rescope work later.
- **Plan 36-01 broke AUTHENTICATED in 3 outbound-only napplets.** Probe deletion in composer/theme-switcher/toaster broke AUTHENTICATED detection. Caught by the iteration loop's `demo-concurrent-boot.spec.ts` regression anchor (good), but the root cause — "the probe was load-bearing despite being named 'probe'" — was predictable from the code pre-edit. A pre-flight grep for non-probe boot-time SDK calls per napplet would have caught all 3 before execution.
- **Plan 36-02 YAML parser gotcha.** Embedded `---` horizontal rules inside an iteration-log template tripped the `gsd-tools frontmatter validate` parser (uses LAST `---...---` block). Fixed by switching embedded rules to `***`. Worth propagating to other GSD templates if the pattern becomes common.

### Patterns Established

- **Pluggable `HostXxxBridge` interface as canonical injection pattern** (Decision 18). Extends Keys + Media v1.4 pattern to any kehto reference service that wraps a host-capability. CACHE retroactively confirmed this is the right shape — expose options object AS the bridge; downstream shells implement without monkey-patching.
- **`@napplet/nub` subpath consolidation as canonical consumer pattern** (Decision 20). Split `@napplet/nub-*` form retired with anti-term enforcement. Transitive residue from @napplet/sdk/shim in packages: section accepted as out-of-scope upstream footprint; importer-block scope is the correct verification surface.
- **`/<domain>/sdk` subpath variant when `@napplet/shim` is loaded** (Decision 21). Root `/<domain>` subpath calls `registerNub` at module-init — collides with shim. Pattern surfaced as a Rule 1 auto-fix in Plan 32-02 and captured for future migrations.
- **Seeds mechanism for upstream-dependent follow-ups** (Decision 22). SEED-001 format: store the why + when-to-surface in `.planning/seeds/SEED-NNN-slug.md`; trigger re-verification at next-relevant milestone.

### Key Lessons

- **Stale audit claims compound.** v1.5's CACHE + PERF observations survived into v1.6 requirements-definition. Next milestone's REQUIREMENTS-drafting step should include a "verify current code matches audit claims" gate for carryover items.
- **Outbound-only napplets need explicit AUTH triggers.** The D-04 AUTH-probe pattern was dead weight for napplets that loaded real data (chat/preferences/bot kept working after probe removal via their loadHistory/loadPreferences/loadRules calls) but load-bearing for napplets with no boot-time SDK call. Future "delete dead code" sweeps should grep per-napplet for non-deleted SDK calls.
- **User decisions at grey-area moments are the autonomous flow's highest-value signal.** Both CACHE (user: "comment on the issue") and PERF (user: "AUTH is deprecated entirely") reshaped phases via single-line input. The autonomous workflow's pause-only-for-grey-areas rule surfaces exactly these moments.
- **Integration checker's "intentionally disconnected" distinction matters.** 8 of 21 REQ-IDs (NIP66 + WM + DOCS) were intentionally self-contained per explicit publish-only/skeleton-only/docs-only contracts. The integration checker surfaced them with the right framing ("intentional") rather than as gaps.

### Cost Observations

- Model mix: opus (planner) + sonnet (executor, checker, verifier) — unchanged from v1.5.
- Sessions: ~5 (one per phase + milestone-close session).
- Notable: mid-milestone rescopes (CACHE, PERF) happened inside the autonomous flow without breaking it — the pause-for-grey-area gate surfaced each at the right moment.

---

## Milestone: v1.5 — Demo Stability & UAT Coverage

**Shipped:** 2026-04-20
**Phases:** 3 (29–31) | **Plans:** 7 | **Tasks:** 9

### What Was Built

- **Phase 29 — Concurrent-boot AUTH Fix + Demo Stability.** Data-driven rewrite of `refreshAclPanelsIfNeeded()` in `apps/demo/src/main.ts`. Old: 2 hardcoded status-text updates for chat/bot + 6 no-op blocks for other napplets + hopeless-hardcoded `aclRendered.size < 8` guard. New: single loop over `DEMO_NAPPLETS` → update each napplet's `statusId` DOM element when `info.authenticated === true`. All 10 napplets now show AUTHENTICATED. DEMO-02 (media Play/Pause) was cascade-fixed — the napplet-internal state always worked; the visible "loading…" status made the user think clicks did nothing.
- **Phase 30 — Shell UI State Wiring.** Three independent fixes, all against pre-existing v1.3-era gaps: (UI-01) `installActivityProjection()` extended with service-level pushActivity routing + `SERVICE_DOMAIN_ALIAS = { notify: 'notifications' }` + `topology.services.includes()` guard; (UI-02) `aclAdapter.snapshot()` gate swapped from `!info.pubkey` to `!info.authenticated` — picks up NIP-5D napplets that had been silently dropped for 4 milestones; (UI-03) hardcoded `LANE_NAMES = ['Chat','Shell','Bot']` replaced with dynamic `deriveLanes()` helper that reads napplet names from observed messages, alphabetical-splits with Shell centered.
- **Phase 31 — E2E Coverage + Milestone Iteration Loop.** Two new Layer-B specs lock the contracts: `demo-concurrent-boot.spec.ts` polls 10 napplet status sentinels until every one reads `'authenticated'` within 10s; `shell-ui-state-surfaces.spec.ts` (3 tests) asserts service counters tick, ACL matrix shows 10 rows, and the debugger's shadow-root sequence diagram renders ≥ 4 lanes including Shell. Fresh-build iteration loop closes 53/0/0 (up from 49; +4 Playwright tests / +2 spec files).

### What Worked

- **Playwright MCP automated UAT inside autonomous flow (Phase 29 pattern).** When a phase checkpoint needed manual browser testing, instead of halting the autonomous session I drove the demo via `mcp__playwright__browser_*` tools — captured DOM evidence, classified into decision buckets, closed the checkpoint with a full diagnostic file. Zero interruption to the autonomous chain. Established as a canonical v1.5+ pattern (PROJECT.md decision 17). Saved significant wall-clock time and turned a fragile "ask-the-user" gate into a reliable automated gate.
- **Smart-discuss identifying root causes during scout.** Phase 29 and Phase 30 smart-discuss sessions included a live scout pass that identified the exact file + line of each bug BEFORE proposing grey-area answers. Every grey-area question could reference the actual broken code. Planners + executors then had zero ambiguity about what to fix. The structural scaffolding ("refactor refreshAclPanelsIfNeeded as a data-driven loop") wrote itself because the scout had already proved what was wrong.
- **Parallel wave-1 execution for independent fixes.** Phase 30 shipped 3 fixes across 3 separate files concurrently. Zero file overlap guaranteed no merge conflicts; Agent tool ran 3 executor subagents in parallel. Total wall time matched the slowest fix (~10 min), not the sum (30+).
- **Data-driven UI pattern codified as decision #16.** The v1.5 root cause was the same shape as a hypothetical v1.6 bug: hardcoded lists silently drift when a list grows. Codifying "UI loops DEMO_NAPPLETS; no per-napplet hardcoded blocks" as PROJECT.md Key Decision 16 means future reviewers + planners catch this pattern BEFORE it ships.

### What Was Inefficient

- **Phase 31 Playwright-count semantics gap between ROADMAP and CONTEXT.md.** ROADMAP Phase 31 success criteria said "exactly 51 passed" (assuming spec-file-count); CONTEXT.md Area 3 correctly anticipated "don't force a hardcoded number — Playwright may report by test count". Actual runner reported 53 (4 new tests: 1 from E2E-15 + 3 from E2E-16). The planner bridged the two by documenting both metrics in the iteration log, but the underlying ROADMAP success criterion was drift-prone. Fix for v1.6+: stop using specific pass-count numbers in ROADMAP success criteria; use delta semantics (+N specs, +M tests) instead.
- **UI-01 poll guard weakness (info-level tech debt).** `shell-ui-state-surfaces.spec.ts:UI-01` uses `expect.poll(... , { timeout: 10_000 }).toEqual(expect.objectContaining({ storage: expect.any(Number), ... }))` — this resolves on `-1` (missing element) just as quickly as on `12` (populated). The post-poll `toBeGreaterThanOrEqual(1)` is the real guard, but the poll doesn't wait for real activity; it waits only for element existence. Works in practice because Phase 30 made counters tick within the boot window. Candidate for v1.6 refinement: `expect.poll(...).toEqual({ storage: expect.anything(Number ≥ 1), ... })` using a custom predicate.
- **Background preview-server lifecycle.** Playwright MCP UAT required spinning up `pnpm --filter @kehto/demo preview --port 4174` in the background, navigating, observing, then killing. The teardown kept logging exit-code-144 errors (signal termination) that polluted the notification stream. Non-fatal but noisy. Fix for v1.6: a small helper script that daemonizes preview cleanly OR uses Playwright's built-in webServer config in playwright.config.ts.

### Patterns Established

- **Data-driven UI contract (decision #16)** — UI loops over DEMO_NAPPLETS, never per-napplet hardcoded blocks. Applied to status-text, activity counters, ACL rows, sequence-diagram lanes. New napplets added in v1.6+ automatically picked up by all 4 surfaces with zero UI edits.
- **Playwright MCP UAT within autonomous flow (decision #17)** — replace `checkpoint:human-verify` with automated browser-drive when the evidence is DOM-readable. Captured per-surface: service activity counter regex extraction, ACL modal row count, shadow-root drill for debugger lanes.
- **Alphabetical-split-with-center-anchor lane ordering** — `deriveLanes` sorts napplets alphabetical, splits at midpoint, places Shell at center. Deterministic, readable, extensible to any lane count.
- **Service-domain aliasing via SERVICE_DOMAIN_ALIAS map** — when envelope domains differ from topology node IDs (e.g., `notify` → `notifications`), map-based aliasing beats branching. Single-line rename in the map handles new renames; guard via `topology.services.includes()` prevents orphan rings.
- **Cascade-fix bucket in plan decision matrices** — 29-02's 4-bucket decision matrix (ACL pre-grant / napplet-internal / shell-mediasession / escalate) gained a 5th bucket "cascade-fixed" at diagnostic time. Future investigation-first plans should account for "the upstream fix already resolved this" as an explicit outcome.

### Key Lessons

- **Hardcoded lists drift silently — surface-sweep them at every milestone boundary.** The v1.5 bug had been latent since v1.3 (when the 8-napplet hardcoded block was written). Nobody noticed until v1.4 added a 9th and 10th napplet and the user manually tested. v1.6 milestone review should include a grep sweep for any `if (name === 'X')` chains that should be data-driven loops.
- **"All napplets in isolation pass" ≠ "all napplets together pass".** 49 Playwright specs passed pre-v1.5; every Layer-B spec loaded one napplet at a time. The concurrent-boot failure mode lived in the gap between Layer-A (harness-driven, single napplet) and Layer-B (demo-driven, single napplet per spec). v1.5 closed the gap with `demo-concurrent-boot.spec.ts` — every future napplet addition trips this spec if AUTH-flow regressions appear.
- **Symptoms mask root causes until you scout the code first.** The user reported "7 napplets stuck on LOADING" + "media play does nothing" + "ACL matrix empty" + "sequence diagram only 3 lanes" as 4 separate bugs. Scout revealed: (1) was a display bug with (2) as a cascade effect; (3), (4), (5) were 3 independent root causes. Phase 29 shipped 1 fix that closed 2 issues; Phase 30 shipped 3 fixes for 3 independent surfaces. Without the scout pass, the planning would have over-scoped Phase 29 to cover (2) separately.
- **MCP Playwright is a game-changer for autonomous UAT.** v1.4 Phase 27 used HUMAN-UAT.md deferrals; v1.5 Phase 29 used MCP Playwright to close the same type of gate inline. Any autonomous flow that previously required a human browser test now has a fully automated path. Expand the pattern to Phase 30+ in v1.6+.

### Cost Observations

- Model mix (approx): 75% sonnet (executors + checkers + verifier + researcher + integration-checker), 25% opus (planners + orchestrator + smart-discuss).
- Sessions: 1 autonomous session from `/gsd:autonomous --from 29` through milestone close. User interventions: 3 × accept-all smart-discuss per phase (9 total), 1 × "checkpoint detected — I drove UAT via MCP and closed automatically" (no user interrupt), 0 × escalations. ~18 decisions gated by user; all resolved in 1 click.
- Autonomous session efficiency: 7 plans / 9 tasks / 3 phases shipped in ~45 min wall-clock. Phase 30's parallel wave-1 was a significant speed-up (3 fixes → wall time = slowest single fix).
- Iteration-loop behavior: zero auto-fixes required during wave execution (CONTEXT scouts caught all the edge cases in the planning phase). Contrast with v1.4 Phase 27/28 which needed 2 + 1 auto-fixes respectively.

---

## Milestone: v1.4 — Productionization & Upstream Unblock

**Shipped:** 2026-04-19
**Phases:** 6 (23–28) | **Plans:** 17 | **Tasks:** 33

### What Was Built

- **CI/CD enforcement** — `.github/workflows/build.yml`, `unit.yml`, `e2e.yml` gate every push/PR; `release.yml` staged for tag-triggered publishing.
- **npm publication** — `@kehto/{acl,runtime,shell,services}@0.2.0` live on registry.npmjs.org; fresh-install smoke test clean.
- **DRIFT-CORE-06 cleanup** — `core-compat.ts` deleted; live types re-homed; dead NIP-01 paths (`BusKind`, `AUTH_KIND`, `DESTRUCTIVE_KINDS`, `STATE_TOPICS`) purged from runtime + shell. Zero behavior change — all 442 unit tests green.
- **Real keys backend** — document-level chord listener + subscription registries + `keys.action` push; `HostKeysBridge` interface; `hotkey-chord` demo napplet; Layer-B E2E-12 spec.
- **Real media backend** — `navigator.mediaSession` mirror (metadata + playbackState) + 5 action handlers → `media.command` push; silent-audio prime; last-active-wins multi-session registry; `HostMediaBridge` interface + `createBrowserMediaBridge()` factory; `media-controller` demo napplet; Layer-B E2E-13 dual-path spec.
- **Layer-A upgrade** — `nub-keys.spec.ts` + `nub-media.spec.ts` rewritten in place to exercise real backends via `__registerService__('keys'|'media', 'real')` harness factory-key.
- **Docs polish** — `packages/services/README.md` extended with Keys + Media H2 sections (verbatim interface blocks + runnable snippets + custom-bridge examples). `apps/demo/README.md` created with 10-napplet inventory + service topology + ACL surface + host-hook catalog.

49 Playwright specs green (baseline 47 → 48 after Phase 26 → 49 after Phase 27 → 49 after Phase 28 in-place upgrade).

### What Worked

- **Smart-discuss batch acceptance in autonomous mode.** 3-area grey-area proposals with recommended answers resolved in one click per area. Every phase-context decision ended up in CONTEXT.md Area N blocks; plans cited them verbatim; zero "what did we decide?" reloops during execution. This scaled especially well for Phase 26/27/28 where each had 3 grey areas × 4 questions.
- **Structural mirroring across Phase 26/27.** Phase 26 established the 4-plan shape (real service / HostBridge / demo napplet / Layer-B spec + iteration loop). Phase 27 mirrored it 1:1 for media. The planner produced Phase 27 plans by structural copy + domain substitution — reduced planning-phase churn to near-zero.
- **`--no-transition` auto-advance.** Each `gsd:execute-phase` returned status to the autonomous orchestrator instead of chaining, keeping the agent tree flat and preventing deep nesting deadlocks. Six phases executed with no context-window pressure on the orchestrator.
- **Per-napplet `__grant*__` host hooks for E2E capability gates.** `__grantKeysForward__` (Phase 26) + `__grantMediaControl__` (Phase 27) gave Playwright specs a deterministic capability-grant path without UI click-through. Pattern generalized cleanly — future real-service phases can reuse the recipe.
- **DUAL-PATH E2E assertion.** Phase 27's spec asserted both the DOM sentinel (status transitions) AND the browser-side API (`navigator.mediaSession.playbackState` + `metadata.title` via `page.evaluate`). Locked the protocol wire + the actual browser integration simultaneously.

### What Was Inefficient

- **Anti-term grep false-positive hygiene.** Phase 28's full-surface sweep returned 27 raw matches that all needed manual classification (JSDoc migration docs, `signer.sign` over-match on legitimate NIP-46 signer variables, spec-docblock anti-feature references). Classification was fast (single audit agent) but it's a recurring noise source. Fix for v1.5+: tighten anti-term grep patterns (e.g., `^signer-service\b` instead of `signer-service`) or pre-classify known false-positive files.
- **Phase 27-01 → 27-02 double-call regression.** Initial 27-02 extraction called `setMetadata` directly in `session.create` PLUS via `setActive()`, causing a double-call that broke Plan 27-01's test compatibility. Auto-fixed during 27-02 execution (removed the direct call). Root cause: the silent-audio prime was previously inline; when it moved to `setActiveSession`, the mirror path needed refactoring too. Fix for v1.5+: when refactoring via extraction, explicitly list all control-flow paths that change and write a regression test matrix before touching code.
- **Phase 27-04 Chromium background-tab throttling.** Parallel Playwright workers (8 threads) throttled the sandboxed iframe's onclick handler in media-controller.spec.ts, requiring `page.bringToFront()` before each button click (auto-fixed). Hotkey-chord.spec.ts wasn't affected because it dispatches keyboard events at the top-level page. Pattern now documented: iframe interactions in parallel workers need `bringToFront()`.
- **Traceability checkbox drift.** A subset of v1.4 REQ-IDs (CI-04, REL-05/06, MEDIA-01/02/03, E2E-13/14, DOCS-05/06) remained `[ ]` in REQUIREMENTS.md despite being fully verified — the traceability table wasn't systematically updated at phase complete. `gsd:complete-milestone` caught it via 3-source cross-reference, but it's noise. Fix for v1.5+: `gsd-tools phase complete` should auto-check off REQ-ID rows when VERIFICATION.md is `passed`.

### Patterns Established

- **`__registerService__('name', 'real')` harness factory-key** — single new API surface replaces ad-hoc stub-body strings for both `keys` + `media`; extends naturally if future domains need real-backend Layer-A coverage.
- **HostXxxBridge + createBrowserXxxBridge factory extraction** — Phase 26 (keys) + Phase 27 (media) both shipped the same structural shape: interface type + browser reference impl factory + `hostBridge?` option branch. Canonical for any future "real backend" phases.
- **Silent-audio prime for `navigator.mediaSession`** — 4 kHz silent-WAV data URL inline in shell code; played on first active session; removed on last destroy. Keeps OS media controls visible without shipping an audio file asset.
- **Status-sentinel wait substitute for `__nappletReady__`** — demo port `:4174` doesn't install `__nappletReady__` (only `:4173` harness does); Layer-B specs wait on DOM sentinel transitions instead (e.g., `'session-ready'`, `'subscribed'`). Canonical for all demo-driven specs.
- **Cascaded topology-change test updates are in-scope** — when a phase retires a stub service, the `demo-boot.spec.ts` stub-badge assertion update lands in that phase's atomic commit (not a separate follow-on). Phase 26 established; Phase 27 confirmed.

### Key Lessons

- **Capstone phases should always ship docs.** Phase 28's docs polish turned out to be critical — without runnable snippets + interface blocks in the README, host-app integrators would have to read source. v1.3 had similar docs coverage; v1.4 extended it for the new backends. Future "real backend" or protocol-extension milestones should always include an explicit DOCS-XX requirement.
- **Anti-feature documentation should be descriptive, not literal.** Phase 26 Rule-1 lesson applied again: docblocks that quote forbidden tokens literally (e.g., `'window.addEventListener'`) trigger anti-term grep false positives. Describe the anti-feature (`"no raw postMessage listener"`) instead. Carried into Phase 27/28 without incident.
- **Smart-discuss is a force multiplier for structurally-similar phases.** Phase 26/27/28 shared the "3 grey areas × 4 questions" shape — Phase 27's discussion produced CONTEXT.md in minutes because the user had 1-click acceptance for each area. Future multi-phase milestones with parallel structure (e.g., multiple domain implementations) should batch grey areas similarly.
- **CI evidence deferral is a repeatable pattern.** Phase 26 deferred push + CI URL evidence until after milestone close; Phase 27 did the same. HUMAN-UAT.md tracks it cleanly. Future "ship a spec" phases can adopt the pattern without needing to block phase close on CI green.

### Cost Observations

- Model mix (approx): 80% sonnet (executors + checkers + verifier + researcher), 20% opus (planners + orchestrator + smart-discuss).
- Sessions: 1 autonomous session from `/gsd:autonomous --from 27.` executed Phase 27 + Phase 28 end-to-end + milestone lifecycle. User interventions: 3 × accept-all smart-discuss, 1 × defer-push decision, 1 × archive-phases + push-tag decision.
- Notable efficiency: 17 plans / 33 tasks / 6 phases shipped in one autonomous session. Phase 26 shipped before autonomous mode started (normal flow); Phases 27–28 + lifecycle in autonomous.
- Iteration-loop behavior: Phase 27-04 needed 1 auto-fix (bringToFront). Phase 28-01 needed 2 auto-fixes (Rule 3 workspace dep, Rule 1 envelopeLog hoisting). All auto-fixed in the executor subagent without orchestrator intervention.

---

## Milestone: v1.3 — Demo Functional & Playwright Parity

**Shipped:** 2026-04-18
**Phases:** 7 | **Plans:** 43 | **Tasks:** 68

### What Was Built

- `apps/demo` fully wired to canonical v1.2 `@kehto/*` APIs — 8 NIP-5D service nodes visible in topology; ACL panel/modal/history, signer demo + NIP-46, notifications, kinds + constants panels all green; zero `window.nostr` / `signer-service` / `BusKind` in demo source.
- 8 demo napplets (`bot`, `chat`, `composer`, `preferences`, `toaster`, `feed`, `profile-viewer`, `theme-switcher`) on `@napplet/sdk` exercising all 6 non-stub NUB domains end-to-end.
- Playwright suite: Layer-A (6 nub fixture napplets + 8 `nub-*.spec.ts` harness-driven correctness specs) + Layer-B (18 domain/demo specs). 47 passed / 0 failed / 0 skipped / 16.7s on fresh build.
- Docs: `typedoc` @ root (`entryPointStrategy: packages`), 4 canonical @kehto/* READMEs, migration archive at `docs/migrations/`.
- Release rehearsal: `publint` + `attw --profile esm-only` clean, `pnpm changeset version` dry-run clean, 4 v1.3 `patch`-bump changesets staged.

### What Worked

- **E2E-11 cross-cutting iteration-loop gate.** Enforcing build → run → Playwright → fix discipline per phase meant regressions surfaced within the phase that introduced them, not after. Phase 22's fresh-build capstone closed on iteration 1.
- **Goal-backward VERIFICATION.md per phase.** Each phase's acceptance criteria translated to automated `<verify>` blocks; auditing at milestone close was straightforward because phase-level verification already passed.
- **Layer-A + Layer-B separation.** Harness-driven `nub-*.spec.ts` proves runtime protocol correctness without the demo; Layer-B proves the demo wires the protocol correctly. Gaps in one layer don't hide behind the other.
- **Deletion over migration for legacy fixtures + specs.** Phase 21-01 deleted `auth-napplet`/`publish-napplet`/`pure-napplet`; Phase 22-07 deleted the 7 spec files that loaded them. Cleaner than a migration path that would have duplicated new Layer-A coverage.
- **`pnpm.overrides` for `@napplet/core` dedup.** Single workspace-level override prevented Pitfall 3 (two core instances breaking dispatch identity) across all 4 `@kehto/*` packages — no per-package workarounds needed.

### What Was Inefficient

- **Gap closure cycle in Phase 22.** Initial phase plan shipped 22-01/02/03 (docs) but missed REL-01..04 + E2E-10 + E2E-11 until verification flagged `gaps_found`. Had to add 5 gap-closure plans (22-04..22-08). Root cause: phase scope was written before the iteration-loop cross-cutting requirement (E2E-11) was formalized as a D-08 directive mid-milestone. Fix for v1.4: confirm all cross-cutting gates have explicit plans before plan-phase concludes.
- **Mid-milestone terminal crash during Phase 22-07 execution.** Lost the commit for 7 `git rm` deletions + iteration-log updates; resume required forensic reconstruction from staged state. Fix: executor subagents should commit after each tool-produced atomic unit (already the convention; one plan slipped through).
- **SUMMARY frontmatter drift.** Several plans (17-01, 17-03/04/06/07, 18-01, 19-01..03/06/07, 20-04..06/08, 21-02..05, 22-03/05) have empty `requirements_completed` arrays despite their work completing requirements. VERIFICATION caught the real state, but milestone audit had to cross-reference three sources to untangle. Fix: enforce non-empty `requirements_completed` in plan-level `<acceptance_criteria>` when the plan claims any REQ-ID.

### Patterns Established

- **Pre-`aclBeforeEach` + `demoBeforeEach` fixture split** (Phase 17) — harness-targeted vs demo-targeted specs use different setup helpers to pick the right surface.
- **`frame.evaluate(() => btn.click())` for sandboxed napplet iframes** (Phase 19-05) — CDP Input doesn't reach cross-origin sandboxed handlers; canonical for all napplet iframe button interactions.
- **Idempotency guards on shared log sections** (Phase 22 W6) — gap-closure plans writing to a shared `ITERATION-LOG.md` use `grep -q '^## <section>' ... || append` so re-running is safe.
- **D-02 option (a): delete over migrate** when underlying fixtures removed (Phase 21-01 / 22-07 precedent).
- **Capstone iteration-log pattern** — Phase 22-08 consolidated REL-01..04 + E2E-10 evidence from Phase 22-04..07 into one document + ran a fresh-build Playwright loop as the milestone gate closure.

### Key Lessons

1. **Cross-cutting gates need explicit plan coverage.** E2E-11 being "cross-cutting" (every phase must close with an iteration loop) wasn't enough to guarantee coverage; Phase 22 also needed a dedicated capstone plan (22-08) to formally record it. Rule for v1.4: every cross-cutting gate gets at least one dedicated plan in the phase that closes it.
2. **Verification before completion — always.** Phase 22 verifying as `gaps_found` caught 5 missing requirements before milestone audit. Skipping verification would have shipped v1.3 with REL-01/02/03/04 + E2E-10 unclosed.
3. **Fresh build ≠ cached build.** Phase 22-08's `pnpm clean && pnpm build` surfaces turbo cache staleness issues that cached builds miss. Worth the ~30s cost on the milestone capstone even when iterative runs are cached.
4. **Atomic commits per tool-produced artifact.** The Phase 22-07 crash recovery was manageable because each step produced git-trackable artifacts (staged deletions, modified logs). Would have been worse if the work had only lived in memory.
5. **Peer-dep + workspace overrides are the cleanest protocol-version gate.** `@napplet/core ^0.2.0` as peer dep + `pnpm.overrides` link: for workspace lets `@kehto/*` compile against a real type surface while the real package lives in a sibling repo — no per-`@kehto/*` vendoring needed.

### Cost Observations

- Model mix: ~95% opus (including opus-1m for long-running plan/verify), ~5% sonnet (gsd-executor subagents per workflow defaults).
- Sessions: ~10 planning sessions + ~15 execution sessions across 7 phases (estimate — not instrumented).
- Notable: Phase 22 gap closure (plans 22-04..22-08) absorbed ~30% of total milestone compute due to the gap-found → plan-gaps → execute → re-verify cycle. Up-front rigor on cross-cutting gates would have cut this in half.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 5 | Initial GSD adoption; migration docs |
| v1.1 | ~12 | 4 | NIP-5D 5-nub implementation; introduced phase VERIFICATION.md |
| v1.2 | ~18 | 6 | Canonical conformance + 8-nub coverage; 449 tests |
| v1.3 | ~25 | 7 | Consume-and-showcase; Layer-A + Layer-B Playwright split; E2E-11 iteration-loop gate |

### Cumulative Quality

| Milestone | Active Tests | Skipped | Zero-Dep Additions |
|-----------|-------------:|--------:|-------------------:|
| v1.2 | 449 | 0 | (baseline) |
| v1.3 | 47 (E2E) | 0 (was 68 pre-22-07) | @kehto/acl already zero-dep (confirmed via publint) |

Note: v1.3 test count reflects E2E Playwright specs only; unit tests carried forward from v1.2 unchanged. The drop from 449 → 47 is a change of instrument (v1.2 counted all Vitest specs; v1.3 E2E-10 gates specifically on Playwright suite green).

### Top Lessons (Verified Across Milestones)

1. **Iteration loops are the unit of verification.** v1.2 introduced per-phase VERIFICATION; v1.3 added the E2E-11 build-run-Playwright-fix gate on top. Both milestones needed this — code green alone underspecifies "done".
2. **Delete over migrate when the underlying contract changed.** v1.1/v1.2 deleted NIP-01 → NIP-5D code paths; v1.3 deleted the last legacy fixtures + specs. Migration paths burn time for code that won't ship.
3. **Workspace overrides beat per-package shims.** v1.2 introduced `DRIFT-CORE-06` (per-package shim for `@napplet/core` v0.1 exports) as a bridge; v1.3 relies on `pnpm.overrides` at the root. The second is less load-bearing and harder to forget.
