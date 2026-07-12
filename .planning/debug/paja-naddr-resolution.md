---
slug: paja-naddr-resolution
status: resolved
trigger: "Paja fails to resolve naddr1qqxxwmm0vskk6mmjde5kueczyqnxs90qeyssm73jf3kt5dtnk997ujw6ggy6j3t0jjzw2yrv6sy22qcyqqqgjwgpz4mhxue69uhhyetvv9ujuerfw36x7tnsw43qzd3wc3 while nak fetch, njump.me, and playground.nostr.com resolve it"
created: 2026-07-12
updated: 2026-07-12T20:21:04+02:00
---

# Debug: Paja naddr Resolution Failure

## Symptoms

**Expected:** Paja resolves the supplied NIP-19 `naddr` and loads the referenced NIP-5D napplet manifest/artifact, matching `nak fetch`, njump.me, and playground.nostr.com.

**Actual:** Paja has trouble resolving the supplied `naddr`; the comparison tools resolve it successfully.

**Error messages:** No Paja error text supplied yet.

**Timeline:** Not supplied; current behavior reported 2026-07-12.

**Reproduction:** Give Paja `naddr1qqxxwmm0vskk6mmjde5kueczyqnxs90qeyssm73jf3kt5dtnk997ujw6ggy6j3t0jjzw2yrv6sy22qcyqqqgjwgpz4mhxue69uhhyetvv9ujuerfw36x7tnsw43qzd3wc3`, then compare with `nak fetch` and public Nostr pointer viewers.

## Current Focus

hypothesis: CONFIRMED. Paja decodes the pointer and builds the correct addressable-event filter, but runtime-pointer resolution queries only the pointer's relay TLVs plus pointer-only overrides. The static Paja artifact supplies no pointer overrides and does not pass its configured live relay defaults, so this pointer is queried only against unavailable `wss://relay.ditto.pub` even though the event is available on Paja's configured `wss://nos.lol` relay.
test: Run current `origin/main` Paja resolution twice: first with the pointer alone, then with `wss://nos.lol` supplied as an extra relay. Compare with direct `nak` relay queries and the installed `nak fetch` implementation.
expecting: Pointer-only resolution fails before manifest validation, while the same pointer plus `nos.lol` completes signature, manifest, aggregate, blob-hash, and HTML resolution.
next_action: Diagnosis complete; implement only in a follow-up fix workflow. Reuse Paja's effective live relay configuration and add bounded author-relay discovery/fallback tests rather than treating NIP-19 relay TLVs as exhaustive.

## Evidence

- timestamp: 2026-07-12T20:00:00+02:00
  command: `git status --short --branch; git branch --show-current; git log --oneline -5; git rev-parse HEAD origin/main`
  finding: The investigation branch `debug/paja-naddr-resolution` is at `451a09f47d8c3c9d1488b0f42fe5d381751298f4`, exactly matching `origin/main`; the only worktree change is this untracked debug record.
  confirms: Reproduction and source inspection are against current `origin/main`, not a stale implementation branch.
- timestamp: 2026-07-12T20:02:00+02:00
  command: `nak decode <exact-naddr>`
  finding: The pointer decodes to `type=naddr`, kind `35129`, author `266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5`, identifier `good-morning`, and one relay hint: `wss://relay.ditto.pub`.
  confirms: NIP-19 decoding and NIP-5D named-manifest kind selection are correct; decode is not the failure boundary.
- timestamp: 2026-07-12T20:05:00+02:00
  command: `timeout 15s nak req -k 35129 -a 266815...08a5 -d good-morning wss://relay.ditto.pub`
  finding: `nak` reports `connection took too long` and `failed to connect to any of the given relays` (exit 3).
  confirms: The pointer's sole relay hint is currently unavailable from this host.
- timestamp: 2026-07-12T20:06:00+02:00
  command: `nak req -k 35129 -a 266815...08a5 -d good-morning wss://relay.primal.net wss://nos.lol wss://purplepag.es wss://relay.damus.io wss://nostr.wine`
  finding: The exact signed manifest is available as event `f39dfca7dbaeacbddf294977c5654c912fced30d8b839b32a1910a988ccc1f5a`. Individual relay probes locate it on `wss://nos.lol`; the other probed relays returned no match.
  confirms: The event exists and the addressable filter is valid; relay selection, not filter construction, separates failure from success.
- timestamp: 2026-07-12T20:07:00+02:00
  command: `nak req -k 10002 -a 266815...08a5 <common-relays>`
  finding: The author's latest kind-10002 relay list is event `40e13774746e73590d5af1f5b93540fd46b1df578c7511f539d129f8d47ef16a` and includes `wss://nos.lol/` with a `read` marker, plus Ditto, Damus, nostr.wine, pyramid.fiatjaf.com, and inbox.relays.land.
  confirms: Broader clients have author-relay discovery information beyond the single NIP-19 hint. The current event copy found in this investigation is on the author's declared `nos.lol` read relay.
