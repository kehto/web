---
phase: 26-real-keys-backend
plan: 03
subsystem: demo
tags: [keys, hotkey-chord, demo-napplet, sdk-keys-namespace, grant-hook, topology]

requires:
  - phase: 26-01-real-keys-backend
    provides: real document-listener keys-service + per-window send-callback capture + keys.action envelope emission
  - phase: 26-02-real-keys-backend
    provides: HostKeysBridge interface + hostBridge option (unused by hotkey-chord — Branch B default path)
  - phase: 20-napplet-driven-flows
    provides: DEMO_NAPPLETS pattern + topology.ts dynamic frame-container rendering + napplet scaffold template (feed/profile-viewer/theme-switcher)
provides:
  - apps/demo/napplets/hotkey-chord/ demo napplet (5 files) — scaffolded on feed-napplet template; 100% SDK-driven via @napplet/sdk `keys` namespace (keys.registerAction + keys.onAction)
  - DEMO_NAPPLETS 9th entry (hotkey-chord) — topology.ts:466 dynamically renders #hotkey-chord-frame-container on boot
  - STUB_ONLY_SERVICES demoted from ['keys', 'media'] → ['media'] — 'keys' is now a real backend per Plan 26-01
  - createKeysService onForward callback wired for real-backend observability (replaces 'stub-only' console.debug)
  - NAP-09 COVERAGE GATE comment block updated — coverage grew from 6 → 7 non-stub NUB domains
  - window.__grantKeysForward__ host hook in bootShell() — pre-locks Plan 26-04's capability-gate mechanism (returns true on grant, false if napplet not yet loaded/authenticated)
affects: [26-04, E2E-12, host-app-integrations]

tech-stack:
  added: []
  patterns:
    - "SDK-driven napplet pattern: 100% via @napplet/sdk keys.registerAction + keys.onAction — zero raw window.addEventListener('message'), zero hand-rolled correlation IDs, zero hypothetical exports (onNappletMessage/sendNappletMessage do NOT exist in SDK 0.2.1)"
    - "D-04 init pattern for keys-domain napplets: storage.getItem probe → 'authenticated' status → await keys.registerAction → 'subscribed' status → keys.onAction subscription. Mirrors feed-napplet's relay.subscribe initialization sequence."
    - "Dynamically-rendered frame-container slots: topology.ts:466 enumerates DEMO_NAPPLETS and generates #{frameContainerId} divs at render time. Adding napplets is a single-file edit (shell-host.ts) — no apps/demo/index.html touch required."
    - "Per-napplet grant-hook pattern for test harnessing: bootShell installs window.__grantKeysForward__ (scoped to one napplet by name) that does the ACL grant the Playwright spec would otherwise need to drive through UI clicks. Returns false when not-ready so callers can retry."

