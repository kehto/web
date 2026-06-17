# Phase 88: Terminology & Playground Modern-Path Alignment - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped; spec from REQUIREMENTS.md + audit + verified package facts)

<domain>
## Phase Boundary

Make the playground exercise the modern `naps` / `inc` capability path (the path the real shim uses) and establish `nap:` as the primary capability prefix — WITHOUT removing the `naps`+`nubs` / `inc`+`ifc` dual-emit (installed shim is 0.5.0). Five requirements: TERM-01 (`nap:` primary prefix), TERM-02 (4 napplets `ifc`→`inc` capability declaration), TERM-03 (playground reads `naps`), TERM-04 (naps-path e2e), TERM-05 (keep dual-emit; existing capability-payload assertions stay green).

Out of scope: removing dual-emit / CLEANUP-01 (deferred); the `specs/NIP-5D.md` full rewrite + NAP-SHELL/INTENT mirrors (Phase 89 owns that file); archetypes (Phase 87, done).
</domain>

<decisions>
## Implementation Decisions

### VERIFIED PACKAGE FACTS (do not violate)
- `naps` and `nubs` arrays (`packages/shell/src/shell-init.ts`) contain the SAME bare domains (relay, outbox, identity, storage, theme, keys, media, notify, config, resource, connect, class, cvm, + conditional upload/intent). The ONLY difference: `naps` has `inc` (+ `inc:NAP-01..06`); `nubs` has `ifc` (+ `ifc:NUB-01..06`, `ifc:NAP-01`). → switching the playground to read `naps` is SAFE for every bare domain the 9 napplets use.
- **`@napplet/nub@0.5.0` (installed) exposes ONLY `./ifc/*` subpaths — there is NO `./inc` subpath.** Napplet wire helpers `ifcOn`/`ifcEmit` import from `@napplet/nub/ifc/sdk` and emit `ifc.*` wire messages. The runtime DUAL-ROUTES `ifc.*` and `inc.*` to the same handler. → **wire SDK imports and `ifc.*` wire messages MUST stay `ifc` — do NOT change them to `inc` (the subpath does not exist; the build will break).**

### TERM-02 — 4 napplets `ifc`→`inc` (CAPABILITY DECLARATION/QUERY ONLY)
Napplets: bot, chat, feed, profile-viewer. For each:
- `apps/playground/napplets/<n>/vite.config.ts`: `requires: ['ifc', ...]` → `['inc', ...]`.
- `apps/playground/napplets/<n>/src/main.ts`: `REQUIRED_NAPS = ['ifc', ...]` → `['inc', ...]`; `REQUIRED_IFC_PROTOCOL = 'ifc:NAP-01'` → `'inc:NAP-01'` (rename const to `REQUIRED_INC_PROTOCOL` is optional cosmetic); any `supports('ifc')`/`supports('ifc:NAP-01')` call → `supports('inc')`/`supports('inc:NAP-01')`.
- **DO NOT touch** `import { ifcOn, ifcEmit } from '@napplet/nub/ifc/sdk'` or any `ifcOn(...)`/`ifcEmit(...)` call — the wire stays `ifc.*` (0.5.0 has no `inc` SDK; runtime dual-routes). This is a capability-name migration, not a wire migration.

### TERM-03 — playground reads `naps` (with `nubs` fallback)
- `apps/playground/napplets/shared-vite-config.ts` ~l.36-48 `supports(capability)`: the bare/`nap:`/`nub:` branch currently checks `capabilities.nubs.includes(nap)`. Change to check `capabilities.naps` first, falling back to `capabilities.nubs` when `naps` is absent/empty (kehto always dual-emits both, so this reads `naps` in practice). Keep the `perm:` → `sandbox` branch unchanged.
- `apps/playground/src/demo-hooks.ts` ~l.303-307 `getMissingRequiredNaps`: `const supported = new Set(capabilities.nubs)` → prefer `capabilities.naps`, fall back to `nubs`.
- Net effect: `supports('inc')`/`requires:['inc']` now resolve (naps has `inc`); `supports('ifc')` now returns false (naps lacks `ifc`) — which is correct and is exactly why TERM-02 migrates the 4 napplets in lockstep. Other 5 napplets unaffected (their bare domains are in naps).

### TERM-01 — `nap:` primary prefix
- The playground `supports()` already strips both `nap:` and `nub:` prefixes (l.43-46). Confirm `nap:` is the primary/first-checked branch; `nub:` remains an accepted alias. No behavior change needed if both already work — just ensure ordering/intent reads nap-first.
- `packages/shell/tests/perm-namespace.test.ts`: the local stub (l.115-120) checks `nub:`→`caps.nubs`. Update so the stub/contract treats `nap:` as primary (strip `nap:`, check the capability array) AND still accepts `nub:` as alias; update the JSDoc contract prose (l.8, l.115) from `nub:` to `nap:` (note `nub:` accepted). Keep the `perm:` assertions intact. The stub may read whichever array; keep it consistent with what it asserts.
- `specs/NIP-5D.md` prefix examples (`supports('nub:identity')` etc.): **DEFERRED to Phase 89** (DOCS-01 rewrites that whole file). Do NOT edit `specs/NIP-5D.md` in this phase to avoid a merge with Phase 89.

