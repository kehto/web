# Paja advertised-domain implementation audit

## Definition of implemented

A domain is implemented only when Paja routes the NAP operation to a real browser,
network, signer, storage, or host backend; enforces the relevant permission and
identity boundary; owns the required lifecycle and cleanup; exposes truthful errors;
and has tests that observe the backend effect. A canned result, local echo, no-op,
unconditional grant, or memory-only fake is not an implementation. Explicit test
fixtures may simulate a backend, but their presence cannot make the domain appear in
the production Paja `shell.init` environment.

## Baseline findings

| Domain | Baseline classification | Evidence / required closure |
| --- | --- | --- |
| `shell` | real | Mandatory one-shot ready/init, immutable injected binding, scoped environment; retain full host proof. |
| `relay` | implemented live on branch | Runtime signs templates and encrypts plaintext before Paja publishes to real relays. Live subscribe/query/publish settlement, verified scoped-relay subscription/publish/cleanup, actual observed-relay provenance, mutable relay tiers, and public/configured relay gating are backed by `nostr-tools`. Live reads never merge fixture events or local publish echoes, invalid live URLs fail before advertisement, and memory mode is an unadvertised test fixture. |
| `outbox` | implemented live on branch | NIP-65 discovery, verified/deduplicated reads, observed relay hints, signer-mediated single-event publish, required inbox/outbox fanout, and live subscription cleanup route through the real relay pool. Memory mode no longer registers or advertises OUTBOX. |
| `identity` | implemented on branch | NIP-07/NIP-46/dev signer paths provide the current public key and relay map; no signer returns the specified empty identity. Live kind-3 follows use the verified social cache, signer changes emit `identity.changed`, and Paja suppresses the runtime's safe-default fallback when its real service was not installed. |
| `storage` | implemented local on branch | Runtime uses writable `localStorage`, composite `(dTag, aggregateHash)` scoping, quota enforcement, and stable per-window instance isolation. Capability fails closed when durable storage is unavailable; the memory fixture is explicitly unadvertised. |
| `inc` | real | Runtime-owned authenticated event/channel routing and cleanup exist. |
| `theme` | implemented on branch | Host-owned mutable theme state and browser broadcast exist; Paja suppresses the runtime fallback when its real theme service was not installed. |
| `keys` | implemented when browser document exists | Document-level keybinding registry, reserved-key policy, full binding pushes, action forwarding, and window cleanup exist. The native domain is disabled when no real document listener can be installed. |
| `link` | implemented when browser navigation exists | Consent-gated absolute HTTP(S) handoff uses the host browser with `noopener,noreferrer`; `opened` means the shell accepted and handed the request to the user agent, as specified. The service and capability are absent without `window.open`. |
| `common` | implemented on branch | Live relay reads normalize hex/npub/nprofile targets, verify latest kind 0/3 events, and return raw profile events. Follow-list changes preserve unrelated state and are idempotently signed/published; reactions and reports resolve native events and publish verified NIP-25/NIP-56 events. Mutations fail closed without a signer, and memory relay mode does not advertise the domain. |
| `lists` | implemented public subset on branch | Paja truthfully advertises four fully implemented public list kinds (`10000`, `10002`, `10003`, `30000`). It verifies the current event, preserves unrelated tags/content, applies NIP-65 marker rewrites, signs, and publishes. Private items and unsafe removal from encrypted content fail closed pending NIP-44 support; memory relay mode does not advertise the domain. |
| `serial` | implemented on branch | Uses `navigator.serial`, a host-click chooser, port streams, disconnect/state events, redacted session IDs, ordered writes, and per-window cleanup. Capability is absent when the browser API or activation broker is unavailable. |
| `ble` | implemented on branch | Uses the Web Bluetooth chooser and GATT services/characteristics/descriptors for reads, writes, notifications, disconnect, redacted session IDs, and per-window cleanup. Capability is absent when the browser API or activation broker is unavailable. |
| `webrtc` | implemented on branch | Uses host-owned `RTCPeerConnection` and `RTCDataChannel` objects with signed kind-25050 Nostr signaling. Offer/answer SDP is NIP-44 encrypted, application payloads travel only through the data channel, and explicit session consent warns about peer-visible network metadata. Per-window session/peer/payload limits, signer identity binding, replay/freshness checks, teardown, and conditional capability advertisement fail closed unless a live relay, WebRTC API, cryptography, and a NIP-44 signer are all available. Checked against NAP-WEBRTC draft `5fae95dd2c8e59bd06c654e0845656add077dcda` and NIP-100 PR #363 head `ead1cd6ca6b5b789d70e0d146d17266a2e8e2fba`. |
| `media` | implemented when Media Session exists | The browser Media Session bridge mirrors metadata/playback state, owns media-key actions and silent-audio lifecycle, and cleans sessions per window. The native domain is disabled without `navigator.mediaSession` and a document. |
| `notify` | implemented on branch | Host-rendered, origin-attributed text notifications now provide explicit user permission, channels, badges, actions, clicks, dismissals, controls, and per-window cleanup. The generic service delegates every operation and fails closed without a presentation backend. |
| `config` | implemented on branch | The service recursively enforces the bounded Core Subset, rejects unsupported constraints/defaults/depth, resolves defaults, drops orphans, isolates live schemas/subscriptions, and fails closed before schema registration. Paja persists post-validation snapshots by host-resolved `(dTag, aggregateHash)`, renders a shell-owned settings dialog with masked secret inputs, publishes only committed values, cleans window UI state, redacts all `config.values` from its message log, and omits the domain if durable storage or the UI boundary is unavailable. Checked against draft `448013e6d8cb8c75dce49576b3e7c0d46d960eac`. |
| `resource` | implemented data scheme on branch | Paja now exposes a real, no-network `data:` backend with per-window identity, exact `null`-origin grants, decoded-byte MIME classification, raw SVG/HTML rejection, 10 MiB and 100-URL limits, window-scoped cancellation, and current wire-only results. Network schemes return `unsupported-scheme` until a redirect/DNS-safe host proxy exists. |
| `cvm` | implemented on branch | Paja now registers the real CEP-4/NIP-44 encrypted MCP-over-Nostr transport only with a live relay boundary. Publications use Paja relay policy; inbound wraps and inner events are signature-checked and correlated only to the expected server; window destruction closes orphaned sessions. |
| `upload` | implemented Blossom on branch | Only the real consent-gated, signer-authorized Blossom backend can register or advertise upload. The memory fixture no longer creates a service, upload hook, capability, or `kehto-dev://` success. Checked against NAP-UPLOAD draft `a7cc17463cbf5d9cb87884b31071bc4fc826034c`. |
| `intent` | implemented with real host controller | Installed verified catalog, resolved runtime tabs, readiness, generation-safe reuse, authorization, and source-independent delivery exist. The former default no-op target controller is removed; no host controller means no service or capability. |
| `count` | implemented live on branch | Sends NIP-45 `COUNT` to the first accepting configured relay with bounded fallback, preserves multi-filter OR semantics, discloses the relay actually used, and never downloads matching event payloads. Broad empty filters and memory relay mode fail closed. |
| `dm` | implemented live on branch | Paja registers NAP-DM only for its real Dev signer plus live relay transport. The service creates and verifies NIP-17 gift wraps, queries durable relay history before returning conversations/messages, publishes only after recipient/plaintext consent, orders subscription results before pushes, scopes subscriptions per window, and rejects forged wraps. Memory relay mode and non-NIP-17-capable signers do not advertise the domain. Checked against NAP-DM draft `a0a48588b3c9caca9540cccec19635b85231a00f`. |
| `fs` | implemented browser filesystem on branch | Paja registers NAP-FS only after a successful OPFS probe. Each napplet identity receives a durable hashed `/workspace`; session-only picker mounts expose opaque virtual paths without leaking host handles or paths. The backend implements bounded ranged reads, canonical base64, revisions and write preconditions, serialized atomic writes/appends, directories, move-or-unsupported behavior, removal, scoped advisory watches, picker consent, and window cleanup. Checked against NAP-FS draft `b640cf337c0481f0f9a0216c00843f797a5c6df6`. |

