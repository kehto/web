# @kehto/playground

Browser playground that hosts 9 demo napplets and demonstrates Kehto integration behavior.

> **Alpha status:** The playground shows Kehto's current behavior for the draft
> NIP-5D protocol. It is not a stability guarantee for NAP contracts or helper APIs.

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
| Version | `0.1.6` |
| Private | `true` |
| Scripts | `dev`, `build`, `preview` |

## Dependencies

| Package | Role |
|---------|------|
| `@kehto/runtime` | Runtime engine under test. |
| `@kehto/shell` | Browser shell bridge. |
| `@kehto/services` | Reference services. |
| `@kehto/nip` | Unique Nostr NIP utilities, including NIP-5D artifact resolution and optional cache reuse. |
| `nostr-tools`, `leader-line`, `qrcode` | Playground-only integration/display dependencies. |

## Primary Surfaces

| Area | Surface |
|------|---------|
| Gateway loading | `/napplet-gateway/<dTag>/<aggregateHash>/index.html` |
| Demo source | `apps/playground/src/` |
| Napplet source | `apps/playground/napplets/<name>/` |
| Verification | Playwright E2E target served by `preview` on port `4174` |

## Verified catalog and intent delivery

The playground maintains a persistent catalog of resolver-verified manifests
separately from its live frames and controllers. Install or replacement after
verification is the only way to add or update catalog facts; explicit artifact
removal is the only way to remove them. Frame close/reload never deletes an
installed handler, so availability can select an installed cold target.

Selection uses exact compatible installed conventions, not frame presence. A
compatible default can resolve a request, a chooser can resolve several
candidates, and ambiguity without a choice is rejected. An explicit handler
d-tag also requires sender-aware authorization. The host starts or reuses the
selected target and waits for that generation's registered source to complete
real `shell.ready`; only a current target receives one `inc.event` for the
selected convention. The final result identifies the handled target. Replacement,
retry, and terminal behavior remain controller policy.

The feed opens profiles with a structured request whose payload contains the
pubkey and whose metadata advertises the queryless `napplet:profile/open`
convention. Profile-viewer registers
`inc.on('napplet:profile/open', …)` before capability waiting. It reads profile
picture/banner bytes with
`resourceBytes`, creates Blob URLs, and revokes URLs for stale completion,
replacement, error, clear, and `pagehide`—never direct remote image URLs.

`theme.get` supplies the current complete state and each eligible frame receives
one automatic synchronized `theme.changed` after an update. There is no
subscribe/unsubscribe protocol. The mandatory shell is likewise host-owned:
`@napplet/shim@0.29.2` does not provide `window.napplet.shell`; Kehto's prelude
installs it before one bare ready/init handshake.

Resource demo behavior targets draft NAP-RESOURCE at exact ref
`fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1` together with Kehto's resource
hardening policy. The playground does not define new wire semantics or NAP-DM
behavior.

## Scope Boundaries

- Demonstrates and verifies Kehto integration behavior.
- Is not a published package.
- Does not define new protocol behavior; protocol truth belongs in source packages and policy docs.

## API Reference

The playground is private and does not generate package API reference. Use its README and E2E specs as integration evidence.
