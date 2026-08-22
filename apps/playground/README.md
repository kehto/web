# @kehto/demo

Visualization of the current napplet protocol draft — a 9-napplet browser demo
that hosts `@kehto/runtime` + `@kehto/shell` and exercises Kehto's supported
NIP-5D NAP surfaces end-to-end. It is both the Playwright test harness target
(`:4174` preview build) and an integration showcase. It is not the reference
runtime and does not define Kehto-wide runtime policy; Paja is the reference
developer runtime.

> **Alpha status:** NIP-5D is still under development, and NAP contracts are not
> final. The playground demonstrates Kehto's current behavior; it is not proof
> that the protocol or helper APIs are stable.

## Run

```bash
pnpm install                          # monorepo root — resolves workspace dependencies
pnpm --filter "./apps/playground/napplets/*" build
pnpm --filter @kehto/playground dev         # vite dev on http://localhost:5173
# or, matching the Playwright baseURL exactly (production build):
pnpm --filter @kehto/playground preview     # vite preview on http://localhost:4174
```

The `preview` command serves the production build against which the Playwright E2E suite runs (`pnpm test:e2e` from the monorepo root). Use `dev` for interactive shell development; use `preview` to reproduce Playwright failures locally. Both modes expect the demo napplet `dist/` folders to exist because the shell now loads gateway artifacts from `apps/playground/napplets/<name>/dist/`.

## Gateway Artifact Loading

The active playground boot path is production-equivalent:

1. Each demo napplet uses `apps/playground/napplets/shared-vite-config.ts`.
2. The shared config lets `@napplet/vite-plugin` validate and sign the normal external-asset graph, then Kehto's post-build plugin rewrites the final gateway artifact to a single HTML file and recomputes the manifest.
3. Each napplet build emits exactly `dist/index.html` plus `dist/.nip5a-manifest.json`.
4. The shell resolves the manifest, verifies the signed content-addressed bytes, binds the iframe origin to the computed `(dTag, aggregateHash)`, and writes the verified HTML through `iframe.srcdoc`.
5. Before authored scripts run, the shell prepends Kehto's local Class-1 CSP and a host-owned NIP-5D prelude outside the signed artifact bytes. The policy denies all defaults, permits inline script/style and WebAssembly compilation through the narrow `'wasm-unsafe-eval'` source while keeping JavaScript string evaluation blocked, permits `data:`/`blob:` images and `data:` fonts, and limits `connect-src` to caller-granted origins. It explicitly denies worker, child, frame, media, object, manifest, prefetch, base, and form capabilities, then ends with `frame-ancestors 'self'`. It always installs mandatory `window.napplet.shell`, then filters optional domains to the verified manifest allowlist. The published `@napplet/shim@0.29.2` is non-shell, so this Kehto prelude remains the required receiver before one bare `shell.ready`, the first `shell.init` cache, and local `ready()`, `supports()`, read-only `services`, and one-shot `onReady()` behavior. `shell.ready` establishes the runtime session.
6. The iframe sandbox remains opaque-origin: `allow-scripts` only, no `allow-same-origin`.

The gateway route may still serve manifest/blob data as a local accelerator or debugging surface, but it is not the identity authority. New tests and docs should treat verified `srcdoc` loading plus `(dTag, aggregateHash)` provenance as the canonical playground boot path.

NIP-5D defines the verified `srcdoc` and opaque `allow-scripts` sandbox contract; it does not define this CSP baseline. The Class-1 policy is therefore a Kehto security-policy decision, not a protocol requirement.

## Napplet Inventory

The playground hosts 9 sandboxed napplets, each built independently under `apps/playground/napplets/<name>/` and loaded into a topology-rendered iframe at runtime. Some incomplete demo source folders are retained for later iteration, but they are not part of `DEMO_NAPPLETS` and are not loaded in the playground.

The cross-napplet domain is `inc` (the NAP rename of the legacy `inc`). The
napplets that declare `requires` with `inc` preflight injected
`window.napplet.inc` availability; the runtime dual-routes `inc`+`inc` for the
back-compat window, so legacy `inc.*` envelopes still reach the same handler
(removal tracked as CLEANUP-01).

