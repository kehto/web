# @kehto/paja

Development runtime for local napplet authoring and static pointer-loaded
napplet testing.

The runtime is designed to be used from a napplet package script:

```json
{
  "scripts": {
    "dev": "kehto paja --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1"
  }
}
```

The target URL is explicit on purpose. Kehto can spawn any framework command and
wait for that URL, but it does not guess which URL the framework chose. Loading
that URL through Paja as injected `srcdoc` lets Kehto install mandatory
`window.napplet.shell` plus enabled optional domains before app code runs. The
Kehto host-owned shell prelude completes `shell.ready` / `shell.init` and caches
capability queries,
while a `<base>` tag keeps the
app's own assets and HMR pointed at the target dev server without Vite, Svelte,
React, or any other framework lock-in.

The package provides the typed option model, CLI parser, runtime server, host
page, and host config surface. Local target-url mode keeps one target iframe
with a reload loop and a development console wired through a real
`ShellBridge`, `@kehto/runtime`, and service adapters for the current web NAP
surface: relay/outbox, storage, identity, keys, config, resource, theme, notify,
media, upload, intent, count, link, common, lists, serial, BLE, WebRTC, DM, FS,
CVM, and inc. Relay/outbox defaults to live public relays
and uses NIP-65 relay-list bootstrap plus kind `3` contact-list reads for
identity flows; `--relay-mode memory` is the explicit deterministic fixture
mode and does not advertise relay, outbox, count, or DM. `shell` is the
mandatory, non-toggleable handshake domain; the deprecated legacy package path
remains an upstream compatibility alias to `inc`.

## Dev-server CORS requirement

The target iframe is sandboxed without `allow-same-origin`, so the napplet
document has an opaque origin and requests its own assets with `Origin: null`.
`<script type="module">` is always fetched in CORS mode, so a dev server that
does not allow that origin blocks the napplet's entry module and the frame
renders blank. Vite's default `server.cors` allowlist covers only `localhost`,
`127.0.0.1`, and `[::1]` origins, so it rejects `null`:

```js
// vite.config.js
export default {
  server: { cors: { origin: '*' } },
};
```

Any dev server works as long as it answers `Origin: null` with
`Access-Control-Allow-Origin: *` or `null`. Paja probes the target on startup
and logs a `paja.target.cors.error` entry in the message log, plus a console
warning, when the target would block the sandboxed frame.

