# Multiplayer providers in Paja

Paja can use an operator-selected CVM provider and the documented `soy-rtc/1`
signaling profile. This lets the same signed napplet use compatible rooms across
hosts. No provider URL, public key, family label, or app address is built in.

Open **Multiplayer providers** in the host sidebar. Paste your provider settings
as JSON, then choose **Save and reload**. Settings belong to this host origin;
clearing the field restores the server's config. A file-based host can instead
set the same object at `simulation.multiplayer`:

```json
{
  "profile": "soy-rtc/1",
  "relays": ["wss://signaling.example"],
  "registry": [],
  "iceServers": [{ "urls": ["stun:stun.example:3478"] }]
}
```

For CVM discovery, add one or more entries to `registry`. Each entry has `family`
(the local label expected by your app), `server: { pubkey, relays }`, and `tools`,
an array of `{ name, schemaHash }` pins. `pubkey` and each hash are lowercase
64-character hex. Obtain the inventory with `cvm.listTools(server)` or a trusted
operator tool. `computeCvmToolSchemaHash(tool)` from `@kehto/services` calculates
the CEP-15 hash from the returned name and schemas. Review those schemas before
pinning them. A configured family requires all its pins to match the live
inventory; a changed schema fails closed. Hash selectors take precedence over
local family labels. A caller's explicit server pin never falls back to another
provider. All provider requests still pass ordinary runtime approvals.

Paja does not infer signaling from a provider's hostname. The currently observed
`.well-known/napplet.json` discovery document exposes backend key/relay hints but
does not describe signaling profiles, family membership, key coupling, or ICE.
Automatic selection of those settings is a discovery-contract gap, so this
implementation requires explicit settings.

## Identity, transport and lifecycle

Each window gets a temporary host-owned key shared by its CVM and WebRTC
transports. No connected user signer is required for this profile. Keys are not
exposed to the iframe or persisted. Other tabs and replacement frames get their
own keys. Destroying/revoking the owning scope closes subscriptions and peers;
late negotiations cannot publish or deliver app messages.

The signaling namespace comes from the signature-verified manifest address,
independent of relay hints and artifact versions. Same-publisher snapshots share
the original address; a different snapshot signer remains isolated. Unsigned
local development targets require an explicit `developmentNamespace`; this
setting cannot override a verified address. Artifact verification, `srcdoc`
loading and host-bootstrap separation remain the loader's authority boundaries.

The profile authenticates kind-25050 signaling, binds SDP to session nonces, and
encrypts offers/answers with NIP-44. Presence repeats so late peers can join.
Application data travels through RTCDataChannel. This implementation reports
reliable ordered JSON delivery, including when a napplet requests transient
delivery. Peers advertising incompatible delivery are excluded. Payloads are
limited to 16 KiB, with four sessions/window and eight peers/session. Optional
byte/statistics requests receive `unsupported`; nothing retries as JSON.

## ICE and connectivity

`iceServers` is optional. Each entry contains an array of `urls` and optional
`username`/`credential` strings. These are host settings, never napplet outputs.
Every endpoint gets its own Firewall `network`/`ice` permission before creating a
peer. Credentials pasted in settings are stored in the host origin's localStorage;
use operator-managed credentials appropriate for that lifetime. Credential refresh
via provider-specific tools is not implemented. Without configured ICE, peers are
limited to connectivity available through local host candidates.

The endpoint parser accepts the STUN/TURN forms in
[RFC 7064](https://www.rfc-editor.org/rfc/rfc7064) and
[RFC 7065](https://www.rfc-editor.org/rfc/rfc7065), restricted to hostnames/IP
literals, optional ports and TURN's `transport=udp|tcp`. Credentials in URLs,
paths, fragments and arbitrary query parameters are rejected.

## Checked contracts and verification

- NAP-WEBRTC draft #59: `fb4dd6f0e6294e1837733d2af61931e3e114bd97`.
- NAP-CVM draft #31: `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`.
- NAP-SHELL master: `377bf939c6c906817084b43dd21d424de646dbc2`.
- `zeSchlausKwab/napplet-soy` host profile and realtime extension docs:
  `a0863d7cdc71c0553a49481deaa1c4e24beb0314`.

The NAP request/result, authorization and lifecycle boundaries follow those
drafts. Signaling and provider selection are explicit host policy, not a new NAP
wire field or a claim of standardized discovery. The packaged SDK's old family
argument is translated to canonical selectors with a warning once per iframe;
see [compatibility](compatibility.md) and upstream
[napplet/web#336](https://github.com/napplet/web/issues/336).

`paja-multiplayer.spec.ts` exercises real signed/encrypted CVM traffic and an
independently implemented signaling peer in Chromium: registry invocation, shared
authenticated transport identity, delivery fallback, and bidirectional JSON.
Local peer tests permit loopback candidates because CI need not support multicast
DNS or private-interface routing. This is not separate-network NAT/TURN acceptance.
