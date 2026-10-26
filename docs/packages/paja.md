# @kehto/paja

## Relay approval boundary

Paja passes each runtime-approved destination list to its live relay backend for
publication. Host policy selects the list; approval waits cannot replace it.

Single-window Paja local authoring workshop for napplet development.

Paja's WebRTC controller snapshots the host-selected signaling relays before
approval. It has no configured ICE/TURN endpoints by default and rejects opaque
injected peer factories that cannot declare their destinations.

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
| Version | `0.24.4` |
| Runtime entry | `./dist/index.js` |
| CLI runner entry | `./dist/cli.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@kehto/firewall`, `@kehto/nip`, `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, `@kehto/wm` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.32.0 <0.33.0` |
| `@napplet/nap` | `>=0.32.0 <0.33.0` |
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
| Local files | `createPajaLocalTarget`, `isPajaLocalTarget`, `isPajaLocalHtmlFile`, `readNappletIdMeta`, `findRelativeAssetReferences`, `PAJA_LOCAL_SINGLE_FILE_HINT`, `PajaLocalTarget`, `PajaLocalFileInput`, `PajaRuntimeTarget` |
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

The console is a collapsible left column. It starts expanded, and one chevron
button in the top bar collapses it to the left and restores it; the toggle stays
visible in both states, including after a reload with no runtime tabs open, so a
collapsed console is always one press away. The toolbar never requires hovering
over a hidden edge to reveal it. The choice is remembered per browser origin.
Collapsing is CSS-only presentation:
the target iframe is never navigated or recreated, so the running napplet keeps
its generation, message log, and shell state while the stage reclaims the full
width.

All sections are flush independent native accordions, expanded by default:
**Pointer** where present, **Interfaces**, **ACL**, **Signer**, **Resource servers**,
**Messages**, and **Events** last. Enter/Space toggle focused headers; visible focus and chevrons
show their state. Hidden bodies retain controls, drafts and the running app.
Origin-local `kehto:paja:sidebar-sections:v1` stores validated collapsed booleans,
independently of whole-drawer visibility and resource settings. Invalid preferences
default expanded; unavailable storage leaves toggles usable for the session.

The console includes:

- **Interfaces** — every supported Paja domain has an injection toggle. Toggling
  a domain updates the live capability override and reloads the target so the
  next `shell.init` reflects the changed support surface.
- **ACL** — every runtime capability can be granted or revoked for the target
  napplet identity. In runtime-pointer mode, both the displayed state and the
  mutation use the active tab's resolver-verified d-tag and aggregate hash. The
  controls write through `bridge.runtime.aclState`, rerender immediately, and
  the next matching request is allowed or denied by the real runtime gate.
