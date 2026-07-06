---
status: complete
completed: 2026-07-06
branch: fix/paja-target-url-injection
---

# Quick Task 260706-siz Summary

Fixed Paja `--target-url` mode so local preview URLs are fetched by the Paja host,
converted to sandboxed `srcdoc`, and boot with the same injected
`window.napplet.<domain>` namespace as runtime-pointer targets before authored
scripts run.

## Changes

- Added `/__kehto/target.html` to proxy the current target URL HTML through the
  Paja host server.
- Changed external-target and runtime-pointer rendering to inject the NIP-5D
  namespace prelude before assigning iframe `srcdoc`.
- Added a `<base>` element for proxied target HTML so local preview assets resolve
  against the original dev server URL.
- Marked Paja ready when modern injected-domain targets send valid NAP messages
  without the legacy `shell.ready` bootstrap.
- Added Paja unit/source guards and Playwright coverage for both legacy
  `shell.ready` targets and modern injected-domain targets.
- Added patch changesets for `@kehto/paja` and `@kehto/cli`; `@kehto/cli` owns
  the published runnable `kehto paja` entrypoint.

## Verification

- Red check before the fix: focused Paja Playwright failed with the target showing
  `Required shell domains unavailable`.
- `pnpm type-check` (includes full `pnpm build`)
- `pnpm test:unit` — 101 files, 1295 tests
- `pnpm docs:check`
- `pnpm exec playwright test tests/e2e/paja-single-window.spec.ts --workers=1` —
  4 passed
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main` — clean 100/100
- `git diff --check`
- Manual GB Color smoke with fixed local Paja on port 5198: iframe was
  `about:srcdoc`, Paja reached `ready`, `window.napplet.identity/outbox/resource/keys`
  were present in the target frame, and the later target error was a separate
  ROM `resource.bytes` network fetch failure.

## Notes

Full local `pnpm test:e2e` was not a valid final gate in this workspace because
the user-owned GB Color preview is already listening on the hardcoded harness
port 4173 and Paja is listening on 5197. Those processes were left untouched.
