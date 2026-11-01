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
| Version | `0.0.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.32.0 <0.37.0` |
| `@napplet/nap` | `>=0.32.0 <0.36.0` |

Workspace dependencies: `@kehto/runtime` (ServiceHandler contract) and
`@kehto/acl` (capability names).

## Primary APIs

| Area | Exports |
|------|---------|
| Aggregate | `createMockNapServices`, `MOCK_NAP_REGISTRY`, `findMockDomain`, `mockShellEnvironmentDomains` |
| Builder | `defineMockService`, `pushToWindow`, `resultType`, `DEFAULT_CLOCK`, `DEFAULT_SCHEDULER` |
| Determinism | `createSeededRng`, `hashLabel`, `mockHex`, `mockPubkey`, `mockEventId`, `mockSignature` |
| Fixtures | `MOCK_ACCOUNTS`, `MOCK_EVENTS`, `MOCK_RELAYS`, `MOCK_RELAY_URLS`, `buildMockEvent`, `queryNostrEvents`, `matchesNostrFilter`, `LINUX_DISTROS`, `findLinuxDistro`, `searchLinuxDistros` |
| Domain factories | `createMock<Domain>Service` per wire domain (table below), `createMockStatePersistence` for storage |
| Types | `MockService`, `MockServiceOptions`, `MockControls`, `MockDomainEntry`, `MockDomainKind`, `NapSpecRef`, `MockClock`, `MockScheduler`, `MockRouteContext`, `MockServiceDefinition`, per-domain `Mock<Domain>State` / `Mock<Domain>Options` / `Mock<Domain>Service` |

## Usage

```ts
import { createShellBridge } from '@kehto/shell';
import { createMockNapServices, MOCK_NAP_REGISTRY } from '@kehto/mocks';

const mocks = createMockNapServices(MOCK_NAP_REGISTRY, { seed: 7 });
const bridge = createShellBridge({ ...hooks, services: mocks.services });

mocks.get('torrent').mock.state();   // inspect
mocks.resetAll();                     // back to seeds
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
<!-- domain-table:end -->

Transfer-oriented mocks (torrent, nzb, soulseek, resource, upload, fs, blossom,
hashtree, git) model Linux distribution images only.

## Scope Boundaries

- Shapes, not semantics: results and pushes follow the recorded NAP ref, with
  placeholder ids, signatures, bytes, and provider output. Nothing is
  cryptographically valid or fetched from the network.
- Mocks never bypass runtime gates: built-in domains still require their ACL
  capability, extension domains still require the shell to expose the domain,
  and pushes go through `ServiceRuntimeContext.sendToEligibleNapplet` when the
  service is registered.
- INC and NAP-SHELL are served by the runtime and `@kehto/shell`; the package
  records their refs and offers helpers but does not fabricate their traffic.
- Draft-tracking only: the registry mirrors `napplet/naps` master and open PR
  heads at the recorded shas. It does not define new protocol behavior; spec
  gaps are called out in each module header.
- Not a replacement for `@kehto/services`: use the reference services when a
  real backend exists.

## API Reference

- Generated module: <a href="../api/modules/_kehto_mocks.html" target="_self"><code>docs/api/modules/_kehto_mocks.html</code></a>
