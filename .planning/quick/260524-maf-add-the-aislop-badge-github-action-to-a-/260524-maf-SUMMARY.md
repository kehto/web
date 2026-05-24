---
status: complete
---

# Quick Task 260524-maf Summary

## Goal

Add the `sandwichfarm/aislop-badge` GitHub Action to calculate the AI slop badge when source code changes on the primary branch.

## Result

- Added `AI Slop Badge` as a dedicated GitHub Actions workflow.
- Scoped automatic runs to `push` events on `main` when source/config paths change.
- Added `workflow_dispatch` for manual recalculation.
- Uses `sandwichfarm/aislop-badge@v1` with `package-runner: pnpm`.
- Writes `.github/badges/aislop-score.json` and commits it only when the workflow runs on `refs/heads/main`.
- Sets `fail-on-error: false` so the badge can reflect an unhealthy score instead of turning badge calculation into a duplicate quality gate.
- Avoids badge commit loops by not including `.github/badges/**` in the trigger paths.

## Upstream Integration

- Upstream action metadata and README were readable via GitHub API.
- The action exposes the needed `package-runner`, `badge-file`, `commit-badge`, `fail-on-error`, and summary inputs.
- No action integration issue was encountered, so no upstream issue was opened.

## Verification

- `pnpm dlx aislop@0.9.3 scan --json .` returned exit code `0`, score `100`, label `Healthy`, with 0 errors, 0 warnings, and 0 fixable issues.
- `.github/workflows/aislop-badge.yml` parses as YAML.
- `npx aislop scan` remains clean at `100 / 100 Healthy`.

## Implementation Commits

- `b5c39f7` — Calculate AI slop score after main source changes
