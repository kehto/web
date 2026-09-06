# Phase 82: Verification & Closeout - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning
**Source:** Approved design brief (brainstorming session, 2026-06-15)

<domain>
## Phase Boundary

Final closeout for milestone v1.18. No new feature code. Deliver: (1) a changeset covering `@kehto/firewall` (new) + `@kehto/runtime` (additive API incl. the `ConsentRequest` change), and (2) confirmation that the whole-repo unit suite AND the Playwright E2E specs stay green with the firewall integrated.

In scope: the changeset; running `pnpm test:unit`, `pnpm type-check`, and `pnpm test:e2e`; fixing any regression surfaced by those runs.

Out of scope: any new firewall behavior, management UI, real WASM, ACL-denied observation (all future). The firewall engine (Phase 80) and runtime integration (Phase 81) are done.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

- **Changeset:** `.changeset/v1-18-napplet-firewall.md` — `@kehto/firewall: minor`, `@kehto/runtime: minor`. Must call out the `ConsentRequest` public-API change (new `firewall-policy` variant + `event` now optional).
- **Green bars required (VERIFY-03):**
  - `pnpm test:unit` — whole repo green (baseline was 819; now 840 with firewall tests).
  - `pnpm type-check` — repo-wide exit 0.
  - `pnpm test:e2e` — the 87–89 Playwright specs stay green (firewall's flag-by-default posture must not break existing playground flows; the playground constructs `RuntimeAdapter` without firewall hooks, so the optional-hooks design should mean zero behavioral change there).
- If E2E surfaces a regression caused by the firewall (e.g. a default limit throttling a legitimate playground flow), fix by tuning defaults or wiring, NOT by disabling the firewall.
</decisions>

<canonical_refs>
## Canonical References
- `.changeset/README.md` — changeset format.
- `package.json` scripts: `test:unit`, `type-check`, `test:e2e` (`pnpm test:build && npx playwright test`).
- `apps/playground/` — the E2E surface; constructs `RuntimeAdapter` (no firewall hooks → firewall uses built-in defaults with `getFocusContext` absent ⇒ `{focused:true}`).
- `.planning/REQUIREMENTS.md` — VERIFY-03.
</canonical_refs>

<specifics>
## Specific Ideas
- The playground builds opaque-origin gateway artifacts; firewall evaluation happens in-runtime, so E2E exercises the real gate path. Watch for any spec that publishes/deletes in volume on init — the init-burst guard (default block) could trip it. If so, that's a real finding: tune the default burst threshold so legitimate playground init stays under it.
</specifics>

<deferred>
## Deferred Ideas
- Milestone archive (`/gsd:complete-milestone`), PR creation → after this phase verifies.
- Real WASM, management UI, ACL-denied observation, cross-napplet anomaly detection → future milestones.
</deferred>

---

*Phase: 82-verification-closeout*
*Context gathered: 2026-06-15 from approved design brief*
