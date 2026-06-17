---
"@kehto/acl": minor
"@kehto/runtime": minor
"@kehto/services": minor
"@kehto/shell": minor
"@kehto/firewall": minor
---

chore: modernize to @napplet 0.12/0.13 (peer dep + core API rename)

All runtime packages move off the legacy `@napplet/nub` toolchain onto the
current `@napplet` line:

- **Peer dependency** `@napplet/core ^0.5` → `^0.12`, and `@napplet/nub ^0.5`
  → `@napplet/nap ^0.12` (the package was renamed upstream; `@napplet/firewall`
  consumers only need `@napplet/core ^0.12`).
- **Core dispatch API** `registerNub` → `registerNap` and the `NubHandler` type
  → `NapHandler`. The runtime's domain dispatcher now calls `registerNap(...)`
  for every domain.

**Migration for consumers:** install `@napplet/core@^0.12` and `@napplet/nap`
(replacing `@napplet/nub`). The kehto wire protocol is unchanged — the legacy
`ifc`/`nubs` envelopes are still dual-emitted for the installed 0.5.0 shim
(removal is tracked as CLEANUP-01) — so no napplet-side code change is required;
this is a host-side dependency and core-API modernization only.

Internal kehto identifiers that still carry "nub"/"ifc" vocabulary
(`createNubEnvelopeDispatcher`, `IfcDomain`, `ifc-handler.ts`, …) are unchanged:
they are private and the runtime dual-routes `ifc`+`inc`.
