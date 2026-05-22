# Phase 55: Guards, Policy Docs, and Full Verification - Context

## Scope

Lock the v1.11 gateway artifact invariant so the playground cannot drift back to a local external-asset shortcut without tests or audits failing.

## Requirements Covered

- GATEWAY-04
- POLICY-01
- GUARD-01
- E2E-33
- E2E-34
- DOCS-10

## Required Proof

- Static guard rejects `allow-same-origin` on active napplet iframes.
- Static guard rejects active playground loading through `/napplets/...`.
- Build-output audit rejects external executable/style/preload assets in built napplet HTML and rejects extra files in napplet `dist/`.
- Playwright proves all 13 demo napplets boot through `/napplet-gateway/<dTag>/<aggregateHash>/index.html`.
- Docs describe the single-file gateway artifact as canonical for the playground.
- Full `pnpm build`, `pnpm type-check`, `pnpm test:unit`, and `pnpm test:e2e` pass.

