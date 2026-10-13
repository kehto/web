# Package Surfaces

## Runtime Packages

If no package exposes the named interface or wire format you need, do not add a
new private message domain in this app. Read `docs/new-nap-proposals.md` and
propose protocol-level work in `https://github.com/napplet/naps` only when the
guardrails are met.

### `@napplet/shim`

Runtime-side injected global installer. Napplet application code does not import
this package. Runtime implementers use it to install selected
`window.napplet.<domain>` objects before napplet scripts run; app authors should
consult runtime package documentation rather than copying installer code here.

### `@napplet/sdk`

Named helpers for napplet app code.

```ts
import { outbox, storage, identity, config, resource } from '@napplet/sdk';
```

Use this for app calls. It wraps runtime-injected domains at call time and
re-exports types and constants. Current package domains are `relay`, `identity`,
`storage`, `inc`, `theme`, `keys`, `media`, `notify`, `config`, `resource`,
`cvm`, `outbox`, `upload`, `intent`, `ble`, `webrtc`, `link`, `count`, `lists`,
`serial`, `common`, and `dm`. Prefer OUTBOX or a higher-level social domain for
normal Nostr work; RELAY is the low-level relay-local escape hatch.

### `@napplet/nap`

Domain-specific subpaths. Use these when you need granular imports.

```ts
import { relaySubscribe } from '@napplet/nap/relay/sdk';
import type { ResourceBytesMessage } from '@napplet/nap/resource/types';
```

Do not import from the `@napplet/nap` root. Import a domain subpath.

## Build Package

### `@napplet/vite-plugin`

Vite plugin for single-file builds and a local napplet manifest/hash workflow.

```ts
import { nip5aManifest } from '@napplet/vite-plugin';
```

Set `artifactMode: 'single-file'` for the NIP-5D artifact shape. The plugin produces a single-file artifact hash and can write a local signed manifest when `VITE_DEV_PRIVKEY_HEX` is set. Current NIP-5D uses one direct artifact hash with R/O domain declarations. Declare only hard domains through the explicit `requires` option
and keep inference disabled for optional features. Config-schema metadata is
private package plumbing until a living protocol document defines that encoding.

Production relay publishing is intentionally outside this boilerplate.

## Controller tester exception

GAMEPAD is implemented by Kehto PR 297. Its SDK wrapper and packaged types are pending in napplet/web PR 242. This demo calls the canonical injected API directly, using local structural types pinned to naps PR 108 at 0b28f77e3dfa0f07dd7c0f9d61a7090ee99f3a5e. No app-owned wire transport or native reader is added. Migrate to the SDK wrapper once published.
