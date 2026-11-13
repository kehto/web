---
quick_id: 261111-b5u
status: complete
date: 2026-11-11
branch: feat/paja-mocked-naps
---

# PR 413 conflict resolution

Merged origin/main at 11ae71c633e45ff09ef381a3527273f9941504b8 into the existing PR branch with merge commit f8d7ccb5. Preserved both planning histories and current package/JSR versions, including mocks 0.1.2. Retained main's adapter-support extraction and the PR's mock lifecycle and readiness assertions.

Paja now supplies its mock tables through BrowserAdmissionRequest.bindings. Shared admission injects only approved domains, so bindings do not bypass Firewall grants. A runtime regression executes the prepared prelude for allowed and denied mock interfaces and verifies the no-ID location.subscribe wire envelope. Existing private-port trust and lifecycle regressions remain green.

The browser probe declares its required interfaces and optional torrent interface and uses the existing session approval driver. The initial full browser run showed undeclared-all-interface fallback exhausting main's prompt-rate budget before reaching mocked domains. Explicit probe declarations exercise admission without changing that policy; disabling optional torrent still reloads the probe with git exposed. All three mock browser tests pass.

Verification:
- pnpm install --frozen-lockfile: passed.
- pnpm build: passed (17 tasks).
- pnpm type-check: passed (19 tasks).
- pnpm test:unit: passed (268 files, 3398 tests).
- pnpm docs:check: passed (strict TypeDoc, VitePress, 10 public package docs).
- pnpm test:e2e: passed (127 Chromium tests, 1 pre-existing skip).
- pnpm --filter @kehto/mocks bindings:check: committed tables are current at their pinned draft refs.
- pnpm dlx aislop@0.12.0 ci --json: passed, 100/100; one existing browser-llm-panel.ts function-length warning.
- node scripts/sync-jsr-versions.mjs: 0 updates; all 10 package doc versions current.
- git diff --check: passed; no unresolved index entries.

Authority checked: NAP-SHELL at napplet/naps@43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab; NIP-5D at nostr-protocol/nips@51ef0cd33a5694784306f3260d90b1872545fdee; NAP-LOCATION draft #125 at 24d2039c. The resolution preserves conformant optional readiness, host-selected domain injection, verified srcdoc, and private-port transport. PR 413's existing documented draft JavaScript API spec gaps are retained, not expanded. Firefox/WebKit were not run.

The primary checkout's unrelated package.json and untracked shell skills were left untouched. No history rewrite or PR merge.