| Napplet | Domain(s) | NAP methods exercised | File path |
|---------|-----------|------------------------|-----------|
| bot | inc, storage | `inc.emit`, `inc.subscribe`, `storage.get` | [apps/playground/napplets/bot/src/](./napplets/bot/src/) |
| chat | inc, storage, relay | `inc.emit`, `inc.subscribe`, `storage.get`, `storage.set`, `relay.publish` | [apps/playground/napplets/chat/src/](./napplets/chat/src/) |
| composer | relay | `relay.publish`, `relay.publishEncrypted` | [apps/playground/napplets/composer/src/](./napplets/composer/src/) |
| cvm-relatr | cvm | `cvm.discover`, `cvm.request` (`tools/call` calculate_trust_score) against the Relatr ContextVM server | [apps/playground/napplets/cvm-relatr/src/](./napplets/cvm-relatr/src/) |
| feed | identity, relay, resource, intent, theme | `identity.getPublicKey`, `relay.subscribe`, `resource.bytes`, structured `intent.invoke` (`profile` / `open` / `napplet:profile/open`) | [apps/playground/napplets/feed/src/](./napplets/feed/src/) |
| preferences | storage, theme | `storage.set`, `storage.get`, `theme.changed` allowlisted listener | [apps/playground/napplets/preferences/src/](./napplets/preferences/src/) |
| profile-viewer | inc, relay, resource, theme | `inc.on` (`napplet:profile/open`), `relay.subscribe`, `resource.bytes` | [apps/playground/napplets/profile-viewer/src/](./napplets/profile-viewer/src/) |
| resource-demo | resource, theme | `resource.bytesMany`, host grant/CSP visualization | [apps/playground/napplets/resource-demo/src/](./napplets/resource-demo/src/) |
| toaster | notify | `notify.create`, `notify.list`, `notify.dismiss` | [apps/playground/napplets/toaster/src/](./napplets/toaster/src/) |

Retained but disabled source folders:

- [ble-demo](./napplets/ble-demo/src/)
- [common-demo](./napplets/common-demo/src/)
- [link-demo](./napplets/link-demo/src/)
- [lists-demo](./napplets/lists-demo/src/)
- [serial-demo](./napplets/serial-demo/src/)
- [webrtc-demo](./napplets/webrtc-demo/src/)

Each napplet is an independent build target with its own `package.json`, `vite.config.ts`, and `index.html`. The topology view (`apps/playground/src/topology.ts`) renders one frame container per `DEMO_NAPPLETS` entry from `apps/playground/src/shell-host.ts` — adding a new napplet requires editing only that array, no per-napplet template duplication.

## Service Topology

The demo renders service nodes reflecting the NIP-5D service surface the runtime exposes to napplets:

- **identity** — read-only identity lookups backed by the shell's signer adapter (`getPublicKey`, `getRelays`, `getProfile`).
- **keys** — real document-level chord listener (v1.4 Phase 26, `KEYS-01..03`).
- **link** — host-owned external navigation service surface.
- **media** — real `navigator.mediaSession` mirror (v1.4 Phase 27, `MEDIA-01..03`).
- **notify** — notification service for direct `notify.*` envelopes.
- **relay** — shell-signed `nostr-tools` relay publishing plus subscriptions;
  publish replies carry the canonical signed event result.
- **signer** — shell-side signing proxy; napplet-invisible per NIP-5D (`MUST NOT` expose `window.nostr`).
- **storage** — per-napplet namespaced localStorage proxy.
- **theme** — ThemeService-backed `theme.get` plus automatic
  recipient-authorized `theme.changed` delivery.

`STUB_ONLY_SERVICES` is `[]` — the stub-only era ended at Phase 27 close. Both `keys` and `media` ship real reference backends as of v1.4; the services listed above are all backed by real implementations.

## Identity and theme host wiring

The playground follows draft NAP-IDENTITY/NAP-THEME/NAP-SHELL at
`napplet/naps@5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`. Its signer controller
emits one protected `identity.changed` transition for a real connect or sign-out
only; it never turns an identity result into a retry, INC event, intent delivery,
or raw iframe broadcast. `identity.getPublicKey.result` uses `pubkey: ""` for
the disconnected state.

