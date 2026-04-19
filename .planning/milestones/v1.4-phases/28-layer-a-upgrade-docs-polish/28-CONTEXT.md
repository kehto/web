# Phase 28: Layer-A Upgrade & Docs Polish - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Smart-discuss batch acceptance (user accepted all 3 grey-area recommendations)

<domain>
## Phase Boundary

Close the v1.4 milestone by (a) upgrading the two stub-scope Layer-A harness specs (`nub-keys.spec.ts` + `nub-media.spec.ts`) to full protocol-correctness coverage now that real backends exist, (b) extending `packages/services/README.md` with first-class `keys` + `media` sections documenting the new public APIs + `HostKeysBridge`/`HostMediaBridge` host-bridge contracts, and (c) creating `apps/demo/README.md` from scratch to document the 10-napplet end-to-end showcase. Close the phase with a fresh-build iteration loop, anti-term hygiene sweep across the full v1.4 surface, and hand off to the autonomous lifecycle step (audit → complete → cleanup).

In scope:
- **E2E-14**: Upgrade `tests/e2e/nub-keys.spec.ts` + `tests/e2e/nub-media.spec.ts` from stub-scope to real-backend coverage. Extend `__registerService__` with a `'real'` factory-key so harness tests can swap the real service in cleanly. Delete STUB SCOPE NOTICE docblocks; delete stub-body registration paths. Audit all `tests/e2e/**` for stub-scope `test.describe.skip` / `test.skip` markers and remove any still attached to stub rationale.
- **DOCS-05**: Append `## Keys Service` + `## Media Service` H2 sections to `packages/services/README.md` — factory signatures, `HostKeysBridge` / `HostMediaBridge` interface signature blocks, runnable copy-paste code examples, "when to plug a custom bridge" sidebars. Examples reference the `hotkey-chord` + `media-controller` demo napplets by file path.
- **DOCS-06**: Create `apps/demo/README.md` from scratch using the repo's canonical 7-section README skeleton (mirroring `packages/services/README.md`). Napplet inventory table listing all 10 entries; v1.3 → v1.4 history line; service topology overview; ACL surface summary; host-hook catalog (e.g., `window.__grantKeysForward__`, `window.__grantMediaControl__`); license.
- **Iteration-loop**: `pnpm clean && pnpm build && pnpm test:e2e` recorded in `28-ITERATION-LOG.md`. Expected test count: 49 passed / 0 failed / 0 skipped (in-place upgrade of nub-keys + nub-media specs produces no net count change; Phase 28 does NOT add new specs).
- **Anti-term hygiene sweep** (milestone gate): grep across `packages/**/src`, `apps/demo/src`, `apps/demo/napplets/{hotkey-chord,media-controller}/src`, `tests/e2e/**` — expect zero matches for `window.nostr|signer-service|signer.sign|BusKind|kind === 2900[12]|core-compat`; zero raw `window.addEventListener('message')` in new napplets.
- **Lifecycle transition prep**: Phase 28's VERIFICATION.md reaches `passed` so autonomous lifecycle can proceed to `gsd:audit-milestone` → `gsd:complete-milestone v1.4` → `gsd:cleanup`.

Out of scope:
- **Publishing to npm** — REL-05 / REL-06 belong to Phase 25 (skipped per `--from 27` filter; `@kehto/*@0.2.0` already published per MEMORY.md). Phase 28 does NOT bump versions or publish.
- **CI pipeline modifications** — CI-01..04 are Phase 23/25 scope.
- **Docs site / typedoc refresh** — only the two README files named in REQUIREMENTS.md are in scope.
- **Electron / Tauri host-bridge reference implementations** — deferred past v1.4 per REQUIREMENTS.md Future Requirements.
- **New Layer-B specs** — E2E-12 (hotkey-chord) + E2E-13 (media-controller) already shipped in Phases 26/27.

</domain>

<decisions>
## Implementation Decisions

### Area 1: Layer-A Spec Upgrade Scope (ACCEPTED)

