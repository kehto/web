# Phase 88: Modernize Playground onto Released @napplet Packages (inc/naps) - Context

**Gathered:** 2026-06-17 (REVISED — supersedes the original 0.5.0-based context)
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped; spec from REQUIREMENTS.md + audit + user direction + verified modern-package facts)

<domain>
## Phase Boundary

**User direction (2026-06-17):** napplet has been released; the playground was pinned to a VERY old 0.5.0; update the playground dependencies. This re-scopes Phase 88 from "work around the old 0.5.0 shim" to "**modernize the playground onto the released @napplet packages and let the real shim drive the naps/inc path.**" This is the most authentic way to satisfy TERM-01..05.

Satisfies: TERM-01 (`nap:` primary prefix — now via the real shim), TERM-02 (`ifc`→`inc` — now a real end-to-end wire migration), TERM-03 (playground exercises `naps` — now via the real shim 0.12), TERM-04 (naps-path e2e), TERM-05 (keep `@kehto` dual-emit).

Out of scope: migrating the `@kehto/*` runtime packages or the `tests/fixtures/napplets/nub-*` fixtures off `@napplet/nub` (they stay on 0.5 — runtime↔napplet is wire-only; fixtures have their own `nub-*` specs); `specs/NIP-5D.md` rewrite + NAP-SHELL/INTENT mirrors (Phase 89); removing `@kehto` dual-emit / CLEANUP-01 (future).
</domain>

<decisions>
## Implementation Decisions

### DONE (already applied this session, before planning)
- All 9 playground napplet `package.json`s bumped: `@napplet/nub`→`@napplet/nap` `0.11.0`, `@napplet/core` `0.11.0`, `@napplet/sdk` `0.11.0`, `@napplet/shim` `0.12.0`, `@napplet/vite-plugin` `0.7.0`. `pnpm install` succeeded (peer warnings are pre-existing/unrelated: unocss wasm, docsearch, esbuild). `@napplet/nub@0.5.0` and `@napplet/nap@0.11.0` coexist in the store.

