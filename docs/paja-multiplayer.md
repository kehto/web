# Multiplayer providers in Paja

Paja can use an operator-selected CVM provider and the documented `soy-rtc/1`
signaling profile. This lets the same signed napplet use compatible rooms across
hosts. No provider URL, public key, family label, or app address is built in.

Open **Multiplayer providers** in the host sidebar. To configure signaling, paste your provider settings
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

For file-based CVM configuration, add one or more entries to `registry`. Each entry has `family`
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
Automatic selection of signaling and ICE settings is a discovery-contract gap,
so those settings remain explicit.

## Discover and save CVM families

The **Discover CVM tools** input accepts:

- A `nevent` (optionally prefixed with `nostr:`) referencing a signed kind-11316
  server announcement or kind-11317 tool inventory. Relay hints take precedence
  over the host relay set. A server announcement resolves its author's inventory.
- A 64-character CEP-15 tool schema hash. Paja queries the host's configured live
  relays for kind-11317 announcements with a matching `i` tag.
- An HTTPS website URL or hostname. Paja reads the origin's
  `/.well-known/napplet.json`, expects `version: 1` and
  `backend: { pubkey, relays }`, then queries those relays for that author's
  tool inventory. The website must allow browser cross-origin requests (CORS).

For Nostr references, a signed CEP-17 kind-10002 relay list selects the provider's
operational relays when available; unmarked relay URLs take precedence. Otherwise
Paja retains the discovery relays for review in the generated JSON.

Choose a provider when multiple results are found. Review the tool pins, choose
the tools to include, and set the **Local family label** expected by your app
(for example, `soy.rooms.v1`). The generated JSON is read-only and labelled with
its source document or event. **Edit JSON manually** makes an editable copy and
marks its source as manual; **New manual family** starts a separate entry.

**Save family and reload** persists the selection for this host origin. Several
families and providers can coexist. Saved entries are merged with the file or
multiplayer JSON registry; the same label/provider pair uses the saved entry.
Removing a saved entry restores any configured entry with that pair. Saved
families also work with ordinary CVM, without selecting a signaling profile.
All apps reload after a save or removal so their existing scopes are disposed.

Paja verifies announcement signatures and recomputes each tool's CEP-15 hash.
Advertised metadata or named hash tags that disagree are rejected. The newest
inventory per author is used; an invalid newest inventory doesn't fall back to
older schemas. Imports are limited to complete inventories of 1–64 tools and
16 saved families. Discovery times out after 15 seconds. Registry calls still
verify the live schemas and require the existing runtime permissions.

Family labels and membership are host choices: ContextVM defines per-tool
identity, not a portable named-family manifest. `naddr` is therefore unsupported;
use `nevent` for ContextVM's replaceable announcements. Website discovery uses
the provider's published endpoint convention, not a new NAP wire contract.
No WebRTC profile, ICE credentials, or tool invocation is inferred from it.

A hash search needs the provider's CEP-15 `i` tags and a relay carrying its
announcement. Missing tags can prevent hash discovery even when URL or `nevent`
discovery works. Soy's missing tags are tracked in
[soytec/napplet-soy#70](https://github.com/soytec/napplet-soy/issues/70).

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
