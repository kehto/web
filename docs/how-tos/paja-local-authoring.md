# Use Paja for Local Napplet Authoring

Use `@kehto/cli` when you want a local napplet app to run inside Paja, the real
Kehto iframe authoring workshop, while keeping the app dev server's own HMR.

## Install

```bash
pnpm add -D @kehto/cli
```

Use the matching package-manager command in npm or Yarn projects:

```bash
npm install --save-dev @kehto/cli
yarn add --dev @kehto/cli
```

## Add a Dev Script

Keep the app dev server command separate from the Kehto wrapper. The target URL
stays explicit so Kehto does not guess framework ports.

### pnpm

```json
{
  "scripts": {
    "dev": "kehto paja --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1"
  }
}
```

### npm

```json
{
  "scripts": {
    "dev": "kehto paja --target-url http://127.0.0.1:5173 -- npm run dev:app -- --host 127.0.0.1",
    "dev:app": "vite"
  }
}
```

### Yarn

```json
{
  "scripts": {
    "dev": "kehto paja --target-url http://127.0.0.1:5173 -- yarn dev:app --host 127.0.0.1",
    "dev:app": "vite"
  }
}
```

Run the script and open the printed runtime URL:

```bash
pnpm dev
```

The browser page shows a development console beside one sandboxed target iframe
in target-url mode. The console includes interface injection toggles, ACL
controls, signer status, and a filterable message log. Use the chevron button in
the top bar to collapse the console to the left when you want the full window
for the app; the same button restores it, and Paja remembers the choice per
browser origin. Collapsing never reloads the target, so the running napplet
keeps its shell state. Paja fetches the target
HTML into injected `srcdoc` so `window.napplet.<domain>` exists before app
bootstrap, while target assets and HMR still resolve through the framework dev
server. The runtime reload button reinitializes the Kehto shell state around the
same target URL.

Each section is also an independent flush native accordion: **Pointer** where
present, **Interfaces**, **ACL**, **Signer**, **Resource servers**, then **Messages**
last. Use Enter/Space on a focused header; focus outlines and chevrons indicate
state. Sections start expanded and remember collapsed booleans per origin under
`kehto:paja:sidebar-sections:v1`. Invalid entries are ignored and storage failures
leave session-only toggles usable. These preferences are separate from whole-drawer
visibility and saved resource origins. Closing a section retains its live controls,
unsaved drafts and the running app; reopen it to continue editing.