- **Upgrade mechanism — replace in place**. Both `tests/e2e/nub-keys.spec.ts` and `tests/e2e/nub-media.spec.ts` keep their filenames, but their bodies are rewritten. Delete the STUB SCOPE NOTICE docblocks. Delete the inline `__registerService__(…, stringBody)` stub paths that install ad-hoc capture-only services. Replace with real-service registration via a harness extension (decision Q4 below).
- **Assertion scope — contract, not implementation**. Layer-A is harness-driven by definition; specs assert the NUB wire contract against the real backend:
  - `nub-keys.spec.ts`: drives `keys.registerAction` → asserts the real service subscribes + responds with `.result`; simulates a document keydown via `page.evaluate(() => document.dispatchEvent(new KeyboardEvent(...)))` → asserts `keys.action` push envelope fires (captured via `__getNubMessage__`).
  - `nub-media.spec.ts`: drives `media.session.create` → asserts the real bridge installs `navigator.mediaSession` action handlers (verified via `page.evaluate(() => typeof navigator.mediaSession === 'object')` + metadata read); drives `media.session.update` → asserts `navigator.mediaSession.metadata.title` reflects the update; simulates an action handler invocation (via `page.evaluate(() => navigator.mediaSession.setActionHandler('play', …))` or direct handler call) → asserts `media.command` push envelope fires.
- **Skip-marker audit** — grep all of `tests/e2e/**` for `test.describe.skip` + `test.skip` and remove any marker whose rationale cites stub-scope. Non-stub skip markers (e.g., flaky-test quarantine) require an explicit justification comment OR must be removed; ROADMAP §4 success criterion is "zero skipped specs across the entire suite".
- **Harness API — extend `__registerService__`**. Single new factory-key code path — `__registerService__('keys', 'real')` and `__registerService__('media', 'real')` — internally creates the real service via `createKeysService()` / `createMediaService()` and registers it with the runtime. Preserves the existing `__registerService__(name, stringBody)` path for ad-hoc stub needs. Single surface change covers both domains.

### Area 2: README Authoring (ACCEPTED)

- **DOCS-05 — in-file extension**. Append two new H2 sections after the Quick Start block in `packages/services/README.md`:
  - `## Keys Service` — factory signature (`createKeysService(options?: KeysServiceOptions)`), `KeysServiceOptions` field table, `HostKeysBridge` interface signature block (verbatim from `packages/services/src/keys-service.ts`), runnable snippet: `import { createKeysService } from '@kehto/services'; runtime.registerService('keys', createKeysService());` plus a custom-bridge snippet: `runtime.registerService('keys', createKeysService({ hostBridge: myElectronBridge }));`. "When to plug a custom bridge" sidebar: Electron/Tauri/OS-global hotkey backends.
  - `## Media Service` — factory signature (`createMediaService(options?: MediaServiceOptions)`), `MediaServiceOptions` field table, `HostMediaBridge` interface signature block (verbatim from `packages/services/src/media-service.ts`), runnable snippet plus bridge-override snippet, "When to plug a custom bridge" sidebar: Electron/MPRIS/native OS media control.
  - Reference the `hotkey-chord` + `media-controller` demo napplets by file path in each section's "see the demo" line.
  - Mirror the existing `createIdentityService` / `createNotificationService` section structure for consistency.
