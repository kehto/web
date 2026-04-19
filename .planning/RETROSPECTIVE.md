# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

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
