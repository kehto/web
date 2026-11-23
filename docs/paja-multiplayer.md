# Multiplayer signaling in Paja

Paja can use an operator-selected signaling profile, the documented `soy-rtc/1`,
so the same signed napplet can join compatible rooms across hosts. No provider
URL, public key, family label, or app address is built in.

Open **Multiplayer signaling** in the host sidebar, paste your provider's
signaling settings as JSON, then choose **Save and reload**. Settings belong to
this host origin; clearing the field restores the server's config. A file-based
host can instead set the same object at `simulation.multiplayer`:

```json
{
  "profile": "soy-rtc/1",
  "relays": ["wss://signaling.example"],
  "iceServers": [{ "urls": ["stun:stun.example:3478"] }]
}
```

CVM families are configured separately, in **ContextVM providers** or at
`simulation.cvm.registry`. See [ContextVM providers in Paja](paja-cvm-providers.md).
Rooms that are reached through a CVM tool need both. With a signaling profile,
the CVM transport uses the signaling `relays` and the same per-window key as
WebRTC; without one, CVM uses the host relays.

`simulation.multiplayer.registry` still works for existing configs. It is
deprecated: Paja merges it into the CVM registry and warns
`[PAJA_MULTIPLAYER_REGISTRY]` once per page load. Move those entries to
`simulation.cvm.registry`. An empty `registry: []` is ignored without a warning.
See [compatibility](compatibility.md).

Paja does not infer signaling from a provider's hostname. The currently observed
`.well-known/napplet.json` discovery document exposes backend key/relay hints but
does not describe signaling profiles, family membership, key coupling, or ICE.
Automatic selection of signaling and ICE settings is a discovery-contract gap,
so those settings remain explicit.

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
wire field or a claim of standardized discovery. Registry types come from
`@napplet/core` 0.42.0, which exports the draft's selector contract
([napplet/web#336](https://github.com/napplet/web/issues/336), fixed upstream).
Napplets built against `@napplet/nap` 0.40.0 or older still pass a family
string; that argument is translated to a canonical selector with a warning once
per iframe. See [compatibility](compatibility.md).

`paja-multiplayer.spec.ts` exercises real signed/encrypted CVM traffic and an
independently implemented signaling peer in Chromium: registry invocation, shared
authenticated transport identity, delivery fallback, and bidirectional JSON.
Local peer tests permit loopback candidates because CI need not support multicast
DNS or private-interface routing. This is not separate-network NAT/TURN acceptance.