- **DOCS-05 — runnable code examples**. All snippets are copy-paste valid for a host app. Each section ends with a runnable "full example" block that includes import, factory creation, `registerService` wiring.
- **DOCS-06 — create from scratch, canonical 7-section skeleton** (mirrors the @kehto/* package READMEs):
  1. **Title + one-line pitch** — "Reference consumer of the napplet protocol: a 10-napplet browser demo hosting @kehto/runtime + @kehto/shell."
  2. **Run** (not Install — the demo isn't published): `pnpm install && pnpm --filter @kehto/demo dev` → browser opens at `http://localhost:4174`.
  3. **Napplet inventory table** (10 entries, columns: Napplet | Domain(s) | NUB methods exercised | File path) — lists bot, chat, composer, feed, hotkey-chord, media-controller, preferences, profile-viewer, theme-switcher, toaster.
  4. **Service topology** — 5 non-stub services: identity, ifc, notify, relay, storage, theme, keys (real), media (real). `STUB_ONLY_SERVICES = []` noted.
  5. **ACL surface** — high-level: per-napplet capabilities resolved via `relay.runtime.aclState.check(pk, dTag, hash, cap)`; grant flow documented.
  6. **Host hooks** — catalog of `window.__grant*__` hooks: `__grantKeysForward__`, `__grantMediaControl__`, with brief description of when Playwright specs invoke them.
  7. **License** — MIT (matching repo).
- **DOCS-06 — v1.3 → v1.4 history line**. One-sentence block at the top: "v1.3 shipped an 8-napplet demo; v1.4 adds `hotkey-chord` (KEYS-* backend) and `media-controller` (MEDIA-* backend) for a 10-napplet end-to-end showcase."

### Area 3: Milestone Closeout (ACCEPTED)

- **Plan count — 3 plans, one per REQ-ID**:
  - `28-01-PLAN.md` (E2E-14, wave 1, no deps): Upgrade `nub-keys.spec.ts` + `nub-media.spec.ts` in place; extend harness `__registerService__` with `'real'` factory-key; skip-marker audit; anti-term hygiene spot-check on the upgraded specs.
  - `28-02-PLAN.md` (DOCS-05, wave 2, depends on 28-01): Append `## Keys Service` + `## Media Service` sections to `packages/services/README.md`.
  - `28-03-PLAN.md` (DOCS-06 + iteration loop + phase closeout, wave 2 parallel to 28-02): Create `apps/demo/README.md`; run `pnpm clean && pnpm build && pnpm test:e2e`; record `28-ITERATION-LOG.md` (expected: 49/0/0); perform full v1.4-surface anti-term hygiene grep sweep.
  - Waves: `28-01` wave 1; `28-02` + `28-03` wave 2 (both docs-only, no code deps; `28-02` edits services README + `28-03` creates demo README; parallel-safe).
- **Iteration loop** — Last task of `28-03-PLAN.md`. No new specs, no net test-count delta (49 → 49). `28-ITERATION-LOG.md` records SHA of the closing commit, build task counts, Playwright results, anti-term grep evidence.
- **Anti-term hygiene sweep (milestone gate)** — Full v1.4 surface grep in `28-03-PLAN.md`:
  ```bash
  grep -rnE "window\.nostr|signer-service|signer\.sign|BusKind|kind === ?2900[12]|core-compat" \
    packages/{acl,runtime,shell,services}/src \
    apps/demo/src \
    apps/demo/napplets/{hotkey-chord,media-controller}/src \
    tests/e2e 2>/dev/null | wc -l
  # expected: 0
  ```
  Plus raw-postMessage grep on new napplets:
  ```bash
  grep -rn "window\.addEventListener.*message" apps/demo/napplets/{hotkey-chord,media-controller}/src 2>/dev/null | wc -l
  # expected: 0
  ```
- **Milestone-audit trigger** — Phase 28's `VERIFICATION.md = passed` hands control back to the autonomous workflow's `lifecycle` step. The autonomous workflow then runs `gsd:audit-milestone` → `gsd:complete-milestone v1.4` → `gsd:cleanup`. Phase 28 does NOT duplicate audit scope.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/e2e/nub-keys.spec.ts` (stub-scope, ~100 lines) — base structure to rewrite in place. Pattern: `__injectEnvelope__` + `__registerService__` + assertion.
- `tests/e2e/nub-media.spec.ts` (stub-scope, ~100 lines) — structural twin of nub-keys.
- `tests/e2e/helpers/` — `aclBeforeEach`, `waitForNappletReady`, `demoBeforeEach` — reuse as-is.
- `tests/e2e/harness/harness.ts` — home of `__registerService__`; extend with `'real'` factory-key branch.
- `packages/services/README.md` (85 lines, 3 services documented) — extend the existing structure.
- `packages/services/src/keys-service.ts` + `media-service.ts` — source-of-truth for factory signatures, interface shapes, options types; import interface blocks verbatim into README.

### Established Patterns
- Layer-A specs assert the NUB wire contract against the real backend; harness drives envelopes via `__injectEnvelope__` + reads via `__getNubMessage__`. No demo pages loaded.
- README structure pattern: Title → Install → Overview → Quick Start → per-service H2 sections → License (or equivalent). Snippets are runnable copy-paste TypeScript.
- Phase 22's README refresh (v1.3 capstone) set the 7-section canonical skeleton; apps/demo/README.md mirrors that.
- turbo-run test gate: `pnpm test` (all workspaces) + `pnpm test:e2e` (Playwright); both must be green for iteration-loop close.
- Anti-term grep convention: piped through `wc -l`, expected `0`. Evidence captured in ITERATION-LOG.md.

### Integration Points
- `tests/e2e/harness/harness.ts` — `__registerService__` branch extension; touch points for keys + media real-service factories.
- `tests/e2e/nub-keys.spec.ts` — body rewrite; imports from `@kehto/services` real factory (not a stub body).
- `tests/e2e/nub-media.spec.ts` — body rewrite; same pattern.
- `packages/services/README.md` — append two H2 sections; link back to demo napplet file paths.
- `apps/demo/README.md` — new file at this path; 7-section skeleton.
- `.planning/phases/28-layer-a-upgrade-docs-polish/28-ITERATION-LOG.md` — phase-closing artifact.

</code_context>

<specifics>
## Specific Ideas

- **`__registerService__` extension syntax**: `window.__registerService__('keys', 'real')` — the harness detects the literal string `'real'` and imports `createKeysService` from `@kehto/services`, creates an instance, and registers it with the runtime. For `media`, same pattern: `window.__registerService__('media', 'real')`. Existing signature `__registerService__(name, handlerStringBody)` path continues to work for ad-hoc stub needs.
- **Nub-keys real-backend assertion plan**: drive `keys.registerAction({ actionId: 'test.Ctrl+Shift+K', defaultKey: 'Ctrl+Shift+K' })` → assert `.result` envelope. Then `await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', ctrlKey: true, shiftKey: true, bubbles: true })))` → poll `__getNubMessage__('keys.action')` → assert action envelope present with correct `actionId`.
- **Nub-media real-backend assertion plan**: drive `media.session.create({ sessionId: 'test-session', metadata: { title: 'Layer-A Test', artist: 'kehto' }})` → assert `.result`. Drive `media.session.update({ sessionId: 'test-session', metadata: { title: 'Updated Title' }})` → `page.evaluate(() => navigator.mediaSession?.metadata?.title)` returns `'Updated Title'`. Drive an action handler invocation via a page-context script that calls a previously-stored handler → poll `__getNubMessage__('media.command')` → assert command envelope present.
- **Skip-marker audit command**: `grep -rnE "test\.describe\.skip|test\.skip(\(|$)" tests/e2e/ | grep -v 'node_modules'`. Any match requires justification or removal.
- **DOCS-05 interface-signature source**: extract verbatim from `packages/services/src/keys-service.ts` + `media-service.ts`. Use triple-backticks with `ts` language fence. Include JSDoc comments (helps IDE consumers).
- **DOCS-06 napplet inventory table** — exact 10 entries with NUB domain references from REQUIREMENTS.md + phase-20 CONTEXT; see shell-host.ts `DEMO_NAPPLETS` for authoritative list.
- **Iteration-loop expected baseline**: 49 → 49 (no change). The upgrade is IN PLACE — two existing specs become two real-backend specs. Count stays 49.

</specifics>

<deferred>
## Deferred Ideas

- **Typedoc refresh** — not in scope; v1.3 set the entryPoint strategy; no additions needed.
- **Electron/Tauri host-bridge reference implementations** — deferred past v1.4 per REQUIREMENTS.md.
- **Cross-napplet demo integrations** (e.g., hotkey-chord triggering media-controller) — nice-to-have; out of v1.4.
- **Migration guide for host apps upgrading 8-napplet → 10-napplet demo** — v1.3 → v1.4 is additive; no migration needed for consumers. Skip.
- **Per-napplet MIGRATE.md files** — unnecessary; single demo README covers inventory + v1.3→v1.4 delta.

</deferred>
