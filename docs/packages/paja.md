# @kehto/paja

Single-window Paja local authoring workshop for napplet development.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. The Paja API is new in v1.22 planning work
> and is not yet a stability guarantee for final NAP contracts.

## Install

```bash
pnpm add @kehto/paja
```

Install `@kehto/cli` instead when you only need the `kehto paja` command in an
app package's development scripts.

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/paja/package.json`, `packages/paja/src/index.ts` |
| Version | `0.15.0` |
| Runtime entry | `./dist/index.js` |
| CLI runner entry | `./dist/cli.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@kehto/firewall`, `@kehto/nip`, `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, `@kehto/wm` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.31.0 <0.32.0` |
| `@napplet/nap` | `>=0.31.0 <0.32.0` |
| `nostr-tools` | `>=2.23.3 <=2.x` |

## Primary APIs

| Area | Exports |
|------|---------|
| Options | `normalizePajaOptions`, `PajaOptions`, `PajaRawOptions`, `PajaCommand`, `PajaOptionsError` |
| Simulation | `normalizePajaSimulation`, `summarizePajaSimulation`, `PajaSimulation`, `PajaSimulationRawOptions`, `PAJA_SIMULATION_DOMAINS` |
| Config files | `loadPajaConfigFile`, `mergePajaRawOptions`, `resolvePajaRawOptions` |
| Host config | `createPajaHostConfig`, `createPajaRuntimeHostConfig`, `PajaHostConfig`, `PajaPointerRuntimeConfig`, `formatPajaUrl` |
| Host page | `renderPajaHtml`, bundled `/__kehto/browser-host.js` runtime bootstrap |
| Runtime pointers | `decodePajaPointer`, `resolvePajaPointer`, `injectPajaRuntimeCsp`, `PAJA_NAPPLET_MANIFEST_KIND`, `PAJA_NAPPLET_MANIFEST_KINDS` |
| Parity metadata | `PAJA_UPSTREAM_WEB_DOMAINS`, `PAJA_ADVERTISED_DOMAINS`, `PAJA_HANDSHAKE_DOMAINS`, `PAJA_COMPATIBILITY_ALIASES`, `PAJA_REQUIRED_SERVICES`, `getMissingAdvertisedDomains`, `getMissingServices` |
| Readiness | `waitForTargetUrl`, `ReadinessError`, `WaitForTargetUrlOptions`, `ReadinessFetch` |
| Server | `startPajaServer`, `PajaServer`, `PajaServerOptions` |
| Target CORS | `probeTargetCors`, `classifyTargetCors`, `PAJA_TARGET_CORS_HINT`, `PajaTargetCorsDiagnostic`, `PajaTargetCorsStatus`, `PajaTargetCorsFetch` |
| Defaults | `DEFAULT_PAJA_HOST`, `DEFAULT_PAJA_PORT`, `DEFAULT_READY_TIMEOUT_MS`, `DEFAULT_PAJA_RUNTIME_WAIT_MS` |

## CLI

```bash
kehto paja --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1
```

The target URL is explicit. Managed-command mode may start any framework dev
command, but readiness waits for the provided URL instead of guessing the port
or framework.

Simulation flags use the same schema as config files. Common flags:

```bash
kehto paja \
  --target-url http://127.0.0.1:5173 \
  --identity-mode fixed \
  --identity-pubkey 4444444444444444444444444444444444444444444444444444444444444444 \
  --relay-mode disabled \
  --capability relay:off \
  --capability outbox:off \
  --storage-mode memory \
  --upload-mode blossom \
  --upload-server https://blossom.example \
  --theme light \
  --config-value 'density="compact"'
```

`--storage-mode memory` is an explicit unadvertised fixture setting. Production
storage capability requires writable `localStorage` so NAP-STORAGE values
survive reloads.

The config-file form is the same raw option object:

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
    "storage": { "mode": "memory" },
    "upload": {
      "mode": "blossom",
      "servers": ["https://blossom.example"],
      "discoverServers": true,
      "maxBytes": 104857600,
      "mimeTypes": ["image/png", "application/pdf"]
    },
    "theme": { "mode": "light" },
    "config": { "values": { "density": "compact" } }
  }
}
```

