# @kehto/mocks

Deterministic, in-memory mock services for every napplet NAP domain — merged
and draft alike — so a shell has data to work with while implementing a NAP,
without a real relay, device, downloader, wallet, or language-model provider.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. Draft NAP contracts change; each mock records the exact
> `napplet/naps` ref it was written against, and `scripts/audit-naps.mjs`
> reports drift. Treat mock envelopes as the shape at that ref, not as a
> stability guarantee.

## Install

```bash
pnpm add -D @kehto/mocks
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/mocks/package.json`, `packages/mocks/src/index.ts` |
| Version | `0.1.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.32.0 <0.39.0` |
| `@napplet/nap` | `>=0.32.0 <0.38.0` |

Workspace dependencies: `@kehto/runtime` (ServiceHandler contract) and
`@kehto/acl` (capability names).

## Primary APIs

| Area | Exports |
|------|---------|
| Aggregate | `createMockNapEnvironment`, `createMockNapServices`, `MOCK_NAP_REGISTRY`, `MOCK_SOCIAL_DOMAINS`, `findMockDomain`, `mockShellEnvironmentDomains`, `createMockNostrStore`, `createMockStatePersistence` |
| Builder | `defineMockService`, `pushToWindow`, `pushThrough`, `resultType`, `DEFAULT_CLOCK`, `DEFAULT_SCHEDULER` |
| Determinism | `createSeededRng`, `hashLabel`, `mockHex`, `mockPubkey`, `mockEventId`, `mockSignature` |
| Fixtures | `MOCK_ACCOUNTS`, `MOCK_EVENTS`, `MOCK_RELAYS`, `MOCK_RELAY_URLS`, `buildMockEvent`, `queryNostrEvents`, `matchesNostrFilter`, `LINUX_DISTROS`, `findLinuxDistro`, `searchLinuxDistros` |
| Domain factories | `createMock<Domain>Service` per wire domain (table below), `createMockStatePersistence` for storage |
| Types | `MockService`, `MockServiceOptions`, `MockControls`, `MockDomainEntry`, `MockDomainKind`, `NapSpecRef`, `MockClock`, `MockScheduler`, `MockRouteContext`, `MockServiceDefinition`, per-domain `Mock<Domain>State` / `Mock<Domain>Options` / `Mock<Domain>Service` |

## Usage

```ts
import { createShellBridge } from '@kehto/shell';
import { createMockNapEnvironment } from '@kehto/mocks';

const env = createMockNapEnvironment({ seed: 7 });
const bridge = createShellBridge({ ...hooks, services: env.services, statePersistence: env.statePersistence });
// list env.domains in the shell environment's capabilities.domains

env.get('torrent').mock.state();   // inspect
env.resetAll();                     // back to seeds (store and storage too)
```

