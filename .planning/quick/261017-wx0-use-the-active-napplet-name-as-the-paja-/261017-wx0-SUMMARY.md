---
status: complete
---
# Active napplet page title

The shared runtime-tab renderer now assigns the active tab display name to document.title. Opening, switching and closing tabs keep the browser title synchronized; no active tab restores @kehto/paja. Existing verified manifest and local-file naming are reused. Host presentation only; no NAP wire, API, loader, metadata or sandbox-contract changes.

Commit: bcc0ea60. Paja patch changeset and three package/user docs updated.

Validation:
- pnpm build: passed (32 tasks).
- pnpm type-check: passed (17 tasks).
- pnpm test:unit: 176 files and 2,233 tests passed.
- pnpm docs:check: passed after build artifacts were available.
- Full Chromium suite: 128 passed initially; one signer-consent fixture timed out and its serial group skipped three subsequent cases. Reran the complete paja-single-window file: all 18 passed, including the timed-out case and the three skipped tests. All 132 unique browser cases therefore passed across these runs.
- Title assertions passed for a verified pointer, local file loading, switching tabs, closing the active tab with a remaining sibling, closing the last tab and reloading an empty host.
- aislop@0.12.0: passing 95/100 with five pre-existing size warnings, no new diagnostics or configuration changes.
- git diff --check: passed.

Browser runs used normal test selection and Chromium settings with separately started worktree IPv6 previews. A temporary config disabled automatic servers to avoid an unrelated process on IPv4 port 4173. Temporary config removed after testing.
