# @kehto/paja

## Relay approval boundary

Paja passes each runtime-approved destination list to its live relay backend for
publication. Host policy selects the list; approval waits cannot replace it.

Unconfigured private relay names remain denied with a trailing DNS dot too.
Explicit host-configured development relays remain available. The default pool
does not automatically sign NIP-42 challenges. Network-origin approvals do not
grant signing authority to a third-party relay pool.

Single-window Paja local authoring workshop for napplet development.

Firewall approval prompts remain visible when the development console or its
Firewall section is collapsed. Grant management stays in the sidebar; napplet
execution still waits for the user's admission decision.

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
| Version | `0.38.0` |
| Runtime entry | `./dist/index.js` |
| CLI runner entry | `./dist/cli.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@kehto/firewall`, `@kehto/nip`, `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, `@kehto/wm` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.42.0 <0.46.0` |
| `@napplet/nap` | `>=0.37.0 <0.46.0` |
| `nostr-tools` | `>=2.23.3 <=2.x` |

## Primary APIs

| Area | Exports |
|------|---------|
| Options | `normalizePajaOptions`, `PajaOptions`, `PajaRawOptions`, `PajaCommand`, `PajaOptionsError` |
| Simulation | `normalizePajaSimulation`, `summarizePajaSimulation`, `PajaSimulation`, `PajaSimulationRawOptions`, `PAJA_SIMULATION_DOMAINS` |
| Config files | `loadPajaConfigFile`, `mergePajaRawOptions`, `resolvePajaRawOptions` |
| Host config | `createPajaHostConfig`, `createPajaRuntimeHostConfig`, `PajaHostConfig`, `PajaPointerRuntimeConfig`, `formatPajaUrl` |
| Host page | `renderPajaHtml`, bundled `/__kehto/browser-host.js` runtime bootstrap |
| Runtime pointers | `decodePajaPointer`, `resolvePajaPointer`, `findPajaPointerReplacements`, `PajaPointerNotFoundError`, `PajaRelayUnreachableError`, `injectPajaRuntimeCsp`, `PAJA_NAPPLET_MANIFEST_KIND`, `PAJA_NAPPLET_MANIFEST_KINDS` |
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

### Experimental policies

Paja exposes Kehto's [experimental namespace](/policies/EXPERIMENTAL) of opt-in,
opinionated host policies (off by default). The first is the nested-browsing-context
lock, which prevents a napplet from creating an iframe:

```bash
kehto paja --target-url http://127.0.0.1:5173 --nested-context-lock auto
```

`--nested-context-lock` (config key `experimental.nestedContextLock`) takes
`on`, `off`, or `auto` (default). `auto` applies the lock only to a napplet
granted a privacy-sensitive NAP domain (`dm`), where exfiltration by an
untrusted app has real consequences. Enabling the lock requires Trusted Types in
the napplet CSP and is incompatible with frameworks that register their own
Trusted Types policy (e.g. Angular); see
[the experimental-namespace policy](/policies/EXPERIMENTAL) for the full cost.

A deployed runtime (no CLI access) can set the same policy from the host-page
**Security** sidebar's Frame-creation lock control; the choice persists in the
host origin's `localStorage`, overrides the config, and applies on the next
napplet load.

