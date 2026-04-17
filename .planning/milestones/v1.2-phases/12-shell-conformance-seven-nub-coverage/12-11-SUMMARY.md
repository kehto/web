---
phase: 12-shell-conformance-seven-nub-coverage
plan: 11
subsystem: shell
tags: [shell, proxies, keys-forwarder, nip-5d, drift-closure]

# Dependency graph
requires:
  - phase: 12-03-identity-nub-dispatch
    provides: "runtime identity.* dispatch — the delegation target for identity-proxy"
  - phase: 12-05-keys-nub-dispatch
    provides: "runtime keys.* dispatch + keys:forward cap semantics"
  - phase: 12-06-media-nub-dispatch
    provides: "runtime media.* dispatch"
  - phase: 12-07-notify-nub-dispatch
    provides: "runtime notify.* dispatch"
provides:
  - "Canonical shell-side per-domain proxy shape (dispatch + emit)"
  - "createIdentityProxy / createThemeProxy / createKeysProxy / createMediaProxy / createNotifyProxy factories"
  - "createKeysForwarder — host keydown → keys.forward envelope pump, ACL-gated"
  - "shell-bridge lifecycle hook: forwarder attached on create, detached on destroy"
  - "DRIFT-SHELL-06 / DRIFT-SHELL-07 / DRIFT-SHELL-08 closure"
  - "NUB-05 shell-side completion (shell→napplet keys.forward push path)"
  - "SH-C03 reinforcement (barrel signer-residual sweep confirmed clean)"