Theme changes take one path: the preferences controller calls
`ThemeService.publishTheme()`, which stores complete state before its sole
ShellBridge callback delivers one automatic change per eligible authenticated
recipient. The playground does not use theme subscribe/unsubscribe messages or
all-origin iframe fan-out. Denied or unavailable theme reads retain Kehto's
fixed non-sensitive complete normal result without `error`; this is the
documented reconciliation of the upstream error-only example, not a mixed
theme/error extension. Published Napplet package adoption remains Phase 105.

## Installed profile handlers and safe profile flow

The playground's verified installed catalog is persistent manifest state, not
the live frame map. Only a resolver-verified install can insert or replace a
record, and only an explicit artifact removal can remove one; closing a frame
does not make its manifest unavailable. Intent availability therefore comes from
exact installed contracts. The host may use a compatible default, present a
chooser for several candidates, or reject ambiguity. An explicit d-tag requires
both an exact installed contract and sender-aware authorization.

The feed invokes a structured profile request with the stable, queryless
`napplet:profile/open` convention and a `{ pubkey }` payload. The host reuses or
starts the verified target, waits for its current registered source and
`shell.ready`, sends one runtime-attested `inc.event` for that convention, and
then returns the final handled target identity. A stale or replaced target is
never used; controller retry and terminal policy remain host-owned.

Profile-viewer registers `inc.on('napplet:profile/open', …)` early. It validates
the delivered `pubkey`,
loads kind-0 metadata, and obtains profile pictures/banners through
`resourceBytes(url)`. The runtime resolves the URL and returns bytes; the napplet
creates a Blob URL from those bytes and revokes it on replacement, stale
completion, image error, profile clear, and `pagehide`. This follows merged
NAP-IDENTITY at `a040914b4bbd3a5cd8a14b0f316a723c968ebfb2` and draft
NAP-RESOURCE at `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`.

Theme is synchronized by reading the current value with `theme.get` and then
receiving one automatic `theme.changed` per eligible frame after a host update;
there is no theme subscribe/unsubscribe or raw iframe broadcast.

### Service and INC routing boundary

The runtime routes a service only by the exact `message.type` domain: for
example, `notify.create` selects the `notify` service. INC is independent of
that service lookup. Its topics are opaque, queryless identities matched only
by exact equality; topic text never selects a service handler. The runtime
attaches the sender to an `inc.event` from the authenticated emitting endpoint,
so host services and napplets must not fabricate INC deliveries. The target
contract is merged
[`naps/NAP-INC.md`](https://github.com/napplet/naps/blob/5ac0490461ca6fec2f0d2e45b4835cf9bc08de24/naps/NAP-INC.md)
on `napplet/naps` master
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`. Released
`@napplet/nap@0.31.2` and merged NAP-INC both deliver one `IncEvent`.

## ACL Surface

Every napplet request that touches a capability-gated service passes through the runtime's ACL check:

```ts
relay.runtime.aclState.check(pubkey, dTag, aggregateHash, capability)
```

Capabilities are per-napplet (keyed on the tuple `(pubkey, dTag, aggregateHash)`) and grant-by-default is OFF — requests fail closed if no explicit grant exists. The demo exposes ACL grant / revoke controls via the topology UI's ACL panel; the Playwright E2E suite exercises the same grant flow via `tests/e2e/helpers/acl-beforeEach.ts` (harness target :4173).

Capability list (active in v1.4):

- `identity:read` — identity.* reads
- `relay:read` / `relay:write` — REQ / EVENT pass-through
- `state:read` / `state:write` — shell:state-get / shell:state-set
- `storage:read` / `storage:write` — per-napplet localStorage
- `notify:send` / `notify:channel` — notify.* NAP
- `theme:read` — theme.get + theme.changed
- `cache:read` / `cache:write` — offline event cache
- `keys:forward` — keys.action push delivery (KEYS-03)
- `media:control` — media.* NAP control surface (MEDIA-03)

Default ACL state on demo boot: all capabilities ungranted. The demo UI + Playwright specs grant capabilities explicitly per test scenario.

## Host Hooks

A demo napplet that needs E2E capability setup without UI click-through can install a scoped `window.__grant<Capability>__()` hook during `bootShell()`: look up the target napplet's windowId from the napplets Map, confirm the napplet is identity-bound, then call `relay.runtime.aclState.grant(pubkey, dTag, hash, cap)`. The Playwright spec then invokes the hook after gating on the napplet's status sentinel.

## License

MIT
