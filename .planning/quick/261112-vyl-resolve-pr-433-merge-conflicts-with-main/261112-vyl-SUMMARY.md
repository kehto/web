---
quick_id: 261112-vyl
status: complete
---

Merged main 226b4ad4 into PR #433 with merge commit b2606f9a.
Retained the obsolete extension-property regression together with main's
signer preference, storage denial, and pending connection lifecycle tests.
Combined both branches' quick-task records in STATE.md. Automatically merged
source and docs preserve host bootstrap discovery and explicit signer choices.
The existing Paja patch changeset is retained; no new shipped behavior was added.

Validation on the combined branch:

- Frozen pnpm install, build (18 tasks), type-check (20 tasks): passed.
- Unit tests: 3,441 passed across 268 files.
- Docs: strict TypeDoc, VitePress and all 11 public package docs passed.
- CI-pinned aislop 0.12.0: 100/100, zero errors, one existing function-length warning.
- Full Playwright: 134 passed, one existing identity.changed skip (1.4 minutes).
  Used KEHTO_HARNESS_PORT=44333 with the installed managed Chromium on macOS.
  The previously documented external-link popup failure did not reproduce here;
  this is local validation, not proof of the earlier Linux environment.
- Diff checks passed; no unmerged entries; origin/main is an ancestor.

Protocol check: napplet/naps master remains
43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab. Rechecked naps/NAP-IDENTITY.md
before edits. Preserved identity.getRelays and permitted empty unsupported
results; this resolution remains conformant with that contract. The existing
identity.changed frame-reinitialization gap remains documented and skipped.

Logs: /tmp/kehto-pr433-{install,build,types,unit,docs,e2e}.log and
/tmp/kehto-pr433-quality.json. Primary-checkout package.json and untracked
packages/shell/skills/ were left untouched. Push this branch to update the
existing PR; no merge into main or release is part of this task.
