# @kehto/dev-runtime

Single-window development runtime for local napplet authoring.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. The development runtime API and CLI are new in v1.22 planning work
> and are not yet a stability guarantee for final NAP contracts.

## Install

```bash
pnpm add -D @kehto/dev-runtime
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/dev-runtime/package.json`, `packages/dev-runtime/src/index.ts` |
| Version | `0.1.0` |
| Runtime entry | `./dist/index.js` |
| CLI entry | `./dist/cli.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@kehto/firewall`, `@kehto/nip`, `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, `@kehto/wm` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.12.0 <0.14.0` |
| `@napplet/nap` | `>=0.12.0 <0.14.0` |
| `nostr-tools` | `>=2.23.3 <3.0.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| Options | `normalizeDevRuntimeOptions`, `DevRuntimeOptions`, `DevRuntimeRawOptions`, `DevRuntimeCommand`, `DevRuntimeOptionsError` |
| Host config | `createDevRuntimeHostConfig`, `DevRuntimeHostConfig`, `formatDevRuntimeUrl` |
| Host page | `renderDevRuntimeHtml`, bundled `/__kehto/browser-host.js` runtime bootstrap |
| Parity metadata | `DEV_RUNTIME_UPSTREAM_WEB_DOMAINS`, `DEV_RUNTIME_ADVERTISED_DOMAINS`, `DEV_RUNTIME_HANDSHAKE_DOMAINS`, `DEV_RUNTIME_COMPATIBILITY_ALIASES`, `DEV_RUNTIME_REQUIRED_SERVICES`, `getMissingAdvertisedDomains`, `getMissingServices` |
| Readiness | `waitForTargetUrl`, `ReadinessError`, `WaitForTargetUrlOptions`, `ReadinessFetch` |
| Server | `startDevRuntimeServer`, `DevRuntimeServer`, `DevRuntimeServerOptions` |
| Defaults | `DEFAULT_DEV_RUNTIME_HOST`, `DEFAULT_DEV_RUNTIME_PORT`, `DEFAULT_READY_TIMEOUT_MS` |

## CLI

```bash
kehto-dev-runtime --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1
```

The target URL is explicit. Managed-command mode may start any framework dev
command, but readiness waits for the provided URL instead of guessing the port
or framework.

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

The dev runtime advertises the web NAP domains that can be reached through the
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
are intentionally useful for local authoring; Phase 93 adds explicit simulation
controls for changing them.

## Scope Boundaries

- Owns the local development host process, option normalization, managed command
  startup, target readiness polling, host HTML rendering, browser bootstrap, and
  runtime config JSON endpoint.
- Loads the app-provided target URL directly in the iframe so the app dev
  server keeps its own HMR behavior.
- Does not guess framework dev-server ports, mutate app build tooling, or add
  framework-specific adapters.
- Simulation controls remain intentionally small in Phase 92; typed CLI/config
  controls for ACL, firewall, signer, relay, storage, cache, upload, media,
  config, and theme modes belong to Phase 93.

## API Reference

- Generated module: <a href="../api/modules/_kehto_dev-runtime.html" target="_self"><code>docs/api/modules/_kehto_dev-runtime.html</code></a>
