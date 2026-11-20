---
name: use-nap-mocks
description: Use when a shell built on @kehto/* needs data for a NAP domain it is implementing or testing, without a real relay, device, downloader, LLM provider, or wallet — covers registering @kehto/mocks services (all domains or a subset), seeding and resetting them, driving pushes and progress from controls, exposing mocked extension domains to napplets, swapping in the storage persistence mock, and using mocks as test fixtures.
---

# Use `@kehto/mocks` in a shell

`@kehto/mocks` ships one deterministic, in-memory mock per NAP domain. Every
mock is a plain `ServiceHandler`, so a shell registers it exactly like a
reference service from `@kehto/services`. Nothing in the package touches the
network, the DOM, timers you did not inject, or `Math.random`.

## When NOT to use this

- You need real behavior (signatures that verify, bytes from a mirror, an LLM
  answer). Mocks return shaped placeholders — use `@kehto/services`.
- You are adding or fixing a mock. Use `skills/maintain-nap-mocks/SKILL.md`.
- You are building a brand-new `x-` domain. The mocks only cover `napplet/naps`
  documents.

## Step 1 — Install

```bash
pnpm add -D @kehto/mocks
```

Peers: `@napplet/core`, `@napplet/nap` (same ranges as `@kehto/services`).

## Step 2 — Register every mock

```ts
import { createShellBridge } from '@kehto/shell';
import { createMockNapEnvironment } from '@kehto/mocks';

const env = createMockNapEnvironment({ seed: 7, user: 'alice' });

const bridge = createShellBridge({
  ...hooks,
  services: env.services,                 // relay, identity, llm, torrent, … in one map
  statePersistence: env.statePersistence, // NAP-STORAGE is served by the runtime
});
// env.domains → list these in the shell environment's capabilities.domains
```

`createMockNapEnvironment` shares one Nostr event store (`env.store`) across
relay, outbox, count, identity, common, and lists, so a `relay.publish` shows up
in `count.query`, `identity.*`, and live subscriptions. `env.get('relay')`
returns the typed mock; `env.resetAll()` restores every seed, the store, and
storage. Use `only`, `except`, and per-domain `overrides` to mix mocks with real
services. The lower-level `createMockNapServices(MOCK_NAP_REGISTRY, options)`
does the same without the shared store:

```ts
const env = createMockNapEnvironment({
  except: ['relay', 'identity'],           // keep the real social stack
  overrides: { llm: { latencyMs: 40 } },   // stream deltas slowly
});
```

## Step 3 — Register one mock

Every domain exports `createMock<Domain>Service(options)`:

```ts
import { createMockTorrentService } from '@kehto/mocks';

const torrent = createMockTorrentService({ seed: 3 });
bridge.runtime.registerService('torrent', torrent);
torrent.advance();            // push the next progress event
torrent.mock.state();         // inspect jobs
torrent.mock.sent;            // every envelope delivered so far
torrent.mock.reset();         // back to the seeded catalog
```

Shared options (`MockServiceOptions`):

| Option | Effect |
|--------|--------|
| `seed` | Seeds ids and fixture order. Same seed → same data. |
| `clock` | `{ now() }` used for every timestamp. Inject a fixed clock in tests. |
| `scheduler` | `{ schedule(ms, fn) }` used for deferred pushes. Inject a manual queue in tests. |
| `latencyMs` | Delay before each result. `0` (default) replies synchronously. |

## Step 4 — Expose the domains to napplets

The runtime only routes an extension domain (anything outside the built-in
dispatcher: torrent, git, mesh, …) when the shell's environment lists it in
`capabilities.domains`. `mockShellEnvironmentDomains(MOCK_NAP_REGISTRY)`
returns the full list, including `shell`, `storage`, and `inc` (`env.domains` is the same list):

```ts
import { MOCK_NAP_REGISTRY, mockShellEnvironmentDomains } from '@kehto/mocks';

const domains = mockShellEnvironmentDomains(MOCK_NAP_REGISTRY);
// → use when building the ShellEnvironment / injected namespace domain list
```

Extension domains have no built-in `window.napplet` binding. Pass the generated
tables so napplets can call them (`MOCK_NAPPLET_BINDINGS` holds one per
`extension` mock, derived from the NAP wire table at the mock's ref):

```ts
import { MOCK_NAPPLET_BINDINGS } from '@kehto/mocks';
import { prepareNappletSrcdoc } from '@kehto/shell';

iframe.srcdoc = prepareNappletSrcdoc(html, { domains, bindings: MOCK_NAPPLET_BINDINGS });
// napplet: await window.napplet.torrent.add(request); window.napplet.torrent.on('progress', fn)
```

Built-in domains still obey ACL: a napplet without `relay:read` never reaches
the relay mock. Mocks never bypass the runtime's gates: a push the runtime
refuses (window not live, domain not exposed, capability missing) makes
`pushToWindow` and controls such as `class.assign()` return `false` and leaves
`mock.sent` untouched.

## Step 5 — Domains the runtime owns

| Domain | What to do |
|--------|------------|
| `storage` | Pass `createMockStatePersistence()` as `statePersistence` in your adapter. |
| `inc` | Nothing — the runtime serves INC; mocks never fabricate INC deliveries. |
| `shell` | Nothing — `@kehto/shell` owns `shell.init`/`shell.ready`. |
| `connect` | No wire protocol — grants become CSP `connect-src`. Use `createMockConnectGate()` and `createMockLoopbackNetwork()`. |
| `class` | Push-only extension: call `classService.assign(windowId)` right after the iframe is ready to send `class.assigned`. |
| `class-1`, `class-2` | Posture documents; `MOCK_NAPPLET_CLASSES` describes them. |

## Step 6 — Drive the mock

Mocks answer requests synchronously (or after `latencyMs`). Events that a
real host would push on its own come from controls on the service object —
look at the domain module's `Mock<Domain>Service` type. Typical names:
`advance()` (progress), `emit…()`/`receive…()` (inbound data), `press…()`
(input), `respondWith()` (scripted answers), `approveNext()` (consent). Every
control pushes through the runtime context when the service is registered, so
only live, eligible windows receive events.

## Step 7 — Use in tests

```ts
import { createMockLinkService } from '@kehto/mocks';

const link = createMockLinkService({ clock: { now: () => 0 } });
const sent: NappletMessage[] = [];
link.handleMessage('win-1', { type: 'link.open', id: '1', url: 'https://example.org' } as NappletMessage, (m) => sent.push(m));
expect(sent[0]).toMatchObject({ type: 'link.open.result', id: '1' });
```

Prefer a manual scheduler in tests:

```ts
const queue: Array<() => void> = [];
const scheduler = { schedule: (_ms: number, fn: () => void) => { queue.push(fn); return () => {}; } };
const llm = createMockLlmService({ scheduler });
// … send llm.generate, then drain: queue.splice(0).forEach((fn) => fn());
```

## Fixtures you can reuse

- `MOCK_ACCOUNTS`, `MOCK_EVENTS`, `MOCK_RELAYS`, `buildMockEvent`,
  `queryNostrEvents` — six accounts with profiles, contacts, relay lists, notes.
- `LINUX_DISTROS`, `searchLinuxDistros` — the file/transfer catalog. Transfer
  mocks only ever "download" these images.
- `mockPubkey`, `mockEventId`, `mockHex` — label-stable ids.

## Pitfalls

- Mock events carry placeholder signatures. Never publish them to a real relay.
- `service.mock.state()` is the live object, not a copy; clone before mutating
  outside a control.
- `reset()` cancels pending latency timers; always call it between tests.
- A mock registered under a different key than `descriptor.name` is never
  routed. Register `createMockRelayService()` as `relay`, not `relay-mock`.
- Spec drift: every mock records the `napplet/naps` ref it was written against
  (`MOCK_NAP_REGISTRY[i].spec`). Run `pnpm --filter @kehto/mocks audit:naps`
  before trusting a draft domain's field names.
