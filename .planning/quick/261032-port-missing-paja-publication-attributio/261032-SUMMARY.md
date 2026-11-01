# Quick 261032 — Paja publication fixes

## Result

Implementation commit: `d02920dd` (`fix(paja): preserve relay publication rejection details`). Worktree `/Users/r/prajects/napplets/web/.worktrees/paja-cvm-fixes`, branch `fix/paja-cvm-fixes`, base `3620a13a` (same as fetched origin/main).

Only missing production behavior was relay rejection diagnostics. Selectively ported `4a4d1803e530432512f558a7c7dee79b22992b4e` into current `browser-relay-runtime.ts`: preserve URL + reason through NAP-RELAY, outbox and direct CVM request errors; keep permission denials distinct; authorized WebRTC/DM publication uses the same detailed failures. Partial-success boolean results are unchanged. No UI or services output changes. Added Paja patch changeset and synchronized README/package docs with deployment caveats.

Old branch assessment:
- **00fb45e6** streaming: skip; main's newer CEP-22/41 implementation remains untouched.
- **14369bb4** scoped outbox router: skip; main's `scopePajaService` already supplies a per-window `createOutboxRouter` through a lifecycle-bound `createPajaWindowScope` backend.
- **bc8fecd9** remembered publication consent: skip; main's #357 (`d49b1bf9`) has newer signerContext/action-separated, version-specific approval.
- **5e0749a3** CVM publish hooks/source registry: skip; main scopes the complete CVM service + transport per endpoint, including pool publication, initialization and stream control. Adding sourceWindowId/publishEvent/registerPublishSource would duplicate or weaken this architecture.
- **4a4d1803** errors: port diagnostics only, not stale consent-copy/UI guards.

The initial superficial assessment (absence of those exact old API names) was wrong; actual scoped callers and adapter regression tests prove the intended attribution already exists. Bundle verification therefore checks current scope hooks, not obsolete registry names.

## Authority / scope

Before editing, read and verified remote refs using `git ls-remote origin` in the independent local naps repository (read-only):
- master `43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab` has no merged RELAY/OUTBOX/CVM documents.
- NAP-RELAY draft PR #2 `9f30b3505335a52c574ff570576687d6467021ff`, `naps/NAP-RELAY.md`.
- NAP-OUTBOX draft `8865f73d52a4864afee145f28d26520476273927`, `naps/NAP-OUTBOX.md`.
- NAP-CVM draft `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`, `naps/NAP-CVM.md`.

Changed errors conform to existing free-text result error fields; no new wire fields. Existing CVM registry/full-draft gaps remain out of scope. Host attribution remains an implementation detail bound to authenticated endpoints, not untrusted message fields.

## Checks actually run

- `pnpm install --frozen-lockfile`: pass, independent worktree node_modules. esbuild build-script warning did not prevent the subsequent builds.
- `pnpm exec vitest run packages/paja/src/browser-relay-runtime.test.ts`: reproduced regression first (30 pass, one failure: generic `publish failed` instead of URL/reasons), then passed after patch.
- `pnpm exec vitest run packages/paja/src/browser-publish.test.ts packages/paja/src/browser-relay-runtime.test.ts`: **37 tests pass**, including real adapter interleaving, forged source claims, outbox scope retirement/reload, signed encrypted per-window CVM handshakes, correlated stream pongs, endpoint cleanup, direct CVM/outbox errors, permission denial and partial success. An initial test ping without CEP-41 start failed correctly; fixed the test to follow the protocol state machine, not production.
- `pnpm build`: **32 tasks pass**. Existing wm output-cache warning only.
- `pnpm type-check`: **17 tasks pass**, after correcting a test envelope typing error caught by first run.
- `pnpm test:unit`: **2,515 tests / 193 files pass**.
- `pnpm docs:check`: pass, rerun after final docs edit; nine public package docs audited. Existing large-chunk warning only.
- `pnpm test:e2e tests/e2e/paja-version-consent.spec.ts tests/e2e/paja-llm.spec.ts tests/e2e/paja-runtime-pointer.spec.ts tests/e2e/paja-single-window.spec.ts`: **34 Chromium tests pass**. Initial run could not launch the missing browser; `pnpm exec playwright install chromium` installed matching Chromium and unchanged rerun passed.
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main`: **100/100**, no changed-production-file issues. Full `pnpm dlx aislop@0.12.0 scan`: exits 0, **95/100**, five pre-existing size warnings in unchanged browser-host.ts, browser-intent-builder.ts, intent-uri.ts and cvm-nostr-transport.ts. Verified those four files byte-identical to origin/main; no suppressions or unrelated cleanup added.
- `git diff --check`: pass.

## Built artifact

Ran after build:

```sh
PAJA_RELAY_URLS=wss://relay.contextvm.org,wss://relay2.contextvm.org \
PAJA_UPLOAD_SERVERS=https://blossom.primal.net,https://blossom.band \
PAJA_PAGES_OUT_DIR=.pages/paja-kipina2 node scripts/build-paja-pages.mjs
```

Python assertions on `.pages/paja-kipina2/__kehto/config.json` passed: both relays in live mode; both upload servers in blossom mode with discoverServers true. Inspected bundle counts: installPajaLlm **4**, scopePajaService **6**, createPajaWindowScope **3**, scopePajaRelayBackend **2**, detailed error prefix **1**. Build output is ignored, not committed. `.worktrees/` added to .gitignore by explicit task direction; primary and kipina2 checkouts untouched.

Preview from worktree:

```sh
PAGES_PREVIEW_PATH=/web/paja-kipina2/ node scripts/serve-pages.mjs
# http://127.0.0.1:4175/web/paja-kipina2/ (or next free port printed)
```

## Residual / not covered

- No public relay connection, muxll server change, public Blossom auth/CORS/live upload, kipina2 republish or deployment performed. Browser tests use controlled relays/servers. muxll must share a configured relay, and signed manifest blob hints must point at reachable republished blobs.
- Existing CVM initialization wrapper still collapses handshake failures to `initialization failed`; direct CVM request publish failures now retain relay detail. No service transport rewrite included.
- Existing outbox required-inbox partial-fanout failures still use router-level generic errors; this port preserves diagnostics on total relay rejection, like the source commit.
- Relevant browser suites rendered successfully. Inspected their generated `/tmp/paja-version-consent-modal.png`: version consent and signer/source details visible, no obvious clipping at 1280x900. No UI changes; no comprehensive visual or accessibility audit claimed. The public-endpoint artifact itself is not visually checked against real external services.
- Entire Playwright suite not run; focused Paja suites cover LLM, Events/read wiring, version consent, runtime pointers and single-window behavior.