Every mock accepts `seed`, `clock`, `scheduler`, and `latencyMs`; every mock
exposes `service.mock` (`state()`, `reset()`, `sent`, `routes`, `runtime`) plus
domain controls for pushes and progress. See
[`skills/use-nap-mocks`](https://github.com/kehto/web/blob/main/skills/use-nap-mocks/SKILL.md)
for shell integration and
[`skills/maintain-nap-mocks`](https://github.com/kehto/web/blob/main/skills/maintain-nap-mocks/SKILL.md)
for keeping the mocks in sync with `napplet/naps`.

## Domains

Kinds: `service` is routed by the runtime's built-in dispatcher to
`serviceRegistry[domain]`; `extension` is routed only when the handler declares
`messageCapabilities` and the shell exposes the domain; `adapter`,
`runtime-owned`, and `posture` have no service factory.

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
| `identity` | NAP-IDENTITY | merged | master @ `43cb3a4e` | service | 9 routes |
| `inc` | NAP-INC | merged | master @ `43cb3a4e` | runtime-owned | The runtime routes inc.* topics and channels itself (packages/runtime/src/inc-handler.ts) and attests sender/peer from authenticated endpoints. Mocks cannot and must not fabricate INC deliveries; shells get INC for free from the runtime. MOCK_INC_TOPICS supplies topic strings for tests. |
| `intent` | NAP-INTENT | merged | master @ `43cb3a4e` | service | 3 routes |
| `keys` | NAP-KEYS | draft | PR #9 @ `8869a4cf` | service | 3 routes |
| `link` | NAP-LINK | draft | PR #53 @ `50a2cd45` | service | 1 route |
| `lists` | NAP-LISTS | draft | PR #68 @ `7cf00cdb` | service | 3 routes |
| `llm` | NAP-LLM | draft | PR #134 @ `3e10939c` | service | 4 routes |
| `location` | NAP-LOCATION | draft | PR #125 @ `24d2039c` | extension | 4 routes |
| `media` | NAP-MEDIA | draft | PR #10 @ `7806f438` | service | 6 routes |
| `mesh` | NAP-MESH | draft | PR #122 @ `bf9a4722` | extension | 5 routes |
| `motion` | NAP-MOTION | draft | PR #124 @ `3069a945` | extension | 3 routes |
| `navigation` | NAP-NAVIGATION | draft | PR #126 @ `9a4b179e` | extension | 2 routes |
| `notify` | NAP-NOTIFY | draft | PR #11 @ `67877ef6` | service | 5 routes |
| `nzb` | NAP-NZB | draft | PR #136 @ `3a426fe4` | extension | 7 routes |
| `outbox` | NAP-OUTBOX | draft | PR #32 @ `8865f73d` | service | 6 routes |
| `pow` | NAP-POW | draft | PR #39 @ `d85b4252` | extension | 8 routes |
| `relay` | NAP-RELAY | draft | PR #2 @ `9f30b350` | service | 5 routes |
| `resource` | NAP-RESOURCE | draft | PR #80 @ `ae5b9c64` | service | 4 routes |
| `serial` | NAP-SERIAL | draft | PR #61 @ `0c6e88ab` | service | 3 routes |
| `shell` | NAP-SHELL | merged | master @ `43cb3a4e` | runtime-owned | The shell package owns shell.ready/shell.init (packages/shell/src/shell-ready.ts). A mock environment only needs capabilities.domains to list every mocked domain; use mockShellEnvironmentDomains(entries) to build that list. |
| `soulseek` | NAP-SOULSEEK | draft | PR #135 @ `892ed8d4` | extension | 14 routes |
| `storage` | NAP-STORAGE | draft | PR #3 @ `4f4cf0ca` | adapter | Runtime-served domain. Pass createMockStatePersistence() as `statePersistence` in the shell adapter; the runtime handles storage.get/set/remove/keys, identity scoping, instance scope, and quota. |
| `system` | NAP-SYSTEM | draft | PR #64 @ `43a112db` | extension | 8 routes |
| `theme` | NAP-THEME | merged | master @ `43cb3a4e` | service | 1 route |
| `torrent` | NAP-TORRENT | draft | PR #72 @ `bc99787e` | extension | 17 routes |
| `upload` | NAP-UPLOAD | draft | PR #33 @ `f5cc981e` | service | 3 routes |
| `value` | NAP-VALUE | draft | PR #30 @ `e468764d` | extension | 3 routes |
| `webrtc` | NAP-WEBRTC | draft | PR #59 @ `69523e8c` | service | 3 routes |
| `worker` | NAP-WORKER | draft | PR #107 @ `0a54af9a` | extension | 4 routes |
<!-- domain-table:end -->

Transfer-oriented mocks (torrent, nzb, soulseek, resource, upload, fs, blossom,
hashtree, git) model Linux distribution images only.

## Scope Boundaries

- Shapes, not semantics: results and pushes follow the recorded NAP ref, with
  placeholder ids, signatures, bytes, and provider output. Nothing is
  cryptographically valid or fetched from the network.
- Mocks never bypass runtime gates: built-in domains still require their ACL
  capability, extension domains still require the shell to expose the domain,
  and out-of-request pushes go through `ServiceRuntimeContext.sendToEligibleNapplet`
  when the service is registered. Extension mocks declare those push types as
  `pushCapabilities` (the `pushes` field of `defineMockService`). A push the
  runtime refuses is reported as `false` by `pushToWindow` and by domain
  controls such as `class.assign()`, and is never recorded in `mock.sent`.
- Live subscription traffic (`relay.event`) is delivered through the `send` of
  the owning `relay.subscribe` request, exactly as the reference relay services
  do, so the runtime's liveness and `relay:read` checks apply and the registered
  relay mock owns fan-out: the publisher's own matching subscriptions receive
  the event and the runtime ring buffer adds no second copy.
- The relay mock implements the runtime's planned-execution relay contract
  (`planRelayOperation` / `executeRelayOperation`). It opens no relay
  transport, so every plan is local-only with no relay URLs and needs no
  network approval. Execution is skipped once the approval signal has aborted.
- INC and NAP-SHELL are served by the runtime and `@kehto/shell`; the package
  records their refs and offers helpers but does not fabricate their traffic.
- Draft-tracking only: the registry mirrors `napplet/naps` master and open PR
  heads at the recorded shas. It does not define new protocol behavior; spec
  gaps are called out in each module header.
- Not a replacement for `@kehto/services`: use the reference services when a
  real backend exists.

## API Reference

- Generated module: <a href="../api/modules/_kehto_mocks.html" target="_self"><code>docs/api/modules/_kehto_mocks.html</code></a>
