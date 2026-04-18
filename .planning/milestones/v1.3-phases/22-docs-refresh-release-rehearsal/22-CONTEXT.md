# Phase 22: Docs Refresh & Release Rehearsal - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous)

<domain>
## Phase Boundary

Finalize v1.3: docs reflect canonical v1.2 APIs + v1.3 demo showcase; release tooling confirms packages are publish-ready (pending `@napplet/core` upstream npm unblock); full E2E suite green under a fresh build.

Covers: **DOCS-01 (typedoc), DOCS-02 (package READMEs), DOCS-03 (root README + migration docs), REL-01 (publint), REL-02 (attw), REL-03 (changeset version dry-run), REL-04 (v1.3 changesets), E2E-10 (full green gate), E2E-11 (iteration loop, formally closes here)**.

</domain>

<decisions>
## Implementation Decisions

### Locked Directives

**D-01 — `typedoc@^0.28` at root devDep** (DOCS-01). Configure with `entryPointStrategy: "packages"` pointing at `packages/*`. New `pnpm docs:api` script generates `docs/api/`. Each package has its JSDoc consumed. Build clean.

**D-02 — Package READMEs use canonical v1.2 APIs only** (DOCS-02). Update `packages/{acl,runtime,shell,services}/README.md`:
- Reference only public v1.2 exports; no `window.nostr`, no signer-service.
- Every public export has JSDoc with `@example` showing usage.
- Cross-link to typedoc-generated `docs/api/` pages.

**D-03 — Root README + `docs/*` refresh** (DOCS-03).
- Root `README.md` showcases v1.3 demo as reference integration; links to `apps/demo` and architecture diagrams if useful.
- Legacy migration docs in `docs/` (ACL-MIGRATION, RUNTIME-MIGRATION, SERVICES-MIGRATION, SHELL-MIGRATION, GAP-ANALYSIS, v1.2-NIP-5D-AUDIT) either:
  - (a) archive under `docs/migrations/` with a terminal-state note, OR
  - (b) update to reference v1.3 as the current state.
  Recommended: (a) — those docs describe point-in-time migrations already shipped.

**D-04 — `publint` + `attw` via `pnpm dlx`** (REL-01, REL-02). No install; run via `pnpm dlx publint packages/*` and `pnpm dlx @arethetypeswrong/cli --profile esm-only packages/*`. Clean output required; any issues fixed before phase close.

**D-05 — `changeset version` dry-run in throwaway branch** (REL-03). Steps:
1. Create branch `gsd/release-rehearsal-v1.3` from main
2. Run `pnpm changeset version`
3. Run `pnpm install --frozen-lockfile`
4. Inspect diffs — assert no unexpected peer-dep range changes
5. `git checkout main && git branch -D gsd/release-rehearsal-v1.3` (discard)
DO NOT run `pnpm changeset publish`.

**D-06 — v1.3 changesets staged at `.changeset/v1-3-*.md`** (REL-04). One per `@kehto/*` package (4 total):
- `.changeset/v1-3-acl.md` — any ACL changes in v1.3 (likely minor: DEMO napplet caps; no protocol change)
- `.changeset/v1-3-runtime.md` — notes session registry fix (Phase 19), publish fan-out fix (Phase 20), shim routing (Phase 21)
- `.changeset/v1-3-shell.md` — publishTheme fan-out fix (Phase 20)
- `.changeset/v1-3-services.md` — notification-service canonical `notify.*` (Phase 17/19), identity-service getPublicKey contract (Phase 20)
Each changeset body cites DEMO-*/NAP-*/E2E-* IDs it covers. Bump type: `patch` for most (no protocol change), `minor` if new public API.

**D-07 — Full E2E suite green gate** (E2E-10). Re-run full v1.3 suite fresh: `pnpm clean && pnpm build && pnpm test:e2e`. Must pass in under 5 minutes. Zero skipped specs beyond the 68 legacy `describe.skip` blocks already documented in Phase 21 iteration log (those are v1.4 scope, not blocking v1.3).

**D-08 — E2E-11 closes here** (iteration-loop discipline). Record in `.planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md`. This is the formal closure of the cross-cutting E2E-11 gate.

### Claude's Discretion
- Exact typedoc theme / layout
- Which obsolete docs move to `docs/migrations/` vs getting updated
- How verbose the root README becomes (prefer concise: overview + demo link + architecture summary)
- Changeset bump types (patch vs minor) — default patch if no new exports

### Anti-features
- No `changeset publish` (hard rule; deferred until @napplet/core npm release).
- No CI/CD setup.
- No new @kehto/* protocol changes in v1.3 (docs reflect existing surface).
- No new consumers of core-compat.ts.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.changeset/` directory exists (prior v1.2 changesets archived in milestones); confirm config.
- Packages have existing `README.md` files (pre-v1.3) — `packages/{acl,runtime,shell,services}/README.md`.
- Root `README.md` exists.
- `docs/` contains v1.0-v1.2 migration docs that are historical snapshots.
- `package.json` scripts may already have `docs:api` placeholder (check).

### Established Patterns
- Phase 16-21 all completed build→run→Playwright cycles using `pnpm build && pnpm test:e2e`.
- `.planning/MILESTONES.md` has past milestone entries documenting prior releases.

### Integration Points
- Modified: root `package.json` (typedoc devDep + `docs:api` script)
- New: `docs/api/` (typedoc output — ignore in .gitignore if appropriate, or check in)
- Modified: `packages/*/README.md`
- Modified or moved: `docs/*.md` (archive old migration docs)
- New: `.changeset/v1-3-{acl,runtime,shell,services}.md`
- New: `.planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md`

</code_context>

<specifics>
## Specific Ideas

- typedoc config: root `typedoc.json` with `entryPointStrategy: "packages"`, `entryPoints: ["packages/*"]`, `out: "docs/api"`. Skip readme generation if package READMEs already serve that purpose; link back instead.
- For the root README, prefer an overview that emphasizes:
  - What kehto is (runtime half of napplet protocol)
  - Link to v1.3 demo (with screenshot if easy)
  - Package list with brief description
  - How to integrate (one pattern example)
  - Link to typedoc API
- For REL-01/02: record the `pnpm dlx publint` + `attw` outputs in `22-ITERATION-LOG.md` as evidence.
- For REL-03 dry-run: capture git diff of version bumps before discarding the branch; attach to iteration log.
- Changeset bodies should be short (1-2 sentences per change) and reference REQ-IDs explicitly.

</specifics>

<deferred>
## Deferred Ideas

- npm publishing `@kehto/*` — blocked by `@napplet/core` upstream; v1.4+ concern.
- CI/CD GitHub Actions — explicitly out of scope (v1.4+).
- Storybook/interactive docs — overkill for a protocol runtime; typedoc is sufficient.
- Docs site (docusaurus/vitepress) — typedoc static output suffices.

</deferred>