CLI flags override config-file values at the same nested paths.

For package-manager script examples covering `pnpm`, `npm`, and `yarn`, see
[Use Paja for local napplet authoring](/how-tos/paja-local-authoring).

## Browser Host

In local target-url mode, the served host page is a single-window development
runtime: a control console beside one sandboxed target iframe, plus compact top
and bottom bars. The iframe is created without a static `src`; the browser
bootstrap sets `sandbox="allow-scripts"`, registers the iframe origin with
`@kehto/shell`, fetches the explicit target URL through the local Paja server,
and renders it as injected `srcdoc`. Paja prepends mandatory
`window.napplet.shell` plus the runtime-owned optional domain namespace before
authored scripts run and adds a `<base>` tag so target assets and HMR still
resolve against the app dev server. A real `ShellBridge` completes
`shell.ready` / `shell.init`; `@kehto/runtime` then handles ACL, firewall, storage,
INC, relay/outbox, and service dispatch. Reload uses a generation-specific
internal window id so the same iframe can receive a fresh `shell.init` without
restarting the CLI or the app dev server.

Because the frame is sandboxed without `allow-same-origin`, the napplet document
has an opaque origin and requests its own assets with `Origin: null`. Module
scripts are always fetched in CORS mode, so the app dev server must answer that
origin with `Access-Control-Allow-Origin: *` or `null`, or the entry module is
blocked and the frame renders blank. Vite's default `server.cors` allowlist
matches only `localhost`, `127.0.0.1`, and `[::1]` origins, so Vite projects need
`server: { cors: { origin: '*' } }`.

Paja does not leave that failure silent. `GET /__kehto/target-cors.json` probes
the configured target with an explicit `Origin: null` request — a header a
browser cannot forge, which is why the probe runs on the Paja server — and
classifies the response as `allowed`, `blocked`, or `unreachable`. The browser
host requests it once per target-url boot and, for anything other than
`allowed`, appends a `paja.target.cors.error` entry to the message log and warns
on the console with the remedy. `classifyTargetCors` and `probeTargetCors` are
exported for reuse.

The console includes:

- **Interfaces** — every supported Paja domain has an injection toggle. Toggling
  a domain updates the live capability override and reloads the target so the
  next `shell.init` reflects the changed support surface.
- **ACL** — every runtime capability can be granted or revoked for the target
  napplet identity. The controls write through `bridge.runtime.aclState`, so the
  next matching request is allowed or denied by the real runtime gate.
