# @kehto/demo

Reference consumer of the napplet protocol — a 10-napplet browser demo that hosts `@kehto/runtime` + `@kehto/shell` and exercises every public NIP-5D NUB surface end-to-end. Acts as both the Playwright test harness target (`:4174` preview build) and the showcase for external integrators evaluating the protocol.

## Run

```bash
pnpm install                          # monorepo root — resolves workspace dependencies
pnpm --filter @kehto/playground dev         # vite dev on http://localhost:5173
# or, matching the Playwright baseURL exactly (production build):
pnpm --filter @kehto/playground preview     # vite preview on http://localhost:4174
```

The `preview` command serves the production build against which the Playwright E2E suite runs (`pnpm test:e2e` from the monorepo root). Use `dev` for interactive development; use `preview` to reproduce Playwright failures locally. The `@napplet/vite-plugin` emits `aggregateHash=""` in dev mode, so ACL-dependent behavior only works correctly against the preview build.

## Napplet Inventory

The demo hosts 10 sandboxed napplets, each built independently under `apps/playground/napplets/<name>/` and loaded into a topology-rendered iframe at runtime. v1.3 shipped an 8-napplet demo; v1.4 adds `hotkey-chord` (KEYS backend exemplar) and `media-controller` (MEDIA backend exemplar) for a 10-napplet end-to-end showcase.

| Napplet | Domain(s) | NUB methods exercised | File path |
|---------|-----------|------------------------|-----------|
| bot | relay, identity | `relay.publish`, `relay.subscribe`, `identity.getPublicKey` | [apps/playground/napplets/bot/src/](./napplets/bot/src/) |
| chat | relay, identity, ifc | `relay.publish`, `relay.subscribe`, `ifc.emit`, `identity.getPublicKey` | [apps/playground/napplets/chat/src/](./napplets/chat/src/) |
| composer | relay, identity, storage | `relay.publish`, `identity.getPublicKey`, `storage.set`, `storage.get` | [apps/playground/napplets/composer/src/](./napplets/composer/src/) |
| feed | relay, identity | `relay.subscribe`, `identity.getPublicKey` | [apps/playground/napplets/feed/src/](./napplets/feed/src/) |
| hotkey-chord | keys, identity | `keys.registerAction`, `keys.onAction` (receives `keys.action` push) | [apps/playground/napplets/hotkey-chord/src/](./napplets/hotkey-chord/src/) |
| media-controller | media, identity | `mediaCreateSession`, `mediaReportState`, `mediaOnCommand` (receives `media.command` push) | [apps/playground/napplets/media-controller/src/](./napplets/media-controller/src/) |
| preferences | storage, theme, identity | `storage.set`, `storage.get`, `theme.get`, `identity.getPublicKey` | [apps/playground/napplets/preferences/src/](./napplets/preferences/src/) |
| profile-viewer | identity, relay | `identity.getProfile`, `relay.subscribe`, `identity.getPublicKey` | [apps/playground/napplets/profile-viewer/src/](./napplets/profile-viewer/src/) |
| theme-switcher | theme, identity | `theme.get`, `theme.changed`, `identity.getPublicKey` | [apps/playground/napplets/theme-switcher/src/](./napplets/theme-switcher/src/) |
| toaster | notify, ifc, identity | `notify.send`, `ifc.emit`, `identity.getPublicKey` | [apps/playground/napplets/toaster/src/](./napplets/toaster/src/) |

Each napplet is an independent build target with its own `package.json`, `vite.config.ts`, and `index.html`. The topology view (`apps/playground/src/topology.ts`) renders one frame container per `DEMO_NAPPLETS` entry from `apps/playground/src/shell-host.ts` — adding a new napplet requires editing only that array, no per-napplet template duplication.

## Service Topology

The demo renders 8 service nodes reflecting the NIP-5D service surface the runtime exposes to napplets:

- **identity** — read-only identity lookups backed by the shell's signer adapter (`getPublicKey`, `getRelays`, `getProfile`).
- **keys** — real document-level chord listener (v1.4 Phase 26, `KEYS-01..03`). See `hotkey-chord` napplet.
- **media** — real `navigator.mediaSession` mirror (v1.4 Phase 27, `MEDIA-01..03`). See `media-controller` napplet.
- **notifications** — notification service (both canonical `notify.*` NUB and legacy ifc-emit `notifications:*` channel).
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

Capabilities are per-napplet (keyed on the tuple `(pubkey, dTag, aggregateHash)`) and grant-by-default is OFF — requests fail closed if no explicit grant exists. The demo exposes ACL grant / revoke controls via the topology UI's ACL panel; the Playwright E2E suite exercises the same grant flow via `tests/e2e/helpers/acl-beforeEach.ts` (harness target :4173) and the `__grant*__` host hooks (demo target :4174).

Capability list (active in v1.4):

- `identity:read` — identity.* reads
- `relay:read` / `relay:write` — REQ / EVENT pass-through
- `state:read` / `state:write` — shell:state-get / shell:state-set
- `storage:read` / `storage:write` — per-napplet localStorage
- `notify:send` / `notify:channel` — notify.* NUB
- `theme:read` — theme.get + theme.changed
- `cache:read` / `cache:write` — offline event cache
- `keys:forward` — keys.action push delivery (KEYS-03)
- `media:control` — media.* NUB control surface (MEDIA-03)

Default ACL state on demo boot: all capabilities ungranted. The demo UI + Playwright specs grant capabilities explicitly per test scenario.

## Host Hooks

The demo installs two `window`-scoped functions during `bootShell()` that let the Playwright E2E specs grant capabilities to the new v1.4 napplets without UI click-through. Both hooks are scoped (they only grant capability to one specific napplet) and both return a boolean to signal whether the grant succeeded.

- `window.__grantKeysForward__(): boolean` — grants `keys:forward` to the `hotkey-chord` napplet. Returns `true` on success, `false` if the napplet isn't loaded or hasn't completed AUTH yet. Installed at `apps/playground/src/shell-host.ts:864`. Invoked by [`tests/e2e/hotkey-chord.spec.ts`](../../tests/e2e/hotkey-chord.spec.ts) after gating on `#hotkey-chord-status = 'subscribed'`.

- `window.__grantMediaControl__(): boolean` — grants `media:control` to the `media-controller` napplet. Returns `true` on success, `false` if the napplet isn't loaded or authenticated yet. Installed at `apps/playground/src/shell-host.ts:903`. Invoked by [`tests/e2e/media-controller.spec.ts`](../../tests/e2e/media-controller.spec.ts) after gating on `#media-controller-status = 'session-ready'`.

Both hooks follow the same pattern: look up the target napplet's windowId from the napplets Map, confirm the napplet is authenticated, then call `relay.runtime.aclState.grant(pubkey, dTag, hash, cap)`. Adding a new demo napplet that needs E2E capability setup follows the same pattern: install a scoped `__grant<Capability>__` hook in `bootShell()`, then invoke it from the Playwright spec.

## License

MIT
