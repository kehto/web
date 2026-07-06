---
quick_id: 260706-siz
status: complete
created: 2026-07-06
---

# Quick Task 260706-siz: Fix Paja --target-url NIP-5D Injection

## Goal

Make Paja `--target-url` mode boot current napplets that synchronously require runtime-injected `window.napplet.<domain>` objects before app bootstrap.

## Tasks

1. Add regression coverage for URL-mode pre-bootstrap namespace injection.
   - Update the Paja e2e fixture so it fails if `window.napplet.identity`, `outbox`, `resource`, or `keys` are missing before the fixture sends `shell.ready`.
   - Add focused source guards for Paja's external-target and runtime-pointer injection path.

2. Implement a shared Paja render path for injected target documents.
   - Fetch target HTML through the Paja host server to avoid browser CORS blocking local previews.
   - Convert external targets to sandboxed `srcdoc` with a `<base>` pointing at the target URL and `injectNappletNamespacePrelude(...)` before authored scripts.
   - Apply the same namespace prelude to runtime-pointer `srcdoc` output.
   - Preserve reload, simulation toggles, and current postMessage registration behavior.

3. Ship release metadata and verification.
   - Add changesets for packages whose published behavior must move.
   - Run focused Paja unit/e2e checks, then repo gates as risk requires.
   - Update the quick-task summary and state.