- timestamp: 2026-07-12T20:10:00+02:00
  command: `pnpm --filter @kehto/paja build; node --input-type=module` calling `decodePajaPointer()` and `resolvePajaPointer()` from `packages/paja/dist/index.js`
  finding: Current Paja decodes the exact values above. Pointer-only resolution fails after about 4 seconds with `No napplet manifest event found for naddr pointer.` Adding only Damus still fails because that relay has no matching event.
  confirms: Paja reproduces the user's failure before post-fetch NIP-5D validation begins; the observable error conflates an unavailable relay with a clean no-match/EOSE result.
- timestamp: 2026-07-12T20:14:00+02:00
  command: `resolvePajaPointer(exactPointer, { relays: ['wss://nos.lol'], maxWaitMs: 8000 })`
  finding: Resolution succeeds with event `f39dfca7...`, title `Good Morning Protocol`, dTag `good-morning`, aggregate `c922cf30dc1e12b135462057631ba3017cdaeea591725f077c5a20a6d9967b68`, and 170797 verified HTML bytes. The relay set is Ditto plus nos.lol; completion takes about 8 seconds because the dead hinted relay remains in the pool wait.
  confirms: Manifest kind/matching, signature verification, NIP-5A aggregate verification, Blossom fetch, blob SHA-256 validation, and artifact assembly all work once a relay containing the event is queried.
- timestamp: 2026-07-12T20:15:00+02:00
  command: `curl https://cdn.hzrd149.com/822dd333...efbe1; sha256sum`
  finding: The Blossom server returns HTTP 200, 170797 bytes, and SHA-256 `822dd33321aba2dbb4640371e711ac8ef2fe57f45a800b48c5c333d9d48efbe1`, exactly matching the manifest path tag; the document title is `Good Morning Protocol`.
  confirms: Blossom availability and artifact integrity are not the failure.
- timestamp: 2026-07-12T20:16:00+02:00
  command: `curl -L https://njump.me/<exact-naddr>`
  finding: njump returns HTTP 200 and renders event `f39dfca7...`, dTag `good-morning`, and title `Good Morning Protocol`.
  confirms: A public resolver with broader relay/indexer reach currently resolves the coordinate despite the stale/unavailable embedded hint.
- timestamp: 2026-07-12T20:17:00+02:00
  source: `packages/paja/src/runtime-resolver.ts:91-114,124-165,188-223`
  finding: `decodePajaPointer()` preserves the relay TLVs; `resolvePajaPointer()` constructs its entire relay set as `pointer.relays + options.relays`; `resolvePointerEvent()` runs one `SimplePool.querySync()` with a 5-second default and then emits the same no-event error when no candidate is returned. The naddr filter is correctly `{ kinds:[35129], authors:[pubkey], '#d':['good-morning'], limit:1 }`.
  confirms: Paja has no author relay-list discovery or general configured-relay fallback in the pointer resolver, and it does not distinguish timeout/connect failure from EOSE/no-match at this boundary.
- timestamp: 2026-07-12T20:18:00+02:00
  source: `packages/paja/src/simulation.ts:181-186`, `packages/paja/src/options.ts:193-217`, `packages/paja/src/browser-host.ts:443-467`, `scripts/build-paja-pages.mjs:42-44`
  finding: The static host config has pointer-specific `relays: []` but live simulation relays `[relay.damus.io, nos.lol, relay.primal.net, relay.snort.social]`. `loadRuntimePointer()` passes only `config.target.pointer.relays`, not the effective live simulation relays. The Pages build creates the runtime host with empty pointer options.
  confirms: The exact missing wiring is local and deterministic: `nos.lol`, which contains this manifest, is already configured in Paja but excluded from runtime-pointer resolution.
- timestamp: 2026-07-12T20:19:00+02:00
  source: installed `nak v0.19.9`, Go module `fetch.go`
  finding: `nak fetch` builds the same naddr kind/author/d-tag filter, appends pointer relay hints, then calls `sys.FetchOutboxRelays(ctx, authorHint, 3)` before `FetchMany`. `nak fetch --relay wss://nos.lol <exact-naddr>` returns the target event.
  confirms: The successful-client strategy differs at relay discovery/fanout, not decoding or filter semantics. The installed `nak fetch` happened to fail during this capture while Ditto/outbox discovery was unavailable, but its implementation and the explicit-nos control demonstrate the wider strategy the user observed.