- **Signer** — Paja auto-connects a browser NIP-07 signer when `window.nostr`
  is available, can connect to a bunker/NIP-46 URI, and only uses the generated
  development signer when the Dev signer button is selected. Sign, publish,
  Blossom upload, and external-link requests use one serialized in-page
  confirmation dialog. Deny has initial focus and Escape denies. Napplet-scoped
  signing defaults to one-time approval. The dialog can instead remember the
  exact event kind or trust every kind from that napplet identity and target; the
  trust option has a prominent warning. Grants are keyed by active signer
  pubkey, host-owned napplet d-tag and aggregate hash, and the Paja target
  boundary. Runtime pointers use their verified artifact hash; direct targets
  use the exact target URL, with an explicit warning that trust survives code
  reloads at that URL. Another signer, identity, artifact, or target asks again.
  Unknown identity/kind remains one-shot, denials are never remembered, and
  **Forget remembered approvals** revokes all saved signer choices. Publish and
  other operation confirmations remain independent prompts. If browser storage
  refuses deletion, Paja retains the listed approval and logs the failed
  revocation. A full host reload creates a new ephemeral Dev signer and asks
  again; stable NIP-07/NIP-46 accounts can reuse their saved choices. This is
  Paja policy permitted by draft
  [NAP-RELAY PR #2 at `0be8abce18beb46ca37bd4ddd042f58d30b4eedc`](https://github.com/napplet/naps/pull/2), not a
  Kehto runtime default. Upload consent shows the requesting
  napplet, file, MIME type, size, server, and durable public effect before
  bytes leave the browser. A denial or a live publish with no accepting relay
  returns a canonical failure and does not enter Paja's in-memory relay view.
  Its scoped-relay hook likewise waits for the backend result and returns
  `false` after denial or transport failure.
- **Messages** — inbound and outbound envelopes are logged with a text filter,
  including Paja system events such as interface changes, ACL changes, signer
  connection changes, signing/publish confirmations, and visible details for
`.error` envelopes.

The GitHub Pages artifact also includes a static Paja Runtime at `/web/paja/`.
That route uses `createPajaRuntimeHostConfig`, keeps `hmr: none`, and loads
verified napplets into ShellBridge-backed iframe tabs from pasted `naddr` or
`nevent` pointers. `naddr` pointers resolve the latest matching NIP-5D named
manifest (`35129`) by author and `d` tag; `nevent` pointers resolve a specific
NIP-5D snapshot, root, or named manifest event id (`5129`, `15129`, or `35129`).
In both cases Paja verifies the signed manifest, aggregate hash, and every
Blossom blob, then injects the same runtime-owned `window.napplet.<domain>`
namespace before assigning iframe `srcdoc`. Before that namespace prelude, Paja
inserts Kehto's local Class-1 CSP: default deny; inline script/style;
`data:`/`blob:` images and `data:` fonts; `connect-src` limited exclusively to
the resolved relay and Blossom origins; explicit worker, child, frame, media,
object, manifest, prefetch, base, and form denial; and final
`frame-ancestors 'self'`. NIP-5D requires the verified `srcdoc` and opaque
`allow-scripts` sandbox, but not this CSP baseline, so the policy is a Kehto
security decision. Local target-URL mode remains outside the verified-pointer
policy path. Loading an already-running napplet
opens an in-page choice to load another instance, switch to the existing tab, or
cancel. Each tab includes a share control that copies a `/web/paja/?naddr=...`
or `/web/paja/?nevent=...` link for that pointer, and the browser remembers open
runtime tabs in local storage so returning to `/web/paja/` restores the previous
pointer set. An explicit pointer in the URL still takes precedence over restored
tabs.

Pointer relay hints are preferred, not exhaustive. Paja queries embedded
`naddr` / `nevent` relay hints first in the ordered candidate list, then any
pointer-specific relay overrides, then the effective configured live simulation
relays. URLs are normalized and deduplicated without changing first occurrence.
When relay simulation is disabled, configured relay URLs are not added as
fallbacks. Connection, fanout, and EOSE share one pointer-resolution deadline;
the UI distinguishes deadline or connection failure from the clean case where
all queried relays reached EOSE without a matching manifest. Wider relay search
does not weaken loading: manifest signature, aggregate, Blossom hash, and
`srcdoc` verification still fail closed.

### Installed catalog and intent lifecycle

The verified pointer catalog and the live runtime-tab/controller map have
different jobs. Paja writes immutable, serializable manifest facts only after a
pointer and its bytes have been resolver-verified, and removes them only at an
explicit installed-artifact removal boundary. A tab close, reload, or source
teardown does not remove the catalog entry. This lets an installed handler be
discovered and cold-started even when it has no live frame.

Availability and selection derive solely from that installed catalog's exact
convention contracts. A compatible default may be used; multiple compatible
candidates go to the host chooser; an unresolved ambiguity is rejected. An
explicit handler d-tag is valid only when it names a compatible installed record
and passes sender-aware explicit authorization. A current frame is only a later
delivery endpoint, never selection authority.

Paja may reuse a current target or start a cold one, but it waits for the
current target generation's registered `MessageEvent.source` and real
`shell.ready` session before one target-only `inc.event`. A replaced generation
is not delivered to; failed open/readiness attempts follow the private
retry/replacement policy. The final result includes the handled target's d-tag,
window identifier, and convention.

The published `@napplet/shim@0.29.2` is intentionally non-shell. Kehto's
host-owned prelude remains responsible for mandatory `window.napplet.shell`,
the one bare `shell.ready` / first `shell.init` handshake, and local cached
`ready()`, `supports()`, read-only `services`, and one-shot `onReady()`.

## NAP and Service Parity

Paja can advertise the following web NAP domains when their real host backend
is live:

`relay`, `outbox`, `identity`, `storage`, `inc`, `theme`, `keys`, `link`,
`common`, `lists`, `serial`, `ble`, `webrtc`, `media`, `notify`, `config`,
`resource`, `cvm`, `upload`, `intent`, `count`, `dm`, and `fs`.

`shell` is represented as the mandatory handshake domain rather than an
injected availability domain. The deprecated legacy compatibility package path
is represented as an upstream alias to `inc`; upstream
`@napplet/nap` does not register a separate runtime domain for that alias.

`dm` is conditional on live relays plus Paja's selected Dev signer. The
runtime-owned key creates and verifies actual NIP-17 gift wraps, history is
loaded from relays, and one host confirmation covers the cleartext send before
validated kind-1059 envelopes are published. It follows draft
[NAP-DM `a0a48588`](https://github.com/napplet/naps/blob/a0a48588b3c9caca9540cccec19635b85231a00f/naps/NAP-DM.md).

`fs` is conditional on a successful OPFS probe. It provides an
identity-scoped durable `/workspace`, browser-mediated session picker grants,
strict virtual paths, bounded range I/O, canonical base64, revisions,
replace/append/patch writes, directory mutation, supported atomic moves, and
advisory watches without exposing browser handles or host paths. It follows
draft [NAP-FS `b640cf33`](https://github.com/napplet/naps/blob/b640cf337c0481f0f9a0216c00843f797a5c6df6/naps/NAP-FS.md).

Default service wiring uses live relay/outbox behavior, localStorage state
persistence through the runtime, browser or configured identity, schema-validated
identity-scoped config and host-owned theme, notification, media, upload, intent, resource, common-profile,
bookmark-list, serial, BLE, WebRTC, NIP-17 DM, OPFS, and CVM adapters. `keys.forward` dispatches
an unbound forwarded keystroke in the host context. `link.open` accepts only
HTTP(S), asks for consent, and opens with `noopener,noreferrer`.
Relay/outbox uses NIP-65 relay lists (`kind:10002`) with fallback relays, and the
identity service reads contact lists (`kind:3`) so social-graph napplets can be
tested against real account state. `--relay-mode memory` retains an internal
fixture/event store for tests but does not register or advertise relay, outbox,
or count. Live relay URLs are validated as credential-free `ws:`/`wss:` URLs;
fixture events and local publish echoes never enter live reads, relay-tier edits
drive the corresponding transports, and event sidecars contain only relay URLs
that the pool actually observed.

WebRTC is conditional rather than simulated: the domain is advertised only
with a browser `RTCPeerConnection` implementation, live relay access, and a
connected NIP-44 signer. Paja owns peer connections and data channels, obtains
explicit session consent, signs kind-25050 Nostr signaling, encrypts
offer/answer SDP, and keeps application payloads exclusively on the data
channel. Signer changes tear down sessions and refresh the shell environment;
napplets never receive SDP, ICE internals, relay sockets, or browser networking
objects. The signaling boundary follows pinned
[NAP-WEBRTC `5fae95dd2c8e59bd06c654e0845656add077dcda`](https://github.com/napplet/naps/blob/5fae95dd2c8e59bd06c654e0845656add077dcda/naps/NAP-WEBRTC.md)
and [NIP-100 PR #363 head `ead1cd6`](https://github.com/nostr-protocol/nips/pull/363).

### Standard identity and private social cache

A signed-in napplet uses the existing `identity.getPublicKey`,
`identity.getFollows`, and ordinary kind-0 `outbox.query` messages. Paja adds no
custom social service, direct networking path, or signer/key capability. It
privately validates the active account's replacement kind-3 contact list and
warms followed kind-0 profile records through the established outbox router.

That snapshot is active-account-scoped and memory-only, separate from generic
simulation cache mode. It is not napplet-owned storage and has no durable-cache
controls. Captured-key request correlation keeps a follows response associated
with the account that started it, and generation-safe background writes prevent
stale account data from becoming active.

A normal query can include matching cached `RelayEventResult` values. The base
router remains authoritative for query-wide `incomplete` and `error`, so cached
values never make a degraded query complete. Profile winner selection,
pagination, follow mutation, durable cache management, and per-author
completeness remain outside this behavior.

[NAP-IDENTITY `6461e4b37c29dc09a20dff35d9515889c4433874`](https://github.com/napplet/naps/blob/6461e4b37c29dc09a20dff35d9515889c4433874/naps/NAP-IDENTITY.md)
is byte-identical to the phase's recorded `napplet/naps` master document. Pinned
[NAP-OUTBOX `4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e`](https://github.com/napplet/naps/blob/4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e/naps/NAP-OUTBOX.md)
and installed `@napplet/nap@0.31.2` types govern this PoC because current master
has no NAP-OUTBOX path. This is not a current-master OUTBOX conformance claim.
Blossom behavior targets pinned
[NAP-UPLOAD `a7cc17463cbf5d9cb87884b31071bc4fc826034c`](https://github.com/napplet/naps/blob/a7cc17463cbf5d9cb87884b31071bc4fc826034c/naps/NAP-UPLOAD.md).

### NAP-UPLOAD

Upload mode defaults to `memory`, an explicit unadvertised fixture that stores
nothing. It does not register an upload service, expose an upload hook, or
return `kehto-dev://` success values. `blossom` mode is opt-in through
`simulation.upload.mode` or `--upload-mode blossom`. Repeat
`--upload-server <url>` for an ordered explicit list; CLI server values replace
the config-file list. Paja uses only the first effective server in this release
and returns its direct descriptor URL. Mirroring, failover, and BUD-10 result
construction are not implemented.

The shell chooses the server. Explicit normalized servers take priority. If the
list is empty and discovery is enabled, signer connection or change warms a
cache from the active pubkey's newest BUD-03 kind `10063` event, preserving its
ordered `server` tags. `upload.info` and `upload.upload` read that cache only;
they do not query relays, reconnect a signer, use a public default, or consult
runtime-pointer Blossom hints.

HTTPS is accepted everywhere. HTTP is restricted to `localhost`, the
`127.0.0.0/8` range, and `[::1]`. Credentials, non-loopback HTTP, empty URLs,
queries, and fragments are rejected. `upload.info.returns` reports `https` or
the permitted loopback `http` form from the same selected server. A Blossom
server used from the browser must support CORS preflight and allow `PUT`,
`Authorization`, and `Content-Type` from the Paja origin.

Before hashing, signing, or storage egress, Paja enforces the Blossom rail,
`maxBytes`, and `mimeTypes`, then prompts with the requesting napplet, filename,
size, MIME type, server, and a public/durable warning. Authorization requires a
writable Dev, NIP-07, or NIP-46 signer. Configured identity, provider identity,
awaited signer pubkey, BUD-03 author, and returned kind-24242 event pubkey must
match. A fixed pubkey without `signEvent` cannot upload.

`complete` is reported only when the Blossom descriptor provides a usable
HTTP(S) URL, the exact local SHA-256, and an exact non-negative safe-integer
size. Missing, malformed, or mismatched proof fails closed. Successful results
include direct URL, MIME type, hash, size, and NIP-94 `url`, optional `m`, `x`,
and `size` tags. This behavior targets the draft
[NAP-UPLOAD at `a7cc174`](https://github.com/napplet/naps/blob/a7cc17463cbf5d9cb87884b31071bc4fc826034c/naps/NAP-UPLOAD.md).

The `count` domain sends NIP-45 `COUNT` with the complete OR-filter set to the
first configured relay that accepts the request. It reports that actual relay,
returns its exact count with `approximate: false`, and never downloads matching
event payloads. Broad empty filters are refused as too expensive; disabled or
memory relay mode also disables `count` advertisement.

### NAP-RESOURCE

Paja implements the draft
[NAP-RESOURCE at `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`](https://github.com/napplet/naps/blob/fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1/naps/NAP-RESOURCE.md)
with real `data:`, `http:`, `https:`, and content-addressed `blossom:` backends.
`resource.info` always reports `data`, `https`, and `http`; it additionally
reports `blossom` only while at least one usable host-owned server is
configured. This disclosure is advisory, not an authorization grant. All paths
expose the enforced 10 MiB response and 100-URL bulk caps. The host ignores
declared or upstream media types, classifies a narrow safe
image/audio/video/font/text set, and rejects raw SVG, HTML, invalid UTF-8, and
unrecognized binary data. Cancellation remains window-scoped and drops late
terminal envelopes.

Paja deliberately accepts arbitrary HTTP(S) origins because it is a developer
runtime. It uses browser `fetch` with credentials omitted and no referrer. The
browser still decides which response bytes JavaScript may read: a network or
CORS rejection becomes `network-error`, while a CORS-readable response is
returned normally. Plain HTTP may also be rejected by the browser's mixed-content
rules when Paja itself is served securely. This resource choice is independent
of Paja's signer confirmation boundary.

The only accepted Blossom form is `blossom:sha256:<64 hex characters>`. Paja
uses runtime-pointer server hints plus explicit or already-warmed upload server
settings, preserving their order and removing duplicates. HTTPS is accepted;
HTTP is restricted to loopback development. There is no public default, the
napplet cannot select an upstream origin, redirects are refused, and Paja
verifies the returned bytes against the requested SHA-256 before delivery. A
hash mismatch is `decode-failed`; missing blobs are `not-found`.

Hashtree, Nostr, and other unimplemented schemes remain unadvertised and fail
with `unsupported-scheme`. HTTP(S) dispatch and Blossom dispatch are separate:
an ordinary web URL is fetched directly, while `blossom:` can only resolve an
exact digest through Paja's configured server list.

## Environment Simulation

The normalized simulation object controls:

- Capability domain advertisement through the production `shell.init` path.
- ACL mode and firewall mode metadata for development policy profiles.
- Anonymous or fixed identity mode.
- Live, memory fixture, or disabled relay/outbox behavior.
- Local, memory, or disabled storage mode advertisement.
- Memory or disabled artifact/cache metadata.
- Unadvertised memory fixture, real Blossom, or disabled upload mode; shell-owned servers,
  BUD-03 discovery, maximum bytes, and MIME policy.
- Media, notification, intent, and CVM availability.
- Initial config values used only after schema registration when an identity has
  no saved shell settings. Paja validates/defaults and persists later host UI
  commits under `(dTag, aggregateHash)`; it does not expose a napplet write path.
- Theme mode and values returned by `theme.get`.

The top bar includes a theme selector and reload button; the bottom bar
summarizes active simulation state, HMR strategy, runtime address, and lifecycle
status. Theme changes apply immediately to the Paja theme service and survive
the next iframe reload.

## Scope Boundaries

- Owns the local development host process, option normalization, managed command
  startup, target readiness polling, host HTML rendering, browser bootstrap, and
  runtime config JSON and target HTML endpoints.
- Fetches the app-provided target URL into injected `srcdoc`; target assets and
  HMR still resolve against the app dev server through the injected `<base>`.
- Does not guess framework dev-server ports, mutate app build tooling, or add
  framework-specific adapters.
- Does not replace the full playground. Paja is the package-scoped authoring
  runtime for one target app; the playground remains the multi-napplet demo and
  topology surface.

## API Reference

- Generated module: <a href="../api/modules/_kehto_paja.html" target="_self"><code>docs/api/modules/_kehto_paja.html</code></a>
- Getting started: [Paja getting started](/how-tos/paja-getting-started)
- Local authoring how-to: [Use Paja for local napplet authoring](/how-tos/paja-local-authoring)