affects: [13-theme-nub-implementation, 14-dispatch-refactor, 15-release-prep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canonical per-domain proxy shape: dispatch(windowId, envelope) delegates napplet→shell to runtime.handleMessage; emit(windowId, envelope) posts shell→napplet through originRegistry.getIframeWindow(windowId).postMessage(envelope, '*'). Proxies are optional composition seams — the runtime still owns 8-domain dispatch by default."
    - "keys-forwarder DOM integration: defaults to the global window, falls back to a fresh EventTarget in SSR/DOM-less tests so addEventListener never throws. Capability check is injected via hasKeysForwardCap(pubkey) — the module stays free of direct aclStore dependency."
    - "Shared ProxyOriginRegistry interface — a minimal { getIframeWindow(windowId): Window | null } contract — accepted by every proxy, enabling the @kehto/shell singleton originRegistry and test-double registries to pass interchangeably."
    - "DRIFT-marker closure discipline: newly created files cite the plan number (Plan 12-11) rather than the DRIFT-<ID> marker string, so the zero-grep-match release gate in packages/shell/src/ stays satisfied."

key-files:
  created:
    - packages/shell/src/identity-proxy.ts
    - packages/shell/src/theme-proxy.ts
    - packages/shell/src/keys-proxy.ts
    - packages/shell/src/media-proxy.ts
    - packages/shell/src/notify-proxy.ts
    - packages/shell/src/keys-forwarder.ts
    - packages/shell/src/identity-proxy.test.ts
    - packages/shell/src/keys-forwarder.test.ts
  modified:
    - packages/shell/src/index.ts
    - packages/shell/src/shell-bridge.ts

key-decisions:
  - "Per-domain proxies are optional composition seams — createShellBridge() does NOT compose them into dispatch. The runtime owns dispatch after Plans 12-03..12-09. Wiring each proxy into the bridge would add an unnecessary indirection; the proxies exist as public API so host apps can intercept or augment domain traffic."
  - "Every proxy accepts the same minimal ProxyOriginRegistry interface — exported from identity-proxy.ts and re-used by theme/keys/media/notify — rather than coupling each proxy file to the @kehto/shell singleton originRegistry. Keeps the proxies trivially testable and lets host apps inject alternative Window-resolver strategies."
  - "keys-forwarder takes hasKeysForwardCap as an injected function rather than importing aclStore directly. The shell-bridge wiring composes the cap lookup from sessionRegistry + aclStore; the forwarder itself stays dependency-light and SSR-safe."
  - "keys-forwarder falls back to a fresh EventTarget when neither deps.target nor a global window is available. This keeps createKeysForwarder pure — it never throws during construction — and makes the forwarder trivially stub-testable without a DOM."
  - "keys.forward envelope uses the @napplet/nub-keys field convention { ctrl, alt, shift, meta } — NOT the DOM-style ctrlKey/altKey/shiftKey/metaKey. Normalized inside the listener."
  - "JSDoc on each proxy / forwarder file cites Plan 12-11 and the relevant requirement (SH-C03, NUB-05, etc.) but deliberately avoids the 'DRIFT-SHELL-0X' marker string so the zero-grep-match acceptance criterion holds in packages/shell/src/."

patterns-established:
  - "Canonical per-domain proxy shape — dispatch + emit — now ready for the three NIP-5D domains that still need shell-side composition seams: storage-proxy (when host apps need a composition point; storage today is served by runtime state-handler.ts directly), ifc-proxy, and relay-proxy. Future proxies MUST follow this shape verbatim."
  - "DOM-safe lifecycle integration: attach DOM-touching runtime components inside a typeof window check + try/catch block in createShellBridge(), and extend bridge.destroy() to tear them down in reverse-construction order. Pattern applies to Phase 13's theme push wiring and any future host-side listeners."

requirements-completed: [SH-C03, NUB-05]

# Metrics
duration: 7 min
completed: 2026-04-17
---

# Phase 12 Plan 11: Shell Per-Domain Proxies + Keys-Forwarder Summary

**Five per-domain proxies (identity, theme, keys, media, notify) establish the canonical shell-side composition shape; a new keys-forwarder pumps host keydown events as `keys.forward` envelopes into ACL-permitted napplets over the shell-bridge lifecycle. Barrel cleanly exports the 6 new factories with zero signer residuals.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-17T19:27:34Z
- **Completed:** 2026-04-17T19:34:44Z
- **Tasks:** 3 (2 TDD cycles + 1 barrel update)
- **Files modified:** 10 (8 created, 2 modified)
- **Line counts:** identity-proxy 117, theme-proxy 102, keys-proxy 106, media-proxy 103, notify-proxy 103, keys-forwarder 157, identity-proxy.test 93, keys-forwarder.test 144 — total 925 new lines

## Accomplishments

- **5 per-domain proxy modules shipped** (`identity-proxy.ts`, `theme-proxy.ts`, `keys-proxy.ts`, `media-proxy.ts`, `notify-proxy.ts`) — each exposes `create<Domain>Proxy(deps)` + `<Domain>Proxy` interface + `<Domain>ProxyDeps` interface, every one mirroring the canonical `dispatch` + `emit` shape.
- **`keys-forwarder.ts` shipped** — attaches a `keydown` listener on the host (global `window` by default, fallback to isolated EventTarget in SSR), emits `keys.forward` envelopes (`{ type, key, code, ctrl, alt, shift, meta }`) to every registered napplet whose ACL grants `keys:forward`. `destroy()` cleanly detaches.
- **shell-bridge lifecycle wiring** — `createShellBridge()` constructs the forwarder inside a `typeof window !== 'undefined'` guard + try/catch; `bridge.destroy()` tears it down before `runtime.destroy()`. Cap lookup composes `sessionRegistry.getEntry(pubkey)` + `aclStore.getEntry(pubkey, dTag, aggregateHash).capabilities.includes('keys:forward')`.
- **Barrel (`packages/shell/src/index.ts`) updated** — two new comment sections add 6 factory exports + 9 type exports (IdentityProxy/Deps, ThemeProxy/Deps, KeysProxy/Deps, MediaProxy/Deps, NotifyProxy/Deps, ProxyOriginRegistry, KeysForwarder/Deps/OriginRegistry/SessionRegistry). Zero signer residuals (`SignerProxy` / `NIP07Signer` / `generateNostrBootstrap`) — already scrubbed by Plan 12-01; sweep re-verified via grep.
- **Two test files shipped** — `identity-proxy.test.ts` (3 tests covering dispatch delegation + emit postMessage + null-window safe no-op) and `keys-forwarder.test.ts` (4 tests covering cap-gated forwarding, cap-denied skip, destroy teardown, null-window skip). 17/17 shell tests green; full workspace 433/433 vitest tests green.
- **DRIFT closure** — `grep -rnE "DRIFT-SHELL-0(6|7|8)" packages/shell/src/` returns zero matches. Closure rationale captured in this summary + plan 12-11 (replacing marker strings that would otherwise pollute source).

## Task Commits

Each task committed atomically (TDD cycle where applicable):

1. **Task 1 RED:** Add failing test for canonical per-domain proxy shape — `e6c1dde` (test)
2. **Task 1 GREEN:** Add 5 per-domain proxies for NIP-5D shell composition — `c6637b0` (feat)
3. **Task 2 RED:** Add failing test for keys-forwarder shape — `fe375ed` (test)
4. **Task 2 GREEN:** Add keys-forwarder + wire into shell-bridge lifecycle — `a6a0742` (feat)
5. **Task 3:** Add 5 per-domain proxy + keys-forwarder barrel exports — `4d5aa04` (feat)

## Deviations from Plan

### None — Plan Executed Exactly as Written

All three tasks landed to the files and shapes specified in `12-11-PLAN.md`. One small JSDoc-only refinement: the plan's example `<interfaces>` sketch suggested citing the DRIFT-<ID> marker string in each new file's header JSDoc. The plan's `<acceptance_criteria>` separately mandates a zero-grep-match rule in `packages/shell/src/` for DRIFT-SHELL-06/07/08. Those two rules conflict. Honored the stricter acceptance criterion: JSDoc in the new files cites "Plan 12-11" and the requirement IDs (SH-C03, NUB-05) rather than the literal DRIFT marker strings — the rationale lives in this SUMMARY, in 12-11-PLAN.md, and in the shell-bridge code comment. This is the same discipline Plan 12-09 applied (patterns-established note: "DRIFT marker closure discipline — markers are deleted, not rewritten, as part of the code change they annotated").

No auto-fixes or Rule-1/2/3 deviations; the plan's automation path was sufficient.

### Parallel Execution Note (12-10 + 12-11)

Plan 12-11 ran in parallel with Plan 12-10 on the shared worktree, as instructed. The two plans touch disjoint files (12-10: `@kehto/acl` + runtime core-compat; 12-11: `@kehto/shell`) and no conflict occurred. One transient `pnpm build` failure was observed at the moment 12-10's concurrent build wiped `packages/runtime/dist/` mid-run; a subsequent targeted `pnpm --filter @kehto/runtime build` → `pnpm --filter @kehto/shell build` sequence restored clean state. No code change needed — just retry after the parallel runner released the dist lock.

## Barrel Diff (index.ts)

**Removed symbols:** None. Plan 12-01 already scrubbed `generateNostrBootstrap`; verified via `grep -n generateNostrBootstrap packages/shell/src/index.ts` → 0 matches before this plan too. No `SignerProxy` / `NIP07Signer` residuals existed — verified via grep.

**Added symbols (6 factories + 9 types):**
- Factories: `createIdentityProxy`, `createThemeProxy`, `createKeysProxy`, `createMediaProxy`, `createNotifyProxy`, `createKeysForwarder`
- Types: `IdentityProxy`, `IdentityProxyDeps`, `ProxyOriginRegistry`, `ThemeProxy`, `ThemeProxyDeps`, `KeysProxy`, `KeysProxyDeps`, `MediaProxy`, `MediaProxyDeps`, `NotifyProxy`, `NotifyProxyDeps`, `KeysForwarder`, `KeysForwarderDeps`, `KeysForwarderOriginRegistry`, `KeysForwarderSessionRegistry`

## DRIFT Marker Removal

| DRIFT | Before Plan 12-11 | After Plan 12-11 |
|-------|-------------------|------------------|
| DRIFT-SHELL-06 | No shell-side keys-forwarder path | Forwarder module + bridge lifecycle integration + 4 unit tests |
| DRIFT-SHELL-07 | (Concern about signer re-exports) | Barrel swept; zero signer residuals; 6 new per-domain / forwarder exports added |
| DRIFT-SHELL-08 | No per-domain proxy modules for 5 missing domains | 5 modules + canonical dispatch/emit shape + 1 proxy test validating the shape |

**Marker sweep:** `grep -rnE "DRIFT-SHELL-0(6|7|8)" packages/shell/src/` returns zero matches (verified post-Task 2 and post-Task 3).

## Proxy Composition Notes

The runtime owns dispatch for all 8 NIP-5D domains after Plans 12-03..12-09. The per-domain proxies this plan adds are **optional composition seams** — `createShellBridge()` does NOT compose them by default. Host apps that want to intercept, log, or augment domain traffic can wrap `proxy.dispatch` or swap in a custom implementation:

```ts
import { createShellBridge, createIdentityProxy, originRegistry } from '@kehto/shell';

const bridge = createShellBridge(hooks);
const identityProxy = createIdentityProxy({
  runtime: bridge.runtime,
  originRegistry,
});

// Decorate: log every identity request before delegating.
const baseDispatch = identityProxy.dispatch;
identityProxy.dispatch = (windowId, envelope) => {
  telemetry.record('identity.dispatch', envelope.type);
  baseDispatch(windowId, envelope);
};
```

## Follow-ups for Phase 13 (Theme) and Beyond

- **Phase 13** composes `themeProxy.emit(windowId, { type: 'theme.changed', theme })` into its `shell.theme.set(theme)` API. The shape is already in place; Phase 13 adds only the runtime-side `theme-service.ts` and the host API.
- **Phase 14 dispatch refactor** may collapse the optional proxy factories into `createDispatch()` composition. The interface (`dispatch(windowId, envelope)` + `emit(windowId, envelope)`) is stable and documented; refactor can preserve the public API.
- **Phase 13 follow-up on keys-forwarder:** the `keys.action` push path (host-defined keybindings triggering napplet actions) is host-app concern, not shell-runtime. The forwarder covers `keys.forward` only; `keys.action` emission is up to whoever owns the keybinding UI and can be done through `keysProxy.emit(windowId, { type: 'keys.action', actionId })` directly.

## Verification Evidence

```
$ pnpm vitest run packages/shell/
Test Files  4 passed (4)
     Tests  17 passed (17)

$ pnpm --filter @kehto/shell build
ESM Build success, DTS Build success, dist/index.d.ts 56.01 KB

$ pnpm --filter @kehto/shell type-check
tsc --noEmit  # zero output

$ pnpm test:unit
Test Files  28 passed | 1 skipped (29)
     Tests  433 passed | 19 skipped (452)

$ grep -rnE "DRIFT-SHELL-0(6|7|8)" packages/shell/src/
# (zero matches)

$ grep -nE "SignerProxy|NIP07Signer|generateNostrBootstrap" packages/shell/src/index.ts
# (zero matches)

$ grep -n "createIdentityProxy\|createThemeProxy\|createKeysProxy\|createMediaProxy\|createNotifyProxy\|createKeysForwarder" packages/shell/src/index.ts
82:export { createIdentityProxy } from './identity-proxy.js';
84:export { createThemeProxy } from './theme-proxy.js';
86:export { createKeysProxy } from './keys-proxy.js';
88:export { createMediaProxy } from './media-proxy.js';
90:export { createNotifyProxy } from './notify-proxy.js';
97:export { createKeysForwarder } from './keys-forwarder.js';
# exactly 6 matches (acceptance criterion met)
```

## Self-Check: PASSED

All 11 expected files present on disk; all 5 task commits present in git history (`e6c1dde`, `c6637b0`, `fe375ed`, `a6a0742`, `4d5aa04`).
