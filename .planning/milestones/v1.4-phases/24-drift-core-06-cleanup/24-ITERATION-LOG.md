# Phase 24 — DRIFT-CORE-06 Cleanup — Iteration Log

**Canon:** E2E-11 iteration-loop discipline (v1.3 Phase 22 established canon; baked into v1.4 per-phase success criteria).

**ROADMAP Phase 24 success criterion 5:** "Build → run → Playwright iteration loop recorded against the post-refactor commit: `pnpm clean && pnpm build && pnpm test:e2e` reports the full v1.3 baseline (47 / 0 / 0) green; result captured in the phase iteration log."

**Phase:** 24-drift-core-06-cleanup
**Requirements covered:** DRIFT-01 (Plan 24-01), DRIFT-02 (Plan 24-02)
**Started:** 2026-04-19T12:21:24Z
**Closed:** 2026-04-19T12:28:45Z

***

## Iteration 1 — post-24-02 fresh build

**Date:** 2026-04-19
**Working tree:** clean after atomic commit (captures Plan 24-01 + Plan 24-02 changes + both SUMMARY files + this log)
**Baseline reference:** Phase 23 closing state — 442 unit / 47 e2e green.

### Commands run

```
# (no root "pnpm clean" script exists; Phase 22 precedent: manual clean of dist/.turbo trees)
rm -rf packages/*/dist packages/*/.turbo \
       tests/fixtures/napplets/*/dist tests/e2e/harness/dist tests/e2e/harness/.turbo \
       apps/*/dist apps/*/.turbo
find . -type d -name ".turbo" -not -path "*/node_modules/*" -exec rm -rf {} +

pnpm build              # cold rebuild of all 20 turbo tasks (4 @kehto/* + demo + harness + fixtures)
pnpm test:unit          # vitest run (root script delegates to `vitest run`)
pnpm test:e2e           # pnpm test:build && npx playwright test (webServers :4173 harness + :4174 demo)
```

**Note on `pnpm clean`:** The plan specifies `pnpm clean` but the root `package.json` does not define a `clean` script. Plan 22-08's iteration log established the precedent of a manual `rm -rf packages/*/dist …` clean for this exact reason (Rule 3 - Blocking deviation: plan command unavailable, manual equivalent used). Behavior is identical: cold turbo rebuild with 0 cache hits.

### Results

| Step          | Exit | Observed                                           | Expected                |
|---------------|------|----------------------------------------------------|-------------------------|
| manual clean  | 0    | dist + .turbo trees removed across all packages    | exit 0                  |
| pnpm build    | 0    | 20 successful / 0 cached / 5.369s (cold rebuild)   | exit 0                  |
| pnpm test:unit| 0    | **442 passed (442) / 29 test files / 648ms**        | 442 passed / 0 failed   |
| pnpm test:e2e | 0    | **47 passed / 0 failed / 0 skipped / 14.2s**        | 47 passed / 0 failed    |

### Fresh-build `pnpm build` tail

```
@kehto/demo:build: dist/index.html                 26.39 kB │ gzip:  6.12 kB
@kehto/demo:build: dist/assets/main-_LIv1z9n.css    4.36 kB │ gzip:  1.15 kB
@kehto/demo:build: dist/assets/main-9r9CuZt7.js   268.54 kB │ gzip: 86.50 kB
@kehto/demo:build: ✓ built in 758ms

 Tasks:    20 successful, 20 total
Cached:    0 cached, 20 total
  Time:    5.369s
```

### Unit test tail

```
 RUN  v4.1.2 /home/sandwich/Develop/kehto

 Test Files  29 passed (29)
      Tests  442 passed (442)
   Start at  14:28:19
   Duration  648ms (transform 2.38s, setup 0ms, import 3.76s, tests 448ms, environment 3ms)
```

### Playwright e2e tail

