---
phase: quick-260802-q92
verified: 2026-08-02T23:34:17Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260802-q92: Verification report

## Goal achievement

| # | Observable truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | No Paja runtime path uses native `window.confirm`. | VERIFIED | Static guards and browser tests prove sign, publish, upload, device, WebRTC, notification, and link consent use the serialized host dialog. |
| 2 | Consent is serialized, accessible, and fail-closed. | VERIFIED | Unit and browser tests cover labelled/described markup, denial-first focus, Escape, queueing, teardown, disclosure, and no pre-consent egress. |
| 3 | Native host domains perform real effects only when their browser boundary exists. | VERIFIED | KEYS dispatches document events; LINK hands safe HTTP(S) URLs to `window.open`; MEDIA uses Media Session; SERIAL and BLE use browser device APIs; NOTIFY renders host UI. Each domain is omitted when its boundary is absent. |
| 4 | Every Paja-advertised NAP domain has a real backend. | VERIFIED | The implementation audit traces all 23 optional domains plus mandatory SHELL. Relay-dependent domains require live `nostr-tools`; storage/config require writable durable storage; upload requires Blossom; WebRTC requires real peer/data-channel APIs, live encrypted signaling, and a signer; DM requires live relays plus the NIP-17-capable Dev signer; FS requires a successful OPFS probe. Memory fixtures do not advertise capabilities. |
| 5 | Network, signer, filesystem, and lifecycle claims are truthful. | VERIFIED | Live relay reads exclude fixtures/local echoes and report observed provenance; COUNT uses NIP-45; COMMON/LISTS publish signed Nostr events; CVM/WebRTC use encrypted Nostr signaling; DM verifies and decrypts relay-persisted NIP-17 wraps; FS persists identity-scoped bytes in OPFS and keeps picker handles opaque; teardown tests cover subscriptions, watches, windows, devices, and sessions. |
| 6 | Release artifacts and documentation match shipped behavior. | VERIFIED | ACL/runtime/shell/services/Paja READMEs, package docs, the all-domain implementation matrix, and minor changesets for every changed public package describe conditional real backends and explicitly unadvertised memory fixtures. |
| 7 | All repository release gates pass. | VERIFIED | Build 32/32; type-check 17/17; unit 142 files / 1,657 tests; isolated Playwright 81 passed / 1 optional external vector skipped; strict docs and CSP audits passed; AI-slop 100/100; diff check passed. |

## Implemented domain set

Paja always provides mandatory `shell`. It advertises the following domains only
when the stated real backend is available:

- Live relay/network: `relay`, `outbox`, `count`, `common`, `lists`, `cvm`.
- Signer/social: `identity` (with the specified empty signed-out state) and
  `dm` (live relay plus Paja Dev signer, with real NIP-17 gift wraps).
- Durable browser state/UI: `storage`, `config`, `theme`, and `fs` (identity-
  scoped OPFS plus session-only opaque picker mounts).
- Browser host integration: `keys`, `link`, `media`, `notify`, `intent`.
- External data/device boundaries: `resource`, `upload`, `serial`, `ble`, `webrtc`.
- Runtime-owned authenticated routing: `inc`.

Memory relay, storage, and upload modes remain explicit fixtures and cannot
enable capability discovery. DM and FS likewise disappear when their real
relay/signer or OPFS boundary is unavailable.

## Protocol authority

The implementation was checked against merged `napplet/naps`
`origin/master@5ac0490461ca6fec2f0d2e45b4835cf9bc08de24` and these exact draft heads:

| Domain | Ref |
| --- | --- |
| SHELL | `5da82b4db5ed3a7711dcaaabc0d32e4de35e955d` |
| RELAY | `0be8abce18beb46ca37bd4ddd042f58d30b4eedc` |
| OUTBOX | `4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e` |
| STORAGE | `f71e84ebca7474db260346cbfc2d88f41b4e421e` |
| KEYS | `cecb64257e0ac29926bb746832a477c553ab307c` |
| CONFIG | `448013e6d8cb8c75dce49576b3e7c0d46d960eac` |
| RESOURCE | `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1` |
| NOTIFY | `e14f5c9d6a6dd2a69ccf79668c4a3c1e955e1ac9` |
| MEDIA | `2b2d29e90c30b994bf5035a65b57e5fe7f08a9a2` |
| UPLOAD | `a7cc17463cbf5d9cb87884b31071bc4fc826034c` |
| INTENT | `a718915ddefa2f03a0126579601f59d8bd86f7c4` |
| COUNT | `c7447f7e3e33e08dad0448851f750044ef75965f` |
| LINK | `e25143355f6d416bfce73b12ec814f1c795ec16a` |
| COMMON | `de603e205a9b498f252be9a5e8e6825c4648df39` |
| LISTS | `72fddac5def8f9bcbedd01dd942c530d89e335e0` |
| SERIAL | `a3891d4bab8ec9418a1ebacba9e261b89b7297ee` |
| BLE | `e14de22a794d24c2431834105d50efd0bd89d459` |
| WEBRTC | `5fae95dd2c8e59bd06c654e0845656add077dcda` |
| CVM | `ad68a938236e9230324e377cd005008a315ff402` |
| INC | `c5cd06f7be6d4690b303949abb26e87ff62f4729` |
| DM | `a0a48588b3c9caca9540cccec19635b85231a00f` |
| FS | `b640cf337c0481f0f9a0216c00843f797a5c6df6` |

WebRTC signaling was also checked against NIP-100 draft PR #363 head
`ead1cd6ca6b5b789d70e0d146d17266a2e8e2fba`. The result is conformant for the
advertised Paja surface; no Kehto-local wire extension was introduced.

## Verification commands

- `pnpm build` — passed, 32 tasks.
- `pnpm type-check` — passed, 17 tasks.
- `pnpm test:unit` — passed, 142 files / 1,657 tests.
- `CI=1 pnpm test:e2e` — passed, 81 tests; one opt-in external vector skipped.
- `pnpm docs:check` — passed.
- `pnpm audit:csp` — passed.
- `npx aislop@0.12.0 scan -d` — 100/100 Healthy.
- `git diff --check` — passed.