## Exact specification authorities refreshed 2026-08-02

The implementation must recheck each ref immediately before changing its domain.
The recorded merged authority is
`origin/master@5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`; the exact draft heads are
RELAY `0be8abce18beb46ca37bd4ddd042f58d30b4eedc`, OUTBOX
`4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e`, STORAGE
`f71e84ebca7474db260346cbfc2d88f41b4e421e`, KEYS
`cecb64257e0ac29926bb746832a477c553ab307c`, CONFIG
`448013e6d8cb8c75dce49576b3e7c0d46d960eac`, RESOURCE
`fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`, NOTIFY
`e14f5c9d6a6dd2a69ccf79668c4a3c1e955e1ac9`, MEDIA
`2b2d29e90c30b994bf5035a65b57e5fe7f08a9a2`, UPLOAD
`a7cc17463cbf5d9cb87884b31071bc4fc826034c`, INTENT
`a718915ddefa2f03a0126579601f59d8bd86f7c4`, COUNT
`c7447f7e3e33e08dad0448851f750044ef75965f`, LINK
`e25143355f6d416bfce73b12ec814f1c795ec16a`, COMMON
`de603e205a9b498f252be9a5e8e6825c4648df39`, LISTS
`72fddac5def8f9bcbedd01dd942c530d89e335e0`, SERIAL
`a3891d4bab8ec9418a1ebacba9e261b89b7297ee`, BLE
`e14de22a794d24c2431834105d50efd0bd89d459`, WEBRTC
`5fae95dd2c8e59bd06c654e0845656add077dcda`, CVM
`ad68a938236e9230324e377cd005008a315ff402`, INC
`c5cd06f7be6d4690b303949abb26e87ff62f4729`, DM
`a0a48588b3c9caca9540cccec19635b85231a00f`, and FS
`b640cf337c0481f0f9a0216c00843f797a5c6df6`. NIP-5D namespace, transport,
lifecycle identity, rejection, and security rules were checked at
`eb45dfd7335b7f88cb53781984c553581d2b4c34`.

