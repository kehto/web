# Phase 42: Bug Fix + Polish + Rename Sweep - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Clear five small, mutually-independent items off the v1.7 carryover slate before the upstream-gated work begins — so v1.8 opens on a clean tree and the topology connector lines render correctly in `pnpm preview` from the first commit.

**Pre-kickoff state reconciliation (committed at `a330da5`):**
- **BUG-01 already shipped** in commit `4f02c1e` (vendored `leader-line.min.js` to `apps/playground/public/vendor/`). Verification step in this phase confirms the fix is intact; no implementation work needed.
- **`apps/demo` → `apps/playground` rename** landed in commit `4208d91` (215 files relocated; napplet packages keep `@kehto/demo-*` names). All file paths in this phase reference the post-rename layout.

**Active items in this phase:**
- BUG-02: Playwright regression spec
- POLISH-01: Cosmetic h2 port label fix
- RENAME-01: `SessionEntry.identitySource` discriminant rename
- RENAME-02: `bridge.injectEvent('auth:identity-changed', ...)` topic rename

</domain>

<decisions>
## Implementation Decisions

### RENAME-01: SessionEntry discriminant rename

- **New field name:** `provenance` (accurate, terse, doesn't conflate with field/topic naming elsewhere)
- **New variant names:** `'nip-5d' | 'legacy-auth'` (names the actual provenance instead of the obsolete `auth`/`source` shorthand)
- **Migration style:** Hard-rename. Internal-ish type; not heavily externalized. v1.6 carryover note was less defensive than RENAME-02.
- **Touch `@kehto/shell` dist?** Yes — regenerate types; minor-bump changeset documents the rename for any downstream consumer.
- **Test fixtures:** Update all test files producing `identitySource: '...'` literals to `provenance: '...'` (live producers in: `packages/runtime/src/test-utils.ts:256`, `packages/shell/src/{keys-forwarder,shell-bridge}.test.ts`, `packages/runtime/src/types.test.ts`).

### RENAME-02: Shell hook topic rename

- **New topic string:** `'identity:changed'` (matches NIP-5D `identity` NUB domain naming).
- **Migration style:** Soft-rename. Emit BOTH `'auth:identity-changed'` AND `'identity:changed'` topics for one release. v1.6 carryover note explicitly flagged "live surface with external consumers."
- **Hard-remove date:** Schedule for v1.9. Add to PROJECT.md Known Tech Debt at phase close.
- **Documentation:** JSDoc `@deprecated` on old-topic call sites (or wrap in deprecation helper that warns once) + changeset advisory paragraph explaining migration window.

### BUG-02: Playwright regression spec

- **Spec file:** `tests/e2e/topology-lines.spec.ts` (new file; matches existing one-spec-per-feature convention).
- **Assertion shape:** Navigate to built `:4174` preview → wait for topology section to render → assert `window.LeaderLine` is defined AND ≥1 SVG `line` (or `path`) element exists inside the topology container.
- **Avoid coupling to specific edge counts:** v1.8 may grow demo napplets in later phases; assertion stays at "≥1" not "==N".

### POLISH-01: Cosmetic h2 fix

- **File:** `apps/playground/napplets/resource-demo/index.html:61`
- **Change:** `:5174` → `:4174` (one-line edit; matches `GRANTED_URL` constant in same file).

### Claude's Discretion

- Per-package changeset granularity for the renames (`@kehto/shell` minor for RENAME-01; possibly `@kehto/runtime` if SessionEntry is consumed there; `@kehto/shell` for RENAME-02).
- Exact wording of changeset migration notes — follow v1.6 / v1.7 changeset prose conventions.
- Whether to land all 4 items as one atomic commit or split (recommended split: BUG-02 + POLISH-01 + RENAME-01 + RENAME-02 = 4 commits, each independently revertable).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/playground/src/topology.ts:initTopologyEdges()` — returns `EdgeFlasher` with `lines` Map; the silent try/catch at lines 235–253 is the bug-mitigation surface (do NOT remove during this phase — protects against future regressions).
- `apps/playground/public/vendor/leader-line.min.js` — vendored UMD copy (Vite copies `public/` to `dist/` verbatim; resolves at `/vendor/leader-line.min.js` in dev + preview).
- `apps/playground/index.html` — already updated to reference `/vendor/leader-line.min.js` in commit `4f02c1e`.

### Established Patterns
- **E2E spec style:** `tests/e2e/*.spec.ts` files navigate to `:4174` preview, use `expect.poll()` for async sentinels, assert against DOM elements with stable IDs/data-* attrs. Reference: v1.5's `class-invariant.spec.ts`, v1.7's `connect-revocation.spec.ts`.
- **Changeset prose:** `.changeset/v1-X-*.md` files follow tight summary + migration-impact + downstream-advisory format. Reference: v1.6 dep changesets.
- **Rename migration notes:** Per Decision #19 (mid-milestone audit-first rescopes), audit the rename impact BEFORE executing to catch inherited inaccuracies. RENAME-01's `'auth'` variant is type-shape-only (no live producers); RENAME-02's old topic likely has live consumers (hyprgate).

### Integration Points
- `SessionEntry` type lives in `packages/shell/src/types.ts:41-67`. Consumers: `packages/shell/src/{shell-bridge,acl-store,keys-forwarder}.ts`, `packages/runtime/src/test-utils.ts`, multiple test files.
- `bridge.injectEvent('auth:identity-changed', ...)` call sites: live in shell production code and demo playground; need grep sweep at plan time.

</code_context>

<specifics>
## Specific Ideas

- **Verify BUG-01 is still intact** before closing phase — `apps/playground/index.html` line referencing `/vendor/leader-line.min.js` and `apps/playground/public/vendor/leader-line.min.js` file present.
- **Topology spec wait condition:** Use `expect.poll(() => page.evaluate(() => window.LeaderLine !== undefined))` then read SVG line count via DOM query — avoids relying on a custom sentinel.
- **Baseline E2E count:** Phase 42 closes at **73/0/0** (72 baseline + 1 new `topology-lines.spec.ts`). If `apps/demo` → `apps/playground` rename broke any existing spec (Playwright config still points at `:4174`), planner must flag.

</specifics>

<deferred>
## Deferred Ideas

- **Removal of `'legacy-auth'` variant entirely** — could happen in v1.9 after one release cycle proves no internal producers emit it. Tracked as future tech debt.
- **Removal of `'auth:identity-changed'` dual-emit** — scheduled for v1.9 per RENAME-02 soft-rename decision.
- **Refactor of the silent try/catch in `initTopologyEdges()`** — convert to a logged warning when UMD library is missing. Out of scope for v1.8 (would mask new bugs by being too vocal).

</deferred>
