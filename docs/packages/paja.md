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
| Version | `0.3.2` |
| Runtime entry | `./dist/index.js` |
| CLI runner entry | `./dist/cli.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@kehto/firewall`, `@kehto/nip`, `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, `@kehto/wm` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.20.0 <0.21.0` |
| `@napplet/nap` | `>=0.20.0 <0.21.0` |
| `nostr-tools` | `>=2.23.3 <3.0.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| Options | `normalizePajaOptions`, `PajaOptions`, `PajaRawOptions`, `PajaCommand`, `PajaOptionsError` |
| Simulation | `normalizePajaSimulation`, `summarizePajaSimulation`, `PajaSimulation`, `PajaSimulationRawOptions`, `PAJA_SIMULATION_DOMAINS` |
| Config files | `loadPajaConfigFile`, `mergePajaRawOptions`, `resolvePajaRawOptions` |
| Host config | `createPajaHostConfig`, `PajaHostConfig`, `formatPajaUrl` |
| Host page | `renderPajaHtml`, bundled `/__kehto/browser-host.js` runtime bootstrap |
| Parity metadata | `PAJA_UPSTREAM_WEB_DOMAINS`, `PAJA_ADVERTISED_DOMAINS`, `PAJA_HANDSHAKE_DOMAINS`, `PAJA_COMPATIBILITY_ALIASES`, `PAJA_REQUIRED_SERVICES`, `getMissingAdvertisedDomains`, `getMissingServices` |
| Readiness | `waitForTargetUrl`, `ReadinessError`, `WaitForTargetUrlOptions`, `ReadinessFetch` |
| Server | `startPajaServer`, `PajaServer`, `PajaServerOptions` |
| Defaults | `DEFAULT_PAJA_HOST`, `DEFAULT_PAJA_PORT`, `DEFAULT_READY_TIMEOUT_MS` |

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

The served host page keeps the visible surface intentionally small: one top bar,
one sandboxed target iframe, and one bottom bar. The iframe is created without a
static `src`; the browser bootstrap sets `sandbox="allow-scripts"`, registers the
iframe with `@kehto/shell`, navigates to the explicit target URL, and uses a real
`ShellBridge` plus `@kehto/runtime` for `shell.ready`, `shell.init`, ACL,
firewall, storage, INC, relay/outbox, and service dispatch. Reload uses a
generation-specific internal window id so the same iframe can receive a fresh
`shell.init` without restarting the CLI or the app dev server.

## NAP and Service Parity

Paja advertises the web NAP domains that can be reached through the
current Kehto runtime and deterministic development adapters:

`relay`, `outbox`, `identity`, `storage`, `inc`, `theme`, `keys`, `media`,
`notify`, `config`, `resource`, `cvm`, `upload`, and `intent`.

`shell` is represented as the mandatory handshake domain rather than a
`supports()`-discoverable capability. The deprecated legacy compatibility
package path is represented as an upstream alias to `inc`; upstream
`@napplet/nap` does not register a separate runtime domain for that alias.

Default service wiring includes in-memory relay/outbox behavior, localStorage
state persistence through the runtime, deterministic identity/config/theme,
notification, media, upload, intent, resource, and CVM adapters. These defaults
are intentionally useful for local authoring.

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

The visible host stays compact. The top bar includes a theme selector and reload
button; the bottom bar summarizes active simulation state, HMR strategy, runtime
address, and lifecycle status. Theme changes apply immediately to the Paja theme
service and survive the next iframe reload.

## Scope Boundaries

- Owns the local development host process, option normalization, managed command
  startup, target readiness polling, host HTML rendering, browser bootstrap, and
  runtime config JSON endpoint.
- Loads the app-provided target URL directly in the iframe so the app dev
  server keeps its own HMR behavior.
- Does not guess framework dev-server ports, mutate app build tooling, or add
  framework-specific adapters.
- Does not replace the full playground. Simulation controls stay in the top and
  bottom bars; debugger panes and protocol timelines remain out of scope here.

## API Reference

- Generated module: <a href="../api/modules/_kehto_paja.html" target="_self"><code>docs/api/modules/_kehto_paja.html</code></a>
- Local authoring how-to: [Use Paja for local napplet authoring](/how-tos/paja-local-authoring)
