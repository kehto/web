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
| Version | `0.6.1` |
| Runtime entry | `./dist/index.js` |
| CLI runner entry | `./dist/cli.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@kehto/firewall`, `@kehto/nip`, `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, `@kehto/wm` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.23.0 <=0.27.x` |
| `@napplet/nap` | `>=0.23.0 <=0.27.x` |
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
  --upload-rail dev-memory \
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
    "upload": { "rail": "dev-memory" },
    "theme": { "mode": "light" },
    "config": { "values": { "density": "compact" } }
  }
}
```

CLI flags override config-file values at the same nested paths.

For package-manager script examples covering `pnpm`, `npm`, and `yarn`, see
[Use Paja for local napplet authoring](/how-tos/paja-local-authoring).

## Browser Host

The served host page is a single-window development runtime: a control console
beside one sandboxed target iframe, plus compact top and bottom bars. The iframe
is created without a static `src`; the browser bootstrap sets
`sandbox="allow-scripts"`, registers the iframe with `@kehto/shell`, creates a
source-derived NIP-5D session entry, navigates to the explicit target URL, and
uses a real `ShellBridge` plus `@kehto/runtime` for `shell.ready`, `shell.init`,
ACL, firewall, storage, INC, relay/outbox, and service dispatch. Reload uses a
generation-specific internal window id so the same iframe can receive a fresh
`shell.init` without restarting the CLI or the app dev server.

The console includes:

- **Interfaces** — every supported Paja domain has an injection toggle. Toggling
  a domain updates the live capability override and reloads the target so the
  next `shell.init` reflects the changed support surface.
- **ACL** — every runtime capability can be granted or revoked for the target
  napplet identity. The controls write through `bridge.runtime.aclState`, so the
  next matching request is allowed or denied by the real runtime gate.
- **Signer** — Paja exposes a generated development signer by default and can
  switch to a browser NIP-07 signer or a bunker/NIP-46 URI. Every request to
  sign an event or publish an event opens a browser confirmation prompt. Paja
  has no bypass list or allow-once whitelist.
- **Messages** — inbound and outbound envelopes are logged with a text filter,
  including Paja system events such as interface changes, ACL changes, signer
  connection changes, signing/publish confirmations, and visible details for
`.error` envelopes.

The GitHub Pages artifact also includes a static Paja Runtime at `/web/paja/`.
That route uses `createPajaRuntimeHostConfig`, keeps `hmr: none`, and loads a
verified napplet into the same ShellBridge-backed iframe from a pasted `naddr`
or `nevent` pointer. `naddr` pointers resolve the latest matching NIP-5D named
manifest (`35129`) by author and `d` tag; `nevent` pointers resolve a specific
NIP-5D snapshot, root, or named manifest event id (`5129`, `15129`, or `35129`).
In both cases Paja verifies the signed manifest, aggregate hash, and every
Blossom blob before assigning iframe `srcdoc`.

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

Default service wiring includes in-memory relay/outbox behavior, localStorage
state persistence through the runtime, a generated local signer-backed identity,
deterministic config/theme,
notification, media, upload, intent, resource, and CVM adapters. These defaults
are intentionally useful for local authoring.

The `count` domain uses Paja's in-memory relay fixture/event store to answer
`count.query` with exact aggregate counts and `approximate: false`. Broad empty
filters are refused as too expensive, and setting `relay.mode` to `disabled`
also disables `count` advertisement.

## Environment Simulation

The normalized simulation object controls:

- Capability domain advertisement through the production `shell.init` path.
- ACL mode and firewall mode metadata for development policy profiles.
- Anonymous or fixed identity mode.
- Memory or disabled relay/outbox behavior.
- Local, memory, or disabled storage mode advertisement.
- Memory or disabled artifact/cache metadata.
- Memory or disabled upload mode and upload rail name.
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
  runtime config JSON endpoint.
- Loads the app-provided target URL directly in the iframe so the app dev
  server keeps its own HMR behavior.
- Does not guess framework dev-server ports, mutate app build tooling, or add
  framework-specific adapters.
- Does not replace the full playground. Paja is the package-scoped authoring
  runtime for one target app; the playground remains the multi-napplet demo and
  topology surface.

## API Reference

- Generated module: <a href="../api/modules/_kehto_paja.html" target="_self"><code>docs/api/modules/_kehto_paja.html</code></a>
- Getting started: [Paja getting started](/how-tos/paja-getting-started)
- Local authoring how-to: [Use Paja for local napplet authoring](/how-tos/paja-local-authoring)
