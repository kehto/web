# Relay authorization implementation handoff

Checked 2026-10-17 before Plan 113-03 implementation. This is a semantic/source
review, not implementation or verification of the migration. Resource group
113-01/02 still gates downstream execution.

## Authority

GitHub API rechecked napplet/naps PR #2 head as
`9f30b3505335a52c574ff570576687d6467021ff`. Read the complete NAP-RELAY at that ref
from `/tmp/kehto-firewall-specs/NAP-RELAY.md`. Current NIP-5D remains
`5560820fa4f37f45b8ab742a11aeb3001b17dc67` (PR #2303).

| Surface | Contract to preserve | Approval regression |
|---|---|---|
| subscribe | Web `options.relay` maps to top-level wire `relay`; `id`, `subId`, filters array; explicit relay targets that relay instead of shared selection | No nested `options` wire invention; approve actual exact origin before socket/cache output; do not authorize a hint then expand it |
| event/EOSE | `relay.event` carries `subId` and `result: { event, sidecar? }`; EOSE carries `subId` | No late callback after replacement or grant loss; preserve sidecar placement |
| close | Request carries `id`, `subId`; stop subscription and delivery; shell can send `relay.closed` with optional string `reason` | Owner can close after denial/budget exhaustion without prompting; cleanup never reaches another source's subscription |
| publish | Request event is an unsigned template; shell signs and publishes; result has matching id, ok, optional event/eventId or error | Denial before signing and fanout, one final result, exact approved destination set |
| publishEncrypted | Plaintext template, recipient, optional nip44/nip04 scheme; shell encrypts then signs/publishes | Approval encloses encryption AND signing AND transport; no ciphertext supplied by the app as an alternate authority path |
| query | Collect results until EOSE, close subscription, return matching id plus events; spec explicitly permits error instead of events on failure | Denial must settle a canonical query result, not silently leave a pending promise; no late cache/EOSE result |
| resource sidecars | Resource owns entry shape; pre-resolution defaults OFF; opt-out prohibits the fetch itself; resource MIME/IP/SVG rules still apply | No resource/network approval bypass by prefetch or local hydration; resource canonical base64 wins over stale illustrative Blob example |

`relay.closed.reason` and publish/query `error` are strings; the draft does not
define an approval-specific enum. Use explicit bounded Kehto diagnostic strings
within those canonical fields, document them, and test the shapes. Do not invent
a generic Firewall response envelope. Source teardown/replacement suppresses
responses to the old endpoint; relevant revocation of a still-live subscription
can send one `relay.closed` and must stop further output.

The introductory claim that omitting allow-same-origin alone prevents WebSockets
is inconsistent with current NIP-5D's explicit CSP advisory. Enforce browser
network isolation under Phase 114; do not rely on that sentence as an isolation
mechanism. No new mandatory protocol behavior follows from that stale description.

## Current code boundaries needing one authorized operation

Inspected current sources while resource group was live (root parent 7c6eba52;
resource WIP subsequently committed 55f54f1c). Relay files were unchanged.

1. `packages/runtime/src/relay-handler.ts` signs in `handleRelayPublish` before
   `publishSignedRelayEvent` delegates to the registered service. Encrypted publish
   likewise calls `nip44/nip04.encrypt` and `signEvent` before service dispatch.
   A gate added only inside relay-pool-service is therefore too late. Planning and
   approval must precede these runtime side effects and remain current through
   publish completion. Runtime context wiring and adapter/service type contracts
   may need changes in this plan, not postponed to the final ingress plan.
2. `publishSignedRelayEvent` can use a registered service OR the runtime adapter's
   relayPool. Both paths must use the same captured destination decision. Current
   `RelayPoolServiceOptions.publish(event)` and `RelayPoolAdapter.publish(event)`
   do not expose the fanout set. Change that boundary so actual targets are known
   before approval and cannot be silently reselected after signing. Do not inspect
   a configured list while leaving publish free to use another one.
3. Runtime subscribe delivers buffered events before service dispatch. Query also
   collects buffered data and can settle a shell-kind query without a service.
   Interface/resource requirements must cover local delivery too; local-only work
   does not need an invented network grant. Cache delivery cannot precede the
   relevant approval merely because no socket was opened.
4. Runtime query synthesizes subscribe and close; prevent duplicate operation
   charging and double approval/one-time consumption across that internal path.
   Backend errors must terminate query correctly rather than waiting for an EOSE
   that denial will never produce.
5. `createCoordinatedRelay` currently guards callbacks with `subs.has(subKey)`.
   Replacing a subscription with the same key can let the old callback find the
   new entry. Require exact entry/generation equality, including asynchronous cache
   completion and timers, and source ownership in cleanup.
6. Paja's relay backend exposes query/publishToRelays and several inherited signing
   paths. Playground's service and relayPoolHooks share one implementation. Keep
   this migration's explicit planning/abort contract reusable by later OUTBOX,
   COUNT, DM, COMMON/LISTS and WebRTC plans; host observer callbacks are telemetry,
   not authorization.

## Specific tests required beyond the existing plan commands

- Hold approval unresolved and assert encrypt, signEvent, cache delivery, pool
  subscribe, and publish calls remain at zero for their respective operations.
- Hold signer/encryption promises, revoke or replace the source, then resolve;
  assert no publish, cache write, buffer delivery, or stale terminal response.
- Change selector results while approval waits; execute only the captured approved
  targets, or replan/reapprove before any side effect. A one-time approval must
  not authorize hidden fanout or a second internal dispatch.
- Return denial from a delegated query subscription and verify one canonical
  query failure plus cleanup, not a hanging timer or a successful empty result.
- Replace a subscription with the same ID, then invoke old cache, event, EOSE,
  timer, and close callbacks; the replacement remains intact and receives none of
  the old work. Cover both reference services and adapter fallback.
- Verify local-only shell-kind/buffer reads require interface authority without
  unrelated network prompts. Revocation must stop buffer delivery too.

No claims of completed protocol conformance or passing new tests are made here.
Record actual implementation decisions and evidence in the Plan 03 summary.
