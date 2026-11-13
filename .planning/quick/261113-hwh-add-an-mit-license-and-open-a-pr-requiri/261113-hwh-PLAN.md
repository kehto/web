---
quick_id: 261113-hwh
status: planned
---

# Add the MIT license

1. Add the standard MIT text to root `LICENSE`, attributed to the Kehto contributors (2026). Link the existing README license entry to it.
2. Verify the license against GitHub's MIT template. Run build, type-check, unit tests, docs, the pinned AI-slop gate, and diff checks.
3. Commit the change and GSD records by explicit path. Open a draft PR tagging every contributor, with individual consent checkboxes and a clear requirement that every human contributor approves before merging.

Contributor inventory: GitHub's paginated contributors endpoint (including anonymous entries), cross-checked with default-branch authors and co-author trailers. Human contributors: dskvr, hzrd149, nrahulpub, jodobear. Automation: github-actions[bot], with copilot-swe-agent[bot] in co-author trailers. Automated identities do not provide licensing consent.

Use an isolated worktree based on `origin/main` at `1c3bdfaa`. Preserve the primary checkout's unrelated package metadata and experimental-NAP skill files. No protocol or runtime behavior changes; no package release is needed. Execute inline under the skill's Codex spawn restriction.