The console shows supported interfaces with per-domain injection toggles,
runtime ACL controls, signer controls, and a filterable message log with visible
error details. In runtime-pointer mode, ACL controls always display and mutate
the active tab's resolver-verified d-tag and aggregate hash; a grant or revoke
rerenders that same identity immediately. Paja auto-connects a browser NIP-07 signer when `window.nostr` is
available, can connect to a bunker/NIP-46 URI, and only uses the generated local
development signer when the Dev signer button is selected. Sign, publish, DM
send, filesystem picker, Blossom upload, and external-link requests use one serialized in-page
confirmation dialog. Deny has initial focus and Escape denies. A napplet-scoped
sign request defaults to one-time approval, with explicit options to remember
that event kind or trust every kind from the napplet identity and target. The trust
choice carries a visible warning. Remembered signing authority is keyed by the
active signer pubkey, host-owned napplet d-tag and aggregate hash, and the Paja
target boundary. Runtime pointers are isolated by verified artifact hash;
direct development targets are isolated by exact target URL, and their trust
survives code reloads at that URL. Changing the signer, identity, artifact, or
target asks again. Missing source identity or a nonnumeric kind remains
one-shot, denials are never remembered, and the signer controls can revoke
every remembered approval. If durable deletion fails, Paja keeps the approval
listed and logs the failure instead of claiming revocation. A full Paja host
reload creates a new ephemeral Dev signer and therefore asks again; a stable
NIP-07 or NIP-46 account can reuse its saved choice. Publish and other operation
confirmations continue to prompt independently. This is Paja runtime policy under draft
[NAP-RELAY PR #2 at `0be8abce18beb46ca37bd4ddd042f58d30b4eedc`](https://github.com/napplet/naps/pull/2), not
a Kehto kernel default. Upload consent identifies the requesting napplet, file, MIME type,
size, selected server, and durable public effect before bytes leave the browser.
A denial or a live publish with no accepting relay returns a canonical failure
and is not added to Paja's in-memory relay view. Paja's scoped-relay hook
likewise waits for the backend result and returns `false` after denial or
transport failure.

WebRTC is advertised only when the host has the browser WebRTC API, a live
relay boundary, and a connected signer with NIP-44 support. Paja owns the
`RTCPeerConnection` and data channels, uses signed kind-25050 Nostr events for
encrypted offer/answer signaling, and asks for explicit session consent with a
network-metadata warning. Napplets receive only NAP session/events and JSON data
channel payloads—never SDP, ICE state, relay sockets, or peer-connection objects.
This implementation tracks pinned
[NAP-WEBRTC `5fae95dd2c8e59bd06c654e0845656add077dcda`](https://github.com/napplet/naps/blob/5fae95dd2c8e59bd06c654e0845656add077dcda/naps/NAP-WEBRTC.md)
and the kind/tag conventions in
[NIP-100 PR #363 at `ead1cd6`](https://github.com/nostr-protocol/nips/pull/363).

DM is advertised only with live relays and Paja's selected Dev signer, whose
runtime-owned secret key can create and unwrap real NIP-17 gift wraps. Sends
receive one explicit plaintext/recipient confirmation, publish only verified
kind-1059 envelopes through the authorized relay path, and reload encrypted
history from relays rather than treating a memory fixture as persistence.
Napplets receive normalized NAP-DM messages, never secret keys, seals, rumors,
or relay sockets. This implementation follows draft
[NAP-DM `a0a48588`](https://github.com/napplet/naps/blob/a0a48588b3c9caca9540cccec19635b85231a00f/naps/NAP-DM.md).

FS is advertised only after Paja successfully opens the browser's real
origin-private filesystem. Each verified napplet identity gets a durable OPFS
`/workspace`; browser file/directory pickers add session-only opaque virtual
mounts after host approval. The backend implements metadata, directory lists,
bounded range reads, canonical padded-base64 writes, replace/append/patch,
revisions and preconditions, recursive mkdir/remove, atomic handle moves when
the browser supports them, and advisory watches over actual storage. Host
paths and handles never cross the NIP-5D boundary. This implementation follows
draft [NAP-FS `b640cf33`](https://github.com/napplet/naps/blob/b640cf337c0481f0f9a0216c00843f797a5c6df6/naps/NAP-FS.md).

Other domains are equally capability-bound. Relay, outbox, and count require
live relays; count uses NIP-45 `COUNT` without downloading events. Storage
requires writable `localStorage`; the memory setting is an unadvertised fixture.
Keys requires a document listener, media requires the browser Media Session
API, notifications require Paja's host renderer, links require browser
navigation, and intent requires the installed-catalog/runtime-tab host
controller. DM also requires the Dev signer and live relays; FS requires a
successful OPFS probe, while picker calls additionally require the corresponding
browser API and a host-owned approval click. Missing host boundaries remove
those domains from `shell.init`.
Live relay URLs are validated before advertisement, fixture events and local
publish echoes never enter live reads, and relay event sidecars disclose only
sources that the relay pool actually observed.

## Standard identity and social-cache boundary

A signed-in napplet reads Paja identity and social data only through existing
`identity.getPublicKey`, `identity.getFollows`, and ordinary kind-0
`outbox.query` messages. Paja exposes no social namespace, direct networking,
or signer/key capability for this behavior.

Paja privately validates the active account's replacement kind-3 contact list,
then warms followed kind-0 profile records through its established outbox router.
The resulting snapshot is active-account-scoped and memory-only. It is distinct
from generic simulation cache mode; it is not napplet-owned storage and has no
durable-cache controls. Captured-key request correlation keeps a follows request
bound to the account that started it, while generation-safe background writes
prevent stale-account data from becoming the active snapshot.

A normal query can include matching cached `RelayEventResult` values, but Paja
retains the base router's query-wide `incomplete` and `error` fields. A cache hit
does not make a degraded query complete. Profile winner selection, pagination,
follow mutation, durable-cache management, and per-author completeness are
outside this behavior.

[NAP-IDENTITY at `6461e4b37c29dc09a20dff35d9515889c4433874`](https://github.com/napplet/naps/blob/6461e4b37c29dc09a20dff35d9515889c4433874/naps/NAP-IDENTITY.md)
is byte-identical to the recorded `napplet/naps` master document for this phase.
Pinned [NAP-OUTBOX at `4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e`](https://github.com/napplet/naps/blob/4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e/naps/NAP-OUTBOX.md)
together with installed `@napplet/nap@0.31.2` types is the PoC contract because
current master has no NAP-OUTBOX path. Paja therefore makes no current-master
OUTBOX conformance claim. Blossom upload behavior targets pinned
[NAP-UPLOAD at `a7cc17463cbf5d9cb87884b31071bc4fc826034c`](https://github.com/napplet/naps/blob/a7cc17463cbf5d9cb87884b31071bc4fc826034c/naps/NAP-UPLOAD.md).

The static Paja Runtime build is served at `/web/paja/` in the GitHub Pages
artifact. It uses the same browser host and service adapters, but loads verified
napplet HTML from pasted `naddr` or `nevent` pointers with `hmr: none`. Each
loaded pointer becomes a closeable header tab; loading an already-running
napplet opens a choice to load another instance, switch to the existing tab, or
cancel. Each tab includes a share control that copies a `/web/paja/?naddr=...`
or `/web/paja/?nevent=...` link for that pointer, and the browser remembers open
runtime tabs in local storage so returning to `/web/paja/` restores the previous
pointer set. An explicit pointer in the URL still takes precedence over restored
tabs.

The static artifact defaults to Paja's standard live relays and memory uploads.
To point it at specific live relays or Blossom upload servers, pass
comma-separated host lists when generating the artifact:

```bash
PAJA_RELAY_URLS="wss://relay.example,wss://relay.example.net" \
PAJA_UPLOAD_SERVERS="https://blossom.example" \
node scripts/build-paja-pages.mjs
```

When `PAJA_UPLOAD_SERVERS` is set, the runtime enables the Blossom upload rail
with server discovery and uses those servers for Blossom NAP-RESOURCE
resolution too.

## Installed intent handlers and delivery

Paja keeps resolver-verified pointer and manifest facts in an installed catalog,
separate from the live tab/controller map. A verified install inserts or replaces
the catalog record; an explicit artifact removal removes it. Closing, reloading,
or replacing a frame never makes an installed handler unavailable, so a cold
target can still be selected and started later.

Intent selection considers only exact compatible contracts from that catalog.
Paja can use a compatible user default, ask its host chooser when more than one
candidate is available, or reject an ambiguity. An explicit handler d-tag is
accepted only when it is an installed compatible handler and the invoking sender
has been explicitly authorized for it. It is not a request to deliver to an
arbitrary running frame.

When Paja receives an invocation, it selects and opens or reuses a verified
target. The controller waits for the target generation's
registered `MessageEvent.source` to establish its real `shell.ready` session;
it checks that generation is still current, sends one target-only `inc.event`
with the selected queryless convention, and returns the final handled target
identity. A superseded target/source, failed open/readiness, or terminal send is
handled by the controller's replacement/retry/terminal policy and produces a
canonical failed `IntentResult`.

`@napplet/shim@0.29.2` supplies no generic shell API. Kehto deliberately keeps
its host-owned mandatory `window.napplet.shell` prelude: it installs the live
receiver before the one bare `shell.ready`, caches the first `shell.init`, and
provides local `ready()`, `supports()`, read-only `services`, and one-shot
`onReady()`. This is the documented upstream-package-drift exception, not a
shim capability.

Before Paja assigns a verified runtime-pointer document to `srcdoc`, it inserts
Kehto's local Class-1 CSP before the host-owned namespace prelude. The policy
denies all defaults; permits inline script/style, WebAssembly compilation through
the narrow `'wasm-unsafe-eval'` source, `data:`/`blob:` images, and `data:` fonts;
keeps JavaScript string evaluation blocked; grants `connect-src` only to the resolved relay and Blossom
origins; explicitly denies worker, child, frame, media, object, manifest,
prefetch, base, and form capabilities; and ends with `frame-ancestors 'self'`.
The NIP-5D verified-srcdoc and opaque-sandbox rules do not mandate this CSP;
it is Kehto policy. Local target-URL authoring mode is intentionally outside
this verified-artifact policy path.

Environment simulation can be supplied through CLI flags or a JSON config file:

```bash
kehto paja \
  --target-url http://127.0.0.1:5173 \
  --identity-mode fixed \
  --identity-pubkey 4444444444444444444444444444444444444444444444444444444444444444 \
  --relay-mode disabled \
  --capability relay:off \
  --capability outbox:off \
  --theme light \
  --config-value 'density="compact"'
```

```json
{
  "targetUrl": "http://127.0.0.1:5173",
  "simulation": {
    "identity": {
      "mode": "fixed",
      "pubkey": "4444444444444444444444444444444444444444444444444444444444444444"
    },
    "relay": { "mode": "disabled" },
    "capabilities": { "domains": { "relay": false, "outbox": false } },
    "theme": { "mode": "light" },
    "config": { "values": { "density": "compact" } }
  }
}
```

Configured `config.values` are only a seed for identities with no saved
settings. A napplet must register a valid NAP-CONFIG schema before any values
are delivered. Paja then validates/defaults the seed, persists commits under
the host-resolved `(dTag, aggregateHash)`, and exposes a shell-owned settings
dialog; napplets remain read-only. If durable browser storage or that host UI
is unavailable, Paja does not advertise `config`.

## NAP-UPLOAD modes

Paja keeps `memory` as the default unadvertised upload fixture. It does not
register `window.napplet.upload`, return success, or store bytes. Opt into real
Blossom storage with a shell-owned server and an active Dev, NIP-07, or NIP-46
signer:

```bash
kehto paja \
  --target-url http://127.0.0.1:5173 \
  --upload-mode blossom \
  --upload-server https://blossom.example \
  -- pnpm vite --host 127.0.0.1
```

Paja prompts with the napplet identity, file details, selected server, and a
public/durable warning before it signs or sends bytes. Production servers must
use HTTPS; plain HTTP is accepted only for loopback development hosts. The
server must allow Paja's browser origin, `PUT` and `OPTIONS`, plus the
`Authorization` and `Content-Type` CORS headers.

Explicit servers win. With no explicit server, Paja may use an independently
warmed snapshot of the active signer's newest BUD-03 kind `10063` `server`
tags. `upload.info` and `upload.upload` never initiate that discovery. Pointer
loader Blossom hints are artifact sources, not upload policy. The current path
uses the first server only, returns its direct HTTP(S) URL, and does not mirror
or construct BUD-10 URLs.

Completion requires the server descriptor to confirm the exact local SHA-256
and byte size as a non-negative safe integer. Missing or mismatched proof is a
failed result even after an HTTP success. The configured identity, provider,
signer, discovery author, and signed authorization pubkeys must agree; a fixed
pubkey without `signEvent` is read-only. This implements the draft
[NAP-UPLOAD at `a7cc174`](https://github.com/napplet/naps/blob/a7cc17463cbf5d9cb87884b31071bc4fc826034c/naps/NAP-UPLOAD.md).

## NAP-RESOURCE schemes

Paja's developer-runtime policy accepts arbitrary `http:` and `https:` resource
URLs so a normal remote image does not look broken merely because its origin was
not pre-granted. Paja resolves those URLs with browser `fetch`, omits credentials
and referrer data, caps responses at 10 MiB, and classifies MIME from returned
bytes. Browser network and CORS rules still apply: an unreadable response is the
canonical `network-error`, while any CORS-readable response is returned as NAP
bytes.

`data:` remains locally decoded. `blossom:` is a separate, content-addressed
boundary and is advertised only when at least one usable host-owned
runtime-pointer or upload server is configured. The only accepted identifier is
`blossom:sha256:<hex>`; Paja refuses redirects, verifies the requested SHA-256,
and permits plain-HTTP Blossom transport only for configured loopback
development servers. Resource-origin permissiveness does not alter Paja's
independent signer confirmations. This behavior targets draft
[NAP-RESOURCE at `fa6bcc6`](https://github.com/napplet/naps/blob/fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1/naps/NAP-RESOURCE.md).

Full package docs: [`docs/packages/paja.md`](../../docs/packages/paja.md).
Getting started: [`docs/how-tos/paja-getting-started.md`](../../docs/how-tos/paja-getting-started.md).
Local authoring how-to: [`docs/how-tos/paja-local-authoring.md`](../../docs/how-tos/paja-local-authoring.md).
Generated API module: `docs/api/modules/_kehto_paja.html` (run `pnpm docs:api`).
