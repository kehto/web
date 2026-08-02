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
| `relay` | partial/real | Live relay backend exists; audit encrypted publish, scoped-relay hooks, signature verification, failure and cleanup paths. |
| `outbox` | real | Relay-pool routing and social-cache decoration exist; retain live relay and signer proof. |
| `identity` | real when signer connected | NIP-07/NIP-46/dev signer paths exist; capability must reflect usable runtime identity where an operation requires one. |
| `storage` | real | Runtime uses scoped `localStorage` persistence with quota and per-window instance isolation. |
| `inc` | real | Runtime-owned authenticated event/channel routing and cleanup exist. |
| `theme` | real | Host-owned mutable theme and browser broadcast exist. |
| `keys` | real | Document-level keybinding registry and host forwarding exist. |
| `link` | real | Consent-gated HTTP(S) browser handoff exists. |
| `common` | implemented on branch | Live relay reads normalize hex/npub/nprofile targets, verify latest kind 0/3 events, and return raw profile events. Follow-list changes preserve unrelated state and are idempotently signed/published; reactions and reports resolve native events and publish verified NIP-25/NIP-56 events. Mutations fail closed without a signer, and memory relay mode does not advertise the domain. |
| `lists` | implemented public subset on branch | Paja truthfully advertises four fully implemented public list kinds (`10000`, `10002`, `10003`, `30000`). It verifies the current event, preserves unrelated tags/content, applies NIP-65 marker rewrites, signs, and publishes. Private items and unsafe removal from encrypted content fail closed pending NIP-44 support; memory relay mode does not advertise the domain. |
| `serial` | implemented on branch | Uses `navigator.serial`, a host-click chooser, port streams, disconnect/state events, redacted session IDs, ordered writes, and per-window cleanup. Capability is absent when the browser API or activation broker is unavailable. |
| `ble` | implemented on branch | Uses the Web Bluetooth chooser and GATT services/characteristics/descriptors for reads, writes, notifications, disconnect, redacted session IDs, and per-window cleanup. Capability is absent when the browser API or activation broker is unavailable. |
| `webrtc` | simulated | Local payload echo and fake peer; no `RTCPeerConnection`, data channel, or Nostr signaling. |
| `media` | real | Browser Media Session bridge exists; retain browser-visible ownership/action/cleanup proof. |
| `notify` | implemented on branch | Host-rendered, origin-attributed text notifications now provide explicit user permission, channels, badges, actions, clicks, dismissals, controls, and per-window cleanup. The generic service delegates every operation and fails closed without a presentation backend. |
| `config` | implemented on branch | The service recursively enforces the bounded Core Subset, rejects unsupported constraints/defaults/depth, resolves defaults, drops orphans, isolates live schemas/subscriptions, and fails closed before schema registration. Paja persists post-validation snapshots by host-resolved `(dTag, aggregateHash)`, renders a shell-owned settings dialog with masked secret inputs, publishes only committed values, cleans window UI state, redacts all `config.values` from its message log, and omits the domain if durable storage or the UI boundary is unavailable. Checked against draft `448013e6d8cb8c75dce49576b3e7c0d46d960eac`. |
| `resource` | implemented data scheme on branch | Paja now exposes a real, no-network `data:` backend with per-window identity, exact `null`-origin grants, decoded-byte MIME classification, raw SVG/HTML rejection, 10 MiB and 100-URL limits, window-scoped cancellation, and current wire-only results. Network schemes return `unsupported-scheme` until a redirect/DNS-safe host proxy exists. |
| `cvm` | implemented on branch | Paja now registers the real CEP-4/NIP-44 encrypted MCP-over-Nostr transport only with a live relay boundary. Publications use Paja relay policy; inbound wraps and inner events are signature-checked and correlated only to the expected server; window destruction closes orphaned sessions. |
| `upload` | implemented Blossom on branch | Only the real consent-gated, signer-authorized Blossom backend can register or advertise upload. The memory fixture no longer creates a service, upload hook, capability, or `kehto-dev://` success. |
| `intent` | real | Installed verified catalog, runtime tabs, readiness, reuse, and source-independent delivery exist. |
| `count` | real when relay backend supports it | Count delegates to the live relay backend and rejects broad empty filters. |

## Exact specification authorities refreshed 2026-08-02

The implementation must recheck each ref immediately before changing its domain.
Current authorities include merged `origin/master@5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`
for merged active documents and these exact draft heads: RELAY `0be8abce`, OUTBOX
`4589a8f9`, STORAGE `f71e84eb`, KEYS `cecb6425`, CONFIG `448013e6`, RESOURCE
`fa6bcc69`, NOTIFY `e14f5c9d`, MEDIA `2b2d29e9`, UPLOAD `a7cc1746`, INTENT
`a718915d`, COUNT `c7447f7e`, LINK `e2514335`, COMMON `de603e20`, LISTS
`72fddac5`, SERIAL `a3891d4b`, BLE `e14de22a`, WEBRTC `5fae95dd`, CVM
`ad68a938`, and INC `c5cd06f7`.

## Execution sequence

1. Truthful capability resolution and security-boundary audit.
2. Real Nostr-backed COMMON, LISTS, and CVM; real shell NOTIFY; manifest-bound RESOURCE; production-only UPLOAD advertisement.
3. Web Serial and Web Bluetooth controllers with permission, streaming/event, disconnect, and destruction cleanup.
4. RTCPeerConnection data channels with shell-owned Nostr signaling, identity, encryption, lifecycle, and cleanup.
5. Backend-observing unit/browser tests, complete docs/changesets, full repository gates, and refreshed PR review.
