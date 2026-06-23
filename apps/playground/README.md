# @kehto/demo

Reference consumer of the current napplet protocol draft — a 13-napplet browser demo that hosts `@kehto/runtime` + `@kehto/shell` and exercises Kehto's supported NIP-5D NAP surfaces end-to-end. Acts as both the Playwright test harness target (`:4174` preview build) and the showcase for external integrators evaluating Kehto as an early runtime implementation.

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
4. The shell fetches `/napplet-gateway/<dTag>/manifest.json`, registers the session with the manifest-derived `(dTag, aggregateHash)`, then navigates the iframe to `/napplet-gateway/<dTag>/<aggregateHash>/index.html`.
5. The iframe sandbox remains opaque-origin: `allow-scripts` only, no `allow-same-origin`.

The legacy `/napplets/<name>/...` static route may still exist for compatibility/debugging, but it is not the canonical active load path. New tests and docs should treat `/napplet-gateway/...` as the only valid playground boot path.

## Napplet Inventory

The demo hosts 14 sandboxed napplets, each built independently under `apps/playground/napplets/<name>/` and loaded into a topology-rendered iframe at runtime. v1.3 shipped an 8-napplet demo; later milestones added resource, link, common, lists, serial, BLE, and CVM demos.

The cross-napplet domain is `inc` (the NAP rename of the legacy `inc`). The four
napplets below declare `requires` / call `supports()` with `inc`; the runtime
dual-routes `inc`+`inc` for the back-compat window, so legacy `inc.*` envelopes
still reach the same handler (removal tracked as CLEANUP-01).

| Napplet | Domain(s) | NAP methods exercised | File path |
|---------|-----------|------------------------|-----------|
| ble-demo | ble | `ble.open`, `ble.services`, `ble.read`, `ble.write`, `ble.subscribe`, `ble.unsubscribe`, `ble.close` | [apps/playground/napplets/ble-demo/src/](./napplets/ble-demo/src/) |
| bot | inc, storage | `inc.emit`, `inc.subscribe`, `storage.get` | [apps/playground/napplets/bot/src/](./napplets/bot/src/) |
| chat | inc, storage, relay | `inc.emit`, `inc.subscribe`, `storage.get`, `storage.set`, `relay.publish` | [apps/playground/napplets/chat/src/](./napplets/chat/src/) |
| common-demo | common | `common.encodeNip19`, `common.decodeNip19`, `common.getProfile`, social action helpers | [apps/playground/napplets/common-demo/src/](./napplets/common-demo/src/) |
| composer | relay | `relay.publish`, `relay.publishEncrypted` | [apps/playground/napplets/composer/src/](./napplets/composer/src/) |
| cvm-relatr | cvm | `cvm.discover`, `cvm.request` (`tools/call` calculate_trust_score) against the Relatr ContextVM server | [apps/playground/napplets/cvm-relatr/src/](./napplets/cvm-relatr/src/) |
| feed | identity, relay, inc | `identity.getPublicKey`, `relay.subscribe`, `inc.emit` (`profile:open`) | [apps/playground/napplets/feed/src/](./napplets/feed/src/) |
| link-demo | link | `link.open` allowed and denied navigation paths | [apps/playground/napplets/link-demo/src/](./napplets/link-demo/src/) |
| lists-demo | lists | `lists.supported`, `lists.add`, `lists.remove` | [apps/playground/napplets/lists-demo/src/](./napplets/lists-demo/src/) |
| preferences | storage, theme | `storage.set`, `storage.get`, `theme.changed` allowlisted listener | [apps/playground/napplets/preferences/src/](./napplets/preferences/src/) |
| profile-viewer | inc, relay | `inc.subscribe` (`profile:open`), `relay.subscribe` | [apps/playground/napplets/profile-viewer/src/](./napplets/profile-viewer/src/) |
| serial-demo | serial | `serial.open`, `serial.write`, `serial.close` | [apps/playground/napplets/serial-demo/src/](./napplets/serial-demo/src/) |
| resource-demo | resource, connect | `resource.bytesMany`, connect grant/CSP fixture | [apps/playground/napplets/resource-demo/src/](./napplets/resource-demo/src/) |
| theme-switcher | identity, relay, theme | discovers user/WoT/global theme events through NAP relay; `theme.set` shell theme request | [apps/playground/napplets/theme-switcher/src/](./napplets/theme-switcher/src/) |
| toaster | notify | `notify.create`, `notify.list`, `notify.dismiss` | [apps/playground/napplets/toaster/src/](./napplets/toaster/src/) |

Each napplet is an independent build target with its own `package.json`, `vite.config.ts`, and `index.html`. The topology view (`apps/playground/src/topology.ts`) renders one frame container per `DEMO_NAPPLETS` entry from `apps/playground/src/shell-host.ts` — adding a new napplet requires editing only that array, no per-napplet template duplication.

## Service Topology

The demo renders 8 service nodes reflecting the NIP-5D service surface the runtime exposes to napplets:

- **identity** — read-only identity lookups backed by the shell's signer adapter (`getPublicKey`, `getRelays`, `getProfile`).
- **keys** — real document-level chord listener (v1.4 Phase 26, `KEYS-01..03`).
- **media** — real `navigator.mediaSession` mirror (v1.4 Phase 27, `MEDIA-01..03`).
- **notifications** — notification service (both canonical `notify.*` NAP and legacy inc-emit `notifications:*` channel).
- **relay** — `nostr-tools` SimplePool relay pool service (`relay.publish`, `relay.subscribe`, etc).
- **signer** — shell-side signing proxy; napplet-invisible per NIP-5D (`MUST NOT` expose `window.nostr`).
- **storage** — per-napplet namespaced localStorage proxy.
- **theme** — theme publisher (`theme.get` + `theme.changed` fan-out).

`STUB_ONLY_SERVICES` is `[]` — the stub-only era ended at Phase 27 close. Both `keys` and `media` ship real reference backends as of v1.4; the 8 services listed above are all backed by real implementations.

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
