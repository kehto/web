---
status: complete
---
# Adopt the published NIP-5D writer line

Implemented in 0a08e1a4 on feat/nip5d-presentation-media (PR #359), following 261030-c0z.

## Result

Every playground, demo napplet and fixture build now pins the published `@napplet/vite-plugin@0.16.2`, the writer released for the NIP-5D presentation media and source pin amendment (napplet/web Version Packages #273 at `f6839146afda77944d12ecdc371630905c9474f6`, source PR #272 `ef915243a2e7724c0cbeaf8b401116afa239d201`). The lockfile carries only the 0.16.2 snapshot; the package matrix guards (`napplet-package-alignment`, `sdk-migration-guard`, `published-napplet-contract`) moved with it and 0.15.0 joined the superseded matrix. A new contract test imports the installed writer's `resolvePresentationMedia`, feeds its `screenshot`/`preview` tags plus `source`, `source-commit` and `source-archive` through the playground `recomputeManifest` final-byte signing, verifies the event and proves `@kehto/nip/5d` parses the same values back.

The 0.16.2 writer embeds publishing metadata in the artifact head and builds self-contained fixtures; the playground single-file plugin and gateway contract tests pass unchanged on it. Registry check at the end of the task: npm and JSR `latest` are vite-plugin 0.16.2 and conformance 0.20.5; core/nap 0.34.0, shim 0.32.0 and SDK 0.30.0 date from 2026-10-14 and are the NAP-GAMEPAD/NAP-INTENT package line, not part of this NIP-5D chase, so Kehto's exact runtime matrix (core/nap 0.32.0, shim 0.30.0, SDK 0.28.0) is unchanged here.

## Authority

NIP-5D PR #2303 at dskvr/nips@6e24617cde507c0a87fa170af9ed6b2b46545b2d, unchanged since 261030-c0z. Conformant; no new spec-gap decision.

## Verification

- Focused: published-napplet-contract, napplet-package-alignment, sdk-migration-guard, playground-gateway-guard, nip5d-conformance-guard, playground-relay-service: 81 tests passed.
- pnpm build: 32 tasks passed (21 napplet/fixture builds rebuilt on 0.16.2).
- pnpm type-check: passed.
- pnpm test:unit --maxWorkers=4: 185 files, 2,383 tests passed.
- pnpm docs:check: passed.
- pnpm test:e2e: 159 passed.
- aislop@0.12.0 scan --changes --base origin/main: 100/100, no diagnostics. git diff --check clean.

No `@kehto/*` shipped output changed, so no additional changeset.