key-files:
  created:
    - apps/demo/napplets/hotkey-chord/package.json — @kehto/demo-hotkey-chord workspace pkg; mirrors feed's peer-dep shape (@napplet/shim ^0.2.1, @napplet/sdk ^0.2.1, @napplet/vite-plugin ^0.2.1)
    - apps/demo/napplets/hotkey-chord/tsconfig.json — 1:1 copy of feed's tsconfig (ES2022 + DOM + DOM.Iterable lib, strict mode, bundler moduleResolution)
    - apps/demo/napplets/hotkey-chord/vite.config.ts — nip5aManifest plugin with nappletType: 'demo-hotkey-chord'
    - apps/demo/napplets/hotkey-chord/index.html — 3 DOM sentinels (#hotkey-chord-status, #hotkey-chord-count, #hotkey-chord-last) + #hotkey-chord-log diagnostic div + napplet-napp-type meta tag
    - apps/demo/napplets/hotkey-chord/src/main.ts — D-04 init pattern; storage.getItem AUTH probe → keys.registerAction({ id: 'hotkey-chord.demo', label: 'Hotkey Chord Demo', defaultKey: 'Ctrl+Shift+K' }) → keys.onAction() counter handler; updates 3 DOM sentinels
  modified:
    - apps/demo/src/shell-host.ts — 4 edits: STUB_ONLY_SERVICES ['keys','media']→['media']; DEMO_NAPPLETS +hotkey-chord 9th entry; createKeysService onForward → real-backend console.info; NAP-09 coverage-gate comment updated (7 non-stub domains); bootShell() installs window.__grantKeysForward__ (38-line block before `return { tap, relay }`)

key-decisions:
  - "[v1.4-26-03] hotkey-chord napplet consumes @napplet/sdk `keys` namespace exclusively — no raw envelope construction, no Math.random correlation IDs, no hypothetical onNappletMessage/sendNappletMessage imports (those exports DO NOT exist in @napplet/sdk@0.2.1). The SDK owns correlation generation + Promise resolution on keys.registerAction.result; the napplet just awaits and subscribes."
  - "[v1.4-26-03] keys.onAction callback is argumentless per SDK 0.2.1 signature — napplet formats the displayed chord string from its OWN registered DEFAULT_KEY constant ('Ctrl+Shift+K'), NOT from any event object. The shell's keys.action envelope (Plan 26-01) carries a `chord` extension field, but the napplet does not need it. A future SDK bump that surfaces the event would be additive, non-breaking."
  - "[v1.4-26-03] Apps/demo/index.html NOT edited — topology.ts:466 dynamically generates #hotkey-chord-frame-container from DEMO_NAPPLETS at render time. Adding a static div would create a duplicate ID and break the topology layout. Verified via grep (count=0)."
  - "[v1.4-26-03] Docstring anti-feature boilerplate scrubbed after first grep pass — the docblock originally quoted literal forbidden tokens ('window.addEventListener', 'Math.random', etc.) to document what the file does NOT contain. Since acceptance criteria grep for those literals, I rephrased the docblock to describe the constraints without quoting the forbidden strings ('no raw postMessage listener', 'no hand-rolled correlation IDs'). Rule 1 auto-fix."
  - "[v1.4-26-03] __grantKeysForward__ hook scoped to 'hotkey-chord' napplet only — not a generic grant API. Returns false when napplet not yet loaded or not yet authenticated so the caller (Plan 26-04's spec) can retry. Mirrors existing toggleCapability pattern (lines 881-887) for pubkey/dTag/hash resolution — NIP-5D napplets have pubkey=''."
  - "[v1.4-26-03] Pre-existing apps/demo type errors (12 of them: nip46-client, main.ts signer-modal, shell-host.ts CryptoHooks.randomBytes/string-undefined warnings) are OUT OF SCOPE per executor scope-boundary rule — verified via git stash: same 12 errors exist on baseline commit. apps/demo is NOT in the turbo type-check graph (pnpm type-check excludes it)."

patterns-established:
  - "Napplet scaffold copy-from-feed: new napplets clone feed/* as template, swap nappletType + DOM sentinel IDs + main.ts logic; tsconfig.json is a verbatim copy. 5-file minimum (package.json, tsconfig.json, vite.config.ts, index.html, src/main.ts)."
  - "Grant-hook preinstallation pattern: when an E2E spec needs to grant a capability before exercising a flow, install a scoped window.__grantX__ hook in bootShell() rather than routing through UI. Scoped to one napplet-by-name keeps the hook minimal and test-clean; returns false when not-ready so the caller can retry on the sentinel change."

requirements-completed: [KEYS-03]

duration: 4 min
completed: 2026-04-19
---

# Phase 26 Plan 03: KEYS-03 hotkey-chord Demo Napplet + Shell Wiring + __grantKeysForward__ Host Hook Summary

**Shipped the apps/demo/napplets/hotkey-chord demo napplet (5 files) built on @napplet/sdk's `keys` namespace (keys.registerAction + keys.onAction), wired it into the demo shell as the 9th DEMO_NAPPLETS entry, demoted keys from stub-only, and installed the window.__grantKeysForward__ host hook that pre-locks Plan 26-04's capability-gate mechanism.**

## Performance

- **Duration:** 4 min (4m 6s)
- **Started:** 2026-04-19T13:54:46Z
- **Completed:** 2026-04-19T13:58:52Z
- **Tasks:** 2 (both autonomous)
- **Files created:** 5 (hotkey-chord napplet scaffold)
- **Files modified:** 1 (apps/demo/src/shell-host.ts)

## Accomplishments

- **Created apps/demo/napplets/hotkey-chord/** with 5 files mirroring feed-napplet structure:
  - package.json (@kehto/demo-hotkey-chord private workspace pkg)
  - tsconfig.json (1:1 feed copy)
  - vite.config.ts (nip5aManifest nappletType: 'demo-hotkey-chord')
  - index.html (#hotkey-chord-status, #hotkey-chord-count, #hotkey-chord-last sentinels + #hotkey-chord-log diagnostic div)
  - src/main.ts (D-04 init → keys.registerAction → keys.onAction handler updating 3 sentinels + log)
- **Wired hotkey-chord into apps/demo/src/shell-host.ts** (5 targeted edits):
  - `STUB_ONLY_SERVICES`: ['keys', 'media'] → ['media']
  - `DEMO_NAPPLETS`: appended 9th entry with hotkey-chord/statusId/aclId/frameContainerId fields
  - `createKeysService` onForward: replaced stub `console.debug('[demo] keys.forward (stub-only):', ...)` with `console.info('[demo] keys real backend — chord delivered:', ...)`
  - NAP-09 coverage-gate comment: rewrote to reflect Phase 26's keys-domain graduation (6 → 7 non-stub NUB domains); noted only media remains stub-only pending Phase 27
  - `bootShell()`: inserted 38-line `window.__grantKeysForward__` installation block before `return { tap, relay }` — looks up hotkey-chord napplet by name from the napplets Map, resolves pubkey/dTag/aggregateHash, calls `relay.runtime.aclState.grant(pubkey, dTag, hash, 'keys:forward')`, returns true on success or false when napplet not loaded / not authenticated
- **No edit to apps/demo/index.html** — confirmed `#hotkey-chord-frame-container` is dynamically generated by topology.ts:466 from DEMO_NAPPLETS (grep count = 0 in index.html source).
- **pnpm build** succeeded with 21/21 turbo tasks (baseline was 20/20) — new @kehto/demo-hotkey-chord:build task runs at cold, caches on repeat. Produced 9 napplet dist/index.html artifacts (up from 8 in Plan 26-02 baseline).
- **pnpm type-check** succeeded with 8/8 turbo tasks (all cache hits — apps/demo is not in the turbo type-check graph, which is baseline behavior; verified via git stash that pre-existing apps/demo TS errors are unchanged).
- **pnpm test:unit** showed 29/29 test files pass, 456/456 tests pass — zero regressions from the shell-host.ts edits.
- **Anti-feature greps all clean** — napplet src/ has 0 matches for window.addEventListener('message'), Math.random, onNappletMessage/sendNappletMessage, window.nostr/signer-service/signer.sign/BusKind/kind 29001|2/allow-same-origin. Docblock was rephrased during execution to avoid quoting these literal tokens.
- **Plan guardrail compliance:** no git commits created (Plan 26-04 will atomic-commit all 4 plans' work after the iteration loop); apps/demo/index.html unchanged; hotkey-chord-frame-container div generated dynamically only.

## Task Commits

Per the execution prompt, no commits were created in this plan. Plans 26-01 + 26-02 + 26-03 (and 26-04's E2E spec work) all stage up for a single atomic commit landing in Plan 26-04 after the iteration loop records.

- **Task 1:** Scaffold apps/demo/napplets/hotkey-chord/ (5 files, @napplet/sdk-driven) — uncommitted
- **Task 2:** Wire into apps/demo/src/shell-host.ts (DEMO_NAPPLETS + STUB_ONLY_SERVICES + createKeysService onForward + NAP-09 comment + __grantKeysForward__ hook) — uncommitted

**Plan metadata:** uncommitted — SUMMARY.md awaits atomic commit alongside code changes in Plan 26-04.

## Files Created/Modified

- `apps/demo/napplets/hotkey-chord/package.json` — 398 bytes / 20 lines. `@kehto/demo-hotkey-chord` private workspace pkg; mirrors feed/package.json peer-dep shape exactly.
- `apps/demo/napplets/hotkey-chord/tsconfig.json` — 264 bytes / 12 lines. 1:1 verbatim copy of feed/tsconfig.json (ES2022 + DOM + DOM.Iterable, strict, bundler moduleResolution).
- `apps/demo/napplets/hotkey-chord/vite.config.ts` — 293 bytes / 15 lines. nip5aManifest plugin, nappletType swapped from 'demo-feed' to 'demo-hotkey-chord'.
- `apps/demo/napplets/hotkey-chord/index.html` — 2235 bytes / 84 lines. Mirrors feed/index.html; swapped three #feed-status/#feed-list/#feed-log sentinels for #hotkey-chord-status, #hotkey-chord-count, #hotkey-chord-last, #hotkey-chord-log; added a hotkey-chord-hint UI hint + two hotkey-metric rows for deliveries/last-chord.
- `apps/demo/napplets/hotkey-chord/src/main.ts` — 3857 bytes / 87 lines. Imports `'@napplet/shim'` + `{ storage, keys }` from `'@napplet/sdk'`. D-04 init pattern: storage.getItem('hotkey-chord-auth-probe') probe → setStatus('authenticated') → await keys.registerAction({ id: 'hotkey-chord.demo', label: 'Hotkey Chord Demo', defaultKey: 'Ctrl+Shift+K' }) → setStatus('subscribed') → keys.onAction('hotkey-chord.demo', () => { increment + update sentinels }). Grep-verified: 5 keys.registerAction refs, 2 keys.onAction refs, 2 Ctrl+Shift+K refs, 1 from '@napplet/sdk' import.
- `apps/demo/src/shell-host.ts` — 42498 bytes / 1123 lines (up from 1092 lines baseline). 5 targeted edits documented in "Accomplishments"; 18 hotkey-chord string matches; 1 `name: 'hotkey-chord'` entry; 6 __grantKeysForward__ matches (declaration + inline usage + 2 log strings + comment refs).

## Decisions Made

- **100% @napplet/sdk-driven napplet** — keys.registerAction + keys.onAction from the SDK's `keys` namespace; no raw envelope construction, no hand-rolled correlation IDs, no hypothetical SDK exports. Per 26-CONTEXT.md checker blocker 1, `onNappletMessage` and `sendNappletMessage` DO NOT EXIST in @napplet/sdk@0.2.1 — the executor VERIFIED this by reading the SDK's canonical types file (node_modules/.pnpm/@napplet+sdk@0.2.1/node_modules/@napplet/sdk/dist/index.d.ts lines 354-411) before writing main.ts.
- **keys.onAction is argumentless in SDK 0.2.1** — callback signature is `() => void` (no event arg). The napplet formats the displayed chord string from its OWN registered `DEFAULT_KEY` constant rather than reading it from an event object. Plan 26-01's `keys.action` envelope carries a `chord` extension field, but the SDK at 0.2.1 cannot surface it through `onAction`. A future SDK bump that does surface it would be additive, non-breaking.
- **apps/demo/index.html NOT edited** — `#hotkey-chord-frame-container` is dynamically rendered by topology.ts:466 at boot time from each `DEMO_NAPPLETS[i].frameContainerId`. Adding a static div would create a duplicate ID and break the topology layout. Verified by grep (count = 0 in apps/demo/index.html).
- **Docblock phrasing changed from literal to descriptive** — the initial main.ts docblock quoted forbidden tokens ('window.addEventListener', 'Math.random', etc.) to document the anti-feature contract. Since the plan's acceptance greps search for those literal strings, the docblock triggered false positives on first pass. Rephrased to describe the constraints without quoting ('no raw postMessage listener', 'no hand-rolled correlation IDs') while preserving intent. Single Rule 1 auto-fix (bug: grep collision between documentation and enforcement).
- **__grantKeysForward__ hook resolves pubkey/dTag/aggregateHash identically to toggleCapability** — uses `info.pubkey ?? ''`, `info.dTag ?? ''`, `info.aggregateHash ?? ''` and calls `relay.runtime.aclState.grant(pubkey, dTag, hash, 'keys:forward')`. Returns `false` when napplet not loaded or not authenticated so callers (Plan 26-04's spec) can retry gated on the `#hotkey-chord-status = 'subscribed'` sentinel.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Docblock quoted forbidden tokens, triggering false-positive anti-feature grep matches**
- **Found during:** Task 1 (first acceptance-criteria grep after writing main.ts)
- **Issue:** The initial docblock for src/main.ts included lines like `* - zero window.addEventListener('message', ...) — uses @napplet/sdk exclusively` and `* - zero Math.random (no hand-rolled correlation IDs)` and `* - zero window.nostr / signer-service / BusKind / kind 29001|29002`. The plan's acceptance criteria grep for those exact literal strings and expect count=0 — but the docblock itself contained 1 match for `window.addEventListener.'message'`, 2 matches for `Math.random`, and 1 match for the anti-term regex. The docblock's INTENT was to document what the file does NOT contain, but the grep-based enforcement cannot distinguish negation context from presence.
- **Fix:** Rephrased the docblock's anti-feature section from literal quotes to descriptive phrasing: `no raw postMessage listener — uses @napplet/sdk exclusively`; `no direct nostr/signer/legacy-bus imports`; `no hand-rolled correlation IDs (SDK owns them)`. Preserved the intent (readers understand the constraint) without quoting the literal forbidden strings.
- **Files modified:** apps/demo/napplets/hotkey-chord/src/main.ts (docblock lines 1-23 only; no logic changes)
- **Verification:** All anti-feature greps now return 0 matches in src/. Positive greps unchanged (5 keys.registerAction, 2 keys.onAction, 2 Ctrl+Shift+K, 1 @napplet/sdk import). Napplet rebuilt successfully (20.51 kB bundle, identical to pre-fix build).
- **Committed in:** uncommitted — Plan 26-04 atomic commit

---

**Total deviations:** 1 auto-fixed (1 bug: grep collision between documentation and enforcement)
**Impact on plan:** Zero structural impact. The rephrasing is documentation-only; napplet behavior is byte-identical. The fix reveals a general pattern: when acceptance criteria grep for forbidden tokens, even negated/documentation mentions count. Future plans should phrase anti-feature docblocks descriptively rather than by direct quotation.

## Issues Encountered

- **apps/demo/tsc --noEmit surfaces 12 pre-existing type errors** — Running `pnpm exec tsc --noEmit` directly in apps/demo reports 12 errors across src/main.ts (missing @napplet/services module, signer optional-chain invocations, Record→NostrEvent mismatch) and src/shell-host.ts (randomBytes not on CryptoHooks, string-undefined narrow failures in the toggleBlock/snapshot paths). Verified via `git stash` that the same 12 errors exist on the baseline commit (line numbers shifted due to my insertions but the error set is identical). These are OUT OF SCOPE per executor scope-boundary rule (only auto-fix issues DIRECTLY caused by current task changes). The workspace-level `pnpm type-check` does NOT include apps/demo in its turbo graph — the demo app has never had a type-check script registered, so the 8/8 turbo task run is clean. Logged for future cleanup consideration.
- **pnpm install peer-dep warnings on oxc-parser/@napi-rs/wasm-runtime** — Unrelated to this plan; pre-existing on baseline (verified). @emnapi/core@^1.7.1 + @emnapi/runtime@^1.7.1 missing in oxc-parser's transitive deps. Not a blocker for build/test/type-check.

## User Setup Required

None — no external service configuration required. The new hotkey-chord napplet is a pure demo consumer of the Plan 26-01 keys-service; it requires no env vars, API keys, or host-app configuration.

## Next Phase Readiness

- **Ready for Plan 26-04 (E2E-12 hotkey-chord.spec.ts):** All seams are in place:
  - hotkey-chord napplet loads via `loadNapplet('hotkey-chord', 'hotkey-chord-frame-container')` and renders a subscribed sentinel within D-04 init.
  - `window.__grantKeysForward__()` grants the `keys:forward` capability on demand (returns true/false).
  - Plan 26-01's document keydown listener + `keys.action` emission routes to the napplet's SDK onAction callback on every Ctrl+Shift+K keydown.
  - Three DOM sentinels are available for Playwright frameLocator assertions: `#hotkey-chord-status`, `#hotkey-chord-count`, `#hotkey-chord-last`.
- **Ready for atomic commit:** Plans 26-01 + 26-02 + 26-03 working trees are all uncommitted; Plan 26-04's execution will land all four plans' work (including the iteration-loop records) in a single chore/feat atomic commit.
- **No blockers.**

## Self-Check

Automated verification of SUMMARY claims:

- Files created present on disk:
  - apps/demo/napplets/hotkey-chord/package.json: FOUND (398 bytes, 20 lines)
  - apps/demo/napplets/hotkey-chord/tsconfig.json: FOUND (264 bytes, 12 lines)
  - apps/demo/napplets/hotkey-chord/vite.config.ts: FOUND (293 bytes, 15 lines)
  - apps/demo/napplets/hotkey-chord/index.html: FOUND (2235 bytes, 84 lines)
  - apps/demo/napplets/hotkey-chord/src/main.ts: FOUND (3857 bytes, 87 lines)
- Files modified:
  - apps/demo/src/shell-host.ts: FOUND (42498 bytes, 1123 lines)
- Napplet build: `pnpm --filter @kehto/demo-hotkey-chord build` → exit 0, produced dist/index.html + dist/assets/index-8kweJpPZ.js (20.51 kB)
- Full build: `pnpm build` → 21/21 turbo tasks successful (was 20/20 baseline; +1 new hotkey-chord:build task)
- Napplet bundles on disk: `ls apps/demo/napplets/*/dist/index.html | wc -l` → 9 (was 8 baseline)
- Type-check: `pnpm type-check` → 8/8 turbo tasks successful (full turbo cache hit — apps/demo not in graph, baseline behavior)
- Unit tests: `pnpm test:unit` → 29/29 test files pass, 456/456 tests pass (no regression from Plan 26-02 baseline of 456/456)
- Grep positive (Task 1 napplet): `grep -c "napplet-napp-type.*demo-hotkey-chord" apps/demo/napplets/hotkey-chord/index.html` → 1 = 1 ✓
- Grep positive (Task 1 napplet): `grep -c "hotkey-chord-status\|hotkey-chord-count\|hotkey-chord-last" apps/demo/napplets/hotkey-chord/index.html` → 3 ≥ 3 ✓
- Grep positive (Task 1 napplet): `grep -c "keys\.registerAction" apps/demo/napplets/hotkey-chord/src/main.ts` → 5 ≥ 1 ✓
- Grep positive (Task 1 napplet): `grep -c "keys\.onAction" apps/demo/napplets/hotkey-chord/src/main.ts` → 2 ≥ 1 ✓
- Grep positive (Task 1 napplet): `grep -c "Ctrl+Shift+K" apps/demo/napplets/hotkey-chord/src/main.ts` → 2 ≥ 1 ✓
- Grep positive (Task 1 napplet): `grep -c "from '@napplet/sdk'" apps/demo/napplets/hotkey-chord/src/main.ts` → 1 = 1 ✓
- Grep anti (Task 1 napplet): `grep -rc "window.addEventListener.'message'" apps/demo/napplets/hotkey-chord/src/` → 0 ✓
- Grep anti (Task 1 napplet): `grep -rcE "window\.nostr|signer-service|signer\.sign|BusKind|kind 29001|kind 29002|allow-same-origin" apps/demo/napplets/hotkey-chord/src/` → 0 ✓
- Grep anti (Task 1 napplet): `grep -rc "Math\.random" apps/demo/napplets/hotkey-chord/src/` → 0 ✓
- Grep anti (Task 1 napplet): `grep -rcE "onNappletMessage|sendNappletMessage" apps/demo/napplets/hotkey-chord/src/` → 0 ✓
- Grep positive (Task 2 shell): `grep -c "hotkey-chord" apps/demo/src/shell-host.ts` → 18 ≥ 6 ✓
- Grep positive (Task 2 shell): `grep -c "name: 'hotkey-chord'" apps/demo/src/shell-host.ts` → 1 = 1 ✓
- Grep positive (Task 2 shell): STUB_ONLY_SERVICES declaration = `['media']` only (no 'keys') ✓
- Grep anti (Task 2 shell): `grep "stub-only" apps/demo/src/shell-host.ts | grep "keys.forward"` → 0 ✓
- Grep positive (Task 2 shell): `grep -c "real backend" apps/demo/src/shell-host.ts` → 1 ≥ 1 ✓
- Grep positive (Task 2 shell): `grep -c "__grantKeysForward__" apps/demo/src/shell-host.ts` → 6 ≥ 2 ✓
- Grep positive (Task 2 shell): `grep -cE "aclState\.grant.*keys:forward" apps/demo/src/shell-host.ts` → 1 ≥ 1 ✓
- Grep anti (Task 2 shell): `grep -c "hotkey-chord-frame-container" apps/demo/index.html` → 0 ✓ (div dynamically rendered by topology.ts)
- DEMO_NAPPLETS frameContainerId entries: 9 (lines 131, 138, 149, 156, 163, 174, 181, 188, 202) — was 8 baseline
- Commits: N/A — plan explicitly instructed no commits (Plan 26-04 atomic commit is the authoritative hash source for this work)

## Self-Check: PASSED

---
*Phase: 26-real-keys-backend*
*Completed: 2026-04-19*