### VERIFIED MODERN-PACKAGE FACTS (authoritative — drive the migration)
- `@napplet/nap@0.11.0` exposes per-domain subpaths `./<domain>` + `/types` + `/shim` + `/sdk` for: relay, storage, **inc**, ifc (back-compat), keys, theme, media, notify, identity, config, resource, connect, class, cvm, outbox, upload, intent.
- `@napplet/nap/inc/sdk` exports `incEmit`, `incOn` (delegate to `window.napplet.inc.*`). `@napplet/nap/ifc/sdk` is a back-compat alias: `export { incEmit as ifcEmit, incOn as ifcOn } from '../inc/sdk.js'` — so EITHER import path now emits `inc.*` on the wire. **The wire becomes `inc.*` with the modern package.**
- `@napplet/shim@0.12.0` (the real released shim): auto-posts `{type:'shell.ready'}` to `window.parent` on load; on `shell.init` sets `window.napplet.shell.supports = createShellSupports(capabilities)` which reads `capabilities.naps` (normalized domains, `nap:` prefix); installs `window.napplet.inc` (`@napplet/nap/inc/shim`) and handles `inc.event`. → **The real shim now natively provides correct `supports()` from `naps` and the `inc` surface.** The playground's hand-rolled `supports()` bootstrap override (reading `nubs`) is now REDUNDANT.
- `@napplet/vite-plugin@0.7.0`: `nip5aManifest({ nappletType, requires?, artifactMode? })` + kind constants — same API the playground uses; still does NOT emit `archetype` tags (Phase 87's manual injection in the playground re-sign path remains correct and necessary).

### TERM-02 — migrate napplet source imports `@napplet/nub/*` → `@napplet/nap/*` (+ ifc→inc)
- In every playground napplet `src/**` and `vite.config.ts`: replace `@napplet/nub/` → `@napplet/nap/`.
- For inter-napplet comms: `@napplet/nub/ifc/sdk` (`ifcOn`/`ifcEmit`) → `@napplet/nap/inc/sdk` (`incOn`/`incEmit`); rename call sites accordingly (bot, chat, feed, profile-viewer). Wire becomes `inc.*` (runtime dual-routes inc, so dispatch + ACL still work).
- capability declarations: `requires: ['ifc',...]` → `['inc',...]` (bot/chat/feed/profile-viewer vite.config.ts); `REQUIRED_NAPS` `ifc`→`inc`, `REQUIRED_IFC_PROTOCOL='ifc:NAP-01'`→`'inc:NAP-01'` (rename const optional), `supports('ifc'...)`→`supports('inc'...)` in main.ts.
- Other domain imports (relay, storage, identity, notify, resource, config, cvm, media, etc.): just `@napplet/nub/`→`@napplet/nap/`; helper names unchanged for non-ifc domains. Verify each against the installed `@napplet/nap` `<domain>/sdk` d.ts if a name differs.

### TERM-01 + TERM-03 — rely on the real shim 0.12 for supports()/naps
- Remove (or neutralize) the playground's hand-rolled `supports()` bootstrap in `apps/playground/napplets/shared-vite-config.ts` (~l.36-64) that read `capabilities.nubs` and overwrote `shell.supports`. With shim 0.12 setting `supports` from `naps` on `shell.init`, the override is redundant and must not clobber the real shim's `supports`. Inspect what else that bootstrap block does before deleting (it captured `state.fallbackSupports`); preserve anything still needed, drop the nubs-reading supports.
- `apps/playground/src/demo-hooks.ts` `getMissingRequiredNaps` (~l.303-307): read `capabilities.naps` (fallback `nubs`) so a napplet `requires:['inc',...]` resolves against the shell's advertised `naps` (which carries `inc`).
- `packages/shell/tests/perm-namespace.test.ts`: make `nap:` the primary asserted prefix (keep `nub:` as accepted alias); update the JSDoc contract prose `nub:`→`nap:`.
- DEFER `specs/NIP-5D.md` prefix wording to Phase 89.

### TERM-04 — naps-path conformance e2e
- Add `tests/e2e/naps-path-conformance.spec.ts`: load a migrated `inc`-capable napplet (profile-viewer/feed) and assert, in-page, `window.napplet.shell.supports('inc') === true`, `supports('inc:NAP-01') === true`, and `supports('ifc') === false` — proving the real shim's `naps` path. Honor `workers:1` + `test.setTimeout(120000)` for reload-heavy specs.

### TERM-05 — keep @kehto dual-emit
- Do NOT touch `packages/shell/src/shell-init.ts` (naps+nubs dual-emit stays; `@kehto` still serves any 0.5 consumers + the nub-* fixtures). `shell-init.test.ts` / `no-window-nostr.test.ts` stay green.

### e2e fallout (CRITICAL — the wire moved to inc for the playground)
- Playground-targeting specs that assert the OLD `ifc.*` wire or `ifc` capability MUST update to `inc`: `ifc-roundtrip.spec.ts` (chat↔bot — now `inc.*`), `gateway-artifact-parity.spec.ts` (`requires.includes('ifc')`/`supports('ifc:NAP-01')` → `inc`), and check `demo-audit-correctness.spec.ts` (`ifc-send` path), `demo-boot`/`demo-concurrent-boot` (9 napplets still reach identity-bound).
- FIXTURE-targeting specs stay UNCHANGED: `tests/fixtures/napplets/nub-*` remain on `@napplet/nub@0.5` (emit `ifc.*`); their specs at the `:4173` harness (`nub-ifc.spec.ts`, `nub-relay`, etc.) must stay green as-is. Do NOT migrate the fixtures.
- If renaming a spec helps clarity (e.g. `ifc-roundtrip`→`inc-roundtrip`) that's fine, but keep coverage equivalent.

### Verification (gates)
- `pnpm build` (all napplets rebuild against @napplet/nap/core 0.11 + vite-plugin 0.7).
- `pnpm type-check`.
- `pnpm test:unit` (root vitest — playground unit tests incl. Phase 87 catalog test).
- Targeted Playwright e2e: the new naps-path spec, `ifc-roundtrip`(→inc), `gateway-artifact-parity`, `demo-boot`/`demo-concurrent-boot` (9 napplets identity-bound), plus the `nub-*` fixture specs (regression — must stay green). Honor `workers:1`.
- Changeset: playground is private (no changeset); add `@kehto/shell` changeset only if `perm-namespace` contract change alters shell behavior (likely test-only → none).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/NIP-5D-2303-DELTA-AUDIT.md` — G5, G6.
- `.planning/REQUIREMENTS.md` — TERM-01..05.
- Installed modern packages (read their dist for exact API):
  - `node_modules/.pnpm/@napplet+nap@0.11.0/node_modules/@napplet/nap/dist/<domain>/sdk.d.ts`
  - `node_modules/.pnpm/@napplet+shim@0.12.0/node_modules/@napplet/shim/dist/index.js` (handshake + createShellSupports + inc install)
- `apps/playground/napplets/shared-vite-config.ts` (l.36-64 bootstrap supports override — remove/neutralize) + `definePlaygroundNappletConfig`/`validateArchetypes`/`recomputeManifest` (Phase 87 archetype injection — keep working with vite-plugin 0.7).
- `apps/playground/src/demo-hooks.ts` (getMissingRequiredNaps → naps).
- All 9 `apps/playground/napplets/*/src/**` + `vite.config.ts` (import migration; 4 ifc→inc).
- `packages/shell/tests/perm-namespace.test.ts` (nap: primary).
- `packages/shell/src/shell-init.ts` (DO NOT EDIT — reference; dual-emit stays).
- `tests/e2e/ifc-roundtrip.spec.ts`, `gateway-artifact-parity.spec.ts`, `demo-audit-correctness.spec.ts`, `demo-boot.spec.ts`, `demo-concurrent-boot.spec.ts` (playground → inc updates).
- `tests/e2e/nub-ifc.spec.ts` + `tests/fixtures/napplets/nub-*` (DO NOT CHANGE — fixtures stay on nub 0.5).
- `playwright.config.ts`.
</canonical_refs>

<specifics>
## Specific Ideas

- Do the import migration mechanically (`@napplet/nub/`→`@napplet/nap/`), then build each napplet and fix any helper-name drift against the installed `@napplet/nap` d.ts (most non-ifc helpers keep their names).
- The shim 0.12 auto-handshake means napplets that previously used a probe to detect readiness can rely on `window.napplet.shell.ready()`/`supports()` — but minimize churn; only change what the migration requires.
- naps-path e2e target: profile-viewer (`supports('inc:NAP-01')`).
</specifics>

<deferred>
## Deferred Ideas

- Migrating `@kehto/*` packages + `tests/fixtures/napplets/nub-*` off `@napplet/nub` → future (not required; runtime is wire-compatible).
- `specs/NIP-5D.md` rewrite + NAP-SHELL/INTENT mirrors → Phase 89.
- Bumping `@kehto/shell` dev dep `@napplet/shim@0.9.0`→`0.12.0` for the conformance test → consider in Phase 89.
- Dual-emit removal / CLEANUP-01 → future.
</deferred>

---

*Phase: 88-terminology-playground-modern-path*
*Context gathered: 2026-06-17 (REVISED for released @napplet packages per user direction)*
