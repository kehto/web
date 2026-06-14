# @kehto/playground

Browser playground that hosts 13 demo napplets and demonstrates Kehto integration behavior.

> **Alpha status:** The playground shows Kehto's current behavior for the draft
> NIP-5D protocol. It is not a stability guarantee for NUB contracts or helper APIs.

## Run

```bash
pnpm --filter "./apps/playground/napplets/*" build
pnpm --filter @kehto/playground dev
pnpm --filter @kehto/playground preview --port 4174
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `apps/playground/package.json`, `apps/playground/README.md` |
| Version | `0.0.4` |
| Private | `true` |
| Scripts | `dev`, `build`, `preview` |

## Dependencies

| Package | Role |
|---------|------|
| `@kehto/runtime` | Runtime engine under test. |
| `@kehto/shell` | Browser shell bridge. |
| `@kehto/services` | Reference services. |
| `@kehto/nip` | Relay-discovery utility. |
| `nostr-tools`, `leader-line`, `qrcode` | Playground-only integration/display dependencies. |

## Primary Surfaces

| Area | Surface |
|------|---------|
| Gateway loading | `/napplet-gateway/<dTag>/<aggregateHash>/index.html` |
| Demo source | `apps/playground/src/` |
| Napplet source | `apps/playground/napplets/<name>/` |
| Verification | Playwright E2E target served by `preview` on port `4174` |

## Scope Boundaries

- Demonstrates and verifies Kehto integration behavior.
- Is not a published package.
- Does not define new protocol behavior; protocol truth belongs in source packages and policy docs.

## API Reference

The playground is private and does not generate package API reference. Use its README and E2E specs as integration evidence.
