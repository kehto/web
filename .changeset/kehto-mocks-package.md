---
"@kehto/mocks": minor
---

Introduce `@kehto/mocks`: deterministic, in-memory mock services for every
napplet NAP domain — merged (`identity`, `inc`, `intent`, `shell`, `theme`) and
every open `napplet/naps` draft (relay, storage, keys, media, notify, config,
connect, class, value, cvm, outbox, upload, pow, link, webrtc, serial, ble,
system, common, lists, count, blossom, torrent, hashtree, dm, resource, fs,
capture, catalog, display, worker, mesh, motion, location, navigation, gamepad,
llm, soulseek, nzb, git).

Each mock is a plain `ServiceHandler` built with `defineMockService`, exposing
`service.mock` controls (`state()`, `reset()`, `sent`, `routes`) and
domain-specific controls for pushes and progress. `createMockNapServices()`
instantiates the whole registry for `ShellAdapter.services`;
`MOCK_NAP_REGISTRY` records the exact `napplet/naps` ref each mock was written
against, and `scripts/audit-naps.mjs` reports upstream drift. Transfer-oriented
mocks (torrent, nzb, soulseek, resource, upload, fs, blossom, hashtree, git) use
a Linux distribution image catalog as their subject.

Mocks deliver through the real runtime: extension mocks declare their
out-of-request pushes as `pushCapabilities` (`defineMockService({ pushes })`),
`pushToWindow` returns the runtime's delivery verdict and records only delivered
envelopes, and the relay mock owns fan-out through each subscription's own
runtime `send` (publisher echo, relay scope) via `pushThrough`.
