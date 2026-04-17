# Project Research Summary

**Project:** Kehto Runtime — v1.3 Demo Functional & Playwright Parity
**Domain:** Sandboxed-iframe plugin runtime (Nostr / NIP-5D) — consumer-side integration milestone
**Researched:** 2026-04-18
**Confidence:** HIGH

## Executive Summary

v1.3 is a **consume-and-showcase** milestone: the protocol implementation already shipped (v1.2 delivered canonical NIP-5D conformance across all 8 nub domains), and the remaining work is wiring `apps/demo`, its bundled napplets, and the Playwright suite to that implemented surface. No `@kehto/*` protocol changes are in scope. All four research dimensions converge on **harness-first sequencing**: triage and fix the Playwright infrastructure before building any new demo surface, because every subsequent spec depends on a working, properly-isolated harness. The harness is the load-bearing foundation.

The central architectural decision the roadmap must enforce is **napplet placement as a hard contract**. Demo napplets (`apps/demo/napplets/`) carry real UI and exercise live service backends; fixture napplets (`tests/fixtures/napplets/`) are deterministic protocol probes with no meaningful UI. The two Vite plugins (`serveDemoNapplets`, `serveNapplets`) read from hardcoded different source directories — mixing them is an anti-pattern with concrete breakage. Alongside this, the `@napplet/*` workspace-link symlink model (all packages resolved via `pnpm.overrides` `link:` entries to `/home/sandwich/Develop/napplet/*`) must be verified before each Playwright run via `pnpm ls @napplet/core --depth 5`. A deduplication failure causes silent type-guard breakage that looks like protocol flakiness.

The primary risk cluster is the intersection of three deterministic bugs that manifest as apparent flakiness: (1) `aggregateHash` is `""` in Vite dev mode but a real 64-char hex in preview mode — ACL state keyed on `(pubkey, dTag, aggregateHash)` is poisoned whenever tests run against a non-built napplet; (2) `frameLocator` resolves immediately but the sandboxed iframe's execution context is not ready until navigation commits — naked frame-locator calls after `__loadNapplet__()` fail intermittently; (3) `localStorage` ACL state bleeds between Playwright tests when `page.reload()` is used instead of `page.goto('/')`. All three are solved once in Phase 16 and applied everywhere thereafter.

## Key Findings

### Recommended Stack

v1.2 stack is fully settled; v1.3 adds three net-new pieces only. Full detail in `STACK.md`.

**Core technologies (already in place):**
- pnpm 10 workspaces + turbo 2.5 + tsup + vitest 4.1 + Playwright 1.52 + Chromium — no churn
- `@napplet/*` resolved via `pnpm.overrides` `link:` — unchanged
- `@changesets/cli` 2.30 — staged already

**v1.3 additions:**
- `@playwright/test` `^1.52.0` → `^1.54.0` (minimum) — unlocks `page.consoleMessages()` / `page.pageErrors()` / `consoleMessage.timestamp()` for the build→run→Playwright→fix debug loop. Zero config change; drop-in.
- `typedoc@^0.28` (root devDep) — docs refresh, `entryPointStrategy: "packages"` for monorepo.
- `publint` + `@arethetypeswrong/cli --profile esm-only` via `pnpm dlx` — release rehearsal, no install required.
- Playwright array `webServer`: harness at `:4173` (existing) + demo at `:4174` (new). `turbo.json` gains `build:napplets` pipeline task.

**Hard rejects (do not add):** `msw`, `@vitest/browser`, `wait-on`, `axe-playwright`, any CJS tsup output, `window.nostr` stubs, `frameLocator`-based access to sandboxed-no-same-origin iframes.

### Expected Features

Full detail in `FEATURES.md`.

**Must have (P1 — blocks "demo functional"):**
- Demo boots clean against v1.2 APIs (no `window.nostr`, no signer-service). All 8 service nodes visible in topology.
- `bot` and `chat` migrated from raw `window.addEventListener('message')` to `@napplet/sdk`.
- Core-domain showcase napplets: `composer` (relay.publish + publishEncrypted), `preferences` (storage), `toaster` (notify) — live under `apps/demo/napplets/`.
- Signer modal + NIP-46 flow driving canonical `identity.*` + `relay.publish` (no `window.nostr`).
- E2E triage complete: obsolete specs (`signer-delegation`, `acl-matrix-signer`, legacy `auth*`) deleted; survivors migrated to NIP-5D envelopes; harness smoke + 6 golden-path specs green.

