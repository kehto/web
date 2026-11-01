# @kehto/mocks

Deterministic, in-memory mock services for every napplet NAP domain — merged
and draft alike — so a shell built on `@kehto/*` has data to work with while
implementing a NAP, without a real relay, device, downloader, wallet, or
language-model provider.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. Draft NAP contracts change; each mock records the exact
> `napplet/naps` ref it was written against and `scripts/audit-naps.mjs`
> reports drift.

## Install

```bash
pnpm add -D @kehto/mocks
```

## Published Napplet Compatibility

Peers admit `@napplet/core` `>=0.32.0 <0.37.0` and `@napplet/nap`
`>=0.32.0 <0.36.0`, matching `@kehto/services`; development and tests stay on
the baseline 0.32.0 line.

## Quick start

```ts
import { createShellBridge } from '@kehto/shell';
import { createMockNapServices, MOCK_NAP_REGISTRY } from '@kehto/mocks';

const mocks = createMockNapServices(MOCK_NAP_REGISTRY, { seed: 7 });
const bridge = createShellBridge({ ...hooks, services: mocks.services });

const torrent = mocks.get('torrent');
torrent.mock.state();   // seeded jobs
mocks.resetAll();       // restore every seed
```

Or one domain at a time:

```ts
import { createMockLlmService } from '@kehto/mocks';

const llm = createMockLlmService({ latencyMs: 25 });
bridge.runtime.registerService('llm', llm);
```

Every mock is a plain `ServiceHandler` with an extra `mock` control surface:

| Member | Purpose |
|--------|---------|
| `mock.state()` | Live in-memory state. |
| `mock.reset()` | Reseed; cancels pending latency timers. |
| `mock.sent` | Every envelope delivered, with its window. |
| `mock.routes` | Exact message types answered. |
| `mock.runtime` | `ServiceRuntimeContext` once registered. |

Shared options: `seed`, `clock`, `scheduler`, `latencyMs`. Domain controls
(`advance()`, `receive()`, `press()`, `respondWith()`, `approveNext()`, …) live on
each `Mock<Domain>Service`.

## Domains

<!-- domain-table:start -->
<!-- domain-table:end -->

Kinds: `service` — routed by the runtime's built-in dispatcher;
`extension` — routed when the handler declares `messageCapabilities` and the
shell exposes the domain (`mockShellEnvironmentDomains()` lists them);
`adapter` / `runtime-owned` / `posture` — no factory (storage uses
`createMockStatePersistence()`).

Transfer-oriented mocks (torrent, nzb, soulseek, resource, upload, fs, blossom,
hashtree, git) model Linux distribution images only.

## Keeping up with `napplet/naps`

```bash
pnpm --filter @kehto/mocks audit:naps           # current / stale / retired / missing
pnpm --filter @kehto/mocks audit:naps -- --strict
```

See `skills/use-nap-mocks/SKILL.md` (integrating) and
`skills/maintain-nap-mocks/SKILL.md` (updating) at the repository root.

## Docs

- Package page: [docs/packages/mocks.md](../../docs/packages/mocks.md)
- Generated API: <a href="../../docs/api/modules/_kehto_mocks.html" target="_self"><code>docs/api/modules/_kehto_mocks.html</code></a>

## License

MIT