These immutable documents were fetched and read in full again on 2026-08-04.
Their API and wire-direction tables, request/result and error shapes, runtime or
shell lifecycle obligations, and security sections remain consistent with the
domain classifications above. In particular, DM coverage includes correlated
requests, id-less `dm.message` pushes, scoped subscription cleanup, and
runtime-owned keys/relay state; FS coverage includes canonical base64 bytes,
`invalid-data`/`too-large` handling, scoped watch cleanup, and bounded byte work.

## Release metadata coverage

Compared with `origin/main`, shipped source changes are confined to
`@kehto/paja`, `@kehto/services`, `@kehto/acl`, `@kehto/runtime`, and
`@kehto/shell`. `.changeset/bright-paja-dialogs.md` already assigns a minor bump
to all five and describes the real NAP adapters, NIP-17 DM, OPFS filesystem,
consent, and fail-closed host boundaries. Application, test-only, documentation,
and planning changes do not require another package bump, so no redundant
changeset is needed.

## Execution sequence

1. Truthful capability resolution and security-boundary audit.
2. Real Nostr-backed COMMON, LISTS, and CVM; real shell NOTIFY; manifest-bound RESOURCE; production-only UPLOAD advertisement.
3. Web Serial and Web Bluetooth controllers with permission, streaming/event, disconnect, and destruction cleanup.
4. RTCPeerConnection data channels with shell-owned Nostr signaling, identity, encryption, lifecycle, and cleanup.
5. Backend-observing unit/browser tests, complete docs/changesets, full repository gates, and refreshed PR review.
