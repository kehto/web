---
phase: 105-published-convention-adoption-and-host-flows
plan: 07
subsystem: paja-browser-host
tags: [paja, nap-intent, nap-inc, nap-shell, nip-5d, firewall, playwright]
requires:
  - phase: 105-06
    provides: "Persistent verified Paja catalog and retained controller seams."
provides:
  - "Resolver-verified Paja installations that outlive tab frames."
  - "Source-bound, generation-specific retained intent delivery with teardown retry."
  - "Fresh startup burst budgets for host-attested replacement iframe lifecycles."
affects: [105-09, paja, intent, inc, runtime, firewall]
tech-stack:
  added: []
  patterns: [verified-install-catalog, source-bound-ready-delivery, lifecycle-scoped-init-burst]
key-files:
  created: []
  modified:
    - packages/paja/src/browser-host.ts
    - packages/paja/src/browser-runtime-tabs.ts
    - packages/paja/src/browser-host.test.ts
    - packages/paja/src/browser-runtime-tabs.test.ts
    - packages/firewall/src/evaluate.ts
    - packages/firewall/src/types.ts
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/firewall-dispatch.test.ts
    - tests/e2e/paja-runtime-pointer.spec.ts
key-decisions:
  - "Install Paja catalog records only after resolver signature, aggregate, and blob verification succeeds."
  - "Use MessageEvent.source plus origin registration and tab generation for readiness and target-only intent delivery."
  - "Scope only the init-burst guard to a host-attested registered lifecycle; retain dTag-wide rate-limit accounting."
requirements-completed: [PKG-01, THEME-04]
coverage:
  - id: D1
    description: "Verified pointer tabs persist handler eligibility while retained delivery waits for the current registered source."
    requirement: PKG-01
    verification:
      - kind: unit
        ref: "packages/paja/src/browser-host.test.ts and browser-runtime-tabs.test.ts"
        status: pass
      - kind: e2e
        ref: "tests/e2e/paja-runtime-pointer.spec.ts#retains an accepted verified intent"
        status: pass
    human_judgment: false
  - id: D2
    description: "A late required-theme Paja frame reads stored ThemeService state and receives exactly one matching change."
    requirement: THEME-04
    verification:
      - kind: e2e
        ref: "tests/e2e/paja-single-window.spec.ts#applies simulation config and compact theme adjustment"
        status: pass
    human_judgment: false
  - id: D3
    description: "A replacement Paja source receives a fresh init-burst budget while stale torn-down sources remain ignored."
    verification:
      - kind: integration
        ref: "packages/runtime/src/firewall-dispatch.test.ts#starts a fresh burst budget only for a replacement source lifecycle"
        status: pass
      - kind: e2e
        ref: "tests/e2e/paja-single-window.spec.ts#keeps canonical INC protected through the real shim assignment in an opaque Paja srcdoc"
        status: pass
    human_judgment: false
metrics:
  duration: 1h
  completed: 2026-07-27
status: complete
---

# Phase 105 Plan 07: Paja Verified Intent Lifecycle Summary

**Verified Paja intent delivery now survives tab replacement, and a freshly registered opaque iframe receives a clean, source-bound INC startup budget without weakening dTag-wide throttling.**

## Accomplishments

- Connected the resolver-verified pointer catalog and retained controller to live Paja runtime tabs; closed frames do not remove installed handler authority.
- Bound readiness and target delivery to the registered `MessageEvent.source`, current window ID, and tab generation; replacement rejects pending readiness before session, origin, and frame teardown.
- Added deterministic local Relay/Blossom browser coverage for accepted source teardown, cold target resolution, exactly-once delivery, no INC carrier, and forged sibling exclusion.
- Corrected the independent single-frame reload defect: the firewall's startup burst counter now uses the runtime's host-attested `windowId` lifecycle key, so the canonical reloaded shim can subscribe and receive one current-source `inc.event`; unregistered stale sources remain ignored.
- Normalized the optional origin-registry lookup to the existing unregistered `null` state before generation readiness validation, preserving rejection of missing, stale, and forged sources while satisfying the Paja TypeScript gate.

## NAP Authority