- timestamp: 2026-07-12T20:20:00+02:00
  source: NIP-5D draft PR `nostr-protocol/nips#2303` head `78efc118278e3ed42201eba9b60530b65835d7ed`; NIP-19 and NIP-65 on `origin/master` `8f8444d05a8842c40211ded5d10af3521541f865`; napplet/naps `origin/master` `5fd99465892fbead3888d7146e1737f77b0ed0b4`
  finding: NIP-5D requires resolving a manifest from relays and then verifying signature, aggregate, blobs, and srcdoc identity. NIP-19 defines relay TLVs as optional locations where an entity is *more likely* to be found, not an exhaustive relay set. NIP-65 says clients downloading events from an author SHOULD use that author's write relays. The merged NAP registry has no pointer-resolution NAP; this behavior is owned by NIP-19/NIP-65 discovery plus the NIP-5D runtime loader, not a NAP wire domain.
  confirms: Treating the one naddr relay TLV as the effective complete search set is too brittle and is not required by the authoritative specs. There is no missing NAP contract to blame.
- timestamp: 2026-07-12T20:20:32+02:00
  command: `pnpm --filter @kehto/paja test -- runtime-resolver`
  finding: All 12 Paja test files and 75 tests pass. `runtime-resolver.test.ts:100-131` injects a fake pool where the event is already present on the hinted relay; no test covers an unavailable/stale hint, effective Paja relay defaults, author relay discovery, or timeout-vs-EOSE diagnostics.
  confirms: Existing tests prove decode/filter/validation happy paths but cannot catch this relay-selection regression.

## Eliminated

- hypothesis: The supplied string is malformed or decodes to a non-NIP-5D kind.
  reason: Both `nak decode` and Paja decode it as a valid kind-35129 naddr with the expected author and d tag.
- hypothesis: Paja constructs the wrong addressable-event filter.
  reason: Its exact kind/author/#d filter finds event `f39dfca7...` when sent to nos.lol.
- hypothesis: The relay query returns a candidate that Paja rejects by pointer matching or kind validation.
  reason: With nos.lol added, the same candidate passes `matchesPointer()` and `isNappletManifestKind()`.
- hypothesis: The manifest signature, NIP-5A aggregate, or manifest schema is invalid.
  reason: End-to-end Paja resolution succeeds and returns the expected signed event, dTag, title, and aggregate.
- hypothesis: Blossom is unavailable, returns the wrong bytes, or artifact resolution fails.
  reason: Direct fetch and Paja both obtain 170797 bytes whose SHA-256 exactly matches the manifest path; Paja assembles `/index.html` successfully.
- hypothesis: Increasing only the relay timeout fixes the pointer.
  reason: The sole hinted relay is unreachable and does not expose the event; waiting longer cannot discover nos.lol because Paja never adds it.

## Resolution

root_cause: High confidence. Paja's runtime-pointer path treats `pointer.relays + pointer-specific overrides` as its complete manifest search set. The supplied naddr has one stale/unavailable hint (`relay.ditto.pub`). The static Pages runtime leaves pointer overrides empty even though its effective live simulation relay set already includes `nos.lol`, the relay currently serving the exact manifest. Consequently Paja times out/returns `No napplet manifest event found` before NIP-5D validation, whereas broader clients use configured/indexer relays and/or author relay discovery. The generic no-event error also hides whether the relay connected, reached EOSE with no match, or exhausted `maxWait`.
fix: Recommendation only; not implemented in this diagnosis. Make runtime-pointer resolution consume Paja's effective live relay set (at minimum merge normalized `config.simulation.relay.urls` when relay mode is live with pointer and explicit pointer relays), preserving pointer hints as the immediate first candidates. For robust Nostr resolution, reuse the existing Paja `@kehto/nip/65` relay-list loader/outbox machinery to discover the author's relays under one bounded deadline, and retain a bounded configured/indexer fallback because this event is presently on an author-declared read relay. Report relay connection/timeout/EOSE outcomes separately from post-fetch manifest/artifact errors.
verification: Diagnosis proof: exact pointer-only current-main Paja fails; exact pointer plus `wss://nos.lol` succeeds through full NIP-5D verification; direct manifest and blob checks match event id, aggregate, path hash, title, and byte count; focused Paja suite remains 75/75 green. Recommended regression set: (1) browser-host/runtime integration proves static default live relays are passed to pointer resolution; (2) dead embedded hint plus event on configured relay succeeds; (3) hinted relay fast path remains first and deduplicated; (4) delayed/rejected author relay discovery cannot block the overall deadline; (5) timeout/connect failure is distinguishable from all-relays EOSE/no-match; (6) invalid signature/aggregate/blob tests still fail closed after wider relay discovery.
files_changed: `.planning/debug/paja-naddr-resolution.md` only; no source code, tests, push, or PR.
