---
slug: nap-resource-server-hints
status: investigating
trigger: "chase NAP-RESOURCE: resource now includes server hints, make any required changes throughout the stack, and implement; napplet/web packages are not yet updated, so stop when you hit that boundary and await"
created: 2026-08-22
updated: 2026-08-22
---

# Debug: NAP-RESOURCE server hints

## Symptoms

**Expected:** Kehto carries the newly specified NAP-RESOURCE server hints through every applicable host, runtime, service, Paja, playground, test, and documentation surface.

**Actual:** The Kehto stack predates the server-hint contract, while the current `napplet/web` packages are expected not to expose its updated protocol types yet.

**Error messages:** None yet; this is a protocol-contract drift chase.

**Timeline:** Began when the active NAP-RESOURCE draft added server hints.

**Reproduction:** Compare the exact active `napplet/naps` NAP-RESOURCE draft with Kehto's current resource request and resolution flow, then compile the required wire shape against the installed `napplet/web` package line.

## Current Focus

hypothesis: CONFIRMED. The new contract changes the web API and request envelopes owned by `napplet/web`: `bytes` gains per-resource `servers`, `bytesMany` replaces `urls` with per-entry `requests`, and `ResourceInfo` gains optional `maxServers`. Kehto must consume those canonical package types after they exist rather than introduce a second local public contract.
test: Compare exact NAP-RESOURCE head `9511232` (semantic commit `7531258`) with the current `napplet/web` core/runtime API, NAP resource types, transport, shim, and SDK, then trace the corresponding Kehto host consumers.
expecting: The first implementation boundary is an unchanged `napplet/web` resource API/wire package surface; Kehto changes remain pending until that contract is available.
next_action: await updated `@napplet/core` and `@napplet/nap` resource contracts, then implement and verify every enumerated Kehto consumer in one conformant change.

## Authority

- Local `napplet/naps` branch `nap-resource`, exact head `9511232`, with the server-hint semantic change at `75312589cdc5012be0ac09d7aa87e265564d3bf8` and changelog checkpoint at the head.
- The public replacement PR #80 remains at older head `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`; this chase intentionally uses the newer exact local draft head supplied by the task.
- The contract adds `servers?` to `resource.bytes`, changes `resource.bytesMany` from `urls` to `requests: ResourceBytesRequest[]`, adds optional `ResourceInfo.maxServers`, preserves per-request order, ignores hints for non-Blossom schemes, and keeps hints outside URL/cache identity.
- Accepted hints are ordered public HTTPS origins, deduplicated and capped by the runtime, followed by runtime/user defaults and public fallbacks. They remain subject to all network policy and Blossom SHA-256 verification.

## Evidence

- timestamp: 2026-08-22
  finding: `napplet/web` `packages/core/src/types/global/runtime-api.ts` still defines `ResourceInfo` with only `schemes`, `maxBytes`, and `maxUrls`; its resource namespace still accepts URL-only single and bulk inputs.
  confirms: The public web API cannot express `maxServers` or typed per-resource server hints yet.
- timestamp: 2026-08-22
  finding: `napplet/web` `packages/nap/src/resource/types.ts` still defines `ResourceBytesMessage` as `{ id, url }` and `ResourceBytesManyMessage` as `{ id, urls: string[] }`.
  confirms: The canonical package-owned wire types contradict draft head `9511232`'s `{ id, url, servers? }` and `{ id, requests }` request envelopes.
- timestamp: 2026-08-22
  finding: `napplet/web` resource transport, shim, and SDK still accept and send URL-only `bytes` and `urls: string[]` `bytesMany` calls.
  confirms: No conformant napplet can currently emit server hints through the supported package surface.
- timestamp: 2026-08-22
  finding: Kehto graph tracing identifies downstream consumers in `packages/shell/src/napplet-namespace.ts`, `packages/shell/src/types/internal-resource.ts`, `packages/services/src/resource-service.ts`, `packages/paja/src/browser-resource.ts`, `packages/paja/src/browser-adapter.ts`, the playground resource handler/demo, and their unit/e2e/static guards.
  confirms: Implementing only the Paja Blossom resolver would leave the wire, batch, introspection, shell prelude, playground, tests, and docs out of sync.
- timestamp: 2026-08-22
  finding: Kehto's reference service currently forwards only `(url, init)` to runtime resolvers, parses only `urls` for bulk requests, and Paja selects only configured default Blossom servers.
  confirms: Once upstream types land, Kehto must carry each request's accepted `servers` into the resolver, preserve per-entry hints for bulk requests, expose `maxServers`, and merge hint/default/fallback tiers without placing hints in cache identity.

## Eliminated

## Resolution

root_cause:
fix:
verification:
files_changed: Debug checkpoint only; Kehto implementation intentionally not started before the canonical `napplet/web` package boundary.
