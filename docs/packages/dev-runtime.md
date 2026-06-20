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
static `src`; the browser bootstrap sets `sandbox="allow-scripts"`, navigates to
the explicit target URL, answers the target's `shell.ready` with a structured
`shell.init`, and exposes a reload control that reinitializes the iframe without
restarting the CLI or the app dev server.

## Scope Boundaries

- Owns the local development host process, option normalization, managed command
  startup, target readiness polling, host HTML rendering, browser bootstrap, and
  runtime config JSON endpoint.
- Loads the app-provided target URL directly in the iframe so the app dev
  server keeps its own HMR behavior.
- Does not guess framework dev-server ports, mutate app build tooling, or add
  framework-specific adapters.
- Phase 91 does not yet provide full shell/service wiring, environment
  simulation controls, or representative service-traffic e2e coverage; those
  belong to later v1.22 phases.

## API Reference

- Generated module: <a href="../api/modules/_kehto_dev-runtime.html" target="_self"><code>docs/api/modules/_kehto_dev-runtime.html</code></a>