```
  ✓  44 [chromium] › tests/e2e/theme-broadcast.spec.ts:33:1 › clicking theme-switcher dark button propagates theme.changed to preferences napplet (1.8s)
  ✓  42 [chromium] › tests/e2e/demo-notification-service.spec.ts:64:1 › notify.dismiss removes item from inspector (2.0s)
  ✓  43 [chromium] › tests/e2e/demo-node-inspector.spec.ts:69:1 › inspector open/close via node click and close button (1.9s)
  ✓  41 [chromium] › tests/e2e/storage-persist.spec.ts:31:1 › preferences round-trips display-name and theme-preference across page.reload() (2.4s)
  ✓  45 [chromium] › tests/e2e/relay-publish.spec.ts:78:1 › composer with encrypted toggle dispatches relay.publishEncrypted envelope (1.2s)
  ✓  46 [chromium] › tests/e2e/demo-notification-service.spec.ts:73:1 › no anti-term in captured console output (1.4s)
  ✓  47 [chromium] › tests/e2e/demo-node-inspector.spec.ts:79:1 › no anti-term in console output during inspector interactions (1.5s)

  47 passed (14.2s)
```

### DRIFT-01 + DRIFT-02 closure proof (ROADMAP Phase 24 success criteria)

| Criterion | Check                                                                              | Result |
|-----------|------------------------------------------------------------------------------------|--------|
| 1         | `test ! -f packages/runtime/src/core-compat.ts`                                    | PASS   |
| 1         | `git grep -n "core-compat" -- packages/ apps/ tests/ specs/`                       | 0 hits |
| 2         | `Capability` from `@kehto/acl/capabilities` at all former consumers                 | PASS   |
| 2         | `ServiceDescriptor` in `packages/runtime/src/types.ts`                             | PASS   |
| 2         | `REPLAY_WINDOW_SECONDS` inlined (= 30) in `replay.ts`                              | PASS   |
| 3         | `grep -rEn "BusKind" packages/runtime/src packages/services/src`                   | 0 hits |
| 3         | `grep -rEn "AUTH_KIND" packages/runtime/src packages/services/src`                 | 0 hits |
| 3         | `grep -rEn "DESTRUCTIVE_KINDS" packages/runtime/src packages/services/src`         | 0 hits |
| 3         | `grep -rEn "STATE_TOPICS" packages/runtime/src packages/services/src`              | 0 hits |
| 3         | `test ! -f packages/runtime/src/service-discovery.ts`                              | PASS   |
| 3         | `grep -rnE "\bresolveCapabilities\b" packages/runtime/src packages/shell/src`      | 0 hits |
| 3         | `grep -rnE "\bCapabilityResolution\b" packages/runtime/src packages/shell/src`     | 0 hits |
| 3         | `grep -rn "handleStateRequest" packages/ apps/ tests/`                             | 0 hits |
| 3         | `grep -rn "requiresPrompt" packages/ apps/ tests/` (source files; dist/ excluded)  | 0 hits |
| 4         | `pnpm test:unit` → 442 / 0 / 0                                                     | PASS   |
| 5         | `manual clean → pnpm build → pnpm test:e2e` → 47 / 0 / 0 (cold rebuild)            | PASS   |

### Preserved live surfaces (sanity re-assertions)

- `@kehto/acl`'s own `CapabilityResolution` interface at `packages/acl/src/resolve.ts:46` — untouched (it is the NIP-5D-flavored live type returned by `resolveCapabilitiesNub`, completely distinct from the deleted runtime-flavored interface).
- `createEnforceGate`, `createNubEnforceGate`, `resolveCapabilitiesNub`, `formatDenialReason` — all retained in the `@kehto/runtime` barrel.
- `handleStorageNub`, `cleanupNappState` — retained in `@kehto/runtime`; `handleStateRequest` deleted.
- `runtime.ts` `IPC_PEER` (29000) — inlined as numeric literal with `// IPC_PEER — inlined numeric after Phase 24 shim deletion` trailing comment at all three live call sites (handleShellCommand sendInterPaneReply, shell:send-dm reply synthesis, injectEvent). Verified: `grep -c "kind: 29000" packages/runtime/src/runtime.ts` returns 3.
- `audio-manager.ts` IPC_PEER — inlined in Plan 24-01 (already at numeric `29000` with comment; unchanged in 24-02).

### Anti-term hygiene

```bash
$ grep -rEn '`window\.nostr`|`signer-service`|`signer\.sign`|`BusKind`|kind 2900[12]' tests/e2e/*.spec.ts
# (no matches — clean)
```