The published `@napplet/shim@0.30.0` remains non-shell. Paja therefore retains
Kehto's host-owned mandatory `window.napplet.shell` prelude, installed before
one bare `shell.ready`; its first `shell.init` is cached for local `ready()`,
`supports()`, read-only `services`, and one-shot `onReady()`. `shell` is not a
manifest-optional toggle. Optional `dm` follows NIP-5D's truthful-presence rule:
Paja advertises it only while the **Dev** signer is selected, relay mode is
`live`, the relay backend is available, and the DM interface toggle is enabled.
In that state Paja routes NAP-DM through its runtime-owned NIP-17 adapter for
history, consent-gated send, and live subscriptions; memory relay mode and
NIP-07/NIP-46/fixed-identity modes do not advertise `dm`. See the immutable
[NIP-5D authority at
`eb45dfd7335b7f88cb53781984c553581d2b4c34`](https://github.com/nostr-protocol/nips/blob/eb45dfd7335b7f88cb53781984c553581d2b4c34/5D.md)
and [NAP-DM at
`a0a48588b3c9caca9540cccec19635b85231a00f`](https://github.com/napplet/naps/blob/a0a48588b3c9caca9540cccec19635b85231a00f/naps/NAP-DM.md).

## Allow the Sandboxed Frame's Origin

Paja sandboxes the target iframe without `allow-same-origin`, so the app
requests its own assets with `Origin: null`. Module scripts are always fetched
in CORS mode, so the dev server must allow that origin or the app's entry module
is blocked and the frame stays blank.

Vite's default `server.cors` allowlist covers only `localhost`, `127.0.0.1`, and
`[::1]`, so add:

```js
// vite.config.js
export default {
  server: { cors: { origin: '*' } },
};
```

Other dev servers need the equivalent: answer `Origin: null` with
`Access-Control-Allow-Origin: *` or `null`. If the target would block the frame,
Paja logs a `paja.target.cors.error` entry in the **Messages** panel and warns on
the browser console with the remedy, so a blank frame is never the only signal.

## Use an Existing Target Server

If another process already serves the app, omit the command:

```bash
kehto paja --target-url http://127.0.0.1:5173
```

## Add Simulation Config

Create `kehto.dev.json`:

```json
{
  "targetUrl": "http://127.0.0.1:5173",
  "simulation": {
    "identity": {
      "mode": "fixed",
      "pubkey": "4444444444444444444444444444444444444444444444444444444444444444"
    },
    "relay": { "mode": "disabled" },
    "capabilities": {
      "domains": {
        "relay": false,
        "outbox": false
      }
    },
    "theme": { "mode": "light" },
    "config": {
      "values": {
        "density": "compact"
      }
    }
  }
}
```

Then run:

```bash
kehto paja --config kehto.dev.json
```

CLI flags override the matching config-file fields, so a script can keep common
defaults in `kehto.dev.json` and still switch one mode for a test:

```bash
kehto paja --config kehto.dev.json --theme dark
```

## Add Extra Blossom Resource Servers

In either target-URL or runtime-pointer mode, use the sidebar's **Resource
servers** textarea and **Save** for read-side lookups. For example:

```text
cdn.example
https://media.example:8443
```

Use one public HTTPS origin per line; bare domains use HTTPS. Save ignores blank
lines, normalizes equivalent origins and removes duplicates in first-seen
order. HTTP, credentials, paths, query/fragment delimiters, malformed input and
obvious local/private hosts are rejected with a line-specific error. A rejected
save leaves the active and durable list unchanged. Unsaved drafts do nothing.
Save an empty textarea to clear only extras.

Valid changes apply to subsequent Blossom requests in every running tab without
reloading napplets. Extras persist per host origin (including port) in
`localStorage`, not in napplet NAP-CONFIG. If storage cannot restore/write/clear
the list, the inline status explains the failure. Valid changes remain usable
session-only when persistence fails; a stale durable list can return after
reload if clearing could not be saved.

Extras come after request hints, event/publisher/user discovery, per-window
manifest hints and existing configured defaults. The combined cap stays eight
servers, so extras may not be tried when earlier candidates fill the cap. This
does not change upload destinations, initial pointer/artifact fetching, direct
HTTP(S) resource URLs, or napplet CSP/network grants. Browser CORS still applies;
browser-only Paja cannot enforce DNS-time private-address checks.

The host-owned policy was checked against
[NAP-RESOURCE `9511232f69313aa7953d110e35d32cc28d506f66`](https://github.com/napplet/naps/blob/9511232f69313aa7953d110e35d32cc28d506f66/naps/NAP-RESOURCE.md)
and PR #80 head
[`fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`](https://github.com/napplet/naps/blob/fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1/naps/NAP-RESOURCE.md).
The latter removes request `servers` and changes bulk `requests` to `urls`;
this UI feature does not migrate the existing packaged wire contract or claim
full browser network conformance.

## Use Real Blossom Uploads

Paja's default `memory` upload mode is an unadvertised fixture and stores
nothing. It does not create `window.napplet.upload` or make
`shell.supports("upload")` true. Add an explicit shell-owned Blossom server for
real upload traffic:

```json
{
  "targetUrl": "http://127.0.0.1:5173",
  "simulation": {
    "upload": {
      "mode": "blossom",
      "servers": ["https://blossom.example"],
      "discoverServers": true,
      "maxBytes": 10485760,
      "mimeTypes": ["image/png", "application/pdf"]
    }
  }
}
```

The equivalent CLI flags are `--upload-mode blossom` and repeatable
`--upload-server <url>`. Explicit servers win. Without one, signer lifecycle
may warm the active identity's newest BUD-03 kind `10063` server list. Neither
`upload.info` nor an upload request starts discovery, and pointer-resolution
Blossom hints are not upload endpoints.

Select Dev, NIP-07, or NIP-46 in the signer controls. A fixed pubkey alone is
read-only, and any disagreement between configured, provider, signer,
discovery, or signed-event pubkeys fails closed. Each upload first shows an
upload-specific prompt naming the napplet, bytes, MIME type, selected server,
and public/durable effect. Denial happens before authorization signing or
storage egress.

Use HTTPS except for `localhost`, `127.0.0.0/8`, or `[::1]` development
servers. Browser-facing Blossom servers must allow CORS `OPTIONS` and `PUT`
with `Authorization` and `Content-Type`. Paja currently uploads to the first
server only and returns its direct URL; it does not mirror or build BUD-10
URLs. A response is complete only when its descriptor confirms the exact
SHA-256 and integer byte size. See the pinned draft
[NAP-UPLOAD at `a7cc174`](https://github.com/napplet/naps/blob/a7cc17463cbf5d9cb87884b31071bc4fc826034c/naps/NAP-UPLOAD.md).

## Verify the Runtime Surface

Inside the target iframe, mandatory `window.napplet.shell` and enabled optional
domains are present before authored app scripts run. Its receiver is installed
before one `shell.ready`; the returned `shell.init` is cached for `ready()`,
`supports()`, `services`, and `onReady()`. Disabled optional capability domains
are removed from the injected namespace and from the advertised `domains` and
`naps` lists, while enabled domains route through Kehto runtime and reference
services.

The default relay/outbox backend is live. It queries configured public relays,
uses NIP-65 relay-list events (`kind:10002`) for outbox routing, and reads
contact-list events (`kind:3`) for identity/follow data. `window.napplet.count`
can send `count.query` requests for non-empty NIP-01 filter arrays and receives
exact aggregate counts from the active relay backend. Use `--relay-mode memory`
for deterministic fixture tests, or disable the relay domain to disable count as
well.

Paja auto-connects a browser NIP-07 signer when `window.nostr` is available,
can switch to a bunker/NIP-46 URI, and exposes a Dev signer button for explicit
synthetic local signing. Without a browser signer, bunker URI, fixed identity, or
Dev signer selection, `identity.getPublicKey` reports no connected account
instead of inventing one. Every sign, publish, Blossom upload, or external-link
request uses Paja's in-page confirmation dialog before it runs. Signing starts
as one-time consent. Napplet-attributed requests can remember one exact event
kind or, after a prominent warning, trust every kind from that napplet identity
and Paja target. Remembered choices are scoped to the signer pubkey, host-owned
d-tag and aggregate hash, plus the verified runtime-pointer artifact or exact
direct-target URL. Direct-target trust survives code reloads at that URL.
Choices can be revoked from the Signer panel and never skip the separate publish
confirmation. A full Paja host reload generates a new ephemeral Dev key and
therefore asks again; a stable NIP-07/NIP-46 account can reuse its saved choice.
If browser storage refuses revocation, Paja retains the listed choice and logs
the failure.

## Read Social Data Through Standard NAP Messages

For a signed-in napplet, call `identity.getPublicKey`, `identity.getFollows`, and
ordinary kind-0 `outbox.query`. Paja does not expose a custom social API, direct
networking, or signer/key access for follows and profiles. It privately validates
the active account's replacement kind-3 contact list and warms followed kind-0
profile records through its established outbox router.

The snapshot is active-account-scoped and memory-only, not napplet-owned storage
or a durable-cache control, and is separate from generic simulation cache mode.
Captured-key request correlation keeps follows tied to the account that started
the request; generation-safe background writes keep stale account data from
becoming active. Normal queries can include matching cached `RelayEventResult`
values while retaining base-router query-wide `incomplete` and `error`. Cached
values do not make a degraded query complete. Profile winner selection,
pagination, follow mutation, durable cache management, and per-author
completeness are outside this behavior.

[NAP-IDENTITY `6461e4b37c29dc09a20dff35d9515889c4433874`](https://github.com/napplet/naps/blob/6461e4b37c29dc09a20dff35d9515889c4433874/naps/NAP-IDENTITY.md)
is byte-identical to the recorded `napplet/naps` master document. Pinned
[NAP-OUTBOX `4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e`](https://github.com/napplet/naps/blob/4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e/naps/NAP-OUTBOX.md)
with installed `@napplet/nap@0.32.0` types is the PoC contract because current
master has no NAP-OUTBOX path; this is not a current-master OUTBOX conformance
claim. Blossom behavior targets pinned
[NAP-UPLOAD `a7cc17463cbf5d9cb87884b31071bc4fc826034c`](https://github.com/napplet/naps/blob/a7cc17463cbf5d9cb87884b31071bc4fc826034c/naps/NAP-UPLOAD.md).

The package API reference is generated at
[docs/api/modules/_kehto_paja.html](../api/modules/_kehto_paja.html).

### Verify intent convention delivery

For a verified installed intent handler, distinguish the persistent manifest
catalog from the live iframe. A closed iframe does not remove its installed
record. The host resolves only exact compatible installed conventions: it can
use a compatible default, use a chooser when there are multiple candidates,
reject an ambiguity, and accepts an explicit opaque handler ID only with sender-aware
authorization.

Paja opens or reuses the target, waits for the generation's registered source
to send `shell.ready`, verifies that generation is still current, and makes one
target-only `intent.deliver` for the selected convention. Acceptance acknowledges
retained responsibility before completion. Replacement, readiness failure, and
terminal send outcomes remain host-observable without a second source result.
