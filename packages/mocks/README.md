# @kehto/mocks

Deterministic, in-memory mock services for every napplet NAP domain — merged
and draft alike, except the few new drafts listed in
`scripts/deferred-naps.json` — so a shell built on `@kehto/*` has data to work with while
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

Peers admit `@napplet/core` `>=0.42.0 <0.43.0` and `@napplet/nap`
`>=0.32.0 <0.42.0`. The core floor is 0.42.0 because `MockCvmRegistryEntry`
extends core's selector-based `CvmRegistryEntry`; earlier releases export the
older family-only registry shape. Development, tests, and JSR imports use the
host line: core 0.42.0 and nap 0.41.0.

## Quick start

```ts
import { createShellBridge } from '@kehto/shell';
import { createMockNapEnvironment } from '@kehto/mocks';

const env = createMockNapEnvironment({ seed: 7 });
const bridge = createShellBridge({ ...hooks, services: env.services, statePersistence: env.statePersistence });
// list env.domains in the shell environment's capabilities.domains

const torrent = env.get('torrent');
torrent.mock.state();   // seeded jobs
env.resetAll();         // restore every seed
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
| Domain | NAP | Status | Spec ref | Kind | Routes / note |
|--------|-----|--------|----------|------|---------------|
| `ble` | NAP-BLE | draft | PR #62 @ `b46b8691` | service | 7 routes |
| `blossom` | NAP-BLOSSOM | draft | PR #71 @ `5e74daa4` | extension | 13 routes |
| `capture` | NAP-CAPTURE | draft | PR #94 @ `438b3761` | extension | 6 routes |
| `catalog` | NAP-CATALOG | draft | PR #95 @ `1020ae53` | extension | 1 route |
| `class` | NAP-CLASS | draft | PR #16 @ `48282798` | extension | push-only |
| `class-1` | NAP-CLASS-1 | draft | PR #17 @ `b9128e0c` | posture | Strict baseline: connect-src 'none', no consent prompt, no grant state; the default class when no class-contributing NAP triggers, delivered as class.assigned { class: 1 }. |
| `class-2` | NAP-CLASS-2 | draft | PR #18 @ `45c9b12d` | posture | User-approved explicit origins: connect-src limited to the granted origins after a first-load consent prompt keyed on (dTag, aggregateHash), refuse-to-serve on residual meta-CSP, denied napplets served as class 1. |
| `common` | NAP-COMMON | draft | PR #67 @ `8cd0eae8` | service | 8 routes |
| `config` | NAP-CONFIG | draft | PR #14 @ `bed9cb5b` | service | 5 routes |
| `connect` | NAP-CONNECT | draft | PR #19 @ `ec81a3a4` | runtime-owned | NAP-CONNECT defines no connect.* envelopes; grants are served as CSP connect-src plus a discovery meta tag. Use createMockConnectGate() and createMockLoopbackNetwork(). |
| `count` | NAP-COUNT | draft | PR #69 @ `9353a0c6` | service | 1 route |
| `cvm` | NAP-CVM | draft | PR #31 @ `28cf1bdb` | service | 7 routes |
| `display` | NAP-DISPLAY | draft | PR #97 @ `2c2e1b5c` | extension | 2 routes |
| `dm` | NAP-DM | draft | PR #74 @ `2c4e4423` | service | 6 routes |
| `fs` | NAP-FS | draft | PR #88 @ `bd1b9e91` | service | 14 routes |
| `gamepad` | NAP-GAMEPAD | draft | PR #130 @ `0b28f77e` | service | 2 routes |
| `git` | NAP-GIT | draft | PR #137 @ `a73bf8de` | extension | 10 routes |
| `hashtree` | NAP-HASHTREE | draft | PR #73 @ `67997706` | extension | 17 routes |
| `identity` | NAP-IDENTITY | merged | master @ `377bf939` | service | 9 routes |
| `inc` | NAP-INC | merged | master @ `377bf939` | runtime-owned | The runtime routes inc.* topics and channels itself (packages/runtime/src/inc-handler.ts) and attests sender/peer from authenticated endpoints. Mocks cannot and must not fabricate INC deliveries; shells get INC for free from the runtime. MOCK_INC_TOPICS supplies topic strings for tests. |
| `intent` | NAP-INTENT | merged | master @ `377bf939` | service | 3 routes |
| `keys` | NAP-KEYS | draft | PR #9 @ `8869a4cf` | service | 3 routes |
| `link` | NAP-LINK | draft | PR #53 @ `100e5c93` | service | 1 route |
| `lists` | NAP-LISTS | draft | PR #68 @ `7cf00cdb` | service | 3 routes |
| `llm` | NAP-LLM | draft | PR #134 @ `5e93bdfc` | service | 4 routes |
| `location` | NAP-LOCATION | draft | PR #125 @ `24d2039c` | extension | 4 routes |
| `media` | NAP-MEDIA | draft | PR #10 @ `7806f438` | service | 6 routes |
| `motion` | NAP-MOTION | draft | PR #124 @ `3069a945` | extension | 3 routes |
| `navigation` | NAP-NAVIGATION | draft | PR #126 @ `9a4b179e` | extension | 2 routes |
| `notify` | NAP-NOTIFY | draft | PR #11 @ `67877ef6` | service | 5 routes |
| `nzb` | NAP-NZB | draft | PR #136 @ `3a426fe4` | extension | 7 routes |
| `outbox` | NAP-OUTBOX | draft | PR #32 @ `8865f73d` | service | 6 routes |
| `pow` | NAP-POW | draft | PR #39 @ `d85b4252` | extension | 8 routes |
| `relay` | NAP-RELAY | draft | PR #2 @ `9f30b350` | service | 5 routes |
| `resource` | NAP-RESOURCE | draft | PR #80 @ `ae5b9c64` | service | 4 routes |
| `serial` | NAP-SERIAL | draft | PR #61 @ `0c6e88ab` | service | 3 routes |
| `shell` | NAP-SHELL | merged | master @ `377bf939` | runtime-owned | The shell package owns shell.ready/shell.init (packages/shell/src/shell-ready.ts). A mock environment only needs capabilities.domains to list every mocked domain; use mockShellEnvironmentDomains(entries) to build that list. |
| `soulseek` | NAP-SOULSEEK | draft | PR #135 @ `892ed8d4` | extension | 14 routes |
| `storage` | NAP-STORAGE | draft | PR #3 @ `4f4cf0ca` | adapter | Runtime-served domain. Pass createMockStatePersistence() as `statePersistence` in the shell adapter; the runtime handles storage.get/set/remove/keys, identity scoping, instance scope, and quota. |
| `system` | NAP-SYSTEM | draft | PR #64 @ `43a112db` | extension | 8 routes |
| `theme` | NAP-THEME | merged | master @ `377bf939` | service | 1 route |
| `torrent` | NAP-TORRENT | draft | PR #72 @ `bc99787e` | extension | 17 routes |
| `upload` | NAP-UPLOAD | draft | PR #33 @ `f5cc981e` | service | 3 routes |
| `value` | NAP-VALUE | draft | PR #30 @ `e468764d` | extension | 3 routes |
| `webrtc` | NAP-WEBRTC | draft | PR #59 @ `fb4dd6f0` | service | 4 routes |
| `worker` | NAP-WORKER | draft | PR #107 @ `0a54af9a` | extension | 4 routes |
<!-- domain-table:end -->

Kinds: `service` — routed by the runtime's built-in dispatcher;
`extension` — routed when the handler declares `messageCapabilities` and the
shell exposes the domain (`mockShellEnvironmentDomains()` lists them); pushes
outside a request are declared as `pushCapabilities` and `pushToWindow` returns
the runtime's delivery verdict;
`adapter` / `runtime-owned` / `posture` — no factory (storage uses
`createMockStatePersistence()`).

Transfer-oriented mocks (torrent, nzb, soulseek, resource, upload, fs, blossom,
hashtree, git) model Linux distribution images only.

## Keeping up with `napplet/naps`

```bash
pnpm --filter @kehto/mocks audit:naps           # current / stale / retired / missing / deferred
pnpm --filter @kehto/mocks audit:naps -- --strict
```

New drafts Kehto has no support for yet can be pinned in
`scripts/deferred-naps.json` (PR number, head sha, one-line reason). They show
as `deferred` and do not fail `--strict` until the head moves or the PR
closes.

See `skills/use-nap-mocks/SKILL.md` (integrating) and
`skills/maintain-nap-mocks/SKILL.md` (updating) at the repository root.

## Migrating to 0.2

0.2 removes mock APIs that no longer match `napplet/naps` (tracked as
`KEHTO_MOCKS_NAP_DRIFT_RETIRED` in the repository's `docs/compatibility.md`):

- **NAP-MESH:** `createMockMeshService`, `MESH_MOCK_ENTRY`, `MESH_SPEC_REF` and
  the `mesh` registry row are gone. The draft was retracted in favour of
  NAP-NEIGHBOR, which is not mocked yet.
- **`LLM_TOOLS_SPEC_REF`:** use `LLM_SPEC_REF` (PR #134 now includes tool use).
- **LLM `result.text`:** join the `text` parts of `result.content`.
- **`respondWith(text, 'toolUse')`:** offer `tools` and let the mock derive the
  call; scripted answers take `stop`, `length` or `refusal`.
- **Delta `block: 'toolcall'`:** it is now `'toolCall'`, and each block streams
  as `event: 'start'`, `'delta'`s, then `'end'`.

## Docs

- Package page: [docs/packages/mocks.md](../../docs/packages/mocks.md)
- Generated API module: `docs/api/modules/_kehto_mocks.html` (run `pnpm docs:api`).

## License

MIT
