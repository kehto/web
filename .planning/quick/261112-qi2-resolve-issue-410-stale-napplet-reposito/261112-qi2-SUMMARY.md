---
quick_id: 261112-qi2
status: complete
---

# Issue 410: public SDK repository links

Updated README.md and AGENTS.md to link to https://github.com/napplet/web. The public repository resolves; the old sandwichfarm/napplet URL returns 404. Commit: 0b73feb0.

Published @napplet/core@0.41.0 and upstream packages/core/package.json still contain the old repository URL. Filed a standalone upstream report at https://github.com/napplet/web/issues/335 and Kehto tracking issue https://github.com/kehto/web/issues/431. No local dependency workaround. Kehto package repository fields already point to kehto/web. The historical fixed-tarball assertion in tests/unit/published-napplet-contract.test.ts remains accurate for those old releases.

Verification:
- pnpm install --frozen-lockfile: passed.
- pnpm build: passed, 18/18 cached tasks.
- pnpm type-check: passed, 20/20 cached tasks.
- pnpm test:unit: 267 files / 3,414 tests passed.
- pnpm docs:check: passed; 11 public package docs audited.
- pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json: 100/100, zero findings; config unchanged.
- git diff --check: passed.
- Stale-link search: no old URL remains in active README, agent overview, package manifests or docs outside historical changelogs. Historical planning artifacts and pinned published-package evidence are retained.

No runtime behavior changed, so no new tests, browser run or package changeset. NAP/NIP-5D semantics are unchanged; no protocol-spec check applies to this URL correction. SDK source metadata and npm publication remain outstanding under #431. Work executed inline through gsd-quick in the dedicated worktree; unrelated primary-checkout work was preserved.
