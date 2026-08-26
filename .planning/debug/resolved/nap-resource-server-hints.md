---
slug: nap-resource-server-hints
status: resolved
trigger: "chase NAP-RESOURCE: resource now includes server hints, make any required changes throughout the stack, and implement; napplet/web packages are not yet updated, so stop when you hit that boundary and await"
created: 2026-08-22
updated: 2026-08-26
---

# Debug: NAP-RESOURCE server hints

## Symptoms

**Expected:** Kehto carries the newly specified NAP-RESOURCE server hints through every applicable host, runtime, service, Paja, playground, test, and documentation surface.

**Actual:** The Kehto stack predates the server-hint contract. The shell prelude
drops `servers`, the reference service has no hint-aware resolver boundary, and
Paja therefore reports `blocked-by-policy` when a napplet supplies a Blossom
server but the host has no configured default.

**Error messages:** `ROM bytes unavailable (Blossom: blocked-by-policy)`

**Timeline:** Began when the active NAP-RESOURCE draft added server hints.

**Reproduction:** Compare the exact active `napplet/naps` NAP-RESOURCE draft with Kehto's current resource request and resolution flow, then compile the required wire shape against the installed `napplet/web` package line.

## Current Focus

hypothesis: CONFIRMED. A valid napplet-provided Blossom server was discarded at two Kehto boundaries: the injected shell API emitted URL-only requests and the service resolver received URL-only fetch metadata. Paja consequently had no candidate and emitted the screenshot's `blocked-by-policy` error.
test: Trace canonical single and bulk hint envelopes from the injected API through the reference service into Paja's ordered Blossom candidates, including policy rejection, fallback, and digest verification cases.
expecting: A valid public HTTPS hint resolves a `blossom:` URL without a configured host default; hints remain ignored for non-Blossom URLs and cannot weaken runtime policy.
next_action: Resolved. Ship the conformant implementation and its documented browser-only DNS enforcement boundary.

## Authority

- Local `napplet/naps` branch `nap-resource`, exact head `9511232`, with the server-hint semantic change at `75312589cdc5012be0ac09d7aa87e265564d3bf8` and changelog checkpoint at the head.
- `napplet/web` PR #205 at exact head `bfaa2428503d1e9d7fa4677998500e6a0b188b28` now implements the package-owned API and wire contract against the same NAP head. Its CI and conformance checks were green when rechecked on 2026-08-26. Per Kehto's bleeding-edge upstream policy, this exact draft head is the implementation contract without waiting for merge or publication.
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
- timestamp: 2026-08-22
  finding: Three consecutive live audits fetched every `napplet/web` remote ref and found no commit containing `maxServers` or the new `bytesMany(requests...)` API; NAP-RESOURCE PR #80 remained at pre-hint head `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`.
  confirms: The same external package-contract blocker persists and no spec-conformant Kehto implementation can proceed without creating the forbidden local substitute contract.
- timestamp: 2026-08-26
  finding: `napplet/web` PR #205 head `bfaa2428503d1e9d7fa4677998500e6a0b188b28` adds `ResourceBytesRequest`, `ResourceInfo.maxServers`, `bytes(url, { servers?, signal? })`, `bytesMany(requests, { signal? })`, and the canonical `{ requests }` bulk envelope across core, NAP, shim, SDK, conformance, and the reference shell.
  confirms: The former package-contract blocker is cleared at an exact, green upstream head and Kehto can implement without inventing a competing public contract.
- timestamp: 2026-08-26
  finding: The supplied screenshot reports `ROM bytes unavailable (Blossom: blocked-by-policy)`. Kehto's shell prelude emits only `{ type: 'resource.bytes', url }`; its service calls `fetch(url, { signal })`; Paja throws `blocked-by-policy` when `getBlossomServers()` is empty.
  confirms: The visible failure is the end-to-end consequence of dropped request metadata, not a missing ROM or invalid content hash.
- timestamp: 2026-08-26
  finding: Focused service, shell, Paja, playground, and conformance regressions pass after carrying `servers` through canonical single and `{ requests }` bulk messages. Paja accepts ordered public HTTPS origin hints, deduplicates and caps the combined hint/default list, reapplies policy to every attempt, and verifies the Blossom digest before returning bytes.
  confirms: Request hints now restore a usable candidate without becoming trusted endpoints, weakening policy, or changing resource identity.
- timestamp: 2026-08-26
  finding: The resource demo initially failed E2E because released `@napplet/shim@0.29.2` replaced Kehto's draft-aware host projection and emitted the legacy `{ urls }` bulk shape. Removing that napplet-local shim override made the demo exercise the injected canonical projection; both focused resource E2E tests and all 84 browser tests then passed.
  confirms: Kehto's implementation is correct at the pinned draft boundary, while the unreleased upstream package line remains deliberately outside this change.
- timestamp: 2026-08-26
  finding: Final validation passed `pnpm build`, `pnpm type-check`, `pnpm test:unit` (145 files, 1705 tests), `pnpm docs:check`, AI-slop (100/100), and `pnpm test:e2e` (84 tests).
  confirms: Code, public types, documentation, static conformance guards, unit behavior, and browser integration are synchronized.

## Eliminated

- Missing or invalid ROM bytes: the failure occurred before any Blossom fetch or SHA-256 comparison.
- Treating hints as trusted bypasses: every request-provided server still passes URL normalization, redirect, credential, size, and digest policy.
- Cache-key changes: hints remain request metadata; the resource URL remains the sole identity.
- Waiting for an upstream merge or package publication: Kehto's bleeding-edge policy makes exact green draft head `bfaa2428503d1e9d7fa4677998500e6a0b188b28` authoritative.

## Resolution

root_cause: Kehto's injected resource projection and reference resolver boundary both discarded NAP-RESOURCE `servers`, and Paja selected only configured defaults. A napplet-supplied Blossom origin therefore became zero eligible candidates and surfaced as `blocked-by-policy`.
fix: Implement the pinned draft contract end to end: `ResourceInfo.maxServers`, hint-aware single calls, canonical per-request bulk calls, resolver metadata forwarding, and ordered hint/default Blossom resolution with validation, deduplication, caps, failure precedence, and digest verification. Keep hints Blossom-only and outside resource identity. The playground demo now uses the host projection directly so the released legacy shim cannot overwrite the draft-aware API. Paja documents its bounded browser-only limitation: it rejects obvious private literal hosts but cannot DNS-pin; production resolvers must enforce private-address policy at resolution/connect time.
verification: `pnpm build`; `pnpm type-check`; `pnpm test:unit` (145 files, 1705 tests); `pnpm docs:check`; `npx --yes aislop@0.12.0 scan --changes --base origin/main --json .` (100/100); `pnpm test:e2e` (84 tests).
files_changed: Resource service API/tests/exports; shell namespace projection/types/tests; Paja adapter/resolver/tests; playground resource demo/dependency lockfile; NIP-5D conformance guard; package and policy documentation; changeset.