### TERM-04 — naps-path conformance e2e
- Add an e2e (`tests/e2e/*.spec.ts`) asserting the modern `naps`-only path: for an `inc`-capable migrated napplet (profile-viewer or feed), in-page evaluate `window.napplet.shell.supports('inc') === true` and `window.napplet.shell.supports('inc:NAP-01') === true`, and ideally `supports('ifc') === false` (proving the naps path, not the legacy nubs path). Follow existing e2e patterns (`gateway-artifact-parity.spec.ts`); honor `workers:1` + `test.setTimeout(120000)` for reload-heavy specs.

### TERM-05 — keep dual-emit
- DO NOT modify `packages/shell/src/shell-init.ts` capability arrays or remove `nubs`. `shell-init.test.ts` and `tests/.../no-window-nostr.test.ts` assert the full `nubs` set incl. `ifc`/`ifc:NUB-NN` — these MUST stay green. CLEANUP-01 is explicitly NOT performed.

### e2e specs that need updating (ifc capability → inc), vs. specs that must NOT change (ifc WIRE)
- UPDATE (capability declaration/query): `tests/e2e/gateway-artifact-parity.spec.ts` (the `requires.includes('ifc')` / `supports('ifc:NAP-01')` contract → `inc`), and any spec asserting the 4 napplets' `requires`/`supports` strings (check `nip5d-contract-conformance.spec.ts`, `demo-audit-correctness.spec.ts`).
- DO NOT CHANGE (wire stays ifc.*): `nub-ifc.spec.ts`, `ifc-roundtrip.spec.ts`, chat↔bot round-trip, and any spec asserting `ifc.emit`/`ifc.subscribe` envelopes — the wire is still `ifc.*` via the 0.5.0 SDK. Verify these stay green.

### Constraints
- Additive/surgical; no dual-emit removal. Napplet counts unchanged. `@kehto/*` package source largely untouched (this is mostly playground + one shell test); add a `@kehto/shell` changeset only if `perm-namespace` contract or any shell source actually changes behavior (the test-only change may not need one — assess).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/NIP-5D-2303-DELTA-AUDIT.md` — gaps G5 (`nap:`/`nub:` prefix), G6 (playground exercises legacy path).
- `.planning/REQUIREMENTS.md` — TERM-01..05.
- `apps/playground/napplets/shared-vite-config.ts` (l.36-64 `supports` + `shell.supports` install) — the lever.
- `apps/playground/src/demo-hooks.ts` (l.294-308 `getShellCapabilities`/`getMissingRequiredNaps`).
- `apps/playground/napplets/{bot,chat,feed,profile-viewer}/vite.config.ts` + `src/main.ts` — the 4 migrations.
- `packages/shell/src/shell-init.ts` (NAP_DOMAINS l.39, LEGACY_NUB_DOMAINS l.12, NAP_INC_PROTOCOLS l.50) — DO NOT edit; reference only.
- `packages/shell/tests/perm-namespace.test.ts` — `nap:` primary update.
- `packages/shell/src/shell-init.test.ts`, `packages/shell/tests/no-window-nostr.test.ts` — must stay green (dual-emit).
- `tests/e2e/gateway-artifact-parity.spec.ts`, `nip5d-contract-conformance.spec.ts`, `demo-audit-correctness.spec.ts` — ifc→inc capability updates.
- `tests/e2e/nub-ifc.spec.ts`, `ifc-roundtrip.spec.ts` — ifc WIRE; must stay green unchanged.
- `playwright.config.ts` — workers:1, two webservers.
</canonical_refs>

<specifics>
## Specific Ideas

- The cleanest naps-path e2e target is `profile-viewer` (it checks `supports('inc:NAP-01')` after migration). The new spec can assert all three: `supports('inc')` true, `supports('inc:NAP-01')` true, `supports('ifc')` false.
- Run the affected e2e specs during verification (not the full suite necessarily): the new naps-path spec, gateway-artifact-parity, ifc-roundtrip/nub-ifc (regression), demo-boot/demo-concurrent-boot (9 napplets still reach identity-bound).
</specifics>

<deferred>
## Deferred Ideas

- `specs/NIP-5D.md` prefix wording → Phase 89 (DOCS-01).
- Dual-emit removal / CLEANUP-01 → future (blocked on shim upgrade past 0.5.0).
</deferred>

---

*Phase: 88-terminology-playground-modern-path*
*Context gathered: 2026-06-17 (discuss skipped; spec from requirements + audit + verified package facts)*