Whenever the lock resolves on, Paja also applies the resource-hint lock
(`resourceHintLock`): it shares the Trusted Types policy and refuses napplets
that add or ship `<link rel="dns-prefetch" | "preconnect" | "prerender">`, which
browsers act on outside the napplet CSP. Locked napplets that end up holding a
child frame anyway are revoked (`nested-context`). See
[NIP-5D conformance](/policies/NIP-5D-CONFORMANCE#resource-hints).

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
internal window id and a fresh iframe, so the new document gets a fresh
`shell.init` without restarting the CLI or the app dev server.

NIP-5D port-bound identity ([nips#2303 at `51ef0cd`](https://github.com/nostr-protocol/nips/blob/51ef0cd33a5694784306f3260d90b1872545fdee/5D.md)):
the injected bootstrap hands a private `MessagePort` to Paja in a single
window-level `napplet.hello`, and every NAP message then travels over that port.
Paja forwards window-level traffic from its frames to the `ShellBridge`, which
binds the hello and revokes the napplet on anything else. Paja also watches
each frame for a second load. A revoked runtime tab keeps a fresh, empty panel in
the error state until it is reloaded. A revoked single frame is replaced the
same way, and a revoked intent launcher is removed. When Paja retires an admitted
frame itself (a revoked grant, a tightened rule, a closed tab, or a launch
superseded by a reload), it blanks the frame and then
calls `ShellBridge.revokeNapplet(windowId, 'host')`, the same teardown as any
other revoke: the port binding, cached shell environment, runtime session and
per-window service state all go, and services get `onWindowDestroyed` once for
that registration, even though the Firewall retire and the bridge revoke both
tear the window down. A handler without `onPermissionRevoked` also gets
`onWindowDestroyed` as its revocation fallback when a grant revoke starts the
retire. That
retire is logged as `paja.napplet.retired`, not `paja.napplet.revoked`. Port traffic in both
directions appears in the message log, and revocations are logged as
`paja.napplet.revoked`. The log
highlights every shell reply that failed: a `*.error`, a result with `error` or
`ok: false`, or a `*.closed` with a `reason`. A refusal (`policy denied`,
`policy-denied`, `publish denied`, `denied: <capability>`) is badged `denied`.
Everything else, such as `relay list unavailable`, `relay timeout`, or
`count-unavailable`, is badged `failed, not a denial`, so a relay outage is never
shown as a firewall block. Napplets must not post NAP envelopes at window level or
import `@napplet/shim` alongside Paja's injected namespace. The one window-level
exception is the signed intent launcher's host messages; see the
[window-level host message allowlist](https://github.com/kehto/web/blob/main/docs/policies/NIP-5D-CONFORMANCE.md#window-level-host-message-allowlist).

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

### Targets that require `resource`

[NAP-RESOURCE](https://github.com/napplet/naps/blob/ae5b9c64ab8a4d8909f288829a01e99d6bd713bc/naps/NAP-RESOURCE.md)
exposes `window.napplet.resource` only to a frame the browser denies all direct
network: fetch, XHR, WebSocket, EventSource, beacon, and external subresource
loads. A live dev-server frame loads its scripts and HMR socket from the dev
origin, so the two cannot be combined.

When the target's `index.html` lists `resource` under `napplet-requires`, Paja
loads it as a **network-isolated snapshot**: the Paja server fetches the
document, and the frame runs those bytes under the same closed CSP as a local
single-file target. Nothing is requested from the dev server by the frame, there
is no `<base>` URL, and there is no hot reload; reload Paja after a rebuild.
Inline scripts and styles and `data:` assets work. Anything referenced by URL
does not, so serve a self-contained single-file build.

Paja says so up front. The CLI prints a `Target network: isolated snapshot`
notice with the references that will not load, `GET /__kehto/target-network.json`
returns the same plan, and the browser host logs `paja.target.network.isolated`
in the message log and warns on the console. `planTargetNetwork` and
`findExternalAssetReferences` are exported for reuse.

To keep live dev-server loading, declare `resource` under `napplet-optional`. The
frame then loads live without `window.napplet.resource`, and Paja logs
`paja.target.resource.omitted`.

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
**Language models**, **Messages**, and **Events** last. Enter/Space toggle focused headers; visible focus and chevrons
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
- **Firewall permissions** — default rules first, then grants. Paja allows
  every interface and operation by default and asks before each `link.open`.
  Change the default, or add an exception for an interface (`fs`) or operation
  (`upload.upload`), for every napplet or one; rules are stored in the browser
  under `kehto:paja:firewall-rules:v1` and **Restore defaults** resets them.
  Tightening a rule stops napplets that relied on it. Grants are grouped by
  napplet and interface, scopes allowed by a rule collapse to a count, and the
  panel offers single and group revoke,
  clear, and storage retry. Launch and operation prompts show the trusted source,
  exact scope, and available lifetimes. Without browser storage, persistent
  approval is unavailable; failed durable writes do not activate grants.
- **Signer** — **None** is the first-run default: extension presence does not
  trigger a public-key request. Choose **None**, **Dev**, **NIP-07**, or **Bunker**;
  the method is remembered per origin (`kehto:paja:signer-method:v1`). None
  disconnects and invalidates pending connections. Reload restores Dev or
  reconnects an explicitly selected NIP-07 extension. Bunker remains selected
  but disconnected until its URI is entered again. Only the method is persisted,
  never keys, bunker credentials/URIs, or approvals. Invalid/unreadable storage
  defaults to None; failed writes leave in-session controls usable. Missing
  extensions report an error without switching methods. Fixed simulation identity
  remains separate from signing authority. Sign, publish,
  Blossom upload, and external-link requests use one serialized in-page
  confirmation dialog. Deny has initial focus and Escape denies. Napplet-scoped
  signing and publishing default to one-time approval. The modal can remember
  one kind, every kind for the current action, or **all signing and publishing
  from this napplet version**. Signing-only grants never authorize publication.
  Scope includes the active signer, verified manifest identity (including author)
  and artifact hash; local single-file targets have a separate content scope.
  Another version, manifest or account asks again. Signed versions can retain
  approval after reload. Direct development URLs have only document/frame-load
  approval, because their running code is mutable, including through HMR.
  Signerless CVM uses a separate host-generated principal for this document;
  approvals never transfer to a user account or another host session.
  Otherwise, missing identity/account/kind stays one-shot. Other operation permissions,
  including external links, remain separate. Link navigation runs directly from
  the modal approval click. Deny/Escape and endpoint/account changes prevent
  pending effects. **Forget remembered approvals** revokes saved choices;
  failed durable revocation remains visible. Storage failure keeps new choices
  memory-only; a full host reload changes the ephemeral Dev account.
  Remembered choices are a legacy confirmation preference after runtime
  Firewall authorization, never a replacement grant. Actual remembered use warns
  once per page with `FW-PAJA-SIGNER-CONSENT-LEGACY-001`; use Firewall grants instead.
  Old signing-only records never gain publication, warn once with
  `KEHTO-PAJA-SIGNER-CONSENT-V1`, and can be reviewed or revoked. See the
  [compatibility register](https://github.com/kehto/web/blob/main/docs/compatibility.md).
  This host policy follows [NAP-RELAY `9f30b350`](https://github.com/napplet/naps/blob/9f30b3505335a52c574ff570576687d6467021ff/naps/NAP-RELAY.md),
  [NAP-OUTBOX `8865f73d`](https://github.com/napplet/naps/blob/8865f73d52a4864afee145f28d26520476273927/naps/NAP-OUTBOX.md)
  and [NAP-LINK `50a2cd45`](https://github.com/napplet/naps/blob/50a2cd45e76f06e87b87e93842badf4c61f17bde/naps/NAP-LINK.md); it is not a
  Kehto runtime default. Upload consent shows the requesting
  napplet, file, MIME type, size, server, and durable public effect before
  bytes leave the browser. A denial or a live publish with no accepting relay
  returns a canonical failure and does not enter Paja's in-memory relay view.
  A declined OUTBOX publish is `publish denied`; relays that fail are
  `relay timeout`, never a denial. Paja's live transport finishes a relay that
  failed to connect like one that sent EOSE, so a Paja OUTBOX read cannot yet
  mark that relay `incomplete`.
  Its scoped-relay hook likewise waits for the backend result and returns
  `false` after denial or transport failure.
- **Resource servers** — extra Blossom lookup origins with a newline textarea and
  Save button, immediately before the Language models section (see below).
- **Language models** — draft NAP-LLM connections: provider preset, base URL,
  model, capability flags (images, JSON output, **Tool calling** with optional **Required tool choice** and **Named tool choice**; a connection that never ticks tool calling serves none) and an optional API key that is either session-only or
  encrypted in a password-protected vault. A preset that declares a listing path
  (`LLM_PROVIDER_PRESETS[].modelsPath`, Routstr's `/models`) swaps free-text
  model entry for a dropdown seeded from one `GET` against that path, showing
  `Connected ✓ — n models` under the field. A failed listing names the reason
  and falls back to free-text entry so a connection can still be saved. The Interfaces toggle for `llm` is
  yellow (`⚠ llm`) while no connection exists; `select()` offers to open this
  panel and every generation asks for consent that names the napplet, route, model, counts, any tool definitions offered and the number of tool results being sent. Paja relays tool calls to the napplet and never runs one. See [Language models](/llm).
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
  its receipt count, and its `kind - count` rows. A box also names the authors
  its reads were routed for, as short pubkey chips with the full pubkey and the
  read count in their tooltip. NIP-65 chips name the actual relay-list owners
  supplied by the router, including `options.authors` hints; event-filter authors
  with no matching relay list are not credited for someone else's relay.
  Caller-hint and fallback boxes name requested routing authors; Paja's own
  `host pool` reads name the authors their filters asked about. A box is a routing decision
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
the protected `resource` interface. A target that lists `resource` under
`napplet-requires` is loaded as a network-isolated snapshot instead (see
[Targets that require `resource`](#targets-that-require-resource)), and a
self-contained local file can request `resource` under the same closed CSP.
Loading an
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
the UI distinguishes deadline or connection failure from the case where
the relays that answered reached EOSE without a matching manifest (see
[Pointer not found](#pointer-not-found)). Wider relay search
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

### Handlers that aren't installed yet

When no installed handler is compatible with an invoke, Paja doesn't reject
straight away. It opens **No installed app opens this**, which names the
archetype, action, and convention. Nothing touches the network until the user
presses **Search for apps**. Paja then asks the configured relays for manifests
of every NIP-5D manifest kind whose `i` tag is the exact convention. If the
request carried a `handlerHint`, the same search also looks up that coordinate,
and a matching result is listed first as suggested by the app. Each result must
have a valid signature and must advertise the same archetype (`z`) and exact
convention (`i`). Results already installed are skipped. The list appears under
**Not installed yet** and is capped by `intent.discoveryLimit`. When no relay can
be reached, Paja says the search failed. It doesn't say that no app exists, and
it never reports a denial.

Picking a result runs the ordinary verified pointer load: event signature,
exact coordinate, and NIP-5A artifact hash. Paja then installs the result and
delivers to it, and **Always use this app** makes it the default. Search results
are never added to `available()` or `handlers()` and are never shown to
napplets. The resolver uses a pick only when the reloaded, verified catalog
entry supports the convention. An explicit catalog `handler` never triggers a
search. Cancelling, finding nothing, or a failed install keeps the original
rejection (`no handler`, `unsupported action`, or `unsupported convention`).
This uses the MAY in NAP-INTENT's "Recommended handler resolution" on
`napplet/naps` master at `377bf939`.

### App handlers panel

The **App handlers** sidebar section lists every archetype that has an installed
handler. For each one it shows the user's default, the other candidates, and
their conventions. **Make default** and **Forget default** change the
per-archetype default. **Uninstall** removes the handler from the catalog and
from the saved catalog pointers, and also forgets any default that pointed at
it. Every change emits `intent.changed`. Napplets can't reach this panel and
can't change defaults. A tab still open on an uninstalled handler reinstalls it
the next time that tab is restored.

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
`resource`, `cvm`, `upload`, `intent`, `count`, `dm`, `fs`, and `llm`.

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
HTTP(S), asks for exact-URL approval, then opens from the approving click with
`noopener,noreferrer`. A link allowed without a live click, such as by a
standing rule, gets a host confirmation first. The current verified app
artifact and approval signal are rechecked before opening. A stale confirmation cannot navigate.
Relay/outbox uses NIP-65 relay lists (`kind:10002`) with fallback relays, and the
identity service reads contact lists (`kind:3`) so social-graph napplets can be
tested against real account state. `--relay-mode memory` retains an internal
fixture/event store for tests but does not register or advertise relay, outbox,
or count. Live relay URLs are validated as credential-free `ws:`/`wss:` URLs;
fixture events and local publish echoes never enter live reads, relay-tier edits
drive the corresponding transports, and event sidecars contain only relay URLs
that the pool actually observed.

WebRTC requires browser `RTCPeerConnection` and live relay access. The default
profile also requires a connected NIP-44 signer; an explicitly configured
multiplayer profile uses a temporary transport key instead. Paja owns peer connections and data channels, obtains
explicit session consent, signs kind-25050 Nostr signaling, encrypts
offer/answer SDP, and keeps application payloads exclusively on the data
channel. The default profile carries NAP-WEBRTC byte payloads: `sendBytes`
goes out as one binary data-channel message, an incoming binary message
becomes a `bytes` event, and text stays a JSON `message` event, with no
conversion between them. Sessions report `maxPayloadBytes` from the `webrtc.maxPayloadBytes` setting (default 64 KiB); the
`soy-rtc/1` multiplayer profile stays JSON-only and answers `sendBytes` with
`unsupported`. `tests/e2e/paja-webrtc-bytes.spec.ts` runs two Paja hosts with
their own signers over a real Chromium data channel. Signer changes tear down sessions and synchronize runtime service
handlers. When `webrtc` appears or disappears, a frame that declared it gets a
replacement iframe with the new environment (see the signer-change notes below);
napplets never receive SDP, ICE internals, relay sockets, or browser networking
objects. The signaling boundary follows pinned
[NAP-WEBRTC `5fae95dd2c8e59bd06c654e0845656add077dcda`](https://github.com/napplet/naps/blob/5fae95dd2c8e59bd06c654e0845656add077dcda/naps/NAP-WEBRTC.md)
and [NIP-100 PR #363 head `ead1cd6`](https://github.com/nostr-protocol/nips/pull/363).

### Browser regression coverage

Playwright specs drive these services through the injected `window.napplet.*`
namespace of a minimal hosted napplet. They check each result at both ends: the
value the napplet sees and the wire traffic captured by an in-test Nostr relay
(`tests/e2e/helpers/memory-relay.ts`).

- `tests/e2e/paja-relay.spec.ts`: `relay.publish` through the NIP-07 signer,
  `relay.publishEncrypted` NIP-44 ciphertext, and `relay.subscribe` delivery
  (stored events, then EOSE, then live events, then close). Revoking
  `relay:write` live denies a publish before anything is signed.
- `tests/e2e/paja-storage.spec.ts`: persistence across a host reload, isolation
  of the `instance` scope, and live `state:write` revocation.
- `tests/e2e/paja-identity.spec.ts`: the signer connecting and failing, and
  NIP-07 reconnecting after a reload.
- `tests/e2e/paja-cvm.spec.ts`: discovery and one gift-wrapped `tools/call`
  against an in-test ContextVM server, plus per-window admission (one call
  running, one queued, overflow refused) under `simulation.cvm.concurrency`.

Signer changes follow NAP-IDENTITY
([napplet/naps master `377bf939`](https://github.com/napplet/naps/blob/377bf939c6c906817084b43dd21d424de646dbc2/naps/NAP-IDENTITY.md)):
connecting, switching or disconnecting a signer keeps every loaded napplet
running and pushes `identity.changed` with the new shell-user pubkey, or
`pubkey: ""` when the identity is cleared. A push is sent only when the pubkey
actually changes, not for intermediate states such as `connecting`.

Paja reloads the active frame on a signer change in one case only: the change
alters the advertised domain set in a way that changes what that frame would be
injected. NIP-5D fixes a frame's domain namespace before its code runs, so a
new domain needs a fresh document. Some domains depend on the signer (`webrtc`
needs a signaling signer, `dm` needs the Dev signer, `upload` needs a writable
signer identity). Paja reloads when one of those appears and the napplet
declared it, or declared no domains at all. It also reloads when one disappears
that the frame was admitted. A napplet that declared neither keeps its frame.
Background runtime tabs are not reloaded, which is the same as any other
environment change.

- `tests/e2e/paja-identity.spec.ts` also checks that a loaded napplet receives
  `identity.changed` for connect, switch and disconnect without a reload.
- `tests/e2e/paja-webrtc.spec.ts` covers the narrow reload. A target that
  declares `webrtc` is reloaded once when a signer makes `webrtc` routable.

### Standard identity and private social cache

A signed-in napplet uses the existing `identity.getPublicKey`,
`identity.getFollows`, and ordinary kind-0 `outbox.query` messages. Paja adds no
custom social service, direct networking path, or signer/key capability. It
privately validates the active account's replacement kind-3 contact list and
warms followed kind-0 profile records through the established outbox router.

Warming is background traffic, so it runs only for an account Paja can act as: a
connected NIP-07/NIP-46 pubkey or the ephemeral Dev signer. A fixed simulation
identity (`simulation.identity.mode: "fixed"`) is a read-only stand-in — it
answers `identity.getPublicKey`, and `identity.getFollows` still loads that
account's contact list on demand — but with no signer connected it never starts
author-routed relay reads. Without that gate a signer-less session fetched the
fallback identity's contact list and every followed author's profile through the
outbox router, which surfaced other people's NIP-65 relays in the Events panel
and looked like outbox activity nobody had requested. A signer dropping out ends
warming the same way: the next cycle only starts once a signer account is back.

The social cache is active-account-scoped and memory-only, separate from generic
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
and the installed `@napplet/nap` NAP-OUTBOX types (0.45.0 for host packages) govern this PoC because current master
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
responses to `server.resourceMaxBytes` and `server.resourceTimeoutMs` (default 10 MiB and 30 seconds). Private, loopback, and other blocked
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
host uses only configured discovery/super relays for bootstrap discovery,
including contact-list and followed-author warming. Paja neither reads nor calls
the obsolete NIP-07 `getRelays()` extension property, including during signer
initialization and account changes; there is no signer-bootstrap cache.
The retained NAP `identity.getRelays` operation returns an empty relay map for
unsupported external-user metadata, not host URLs presented as user NIP-65
preferences. This follows [current NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md)
(checked 2026-11-12) and [NAP-IDENTITY at `43cb3a4`](https://github.com/napplet/naps/blob/43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab/naps/NAP-IDENTITY.md),
which permits empty unsupported results. The user-list
lookup works independently of upload mode; an upload runtime may reuse the same
servers when present. ROM-specific event and publisher locations retain
priority over the user/runtime fallbacks. URI length is capped at `blossom.maxUriChars` (default 8192 characters);
retained unique `xs`, the complete author lookup list, and combined server
candidates are each capped at eight by default (`blossom.maxUriHints`, `resource.maxServers`). Both prefixes require exactly 64 hex
characters, with an optional single ASCII-alphanumeric extension preserved in
`GET /<hash>.<ext>`; no query hints reach the blob server. Extensions and upstream
headers never establish MIME. Fragments, path injection, malformed escapes/authors,
and invalid or repeated `sz` fail with `invalid-request` before discovery.
`sz` must be a positive decimal safe integer; sizes above `resource.maxBytes` (default 10 MiB) fail `too-large`.
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

## Settings

Every Paja timeout, interval, cap and abuse bound is a user-changeable default.
Open **Settings** in the top bar to edit them. The dialog has one tab per group
below (arrow keys, Home and End move between tabs) and is generated from the
settings registry, so it lists every key. On a failed save, every tab holding an
invalid value is marked "needs fixing" and the first one opens with focus on the
field. All defaults are defined in one file, `packages/paja/src/settings-registry.ts`. Saved values persist per host
origin under `kehto:paja:settings.v1` (overrides only) and are restored on every
visit. Corrupt, retired or out-of-range stored entries are dropped rather than
clamped; if storage is unavailable, changes apply for the session only. Most
changes take effect on the next operation; anything a running napplet or service
already captured applies after **Save and reload**. Napplets cannot read or write
these settings.

A config file can seed the same keys under `settings`. Browser-scope keys become
the host page's defaults (a saved GUI override still wins); server-scope keys apply
to the CLI and server process and are shown read-only in the dialog. Unknown keys and
out-of-range values in a config file are an error, not a silent clamp.

```json
{
  "targetUrl": "http://127.0.0.1:5173",
  "settings": {
    "relay.liveQueryWaitMs": 8000,
    "server.resourceTimeoutMs": 60000
  }
}
```

Bounds keep abuse guards from being disabled (no zero, negative or unbounded caps),
and security floors can only be raised: `vault.minPasswordLength`,
`vault.minDistinctChars`, `vault.pbkdf2Iterations` (new vaults only; an existing
vault keeps the iterations it was created with) and `webrtc.roomMinChars`.
`--port` and `--ready-timeout` stay CLI/config options.

Numbers that are not settings, because changing them would break a wire contract
or a persisted format: Nostr event kinds (named in `nostr-kinds.ts`), crypto sizes,
HTTP status codes, reserved address ranges, MIME magic bytes, unit conversions,
and presentation values such as CSS sizes. `settings-guard.test.ts` fails on any
new bare number that is neither registered nor listed there with its reason.

NAP-FS `limits`, NAP-WEBRTC `maxPayloadBytes` and NAP-RESOURCE caps are shell
policy in their drafts (NAP-FS `bd1b9e9`, NAP-WEBRTC `fb4dd6f`, NAP-RESOURCE
`ae5b9c6`), so Paja advertises and enforces the effective setting.

| Key | Setting | Default | Range |
|---|---|---|---|
| **Relays and queries** | | | |
| `relay.liveQueryWaitMs` | Live relay query and connect wait | 4000 ms | 250–120000 |
| `relay.hostQueryTimeoutMs` | Host-owned relay query timeout | 5000 ms | 250–120000 |
| `relay.contactListCandidateLimit` | Contact-list candidates per lookup | 64 | 1–1024 |
| `relay.profileQueryLimit` | Events per profile or list query | 16 | 1–500 |
| `relay.eventLookupLimit` | Events per id lookup | 8 | 1–500 |
| `relay.replaceableLookupLimit` | Events per relay-list lookup | 2 | 1–100 |
| `relay.missingProfileQueryMinimum` | Minimum batch size for missing profiles | 10 | 1–500 |
| `social.followParseYieldEvery` | Follow tags parsed before yielding | 64 | 1–10000 |
| `social.profileWarmYieldEvery` | Profiles warmed before yielding | 64 | 1–10000 |
| **Resources and Blossom** | | | |
| `resource.maxBytes` | Maximum resource size | 10485760 bytes | 1024–536870912 |
| `resource.maxUrls` | URLs per bulk request | 100 | 1–1000 |
| `resource.maxServers` | Blossom servers tried per blob | 8 | 1–64 |
| `resource.maxRedirects` | Redirects followed per fetch | 5 | 0–20 |
| `blossom.serverListTtlMs` | Server-list cache lifetime | 300000 ms | 0–86400000 |
| `blossom.maxResourcesPerWindow` | Tracked resources per napplet | 256 | 1–10000 |
| `blossom.maxContextsPerResource` | Contexts kept per resource | 8 | 1–256 |
| `blossom.maxServerListChars` | Maximum server-list event size | 262144 chars | 1024–16777216 |
| `blossom.maxUriHints` | Server hints per blossom: URI | 8 | 0–64 |
| `blossom.maxUriChars` | Maximum blossom: URI length | 8192 chars | 256–65536 |
| **Filesystem** | | | |
| `fs.maxReadBytes` | Maximum bytes per read | 1048576 bytes | 1–268435456 |
| `fs.maxWriteBytes` | Maximum bytes per write | 1048576 bytes | 1–268435456 |
| `fs.maxRevisionBytes` | Maximum file size for revision hashing | 16777216 bytes | 1–1073741824 |
| `fs.maxWatchCount` | Active watches per napplet | 16 | 1–256 |
| `fs.watchIntervalMs` | Watch polling interval | 1000 ms | 100–60000 |
| `fs.encodeChunkBytes` | Base64 encode chunk size | 32768 bytes | 1024–65536 |
| **WebRTC** | | | |
| `webrtc.maxPayloadBytes` | Maximum payload per send | 65536 bytes | 1024–1048576 |
| `webrtc.maxSessionsPerWindow` | Sessions per napplet | 4 | 1–64 |
| `webrtc.maxPeers` | Peers per session | 8 | 1–64 |
| `webrtc.signalMaxAgeSeconds` | Maximum signal age | 300 s | 10–3600 |
| `webrtc.signalLookbackSeconds` | Signal subscription lookback | 60 s | 0–3600 |
| `webrtc.iceGatherTimeoutMs` | ICE gathering timeout | 8000 ms | 500–120000 |
| `webrtc.bufferedAmountLimitBytes` | Data-channel buffer limit | 1048576 bytes | 16384–67108864 |
| `webrtc.seenSignalCache` | Remembered signal ids | 256 | 16–65536 |
| `webrtc.roomMinChars` | Minimum room length | 8 chars | 8–128 |
| `webrtc.roomMaxChars` | Maximum room length | 128 chars | 8–1024 |
| `webrtc.channelMaxChars` | Maximum channel label length | 64 chars | 1–1024 |
| `webrtc.protocolMaxChars` | Maximum protocol length | 64 chars | 1–1024 |
| **Multiplayer WebRTC profile** | | | |
| `mp.maxMessageBytes` | Maximum message size | 16384 bytes | 1024–1048576 |
| `mp.roomMaxChars` | Maximum room length | 256 chars | 1–4096 |
| `mp.maxPeers` | Peers per room | 8 | 1–64 |
| `mp.channelMaxChars` | Maximum channel length | 64 chars | 1–1024 |
| `mp.protocolMaxChars` | Maximum protocol length | 128 chars | 1–1024 |
| `mp.maxSessions` | Rooms per napplet | 4 | 1–64 |
| `mp.iceGatherTimeoutMs` | ICE gathering timeout | 8000 ms | 500–120000 |
| `mp.signalExpirationSeconds` | Signal expiration | 60 s | 5–3600 |
| `mp.signalMaxAgeSeconds` | Maximum signal age | 60 s | 5–3600 |
| `mp.signalLookbackSeconds` | Signal subscription lookback | 10 s | 0–3600 |
| `mp.rateWindowMs` | Rate-limit window | 1000 ms | 100–60000 |
| `mp.maxMessagesPerWindow` | Messages per window | 240 | 1–100000 |
| `mp.maxBytesPerWindow` | Bytes per window | 524288 bytes | 1024–67108864 |
| `mp.maxSignalsPerWindow` | Signals per window | 32 | 1–10000 |
| `mp.maxQueuedPerPeer` | Queued messages per peer | 4 | 1–1024 |
| `mp.maxSignalChars` | Maximum signal size | 64000 chars | 1024–1048576 |
| `mp.sdpMaxChars` | Maximum SDP size | 32000 chars | 1024–1048576 |
| `mp.nonceMaxChars` | Maximum nonce length | 64 chars | 8–1024 |
| `mp.seenSignalCache` | Remembered signal ids | 2048 | 16–65536 |
| `mp.maxRetiredPeers` | Retired peer incarnations per room | 256 | 1–65536 |
| `mp.joinTimeoutMs` | Peer join timeout | 45000 ms | 1000–600000 |
| `mp.tickIntervalMs` | Room maintenance interval | 2000 ms | 100–60000 |
| `mp.bufferedAmountLimitBytes` | Data-channel buffer limit | 262144 bytes | 16384–67108864 |
| **Intents and links** | | | |
| `intent.maxDeliveryAttempts` | Delivery attempts ceiling | 10 | 1–100 |
| `intent.launcherReadyTimeoutMs` | Launcher ready timeout | 10000 ms | 1000–600000 |
| `intent.launcherOutcomeTimeoutMs` | Launcher outcome timeout | 10000 ms | 1000–600000 |
| `intent.linkMaxBytes` | Maximum app-link size | 16384 bytes | 1024–1048576 |
| `intent.discoveryLimit` | Not-installed intent handlers offered per search | 20 | 1–200 |
| `link.approvalClickWindowMs` | Link approval click window | 1000 ms | 100–10000 |
| `link.labelMaxChars` | Maximum link label length | 256 chars | 1–4096 |
| **Firewall** | | | |
| `firewall.maxRequirements` | Requirements per approval request | 128 | 2–1024 |
| `firewall.maxGrants` | Grants in the permission table | 2048 | 64–16384 |
| `firewall.maxGrantsPerNapplet` | Grants one napplet may hold | 512 | 16–16384 |
| `firewall.promptOpenOrigins` | Relay origins listed open in a prompt | 5 | 0–1023 |
| **Signer** | | | |
| `signer.nip46TimeoutMs` | Remote signer request timeout | 30000 ms | 1000–600000 |
| `signer.previewChars` | Content shown in signing prompts | 240 chars | 16–10000 |
| `signer.consentMaxSubjects` | Remembered consent subjects | 128 | 1–10000 |
| `signer.consentMaxKindsPerSubject` | Remembered kinds per subject | 128 | 1–10000 |
| `signer.consentMaxIdentityChars` | Maximum consent identity length | 512 chars | 64–8192 |
| **Language models** | | | |
| `llm.modelsTimeoutMs` | Model list timeout | 8000 ms | 500–120000 |
| `llm.maxConnections` | Saved connections | 32 | 1–256 |
| `llm.connectionNameMaxChars` | Maximum connection name length | 64 chars | 1–1024 |
| `llm.presetIdMaxChars` | Maximum preset id length | 64 chars | 1–1024 |
| `llm.modelIdMaxChars` | Maximum model id length | 200 chars | 1–4096 |
| `vault.minPasswordLength` | Minimum vault password length | 12 chars | 12–256 |
| `vault.minDistinctChars` | Minimum distinct password characters | 4 chars | 4–64 |
| `vault.pbkdf2Iterations` | PBKDF2 iterations for new vaults | 600000 | 600000–10000000 |
| **Multiplayer providers** | | | |
| `cvm.discoveryTimeoutMs` | Provider discovery timeout | 15000 ms | 1000–300000 |
| `cvm.serverRequestTimeoutMs` | Server request answer window | 30000 ms | 1000–300000 |
| `cvm.discoveryMaxBytes` | Maximum discovery document size | 1000000 bytes | 1024–67108864 |
| `cvm.discoveryEventLimit` | Events per discovery query | 64 | 1–1000 |
| `cvm.referenceMaxChars` | Maximum discovery input length | 2048 chars | 64–65536 |
| `cvm.toolNameMaxChars` | Maximum tool name length | 256 chars | 1–4096 |
| `cvm.maxSavedFamilies` | Saved provider families | 16 | 1–256 |
| `cvm.familySourceMaxChars` | Maximum saved family source length | 4096 chars | 64–65536 |
| `multiplayer.textMaxChars` | Maximum configuration text length | 256 chars | 1–4096 |
| `multiplayer.maxRelays` | Relays per configuration | 16 | 1–256 |
| `multiplayer.maxTools` | Tools per family | 64 | 1–1024 |
| `multiplayer.maxRegistryFamilies` | Registry families | 16 | 1–256 |
| `multiplayer.maxIceServers` | ICE servers | 8 | 1–64 |
| `multiplayer.maxIceUrls` | URLs per ICE server | 8 | 1–64 |
| **Development target** | | | |
| `target.maxDTagChars` | Maximum development d tag length | 128 chars | 1–1024 |
| `target.maxNapDeclarations` | Development NAP declarations | 64 | 1–1024 |
| `target.maxReportedAssets` | Relative assets listed in diagnostics | 8 | 1–1000 |
| `target.maxReportedReferences` | Network references listed in diagnostics | 8 | 1–1000 |
| `target.runtimeWaitMs` | Pointer resolution relay deadline | 5000 ms | 250–300000 |
| `target.failureReasonChars` | Characters per relay failure reason | 160 chars | 16–4096 |
| `target.failureReasonCount` | Relay failure reasons shown | 3 | 1–50 |
| `target.pointerReplacementLimit` | Replacement manifests offered for a gone nevent | 50 | 1–500 |
| **Console and indicators** | | | |
| `console.messageLogLimit` | Messages kept in the log | 500 | 10–100000 |
| `console.messageLogVisibleRows` | Messages rendered in the log | 120 | 10–10000 |
| `notify.badgeMaxCount` | Largest badge count shown | 9999 | 9–1000000 |
| `notify.maxActions` | Actions per notification | 3 | 0–3 |
| `gamepad.axisDeadzone` | Stick deadzone | 0.12 | 0–1 |
| `gamepad.buttonThreshold` | Button press threshold | 0.05 | 0–1 |
| `gamepad.activityHoldMs` | Controller activity highlight | 420 ms | 0–10000 |
| **Server (config file only)** | | | |
| `server.readinessPollIntervalMs` | Target readiness poll interval | 250 ms | 50–60000 |
| `server.shutdownGraceMs` | Shutdown grace before force close | 500 ms | 0–60000 |
| `server.requestBodyTimeoutMs` | Request body timeout | 10000 ms | 1000–300000 |
| `server.requestBodyMaxBytes` | Maximum request body | 4096 bytes | 256–1048576 |
| `server.resourceMaxBytes` | Maximum proxied resource size | 10485760 bytes | 1024–536870912 |
| `server.resourceTimeoutMs` | Proxied resource timeout | 30000 ms | 1000–600000 |
| `server.targetNoticeTimeoutMs` | Target network notice timeout | 2000 ms | 100–60000 |
| `server.discoveryGraceMs` | Managed command URL discovery grace | 1000 ms | 0–60000 |

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
- Mints frame-admission `instanceId`, intent-launcher window ids and launch
  correlations, and NIP-46 request ids with the `@kehto/shell` `randomUUID` helper,
  so they stay secure on origins without `crypto.randomUUID()` (non-localhost plain
  HTTP). Development-target hashing, filesystem hashing, WebRTC, and the LLM vault
  still need `crypto.subtle` and stay unavailable there; see the
  [shell package doc](https://github.com/kehto/web/blob/main/docs/packages/shell.md#uuid-support-on-http-origins).

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
cannot accompany an inner query. URLs are limited to `intent.linkMaxBytes` (default 16 KiB) UTF-8. Duplicate
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


### Relay unreachable

Pointer resolution tracks each relay's connection outcome, not just whether
events arrived. When **zero** relays open a WebSocket, the resolver throws
`PajaRelayUnreachableError` (`code: 'relay-unreachable'`, with a
`PajaRelayConnectionSummary` of connected/failed/pending relays) instead of the
generic timeout, and the pointer status reads `No relay connection could be
opened … 0 of N relays connected …` with the likely causes: the browser is
offline, the relays are blocked, or the browser reached its WebSocket connection
limit (for example many open tabs each holding relay connections). Paja logs a
`paja.relay.unreachable` entry with the per-relay detail. A deadline expiry with
at least one live relay keeps the timeout message and now states how many relays
connected. Pools without `ensureRelay` keep the previous timeout and relay
query failure messages.

### Pointer not found

Relays fail now and then; one down relay does not turn a clean miss into a
failure. When at least one relay answered `EOSE` without the manifest, the
resolver throws `PajaPointerNotFoundError` (`code: 'pointer-not-found'`, with
`answered`, `failed`, and the queried `relays`), and the status reads
`Napplet manifest not found (4 answered, 1 failed): …` followed by the relays
that could not be asked. Paja logs `paja.pointer.not-found` with the counts. The
no-connection message and its WebSocket-limit hint stay reserved for zero
opened sockets, and a query no relay answered (every relay failed or sent
`CLOSED`) stays a relay query failure.

A `nevent` pins one event. When it names an addressable napplet (`35129`, with
`author` and `kind`) whose event is gone, the author has most likely republished
it and relays replaced the old event. A `nevent` carries no `d` tag, so Paja
cannot tell which coordinate it belonged to. `findPajaPointerReplacements` asks
the relays that answered for the author's current `35129` manifests and lists
each `d` tag (up to 50). One candidate shows as an **Open …** button; several
show as a picker with nothing preselected, because Paja picks none. Nothing is fetched from Blossom, verified, installed, or framed until the
user clicks one. The click starts an ordinary `naddr` load, so the manifest
signature, artifact hash, `(dTag, artifactHash)` identity, and version consent
all run again for the new bytes. Paja never swaps bytes under the old
verified identity. Replaceable root (`15129`) nevents are not offered a
replacement yet.

## Controller diagnostics

Paja shows a numbered controller icon directly beside the console arrow for each controller the browser detects. Each slot has its own color and input animation; hover for the controller model and activity state. Buttons and stick movement light up only that controller (stick movement below 0.12 is ignored). Quick taps retain the highlight briefly so they are easy to spot. Reduced-motion settings keep the activity highlight without animation. Disconnecting removes the icon. Browsers may require a button press before exposing a newly connected controller. These host diagnostics work without a napplet gamepad subscription and do not change focus-scoped input delivery.

## Media sessions

Live HTTPS MP3/AAC sources start through the host resource policy and bounded
MediaSource buffers, without awaiting EOF. They expose pause/stop/volume but no seek.

See [Media playback](https://github.com/kehto/web/blob/main/docs/media.md) for NAP-MEDIA draft authority, shell-owned audio/video,
shared host controls, endpoint cleanup, and command API migration.

The host peer window accepts `@napplet/core` `>=0.42.0 <0.46.0` and `@napplet/nap` `>=0.37.0 <0.46.0`, and Paja develops on core 0.45.0 / nap 0.45.0. The newly packaged `blossom`, `catalog`, `navigation`, `soulseek` and `torrent` domains remain absent until Paja has corresponding host backends. See the [checked contract and dependency policy](https://github.com/kehto/web/blob/main/docs/policies/NIP-5D-CONFORMANCE.md#host-dependency-line-core-0-45-nap-0-45).

## Optional temporal protection

Paja explicitly installs operation and prompt limiters from `@kehto/rate-limit`
in `createPajaPermissionAdapter`. These are Paja host choices; runtime and Firewall
do not impose them on other hosts. Limiter configuration and counters are separate
from approval grants.

### CVM request admission

Paja bounds NAP-CVM work per window, with or without a multiplayer profile. Each
window may have 8 CVM operations running and 32 queued by default. Set
`simulation.cvm.concurrency` in a Paja config file to change that:

```json
{ "simulation": { "cvm": { "concurrency": { "maxInFlight": 4, "maxQueued": 16 } } } }
```

`maxInFlight` is an integer of at least 1 and `maxQueued` an integer of at least
0. Queued time counts against the request's `timeoutMs`; work past both limits is
refused with `policy denied`. One window filling its budget doesn't delay another.
See [`@kehto/services` CVM admission](/packages/services#cvm-admission).

### Configurable multiplayer providers

The **Multiplayer providers** sidebar accepts explicit JSON settings, also available
as `simulation.multiplayer` in a Paja config file. Select `soy-rtc/1`, signaling
relays, and CVM families with pinned tool schemas. Optional static STUN/TURN
settings receive separate endpoint approval. No provider is selected from an app
URL. See [configuration and interoperability](/paja-multiplayer).

The same sidebar discovers CVM tool inventories from a `nevent`, a CEP-15 tool
schema hash, or an HTTPS website's `/.well-known/napplet.json`. Choose a provider,
local family label, and tools; generated JSON is read-only and shows its source.
Manual JSON remains editable. Saved families persist per host origin and coexist
in the registry, including without a multiplayer signaling profile. Saves and
removals reload the host. ContextVM doesn't define named-family manifests or
`naddr` discovery; labels and membership are local choices.
