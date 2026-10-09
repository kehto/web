---
quick_id: 261007-j7k
slug: paja-load-napplet-from-local-index-html
status: complete
subsystem: paja
tags: [paja, nip-5d, nap-shell, runtime-tabs, dev-ux]
completed: 2026-10-07
key-files:
  created:
    - packages/paja/src/local-target.ts
    - packages/paja/src/local-target.test.ts
    - packages/paja/src/browser-local-loader.ts
    - packages/paja/src/browser-local-loader.test.ts
    - .changeset/paja-local-index-html.md
  modified:
    - packages/paja/src/browser-target-frame.ts
    - packages/paja/src/browser-runtime-tabs.ts
    - packages/paja/src/browser-runtime-tabs.test.ts
    - packages/paja/src/browser-host.ts
    - packages/paja/src/browser-intent-host.ts
    - packages/paja/src/browser-devtools.ts
    - packages/paja/src/host-page.ts
    - packages/paja/src/host-page.test.ts
    - packages/paja/src/index.ts
    - packages/paja/README.md
    - docs/packages/paja.md
    - docs/policies/NIP-5D-CONFORMANCE.md
    - tests/e2e/paja-runtime-pointer.spec.ts
decisions:
  - Local file dTag comes from NIP-5D `<meta name="napplet-id">` (the spec's publishing-metadata name), not `napplet-dtag` as drafted in the plan
  - Local identity = NIP-5A single-path aggregate over the exact file bytes, matching Kehto's current resolver derivation
  - Local tabs are excluded from intent delivery (neither stale-closed nor reused) in addition to never entering the catalog
---

# Quick 261007-j7k: Paja loads a napplet from a local index.html

Paja's runtime-pointer mode can now open a single-file `index.html` from disk, through an "Open file…" picker or by dropping the file on the page. The file opens in a new tab and goes through the same path as verified pointers: identity registered before execution, Class-1 CSP, `window.napplet` prelude, `srcdoc`, and the `allow-scripts` sandbox. Its identity is derived from the file bytes.

## Commits

| Hash | Message |
|------|---------|
| bf60a1d1 | feat(paja): open a napplet from a local index.html |
| beb8b3fc | test(paja): cover local index.html targets, loader, tabs and host page |
| 8638001a | refactor(paja): name the no-op local-file control disposer |
| 5c1eb1f5 | docs(paja): document local index.html loading and its NIP-5D boundary |
| 315ec130 | chore(changeset): minor bump @kehto/paja for local index.html loading |
| 8f13c56b | test(paja): e2e local index.html via picker and drop |

## NAP / NIP-5D spec check

- **NIP-5D:** nostr-protocol/nips PR #2303 (open), head `dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`, file `5D.md`.
- **NAP-SHELL:** `napplet/naps` master `a040914b4bbd3a5cd8a14b0f316a723c968ebfb2`, `naps/NAP-SHELL.md`. It is byte-identical to the policy-recorded `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.
- **Verdict:** conformant on transport, sandbox, injection, and NAP-SHELL. Skipping manifest resolution is an intentional, documented spec-gap decision.
  - Conformant parts:
    - Identity is computed from the file's own bytes and never accepted from the host.
    - The identity is registered against the frame `Window` before any code runs.
    - The file loads only through `srcdoc` with `sandbox="allow-scripts"`.
    - The CSP and the `window.napplet` prelude (mandatory `shell`, unchanged `shell.ready`/`shell.init` handshake) are injected outside the hashed bytes.
  - Spec gap: NIP-5D Identity steps 1-3 (signed manifest, then Blossom fetch and verify) cannot apply to an unsigned local file. Local files are a Paja dev-host affordance outside the resolution path, in the same category as target-URL mode. They never enter the verified catalog and are never intent delivery targets.
  - This is recorded in `docs/policies/NIP-5D-CONFORMANCE.md` ("Paja local development targets") and in the `PajaLocalTarget` source comment.
- **Recorded drift (out of scope, not changed):** the current NIP-5D draft defines the artifact hash as the manifest's single `x` tag over `/index.html`. `@kehto/nip/5d` still verifies NIP-5A `path` tags plus an aggregate `x`. Local targets use the same aggregate derivation as the current resolver, so a local file and its published single-file build share one identity.

## Gates

| Gate | Result |
|------|--------|
| `pnpm build` | pass, 32/32 tasks |
| `pnpm type-check` | pass, 32/32 build + 17/17 type-check tasks |
| `pnpm test:unit` | pass, 152 files / 1820 tests (paja: 39 files / 272 tests) |
| `pnpm docs:check` | pass ("checked 9 public package docs, VitePress routes, TypeDoc targets, and docs gate wiring") |
| aislop (cached 0.16.1 binary) | 100/100. The only warning is pre-existing (`packages/services/src/cvm-nostr-transport.ts` file size) |
| Paja Playwright (`paja-runtime-pointer` + `paja-single-window`) | 15/15 pass, including the new local-file e2e |
| Full Playwright (`npx playwright test`, bundled Chromium) | pass, 87 passed (2.6m) |
| `git diff --check main..HEAD` | clean |

## Deviations from Plan

1. **[Spec check] dTag meta name.** The plan said `<meta name="napplet-dtag">`. NIP-5D's "HTML Metadata for Publishing" table maps the `d` tag to `<meta name="napplet-id">`, so the code uses `napplet-id`.
2. **[Rule 2] Intent delivery excludes local tabs.** `browser-intent-host.ts` no longer closes a local tab as a "stale catalog tab" when its dTag matches an installed handler, and it never reuses a local tab as a verified delivery target. This keeps intents bound to catalog-verified artifacts.
3. **[Rule 1] Snapshot active index.** `snapshotRuntimeTabs` computed `activeIndex` over all tabs while persisting only pointer tabs, which gives a wrong index once a pointer-less local tab exists. It now counts pointer tabs only.
4. **[Rule 2] Single-file limitation surfaced in the UI.** Besides the error status hint, the loader detects relative `src`/`href` asset references and reports them in the status line and the `paja.local.loaded` log entry.
5. **WebCrypto for sha256.** Paja does not depend on `@noble/hashes`, so the file hash uses `crypto.subtle.digest`. `computeAggregateHash` from `@kehto/nip/5a` is reused for the aggregate.
6. **Structure.** The loader and UI wiring live in a new `browser-local-loader.ts` rather than inside `browser-host.ts`, which keeps that file from growing past the 700-line code-quality limit. `browser-host.ts` only adds `state.loadLocalFile` and the runtime-pointer-only `installLocalFileControls` call.
7. **Drop target.** Drag and drop listens on the whole Paja document (stage outline while dragging), not only `#napplet-stage`. This also stops the browser from navigating away when a file is dropped elsewhere on the page. Drops onto a running napplet iframe go to that frame and are not handled, as documented.
8. **Added e2e.** A Playwright test (`paja-runtime-pointer.spec.ts`) replaces the plan's manual check. It drives picker and drop in a real browser, checks the NAP-SHELL handshake and initSent, the tab title, the CSP and sandbox, and that the tab is not restored after a reload.

## Out of scope / noted

- `browser-intent-host.ts` iterates `state.tabs` while `closeRuntimeTab` splices it, so in rare multi-stale cases it can skip one entry. This predates the change and was left alone.
- Opening a folder or zip with asset mapping is a possible follow-up.

## Self-Check: PASSED