- NAP-INTENT: `napplet/naps` PR #91 head `a718915ddefa2f03a0126579601f59d8bd86f7c4` — acceptance transfers delivery responsibility, delivery may follow source closure, and `intent.deliver` is target-only and independent of INC.
- NAP-INC: `napplet/naps@c5cd06f7be6d4690b303949abb26e87ff62f4729` — shell-to-napplet `inc.event` uses the authenticated sender and exact topic routing. It does not state a separate reload rule; current-source replacement behavior is inferred from NAP-SHELL's lifecycle binding.
- NAP-SHELL: `napplet/naps@c5cd06f7be6d4690b303949abb26e87ff62f4729` — the first bare `shell.ready` establishes the creation-identity-bound session and yields exactly one `shell.init` per lifecycle.
- NIP-5D provenance: Kehto's `dskvr/nips@d80d7b25f9c4331acbeb40dbeb3b077caa80e885` audit authority requires opaque iframe identity from `MessageEvent.source`; verified bytes alone populate the `allow-scripts` `srcdoc` path.

## Task Commits

1. **Task 1 RED: Add retained-delivery coverage** — `f76bdfc` (test)
2. **Task 1 GREEN: Wire verified Paja intent targets** — `e51d7c5` (feat)
3. **Task 2: Prove deterministic cold delivery** — `cbd75d5` (test)
4. **Regression RED: Cover replacement lifecycle burst isolation** — `2675934` (test)
5. **Regression GREEN: Scope init bursts to registered realms** — `48422ac` (fix)
6. **Wave 7 gate: Normalize missing origin IDs** — `bf6e71e` (fix)

## Verification

- `pnpm exec vitest run packages/paja/src/browser-host.test.ts packages/paja/src/browser-runtime-tabs.test.ts packages/paja/src/browser-intent-controller.test.ts` — passed (20 tests).
- `pnpm exec vitest run packages/firewall/src/evaluate.test.ts packages/runtime/src/firewall-dispatch.test.ts` — passed (59 tests).
- `pnpm --filter @kehto/paja type-check` — passed.
- `pnpm --filter @kehto/firewall build && pnpm --filter @kehto/runtime build && pnpm --filter @kehto/paja build` — passed; existing `@kehto/nip` tsup side-effects warning remains non-fatal.
- `pnpm exec playwright test tests/e2e/paja-runtime-pointer.spec.ts tests/e2e/paja-single-window.spec.ts --workers=1` — passed (8 tests; 1 opt-in live pointer test skipped).
- `pnpm test:unit` — passed (123 files, 1529 tests).
- `git diff --check` — passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored reloaded Paja INC subscription delivery**
- **Found during:** Task 2 verification.
- **Issue:** A reloaded iframe inherited its previous realm's dTag-keyed init-burst count, so the fresh `inc.subscribe` was rejected and its canonical listener correctly removed itself.
- **Fix:** Added a runtime-only, host-attested lifecycle key to init-burst accounting. The replacement session starts with a clean startup budget, while stale unregistered sources stay rejected and normal rate budgets remain dTag-wide.
- **Files modified:** `packages/firewall/src/evaluate.ts`, `packages/firewall/src/types.ts`, `packages/runtime/src/runtime.ts`, `packages/runtime/src/firewall-dispatch.test.ts`.
- **Commits:** `2675934`, `48422ac`.

**2. [Rule 1 - Type safety] Normalized absent origin registry lookups**
- **Found during:** Wave 7 `pnpm type-check` gate.
- **Issue:** `originRegistry.getWindowId(source)` returns `undefined` for an unregistered source, while the trusted readiness helper accepts the host's established `string | null` representation.
- **Fix:** Coalesced only `undefined` to `null` before existing source, registration, and generation checks; no unregistered source can become ready.
- **Files modified:** `packages/paja/src/browser-host.ts`, `packages/paja/src/browser-host.test.ts`.
- **Commit:** `bf6e71e`.

## Broken Windows Resolved

- Ledger items **#23** and duplicate **#25** are marked fixed after the combined pointer and single-window Playwright suite passed.

## Self-Check: PASSED

- All modified runtime, firewall, Paja, and browser-test files exist.
- Commits `f76bdfc`, `e51d7c5`, `cbd75d5`, `2675934`, `48422ac`, and `bf6e71e` exist and contain the required Codex co-author trailer.
- No known stubs were introduced.