**Should have (P2 — completes 8-domain coverage):**
- `feed` (relay.subscribe), `profile-viewer` (identity), `theme-switcher` (theme) napplets.
- Layer-A fixture napplets in `tests/fixtures/napplets/` (per-nub correctness specs — one fixture per domain).
- Documentation refresh (`docs/` + READMEs + typedoc API reference).

**Defer (v1.4+ / explicit out-of-scope):**
- `hotkey-chord` napplet (keys domain has no real host backend — stub-only; showing "not implemented" is misleading).
- `media-controller` napplet (same reason — stub-only media backend).
- CI/CD (GitHub Actions) — deferred per milestone decision.
- `changeset publish` — blocked upstream by `@napplet/core` npm publication; v1.3 stops at `changeset version` dry-run.

**Hard anti-features (enforced in every phase):** `window.nostr` on any napplet-visible surface (NIP-5D MUST NOT), raw `window.addEventListener('message')` in new napplets, signer-service, `BusKind` / kind 29001 / kind 29002 in napplet code, `allow-same-origin` on iframe sandbox, new consumers of `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06).

### Architecture Approach

Full detail in `ARCHITECTURE.md`.

**Two-tier Playwright architecture:**
1. **Layer A — Harness** (`:4173`, existing): Protocol correctness. Drives the runtime via `window.__*` driver globals. Per-nub fixture napplets at `tests/fixtures/napplets/`.
2. **Layer B — Demo** (`:4174`, new): UX integration. Drives the real demo app. DOM assertions + frame locators only. Never touches `window.__*` harness globals.

**Major components:**
1. **Harness driver API** (`tests/e2e/harness/harness.ts`) — extended with 7 new NIP-5D envelope-aware globals: `__injectEnvelope__`, `__getNubMessage__`, `__getServiceNames__`, `__registerService__`, `__unregisterService__`, `__getNotifications__`, `__setIdentityPubkey__`. Structured-clone-safe primitives only (no method references).
2. **Demo shell host** (`apps/demo/src/shell-host.ts` + `createDemoHooks()`) — gains `keys`, `media`, `theme` service registrations via `@kehto/services` factories; relay pool stays stubbed (IFC routes through runtime's `ifcSubscriptions` map, intentional).
3. **Demo napplets** (`apps/demo/napplets/*`) — new single-purpose napplets with UI: `composer`, `preferences`, `toaster`, `feed`, `profile-viewer`, `theme-switcher`. Each registers as one DOM slot + one topology node + one `DEMO_NAPPLETS[]` entry.
4. **Fixture napplets** (`tests/fixtures/napplets/*`) — minimal protocol probes, one per nub domain. No UI beyond what fixture napplets already use.
5. **Playwright `webServer` array** — `[harness:4173, demo:4174]`. Specs choose target via `baseURL` override.
6. **Release-rehearsal workflow** — throwaway branch → `pnpm changeset version` → `pnpm install --frozen-lockfile` → inspect diffs → discard.

### Critical Pitfalls

Full detail in `PITFALLS.md`. Top 5 for roadmap:

1. **`frameLocator` timing on sandboxed iframes** — iframes load with `sandbox="allow-scripts"` (no `allow-same-origin`), making them `origin: null`. `frameLocator` returns immediately but the iframe's execution context is not ready until navigation commits. `demo-audit-correctness.spec.ts` already exhibits this gap. **Mitigation:** `waitForNappletReady(page, frameSelector)` helper is a Phase 16 deliverable, not an afterthought — every frame-touching spec must use it.
2. **`aggregateHash` dev vs preview divergence** — `@napplet/vite-plugin` emits `aggregateHash = ""` in `pnpm dev` (`closeBundle` is build-only). ACL entries keyed on `(pubkey, dTag, "")` do not match `(pubkey, dTag, "<64-char-hex>")` from preview builds. Silent failure. **Mitigation:** always build before `pnpm test:e2e`; specs assert hash is non-empty before interacting.
3. **pnpm symlink deduplication risk** — 8 `@napplet/*` `link:` overrides risk two `@napplet/core` instances when `apps/demo` adds it as a direct dep. Silent type-guard breakage. **Mitigation:** `pnpm ls @napplet/core --depth 5` as day-0 check in Phase 16 + each subsequent phase; demo never adds `@napplet/core` directly.
4. **ACL state bleed via `localStorage`** — mitigated already by canonical `beforeEach` (`goto('/') → __aclClear__() → __clearLocalStorage__()`) but only when `page.goto()` is used, not `page.reload()`. **Mitigation:** shared fixture + lint rule forbidding `page.reload()` in specs touching ACL state.
5. **Iteration-loop anti-patterns** — `waitForTimeout()` growth, swallowed console errors, stale turbo cache. **Mitigation:** every phase ends with the three-question diagnostic — (a) dist mtime newer than source? (b) console captured? (c) localStorage cleared? First console error is primary failure, not Playwright timeout.

## Implications for Roadmap

Based on research, suggested phase structure (7 phases; numbering continues from v1.2's Phase 15 → v1.3 starts at Phase 16):

### Phase 16: Harness Triage & Playwright Infrastructure
**Rationale:** Nothing else builds on a broken harness; a red baseline makes all new failures indistinguishable from inherited ones.
**Delivers:** obsolete specs deleted (`auth-handshake`, `auth.spec`, `signer-delegation`, `acl-matrix-signer`); harness driver globals extended with 7 new NIP-5D helpers; `waitForNappletReady()` helper; canonical `beforeEach` fixture; Playwright bumped to ^1.54 (unlocks `page.consoleMessages()` / `pageErrors()`); Playwright `webServer` array (`:4173` + `:4174`); `turbo.json` gets `build:napplets` task; harness-smoke spec green.
**Addresses:** all P1 "harness" features; explicit anti-features enforcement scaffolding.
**Avoids:** Pitfalls 1 (`frameLocator`), 4 (ACL bleed), 5 (iteration discipline) baked in from day 0.

### Phase 17: Demo App Rewire
**Rationale:** Unblocks all demo-targeting Playwright specs; the demo must boot cleanly before Phase 18 napplets have anywhere to run.
**Delivers:** demo boots clean (no `window.nostr`, no signer-service, no legacy BusKind); all 8 service nodes in topology; `createDemoHooks()` extended with `keys`/`media`/`theme` registrations; debugger shows NIP-5D `type` strings; signer modal + NIP-46 rewired to canonical `identity.*` + `relay.publish` / `publishEncrypted` path.
**Uses:** `@kehto/services` factories for the 3 new service registrations.
**Implements:** ShellAdapter composition pattern.

### Phase 18: Napplet SDK Migration (bot + chat)
**Rationale:** Establishes the correct `@napplet/sdk` usage pattern before new napplets are built to follow that pattern.
**Delivers:** `bot` + `chat` migrated off raw `window.addEventListener('message')` to `@napplet/sdk` envelope API; `ifc-roundtrip` Playwright spec green; topology shows live IFC traffic between the two napplets.
**Avoids:** cargo-culting the legacy pattern into new napplets.

### Phase 19: Core-Domain Napplets (relay, storage, notify)
**Rationale:** Covers the P1 blockers for "demo functional"; 5 of 8 domains demonstrably working after this phase.
**Delivers:** `composer` napplet (relay.publish + publishEncrypted), `preferences` napplet (storage), `toaster` napplet (notify); Playwright specs green: `relay-publish`, `relay-publish-encrypted`, `storage-persist`, `notify-lifecycle`.
**Addresses:** P1 feature set.

### Phase 20: Expanded-Domain Napplets (identity, theme, relay subscribe)
**Rationale:** Completes 8-domain showcase coverage for demo-side.
**Delivers:** `feed` napplet (relay.subscribe), `profile-viewer` napplet (identity), `theme-switcher` napplet (theme, uses `bridge.publishTheme` host-broadcast API); Playwright specs green: `identity-flow`, `relay-subscribe`, `theme-broadcast`; node inspector shows every registered NUB live.
**Research flag:** `feed` + `relay.subscribe` need a decision — seed events via `__injectMessage__` harness global, add mock relay pool to demo, or scope `feed` spec to validate only the subscribe envelope. See Research Flags below.

### Phase 21: Fixture Napplets & Layer-A Per-Nub Specs
**Rationale:** Protocol correctness independently verifiable without the demo server; re-locks the canonical spec surface at the harness level.
**Delivers:** 6 fixture napplets in `tests/fixtures/napplets/` (one per non-stub nub); 7 new `nub-*.spec.ts` Layer-A specs driving the runtime via harness globals only; `nub-keys` / `nub-media` scoped to stub-level correctness with explicit skip-reason doc.
**Uses:** driver globals established in Phase 16.

### Phase 22: Docs Refresh & Release Rehearsal
**Rationale:** Validate built artifacts after everything runs; content is accurate because implementation is settled.
**Delivers:** `typedoc` API reference at `docs/api/`; `publint` + `@arethetypeswrong/cli --profile esm-only` clean for all 4 packages; `changeset version` dry-run in throwaway branch with `pnpm install --frozen-lockfile` verification; READMEs updated to showcase v1.2-canonical APIs; `changeset publish` explicitly not run (deferred).
**Avoids:** Pitfall 7 (changeset peer-dep install failures).

### Phase Ordering Rationale
- Phase 16 has no dependencies; comes first because every other phase adds specs to the harness it establishes.
- Phase 17 unblocks all demo-targeting specs; must precede Phases 18–20.
- Phase 18 establishes SDK usage pattern *before* Phase 19 adds new napplets following it.
- Phase 19 covers P1 blockers before Phase 20 adds P2 items.
- Phase 21 could parallelize with 19–20 in theory but is sequenced after because it depends on the full driver API from Phase 16 and benefits from the napplet-authoring patterns established in 18–20.
- Phase 22 is always last — validates built artifacts, not implementation.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 20:** `relay.subscribe` + `feed` napplet delivery mechanism. Demo relay pool is stubbed (no-op) by design, so a feeding napplet receives no events without a delivery path. Planning step must pick one: (a) harness `__injectMessage__` seed, (b) mock relay pool in demo, (c) scope `feed` spec to subscribe-envelope-only. This is the one genuine open question across all four research files.

Phases with standard patterns (skip research-phase):
- **Phase 16:** triage targets explicitly named in `ARCHITECTURE.md`; canonical `beforeEach` already exists in `acl-enforcement.spec.ts`.
- **Phase 17:** all mutation points are file-level specific in `ARCHITECTURE.md`.
- **Phase 18:** `@napplet/sdk` API is stable; migration is mechanical removal of raw event listeners.
- **Phase 19:** napplet vite config pattern established; integration points defined.
- **Phase 21:** fixture napplet pattern exists in `auth-napplet`; driver API extensions defined.
- **Phase 22:** exact commands documented in `STACK.md` and `ARCHITECTURE.md`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Playwright release notes verified; publint 0.3.18 confirmed; typedoc 0.28 confirmed; attw version not pinned (pnpm dlx, low risk) |
| Features | HIGH | All findings from live codebase — zero speculation; NIP-5D spec synced at `specs/NIP-5D.md` |
| Architecture | HIGH | All findings from direct file analysis; mutation points are file-level specific |
| Pitfalls | HIGH | Derived from direct codebase analysis of runtime internals, vite configs, existing specs, and vite-plugin source |

**Overall confidence:** HIGH

### Gaps to Address
- `relay.subscribe` mock delivery for `feed` napplet — open decision, needs Phase 20 planning step (`/gsd:discuss-phase 20`).
- `attw` version not pinned — low risk; release-rehearsal-only via `pnpm dlx`.
- `theme-broadcast` Playwright spec requires a second napplet to observe `theme.changed` push — Phase 20 plan must designate which existing napplet consumes it (likely `preferences` or `profile-viewer`).
- `DRIFT-CORE-06` (`packages/runtime/src/core-compat.ts`) must not gain new consumers during v1.3 demo wiring — enforce during code review (not a spec).

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — Playwright 1.54 release notes, publint 0.3.18, typedoc 0.28, attw `--profile esm-only`
- `.planning/research/FEATURES.md` — full live-code analysis of `apps/demo/src/*`, `apps/demo/napplets/*`, `tests/e2e/*`, `specs/NIP-5D.md`
- `.planning/research/ARCHITECTURE.md` — direct read of `createDemoHooks()`, `ShellAdapter`, `harness.ts`, `playwright.config.ts`, `pnpm-workspace.yaml`
- `.planning/research/PITFALLS.md` — direct read of `shell-bridge.ts`, `origin-registry.ts`, `@napplet/vite-plugin` source, existing `acl-enforcement.spec.ts`

### Secondary (MEDIUM confidence)
- `attw` version pinning — not verified, uses `pnpm dlx` so low-risk
- `pnpm dedupe` sufficiency for `@napplet/core` deduplication — pnpm 10.8 behavior; `pnpm ls` check is the authoritative verification

### Tertiary (LOW confidence)
- None — all findings sourced from live code or official tool docs.

---
*Research completed: 2026-04-18*
*Ready for roadmap: yes*
