# Phase 15: Milestone Validation & Release Prep - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove v1.2 is shippable:
1. Every `@kehto/*` package that changed in v1.2 has a changeset entry.
2. All tests pass against the new peer-dep set (with legacy signer tests either migrated or deleted with rationale).
3. `pnpm build` produces clean ESM output for all four packages.
4. Milestone-level sanity: `docs/v1.2-NIP-5D-AUDIT.md` shows all Phase 12 DRIFT rows resolved; open tech debt (DRIFT-CORE-06) is documented; REQUIREMENTS.md shows all 26 REQs `[x]`.

Out of scope:
- Actually publishing packages to npm (blocked upstream by @napplet/core publishing cadence).
- CI/CD setup (listed as standing blocker).
- Removing DRIFT-CORE-06 (core-compat shim) — deferred until @napplet/core restores legacy exports.

</domain>

<decisions>
## Implementation Decisions

### Changeset Strategy
- **One changeset per kehto package** (4 changesets total), each at **minor** bump (`0.1.0 → 0.2.0`).
- Rationale for `minor` (not `major`): packages are all at 0.x, so `minor` semver already signals breaking potential. Consumers are expected to read release notes at 0.x bumps.
- Each changeset mentions:
  - Peer-dep bump: `@napplet/core` `>=0.1.0 → ^0.2.0`; new `@napplet/nub-*` peer deps at `^0.2.0`.
  - Package-specific notable changes (e.g., @kehto/shell: window.nostr removed, new proxies added; @kehto/services: signer removed, identity/keys/media/notify/theme services added).

### Changeset Files to Create
- `.changeset/v1-2-acl.md` — @kehto/acl minor bump: 8-domain ACL mapping, new capability constants, signer removed
- `.changeset/v1-2-runtime.md` — @kehto/runtime minor bump: createDispatch adoption, 8-domain switch removed, publishEncrypted flow, theme dispatch, core-compat shim noted
- `.changeset/v1-2-shell.md` — @kehto/shell minor bump: window.nostr removed (BREAKING), perm: namespace, 5 proxies, keys-forwarder, publishTheme
- `.changeset/v1-2-services.md` — @kehto/services minor bump: signer-service deleted (BREAKING), identity/keys/media/notify/theme services added

### Test File Cleanup
- Delete `tests/unit/shell-runtime-integration.test.ts` entirely. Its 19 tests assert legacy `BusKind`/`Capability`/`signer.*` semantics removed from napplet/core in v0.2.0 and from kehto source in Phase 12. Migration would require rewriting ≥80% of assertions — effectively creating new tests, not migrating existing ones.
- Add a migration note in the changeset (or changelog) citing the deletion: "shell-runtime-integration.test.ts deleted — its v1.1 BusKind/signer.* assertions no longer apply; replaced by per-package integration tests added in v1.2 Phase 12-03/04/08/09."
- `pnpm test` must exit 0 with test-file count reduced by 1 (and test count reduced by 19 skipped + whatever passing tests it had).

### Milestone-Level Checks
- `grep -nE "\[ \]" .planning/REQUIREMENTS.md` returns only items in `## Future Requirements` or `## Out of Scope` sections (no unchecked v1.2 REQs).
- `grep -cE "^\| DRIFT-.*Phase 12 \|" docs/v1.2-NIP-5D-AUDIT.md` still shows 26 Phase-12 rows, all annotated "Resolved in Phase 12" or "Resolved in Plan 12-11" / "Resolved in Phase 13".
- `packages/runtime/src/core-compat.ts` still exists with its DRIFT-CORE-06 header note — preserved intentionally.
- `pnpm build && pnpm type-check && pnpm test` all exit 0.

### Version Bump Execution
- This phase does NOT run `changeset version` — that's a separate release step.
- This phase does NOT run `changeset publish` — blocked upstream.
- Phase 15 just creates the changeset entries and validates the milestone.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.changeset/config.json` — changeset config (existing).
- `.changeset/README.md` — changeset documentation (existing).
- `package.json` scripts: `version-packages` (runs `changeset version`), `publish-packages` (runs `turbo run build && changeset publish`).

### Established Patterns
- Changeset format: YAML frontmatter with `"<pkg>": <bump>` lines, then markdown body.
- Example (from prior milestones if any): see `.changeset/config.json` for `changelog` + `access` settings.

### Integration Points
- Changesets land in `.changeset/*.md` files. `pnpm version-packages` consumes them.
- Test file deletion: `git rm tests/unit/shell-runtime-integration.test.ts` + `vitest.config.ts` unchanged (pattern matches no file).

</code_context>

<specifics>
## Specific Ideas

- One plan, 3 tasks: (1) create 4 changesets + delete test file, (2) run full validation gate (build + type-check + test + audit-doc grep), (3) write SUMMARY.md with milestone rollup.
- Changeset markdown bodies should be concise but informative — release notes readers skim them.

</specifics>

<deferred>
## Deferred Ideas

- Major version bump to 1.0.0 — deferred; prefer minor within 0.x semver posture.
- Migrating the 19 skipped tests to identity.* semantics — deferred; too much scope. Delete with rationale instead.
- Running `changeset version` / publishing — separate release step outside GSD milestone scope.
- Removing DRIFT-CORE-06 core-compat shim — awaits @napplet/core re-adding legacy exports.

</deferred>
