# Phase 36: PERF-01 + Milestone Close E2E-18 - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

**PERF-01 (rescoped 2026-04-23):** The D-04 AUTH probe pattern (`storage.getItem('<napplet>-auth-probe')` as a shim-AUTH-completion gate) is vestigial — AUTH is deprecated entirely in the v1.2+ runtime; AUTHENTICATED now fires from shim bootstrap signal, not from the probe resolving. Delete the 7 vestigial probes + scrub the D-04 comment prose across all 10 demo napplets. Verify AUTHENTICATED still fires for every napplet via the existing 54-spec E2E baseline (demo-concurrent-boot.spec.ts is the canonical assertion).

**E2E-18:** Record the canonical v1.6 milestone-close fresh-install iteration loop at ≥ 54 passed / 0 failed / 0 skipped. The anti-term sweep runs across the full v1.6 delta (Phases 32-36 cumulative).

Scope-in:
- Delete `await storage.getItem('<napplet>-auth-probe')` lines from 7 napplets: composer, feed, hotkey-chord, media-controller, profile-viewer, theme-switcher, toaster
- Delete surrounding try/catch scaffolding that only wraps the probe (no other work in that block)
- Scrub D-04 / "shim AUTH completion" / "first SDK call gates on AUTH" prose comments across all 10 napplets (including chat, preferences, bot — where the comment frames a real data load as an AUTH gate, even though the load stays)
- Verify AUTHENTICATED sentinel still fires for all 10 napplets — `tests/e2e/demo-concurrent-boot.spec.ts` (v1.5 Phase 29-30 canonical) already asserts this; must stay green
- Record `36-ITERATION-LOG.md` with fresh-install loop evidence
- E2E-18 success: 54 passed / 0 failed / 0 skipped

