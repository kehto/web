# Troubleshooting and Tips

These notes collect failure modes surfaced during previous Kehto milestones. They are current docs guidance only where they match the shipped runtime behavior.

## Stale package resolution

**Symptom:** Source changes do not appear in the playground.

**Check:** Inspect package manifests and lockfile resolution. The playground should consume the intended local workspace packages when testing repo-local protocol behavior.

**Fix:** Reinstall and rebuild from the monorepo root. Do not trust a passing browser session until the package graph points at the code you changed.

## Missing built napplet artifacts

**Symptom:** The playground shell cannot load a napplet through `/napplet-gateway/...`.

**Check:** Verify `apps/playground/napplets/<name>/dist/index.html` and `dist/.nip5a-manifest.json` exist.

**Fix:**

```bash
pnpm --filter "./apps/playground/napplets/*" build
pnpm audit:gateway-artifacts
```

## Sandbox policy drift

**Symptom:** A napplet relies on same-origin storage or direct browser APIs.

**Check:** Iframes should remain `allow-scripts` only. Do not add `allow-same-origin` to make a failing demo pass.

**Fix:** Route storage, relay, identity, signing, and resource access through NUB helpers and shell services.

## Raw envelope exceptions

**Symptom:** A demo sends an envelope that is not represented by a helper.

**Check:** Look for the raw-envelope allowlist in tests and phase docs. Unclassified raw envelopes should fail static checks.

**Fix:** Prefer NUB helpers. If a raw envelope is truly test/demo-only, document the exception and guard it.

## Pending decrypt fixtures

**Symptom:** `decrypt-demo` remains in `waiting for fixtures` and rows stay `[pending]`.

**Check:** The captured backlog context lives at `.planning/backlog/999.1-fix-decrypt-demo-fixture-pending/999.1-CONTEXT.md`.

**Fix:** Treat it as a separate bug-fix phase. Do not mix that runtime repair into docs-only work.

## VitePress custom blocks

Build the docs site to validate VitePress syntax. Do not rely on generic Markdown formatters to preserve custom containers or theme-specific syntax.