- **Firewall permissions** — shows the current runtime grants and offers revoke,
  clear, and storage retry. Launch and operation prompts show the trusted source,
  exact scope, and available lifetimes. Without browser storage, persistent
  approval is unavailable; failed durable writes do not activate grants.
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
  a legacy confirmation preference after runtime Firewall authorization, never
  a replacement grant. Actual remembered use warns once per page with
  `FW-PAJA-SIGNER-CONSENT-LEGACY-001`; use Firewall grants instead. The
  signer confirmation policy is permitted by draft
  [NAP-RELAY PR #2 at `0be8abce18beb46ca37bd4ddd042f58d30b4eedc`](https://github.com/napplet/naps/pull/2), not a
  Kehto runtime default. Upload consent shows the requesting
  napplet, file, MIME type, size, server, and durable public effect before
  bytes leave the browser. A denial or a live publish with no accepting relay
  returns a canonical failure and does not enter Paja's in-memory relay view.
  Its scoped-relay hook likewise waits for the backend result and returns
  `false` after denial or transport failure.
- **Resource servers** — extra Blossom lookup origins with a newline textarea and
  Save button, immediately before the Messages section (see below).
- **Messages** — inbound and outbound envelopes are logged with a text filter,
  including Paja system events such as interface changes, ACL changes, signer
  connection changes, signing/publish confirmations, and visible details for
`.error` envelopes.
- **Events** — relay receipts grouped by the routing box that chose the relays,
  then by relay, then by event kind, with the session receipt total in the
  section header. Boxes render in Paja's routing precedence, never in count
  order, so they do not reshuffle while the session runs:
  - **outbox relays (NIP-65)** — relays resolved from the requested authors'
    NIP-65 write lists. When a session only ever used hints or the configured
    set, the box renders as `no author-routed reads` instead of a bare zero,
    because author-routed relays are discovered per read and cannot be listed
    from configuration.
  - **relay hints** — an outbox read the napplet pointed at relays itself with
    NAP-OUTBOX `relays` hints, which the shell validates and uses alongside the
    rest of the plan.
  - **fallback relays** — the host's configured fallback/bootstrap relay set.
    Reads can start while NIP-65 discovery is pending, even if author relays
    resolve later; authorless queries also read this set alongside valid hints.
    Authorless live subscriptions use fallback only when no valid hints remain.
    This box does not imply that author discovery failed.
    Configured relays are listed from boot, so one that has served nothing yet
    still appears, marked `unused` until Paja reads from it and `silent` once a
    read returns no events. This is the only box that can render without traffic.
  - **scoped relay** — a read the napplet pinned to one relay with an explicit
    NAP-RELAY `relay.subscribe` `relay` field (a scoped relay, not a hint),
    which bypasses host tier selection.
  - **host pool** — Paja's own reads: the relay service without a hint, social
    cache, contact lists, relay lists, count, CVM, Blossom lookups, upload
    discovery, WebRTC, and DM traffic.
  Counting happens in the relay backend before delivery, so every read path is
  covered, while simulated memory-mode fixtures and Paja's own publishes are not.
  Each relay row carries a bar scaled against the busiest relay of the session,
  its receipt count, and its `kind - count` rows. A box is a routing decision
  rather than a relay set, so the same relay appears in two boxes when two reads
  reached it for different reasons — a relay that is both an app hint and a
  configured fallback keeps its two receipt counts apart instead of showing one
  merged number. Every receipt belongs to exactly one box, so box counts add up
  to the header total. Counts are receipts, not
  distinct events: repeated deliveries and the same event arriving from several
  relays each count, and the header badge's tooltip reports how many unique
  events those receipts came from. Receipts are observed on each live relay's
  verified, filter-matching event callback before delivery deduplication; a
  silent relay is never credited from another relay's response or a previous
  read. Equivalent relay URL spellings share one row. Napplet delivery and query
  results remain deduplicated. Counts accumulate for the host session and the
  section header's `reset` button clears them without a reload.

The GitHub Pages artifact also includes a static Paja Runtime at `/web/paja/`.
That route uses `createPajaRuntimeHostConfig`, keeps `hmr: none`, and loads
verified napplets into ShellBridge-backed iframe tabs from pasted `naddr` or
`nevent` pointers. `naddr` pointers resolve the latest matching NIP-5D named
manifest (`35129`) by author and `d` tag, or a root manifest (`15129`) by author with an empty identifier and no `#d` filter; `nevent` pointers resolve a specific
NIP-5D snapshot, root, or named manifest event id (`5129`, `15129`, or `35129`).
In both cases Paja verifies the signed manifest and artifact hash (or legacy
aggregate and blobs), then asks the runtime to admit declared interfaces before
assigning iframe `srcdoc`. Required denial blocks launch; denied optional domains
are absent from the injected `window.napplet` namespace and later environment.
The shared admission helper inserts a closed CSP before the namespace and
artifact bytes. Relay/Blossom hints only select mediated services; they grant no
direct iframe network authority. Explicit `csp.connectOrigins` values require
separate browser-source network approval. Supported `csp.directives` sources are
also reduced to exact directive-specific origins for approval; unknown directives
and broad sources are rejected. CSP scheme/port matching still applies, including
HTTP to HTTPS upgrades; the approval UI discloses that browser authority. The
[CSP contract](https://github.com/kehto/web/blob/main/docs/policies/NIP-5D-CONFORMANCE.md#shell-csp-enforcement)
documents the NIP-5D baseline and the shared admitted policy. Configure
`frame-ancestors` through the host HTTP response. NIP-5D requires the verified
`srcdoc` and opaque `allow-scripts` sandbox, but not this CSP baseline. Local
target-URL mode uses the same admission helper with an exact URL plus fetched
artifact hash as its unsigned development identity. Development HTML can request
interfaces with space-separated `napplet-requires` and `napplet-optional` meta
declarations. They never grant authority. A live dev server receives only its
approved browser sources and cannot combine direct network loading with
the protected `resource` interface. A self-contained local file can request
`resource` under the closed local-only CSP. Loading an
already-running napplet
opens an in-page choice to load another instance, switch to the existing tab, or
cancel. Each verified tab's Share control opens a dialog with its selectable
`/web/paja/?naddr=...` or `/web/paja/?nevent=...` app link. **Copy app link**
shows a confirmation on success; blocked or unavailable clipboard access selects
the link for manual copying. Apps with advertised intents also offer
**Create intent link**. Share keeps focus and pointer input in the host overlay
while the apps remain loaded. The browser remembers open runtime tabs in local storage
so returning to `/web/paja/` restores the previous
pointer set. An explicit pointer in the URL still takes precedence over restored
tabs.

The browser page title follows the active napplet tab name, including when switching or closing tabs. With no active napplet, the title is `@kehto/paja`.

Pointer relay hints are preferred, not exhaustive. Paja queries embedded
`naddr` / `nevent` relay hints first in the ordered candidate list, then any
pointer-specific relay overrides, then the effective configured live simulation
relays. URLs are normalized and deduplicated without changing first occurrence.
When relay simulation is disabled, configured relay URLs are not added as
fallbacks. Connection, fanout, and EOSE share one pointer-resolution deadline;
the UI distinguishes deadline or connection failure from the clean case where
all queried relays reached EOSE without a matching manifest. Wider relay search
does not weaken loading: manifest signature, artifact/legacy-aggregate verification, Blossom hash, and
`srcdoc` verification still fail closed.

### Local `index.html` files

In runtime-pointer mode, Paja can also open a napplet straight from disk. Use
**Open file…** next to **Load**, or drop an `index.html` anywhere on the Paja
page (not onto a running napplet frame, which receives its own drag events).
The file opens in a new runtime tab named after the file.

- **Identity comes from the bytes.** Paja hashes the exact file bytes (`sha256`)
  and derives `aggregateHash` as the NIP-5A aggregate over the single
  `/index.html` path entry. That is the same derivation the resolver checks for a
  published single-file napplet, so editing the file gives it a new identity. The
  `dTag` comes from the NIP-5D publishing metadata
  `<meta name="napplet-id" content="…">`. Without it, Paja uses
  `local-<file-stem>`.
- **Same loading path as verified pointers.** Paja registers the identity before
  the frame runs. It injects the Class-1 CSP (with `connect-src 'none'`, since a
  local file has no relay or Blossom hints) and then the runtime-owned
  `window.napplet` prelude, including enabled optional domains. The bytes go in through
  `srcdoc` under the same `allow-scripts` sandbox.
- **Development only and unverified.** A local file has no signed manifest. It
  never enters the installed napplet catalog, never becomes an intent delivery
  target, has no share link, and is not restored after a page reload.
- **Self-contained single-file HTML only.** A `srcdoc` document has no base URL,
  and the CSP denies network loads, so relative `<script src>`, stylesheets, and
  images do not load. Paja lists relative references it finds in the status line
  and the message log. Build with an inlining bundler (for example
  `vite-plugin-singlefile`). Opening a folder or zip of assets is not supported.

### Installed catalog and intent lifecycle

Paja stores immutable resolver-verified manifest facts separately from live tabs.
Closing a frame leaves its catalog record available for cold starts; explicit
artifact removal deletes it. Restored pointers are reverified before entering the
catalog. Entries preserve exact conventions and ordered parameter names under
publisher/kind-safe opaque IDs, including nameless root and snapshot artifacts.
The target's resolved `intent` domain must be available; INC is not required.

Catalog installs, replacements, removals, and user default-handler updates emit
`intent.changed` to eligible open napplets (`napplet.intent.onChanged(...)`).
Replacements notify both removed and added archetypes, once per slug, using the
current filtered catalog. A `no handler` rejection remains terminal: callers must
retry explicitly; installing a handler does not replay the failed invocation.
This follows `napplet/naps` NAP-INTENT on master (last changed at `e5308ac`), whose
runtime behavior recommends notifications on catalog/default changes.

Selection uses exact contracts and user-owned default, chooser, recommendation,
and explicit-authorization policy. Explicit handler IDs require sender-aware
authorization and cannot address an arbitrary running frame.

The controller retains work before returning acceptance. It then opens or reuses
a verified target, waits for its registered source and real `shell.ready`, checks
that the generation is current, and sends one target-only `intent.deliver`.
Replacement, readiness failure, and terminal send failure remain host-observable
controller outcomes; they do not produce a second source result. Accepted work
survives source teardown and is never replayed by tab restoration.

Paja activates delivered handler tabs because its stage shows one tab at a time.
`behavior.focus` is advisory; `reuse: false` creates a new surface. Existing caller
tabs remain open. Installed contracts and domains appear in pointer diagnostics.

Kehto provides the optional `window.napplet.shell` interface for environment information. Other domains route through trusted iframe creation identity independently of readiness. `supports(domain)` queries namespace presence locally. See the living [NAP-SHELL](https://github.com/napplet/naps/blob/master/naps/NAP-SHELL.md).

## NAP and Service Parity

Paja can advertise the following web NAP domains when their real host backend
is live:

`relay`, `outbox`, `identity`, `storage`, `inc`, `theme`, `keys`, `link`,
`common`, `lists`, `serial`, `ble`, `webrtc`, `media`, `notify`, `config`,
`resource`, `cvm`, `upload`, `intent`, `count`, `dm`, and `fs`.

`shell` is an optional environment interface under NAP-SHELL at `19de5ce1cea40cd4c76089cdd8126e9f87648049`; it does not establish identity or gate other domains. `gamepad` is an optional advertised domain. The retained `PAJA_HANDSHAKE_DOMAINS` compatibility export is empty. GAMEPAD uses one host reader and focus-scoped state delivery; the shared approval boundary authorizes `gamepad:input` before native input starts. Native controller access is denied in each frame. See [Controller input](/gamepad).

Paja's NAP-NOTIFY renderer displays attributed text and never fetches untrusted
icon URLs. Runtime approval scopes sending, channel registration, badge changes,
and permission requests to the actual operation/channel; the browser permission
cache additionally keys off the current verified app artifact. Revocation and
window teardown clear rendered notifications and invalidate pending answers.

Paja keeps serial-port and Bluetooth device identity in host-only controller
state. Its browser chooser runs only after runtime approval; the selected device
receives a second host-private approval before a port opens or GATT connects.
Serial writes and BLE service, characteristic, and notification operations stay
bound to the requesting source, and permission revocation closes ports,
disconnects GATT, and stops notification delivery.

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
draft [NAP-FS `bd1b9e91`](https://github.com/napplet/naps/blob/bd1b9e912f05203bf38f7a1b04f920744fe6d625/naps/NAP-FS.md).

The Interfaces panel reports workspace and native open/save/directory picker
support separately. Firefox can expose OPFS without the native picker APIs;
workspace operations then work, while picker operations return `unsupported`.
The message log identifies the missing API. ACL controls such as `fs:read` and
`fs:write` grant permission but cannot add browser support. See the
[browser picker compatibility reference](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker#browser_compatibility).

Default service wiring uses live relay/outbox behavior, localStorage state
persistence through the runtime, browser or configured identity, schema-validated
identity-scoped config and host-owned theme, notification, media, upload, intent, resource, common-profile,
bookmark-list, serial, BLE, WebRTC, NIP-17 DM, OPFS, and CVM adapters. `keys.forward` dispatches
an unbound forwarded keystroke in the host context. `link.open` accepts only
HTTP(S), asks for exact-URL approval, then rechecks the current verified app
artifact and approval signal after host confirmation before opening with
`noopener,noreferrer`. A stale confirmation cannot navigate.
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
and installed `@napplet/nap@0.32.0` types govern this PoC because current master
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

The development sidebar's **Resource servers** textarea adds read-only Blossom
lookup origins in both target-URL and runtime-pointer modes. Enter one public
HTTPS origin per line (`cdn.example` is shorthand for `https://cdn.example`)
and press **Save**. Blanks are ignored and equivalent origins are deduplicated
in first-seen order. A bad line rejects the whole save without changing the
active or saved list; credentials, paths, queries, fragments, HTTP and obvious
local/private hosts are rejected. Saving blank clears only these extras.

Valid saves apply to subsequent Blossom requests across all running tabs,
without reloading their frames. The list persists in the host origin's
`localStorage`; if storage fails, it remains usable **session-only**, and the
status warns that an older saved list may return after reload. Extras are
appended after existing URI/event/user/window/configured defaults. The
combined eight-server cap remains: extras may not be reached if earlier
candidates fill it. This setting does not change upload destinations,
per-napplet NAP-CONFIG, initial pointer/artifact loading, direct HTTP(S) resource
URLs, or napplet CSP/network grants. Each actual HTTP(S) destination still
requires authorization and must pass the proxy address policy below.

Paja resolves HTTP(S) resources through its protected, same-origin
`POST /__kehto/resource` endpoint. The resource request and each actual network
destination have separate authorization requirements; an interface grant or
Blossom server hint grants neither. The resolver requires the request-bound
network authorization callback and refuses network access when it is absent.
The proxy validates its host, main-frame Origin, JSON POST, and server-instance
HttpOnly cookie before DNS. It pins a permitted public address to the connection,
preserves TLS hostname checks, omits upstream credentials/referrer, and bounds
responses to 10 MiB and 30 seconds. Private, loopback, and other blocked
special-purpose addresses are rejected, including development loopback targets.

Redirects return metadata to the trusted resolver instead of redirecting the
browser. The resolver permits at most five hops, authorizes each destination,
and repeats the proxy's DNS/address checks. Cancelling the host request aborts
upstream work. Remote resource responses no longer depend on allowing the opaque
iframe origin through upstream CORS. See the [resource proxy policy](/policies/RESOURCE-PROXY)
for caller checks, address policy, deadlines, and regression coverage.

Paja classifies returned bytes itself. Its classifier recognizes checksum-valid
Game Boy ROM headers as `application/vnd.nintendo.gb-rom`; upstream media types
never establish the result MIME. HTTP(S) and locally decoded `data:` bytes must
have a recognized type; opaque invalid-UTF-8 or NUL-bearing binary remains rejected.
Only capped, SHA-256-verified canonical Blossom resources may return unknown
opaque bytes as `application/octet-stream`. Recognized formats retain their
sniffed MIME. SVG, HTML, XML and script prefixes remain blocked, even with NUL or
invalid-UTF-8 suffixes; upstream headers never override classification.
Byte-identifiable UTF-16 markup is checked by decoding the complete capped
buffer; identifiable UTF-32 document signatures are conservatively rejected.
This encoding guard is not a general markup parser.

`data:` remains locally decoded. `blossom:` is a separate, content-addressed
boundary and is advertised because each request may provide server locations
without a host default. For example, reads accept
`blossom:<hash>.gbc?xs=cdn.example&as=<pubkey>&sz=32768` and
`blossom:sha256:<hash>.gbc?xs=cdn.example&sz=32768`.
Internal event-reference keys and synthesized references use `blossom:<hash>`.
Napplet-supplied resource cache keys remain unchanged, as NAP-RESOURCE does not
require URL canonicalization. Actual `sha256:` alias reads/server-resolution
requests emit `KEHTO_COMPAT_BLOSSOM_SHA256` once per host module lifetime, with
replacement guidance and no URL/hash payload. Canonical requests stay quiet.
Repeated `xs` and `as` are supported without an observed event. Paja accepts only
public-looking HTTPS origin hints (scheme-less domains use HTTPS), discards
invalid/private literals, and deduplicates them. Unlike BUD-10's suggested HTTP
retry, URI hints never enable public HTTP. For a Blossom URL
previously returned to the same napplet window by `outbox.getEvent`,
`outbox.query`, or `outbox.subscribe`, Paja retains bounded event context
without prefetching bytes. Resolution tries URI `xs` and event-local server hints first, then lazily queries URI `as`, event-hinted authors' and the
event publisher's newest BUD-03 kind `10063` lists through host-configured
NIP-65 bootstrap relays and the selected author relay, then queries the active
shell user's BUD-03 list through the same approval-bound relay path, then uses
the current window's verified pointer-manifest servers, followed by upload-runtime
fallbacks and saved extra resource servers. Every bootstrap and author relay is
authorized as its exact `ws:`/`wss:` destination before its socket opens. The
host refreshes signer-derived bootstrap URLs only at signer initialization or a
signer lifecycle change; a resource request reads that bounded host cache and
never calls an external signer's `getRelays()` hook, because that hook can
perform opaque extension work before an origin exists to approve. If refreshing
the cache fails, configured host bootstrap relays remain available. The user-list
lookup works independently of upload mode; an upload runtime may reuse the same
servers when present. ROM-specific event and publisher locations retain
priority over the user/runtime fallbacks. URI length is capped at 8192 characters;
retained unique `xs`, the complete author lookup list, and combined server
candidates are each capped at eight. Both prefixes require exactly 64 hex
characters, with an optional single ASCII-alphanumeric extension preserved in
`GET /<hash>.<ext>`; no query hints reach the blob server. Extensions and upstream
headers never establish MIME. Fragments, path injection, malformed escapes/authors,
and invalid or repeated `sz` fail with `invalid-request` before discovery.
`sz` must be a positive decimal safe integer; sizes above 10 MiB fail `too-large`.
Paja checks a numeric Content-Length before reading and always checks actual
bytes against `sz`; a size or hash mismatch is `decode-failed` unless fallback succeeds.
Hash-only event context stays window-scoped, without transferring extension/size
or retaining request hints. Byte caches retain the original URL and identity scope;
public author lists reuse five-minute cache/single-flight lookups, with incomplete misses retryable.

[BUD-10 at `b5bd280`](https://github.com/hzrd149/blossom/blob/b5bd2801d1763aa635fc8fea7a76597e0eb18990/buds/10.md)
requires lowercase hashes and an extension (default `.bin`) for emitted references.
Extensionless reads, mixed-case hashes, and the `sha256:` alias are deliberately
retained local compatibility, not a full BUD-10 conformance claim. Upload URI
generation is unchanged. Paja verifies SHA-256 and byte MIME after authorized
proxy retrieval. The checked [NAP-RESOURCE draft at `ae5b9c6`](https://github.com/napplet/naps/blob/ae5b9c64ab8a4d8909f288829a01e99d6bd713bc/naps/NAP-RESOURCE.md)
uses canonical `id` correlation, a single `url` or ordered `urls` list, and padded
RFC 4648 base64 wire bytes. The injected web API converts verified wire bytes to
`Blob` values; a JavaScript `Blob` is not the wire payload. Per-item bulk outcomes
preserve input order. The old `requestId` input, object-form `requests` list, and
wire-level `servers` hint have been retired from this contract. Use URI hints or
host-owned resolver configuration for Blossom discovery. See
[`RESOURCE_FIELDS` in the compatibility register](/compatibility).

Verified manifest servers remain source-scoped Paja host policy under the
[NIP-5D draft at `5560820`](https://github.com/dskvr/nips/blob/5560820fa4f37f45b8ab742a11aeb3001b17dc67/5D.md).
Neither those hints nor stored extra servers grant iframe network authority.

The shared launch admission and CSP isolate mediated `resource` frames from
direct browser traffic. NAP-RESOURCE requires direct-network denial before exposing `resource`, including
remote script, image, style, font, and worker paths as well as `connect-src`.
The proxy and service approval checks alone do not stop a frame with permissive
CSP from contacting remote servers. Explicit direct-network frames use the
compatible interface set defined by that host policy; required interfaces cannot
be silently dropped. Paja's host-injected base URL is limited to the exact
approved development origin so relative assets resolve. SVG rejection rather
than rasterization and the retained
Blossom URI aliases are also bounded host behavior, not a claim of complete draft
conformance. Publisher discovery follows
[Blossom BUD-03 at `b5bd280`](https://github.com/hzrd149/blossom/blob/b5bd2801d1763aa635fc8fea7a76597e0eb18990/buds/03.md).

## Environment Simulation

The normalized simulation object controls:

- Capability domain advertisement through the production `shell.init` path.
- ACL mode metadata for development policy profiles. The retired
  `--firewall-mode` and `simulation.firewall` options are rejected; they never
  granted authority. Use the Paja Firewall panel for exact scoped decisions.
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

## NIP-5D event compatibility

Current manifests use a direct artifact `x` hash, plain-text `content`, role-matched
`z`/`i` intent declarations, and required `R` / optional `O` domains. Kehto also
accepts legacy aggregate events through an isolated compatibility adapter.
Existing `aggregateHash` host/cache/ACL fields carry the verified artifact hash
for current events; legacy identities keep their original aggregate. Both paths
verify signatures and bytes before runtime injection and `srcdoc` execution.
For the schema and removal boundary, see [event migration](https://kehto.github.io/web/docs/migrations/NIP-5D-EVENT-SCHEMA.html).


Paja loads napplets that declare unknown or unavailable domains. Optional `O`
integrations load quietly so the napplet can gracefully degrade. For unavailable
required `R` domains (or legacy `requires` declarations), Paja logs a warning per
frame navigation that full functionality may be unavailable, then continues.
Declarations never grant capabilities: unsupported or disabled domain objects
remain absent from `window.napplet`. Check namespace presence before using an
experimental integration. Paja does not implement an experimental protocol merely
because a manifest names it.

## NAP-INTENT links and lifecycle

This follows [NAP-INTENT PR #106](https://github.com/napplet/naps/blob/fc121fc264615482143eda86125863d2e1f741a2/naps/NAP-INTENT.md) at `fc121fc264615482143eda86125863d2e1f741a2` and NIP-5D PR #2303 at `020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`.

For a verified app with advertised intents, choose **Share → Create intent link**.
Select its convention, include the text parameters you want, or switch to JSON.
Parameters start omitted; selecting Include with an empty field sends an explicit
empty string. Names stay in advertised order and extra named fields are allowed.
No parameter type or requiredness is inferred. An empty advertised list still
permits a payload. Opening or editing the builder never invokes an intent.
Use **Copy link** to share it, or **Test intent** to open the shared content.

The outer URL carries a complete percent-encoded convention URI in `intent`.
For example, `?intent=napplet%3Aprofile%2Fopen%3Fpubkey%3Dabc%252B123`
contains `napplet:profile/open?pubkey=abc%2B123` and delivers text `abc+123`.
Outer and inner layers decode once each; literal `+` stays plus. Optional outer
`payload` contains JSON, including null, primitives, arrays, or objects, and
cannot accompany an inner query. URLs are limited to 16 KiB UTF-8. Duplicate
keys, malformed encoding, and conflicting target instructions are rejected.
Ordinary pointer-only app links retain their existing behavior.

New links recommend the app using a named-35129 `#naddr` when available;
snapshot or unnamed apps use an exact outer `pointer`. The builder also offers
recipient-default routing. Explicit pointers must verify and advertise the exact
contract; failure never silently falls back. Recommendation relay hints remain
untrusted discovery inputs. Invalid, incompatible, or disallowed recommendations
do not override an applicable saved default.

Opening a shared link opens its verified app and delivers the content directly,
following Paja's ordinary pointer navigation and capability policy. No URI or
payload review is shown. If an applicable saved default conflicts with the
link's app, Paja names both apps and asks which to use. A one-time choice leaves
the default unchanged; **Always use this app** explicitly saves the chosen app.
Without a usable hint or default, ordinary installed-handler selection applies.
Installed app pointers are saved separately from open tabs and reverified when
loaded; cached pointers never authorize execution or supply trusted metadata.

Progress and failures use a small notice. Successful delivery dismisses it.
Closing the notice or cancelling an app choice before dispatch sends nothing.
After acceptance, the incoming intent is removed from the current URL so reload
restores the app without delivering the shared content again. Accepted work is
retained until the verified target is ready.

Paja invokes through a separate signed launcher napplet with a verified artifact
and authenticated iframe endpoint. Its source supplies the opaque sender; the
URL cannot supply one. The hidden launcher is removed after acceptance and is
never persisted or restored. Verification precedes `srcdoc`, and host bootstrap
injection stays outside signed bytes. Native external-origin sender semantics
remain a documented upstream spec gap; no host sender identity is invented.

## NIP-5D runtime pointers

Paja MUST load all three NIP-5D manifest kinds: root `15129`, named `35129`, and snapshot `5129`. Use an `naddr` with an empty identifier for the latest root, an `naddr` with the literal `d` identifier for the latest named napplet, or a `nevent` to pin a signed event of any of the three kinds. Snapshots require `nevent` because they are immutable events without replaceable coordinates. All paths verify the signed manifest and artifact hash before injecting `srcdoc`. Distinct snapshots retain separate tabs and catalog identities even when their artifact bytes match.

## Controller diagnostics

Paja shows a numbered controller icon directly beside the console arrow for each controller the browser detects. Each slot has its own color and input animation; hover for the controller model and activity state. Buttons and stick movement light up only that controller (stick movement below 0.12 is ignored). Quick taps retain the highlight briefly so they are easy to spot. Reduced-motion settings keep the activity highlight without animation. Disconnecting removes the icon. Browsers may require a button press before exposing a newly connected controller. These host diagnostics work without a napplet gamepad subscription and do not change focus-scoped input delivery.
