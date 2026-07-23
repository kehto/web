# @kehto/paja

Single-window Paja local authoring workshop for napplet development.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
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
| Version | `0.8.1` |
| Runtime entry | `./dist/index.js` |
| CLI runner entry | `./dist/cli.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@kehto/firewall`, `@kehto/nip`, `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, `@kehto/wm` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.23.0 <=0.28.x` |
| `@napplet/nap` | `>=0.23.0 <=0.28.x` |
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

The console includes:

- **Interfaces** — every supported Paja domain has an injection toggle. Toggling
  a domain updates the live capability override and reloads the target so the
  next `shell.init` reflects the changed support surface.
- **ACL** — every runtime capability can be granted or revoked for the target
  napplet identity. The controls write through `bridge.runtime.aclState`, so the
  next matching request is allowed or denied by the real runtime gate.
- **Signer** — Paja auto-connects a browser NIP-07 signer when `window.nostr`
  is available, can connect to a bunker/NIP-46 URI, and only uses the generated
  development signer when the Dev signer button is selected. Every request to
  sign an event or publish an event opens a browser confirmation prompt. Paja
  has no bypass list or allow-once whitelist.
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
namespace before assigning iframe `srcdoc`. Loading an already-running napplet
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

## NAP and Service Parity

Paja advertises the web NAP domains that can be reached through the
current Kehto runtime and deterministic development adapters:

`relay`, `outbox`, `identity`, `storage`, `inc`, `theme`, `keys`, `media`,
`notify`, `config`, `resource`, `cvm`, `upload`, `intent`, and `count`.

`shell` is represented as the mandatory handshake domain rather than an
injected availability domain. The deprecated legacy compatibility package path
is represented as an upstream alias to `inc`; upstream
`@napplet/nap` does not register a separate runtime domain for that alias. The
upstream `dm` domain is tracked as deferred until Paja wires a deterministic
development DM backend.

Default service wiring uses live relay/outbox behavior, localStorage state
persistence through the runtime, browser or configured identity, deterministic
config/theme, notification, media, upload, intent, resource, and CVM adapters.
Relay/outbox uses NIP-65 relay lists (`kind:10002`) with fallback relays, and the
identity service reads contact lists (`kind:3`) so social-graph napplets can be
tested against real account state. `--relay-mode memory` switches relay/outbox
to deterministic fixture/event-store behavior when a test needs isolation.

### NAP-UPLOAD

Upload mode defaults to `memory`, an explicit simulator that returns a
`kehto-dev://` URL without storing bytes. `blossom` mode is opt-in through
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

The `count` domain uses the active Paja relay backend to answer `count.query`
with exact aggregate counts and `approximate: false`. Broad empty filters are
refused as too expensive, and setting `relay.mode` to `disabled` also disables
`count` advertisement.

## Environment Simulation

The normalized simulation object controls:

- Capability domain advertisement through the production `shell.init` path.
- ACL mode and firewall mode metadata for development policy profiles.
- Anonymous or fixed identity mode.
- Live, memory fixture, or disabled relay/outbox behavior.
- Local, memory, or disabled storage mode advertisement.
- Memory or disabled artifact/cache metadata.
- Memory simulator, real Blossom, or disabled upload mode; shell-owned servers,
  BUD-03 discovery, maximum bytes, and MIME policy.
- Media, notification, intent, and CVM availability.
- Config values returned by `config.get`.
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