Zero live-API anti-term occurrences across the 26 active Playwright spec files.

***

## Notes / Deviations

**1. [Rule 3 - Blocking] Manual clean substituted for `pnpm clean` (no script defined).**

The plan's Step 2.2 specifies `pnpm clean` as the cold-rebuild trigger. Root `package.json` does not define a `clean` script, so running `pnpm clean` returns `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "clean" not found`. Precedent: Phase 22-08's iteration log (`22-ITERATION-LOG.md:823`) used the exact same manual pattern for the same reason. Behavior is fully equivalent — 0-cache cold rebuild of all 20 turbo tasks, proved by `Cached: 0 cached, 20 total` in the `pnpm build` output above.

**2. [Rule 2 - Missing Critical] Renamed local variable `isBusKind` → `isShellKind` in runtime.ts.**

Found during Task 1 acceptance-grep verification. The filter predicate `const isBusKind = filters.length > 0 && filters.every((f) => f.kinds?.every((k) => k >= 29000 && k < 30000))` at `runtime.ts` line 502 is a local boolean variable. The plan's `<must_haves>` requires zero `BusKind` references in `packages/runtime/src/**`; the identifier `isBusKind` was a literal residual reference to the deleted concept. Renamed to `isShellKind` (name reflects behavior: the filter targets kinds 29000-29999 which are the shell-bus range, not the napplet application-kind range). Tests still pass (variable is local to `handleRelayMessage` — no external consumers).

**3. [Rule 2 - Missing Critical] Scrubbed comment references to deleted symbols.**

Found during Task 1 acceptance-grep verification. Comments in `enforce.ts` (file-header JSDoc) and `runtime/index.ts` (Re-exports-from-canonical-homes block) explained the deletion rationale by mentioning the deleted symbol names verbatim (`resolveCapabilities`, `BusKind`, `STATE_TOPICS`, `AUTH_KIND`, `DESTRUCTIVE_KINDS`). The plan's grep assertions are word-boundary-scoped and would match these comments — same pattern Plan 24-01's deviations #3/#4/#5 addressed. Rewrote the comments to describe what was deleted generically ("the legacy capability-resolution function", "the NIP-01 kind + topic + auth + destructive-kind constants") without mentioning the literal identifiers. Preserves institutional memory while satisfying the grep-clean acceptance.

**4. [Rule 2 - Missing Critical] Scrubbed a stale `isBusKind` comment in dispatch.test.ts.**

Found during the same grep sweep. Line 165 of `dispatch.test.ts` had a comment `// Empty filters: isBusKind is false …` that referenced the renamed variable. Updated to `// Empty filters: the shell-kind fast path is false …`. No test behavior change — the test still asserts the same EOSE reply envelope.

---

**Total deviations:** 4 auto-fixed (1 Rule 3 blocking [missing script], 3 Rule 2 missing-critical [grep-acceptance scope follow-through]).
**Impact on plan:** Plan scope preserved exactly. All 4 deviations were minor grep-scope follow-throughs — identical pattern to Plan 24-01's deviation set (same mechanism: word-boundary grep assertions hit residual comment / variable identifiers). Zero behavioral regressions; all 3 test suites (type-check, unit, e2e) green at Phase 23 baseline counts.

***

## Phase 24 Status

**DRIFT-01 closed (Plan 24-01).** core-compat.ts deleted; Capability re-homed to `@kehto/acl/capabilities`; ServiceDescriptor relocated to `runtime/src/types.ts`; REPLAY_WINDOW_SECONDS inlined (= 30).

**DRIFT-02 closed (Plan 24-02).** All dead NIP-01 dispatch code scrubbed: `resolveCapabilities()` + runtime-flavored `CapabilityResolution` deleted; `handleStateRequest()` deleted; `service-discovery.ts` deleted; `requiresPrompt(kind)` deleted from both `AclStateContainer` and shell's acl-store; runtime + shell barrels narrowed; README scrubs committed.

**Iteration loop recorded** per ROADMAP Phase 24 success criterion 5, E2E-11 canon.

**Phase 24 complete — ready for Phase 25 (Release Publication).**