Scope-out (user-locked):
- Rename `identitySource: 'auth' | 'source'` type discriminant — not AUTH protocol, just a type value; bigger refactor, out of v1.6
- Remove `bridge.injectEvent('auth:identity-changed', ...)` shell hook — live surface, live consumers
- Touch `apps/demo/src/signer-demo.ts` — independent of D-04; separate demo helper
- Publish @kehto/* changesets — that's `/gsd:complete-milestone` work, not Phase 36

</domain>

<decisions>
## Implementation Decisions

### PERF-01 Rescope (user-locked)

- **Premise correction:** v1.5 audit claim "chat boot performs 18+ serial storage.get round-trips" is inaccurate for the current code. Chat boot = 1 storage call (`loadHistory`). Demo-wide boot ≈ 11 storage calls across 10 napplets (7 AUTH probes + 3 real data loads + 2 serial-by-design preferences reads).
- **Real target:** delete 7 vestigial AUTH probes; don't batch real data loads (they're loading real data).
- **User directive:** "AUTH is deprecated entirely." Confirmed via audit — shim handles AUTH implicitly; no runtime/shell code requires the probe pattern.
- **Audit-first approach (user-locked):** ran the AUTH residual sweep BEFORE planning. Results documented above.

### AUDIT results (AUTH deprecation status)

- **Dead:** `AUTH_KIND`, `BusKind`, `kind 29001/29002` — 0 live consumers; guarded only by anti-term regexes
- **Dead:** D-04 AUTH probe pattern — no runtime/shell code gates on probe resolution; shim fires AUTHENTICATED directly
- **Alive (leave alone):** `identitySource: 'auth' | 'source'` type discriminant in `SessionEntry`, `bridge.injectEvent('auth:identity-changed', ...)` shell hook, `apps/demo/src/signer-demo.ts` — all outside PERF-01 scope

### Claude's Discretion
- Exact prose rewrites for the D-04 comments — keep a one-liner explaining what the init block does (e.g., "Kick off init → set AUTHENTICATED sentinel when first async SDK call resolves") without the AUTH-gate framing.
- Whether to delete the try/catch wrapping a now-empty body or collapse the function. Discretion — go with whichever is cleaner per napplet.
- Whether to update the `#status-text` transition from `connecting...` → `authenticated` to fire synchronously after init completes (faster UX) or keep it gated on `Promise.resolve()` for determinism. Plan phase decides.
- Whether to bump E2E count by adding a spec locking the "no auth-probe" pattern. Recommendation: no — the 54-spec baseline already catches regressions (AUTHENTICATED sentinel firing is asserted by `demo-concurrent-boot.spec.ts`).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/e2e/demo-concurrent-boot.spec.ts` (v1.5 Phase 29) — canonical AUTHENTICATED-for-all-10-napplets assertion. The existing baseline catches any regression from this cleanup.
- D-04 init pattern is documented in 7 of 10 napplets in identical prose ("D-04 init pattern: first SDK call gates on shim AUTH completion"). Mass find-and-replace candidate.

### Established Patterns
- v1.3 Phase 18 established the `init()` async pattern: napplets export an `init()` that runs at module-init, and the status-text sentinel flips to `authenticated` when the init promise resolves
- v1.4 Phase 24 deleted all live consumers of `BusKind`, `AUTH_KIND`, NIP-01 dispatch arrays — the probe pattern survived into v1.5 as vestigial prose even though the runtime no longer honored it

### Integration Points
- 7 napplet main.ts files to edit: composer, feed, hotkey-chord, media-controller, profile-viewer, theme-switcher, toaster
- 3 napplet main.ts files to touch for comment-only scrubs: chat, preferences, bot
- `tests/e2e/demo-concurrent-boot.spec.ts` — regression anchor (must stay green)
- `tests/e2e/nub-*.spec.ts` Layer-A specs — some reference the probe pattern in JSDoc; scrub if found (not load-bearing)

</code_context>

<specifics>
## Specific Ideas

- **Probe deletion pattern per napplet**: locate `await storage.getItem('<slug>-auth-probe')` line(s), delete them; if the surrounding block becomes an empty try/catch or a pointless function, inline or delete it. Keep the status-text flip to `authenticated`.
- **Comment scrub**: find-and-delete phrases like `D-04 init pattern: first SDK call gates on shim AUTH completion`, `Shim handles AUTH implicitly via first SDK call`, `gates on shim AUTH completion (storage proxy requires identity)`. Replace with a short honest description (e.g., "Initialize SDK handlers; flip status to authenticated when init completes.") or delete entirely if the code is self-documenting.
- **E2E regression anchor**: `tests/e2e/demo-concurrent-boot.spec.ts` polls `#<napplet-slug>-status` text content for `authenticated` across all 10 napplets. If any napplet's status-text flip is still gated on the deleted probe code, this spec will fail and we'll catch it.
- **Iteration loop command** (canonical v1.6 pattern):
  ```bash
  rm -rf node_modules packages/*/dist packages/*/node_modules apps/demo/dist apps/demo/node_modules apps/demo/napplets/*/dist apps/demo/napplets/*/node_modules tests/harness/dist tests/harness/node_modules .turbo packages/*/.turbo apps/demo/.turbo apps/demo/napplets/*/.turbo && pnpm install && pnpm build && pnpm test:e2e
  ```
- **36-ITERATION-LOG.md structure** (pattern from 32/33/34/35):
  - Pre-fix git sha (Phase 35 close)
  - Command executed
  - Build output (24/24 turbo tasks expected, unchanged from Phase 35)
  - E2E output (54 passed / 0 failed / 0 skipped expected)
  - Delta documentation: 7 fewer napplet storage.get calls on boot; E2E count unchanged
  - v1.6 milestone-gate anti-term sweep (full anti-feature list from REQUIREMENTS.md): 0 matches each

</specifics>

<deferred>
## Deferred Ideas

- **Rename `identitySource: 'auth' | 'source'` → cleaner enum values**: bigger refactor affecting `@kehto/runtime` and `@kehto/shell` public types. Out of PERF-01 scope. v1.7+.
- **Remove `bridge.injectEvent('auth:identity-changed', ...)` shell hook**: live surface with external consumers. v1.7+.
- **Delete vestigial AUTH_KIND / BusKind anti-term regex checks**: the regexes act as regression guards even though no live code uses those symbols. Keep them as belt-and-braces. v1.7+ audit.
- **Publish v1.6 @kehto/* changesets to npm**: that's `/gsd:complete-milestone` work (or `pnpm publish-packages` manual), not Phase 36.

</deferred>
