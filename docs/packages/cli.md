# @kehto/cli

Top-level Kehto command namespace for local tooling.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. CLI commands are not yet a stability guarantee for final NAP
> contracts.

## Install

```bash
pnpm add -D @kehto/cli
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/cli/package.json`, `packages/cli/src/index.ts` |
| Version | `0.2.14` |
| Runtime entry | `./dist/index.js` |
| Binary | `kehto` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/paja` |
| Side effects | `false` |

## Commands

```bash
kehto paja --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1
```

`kehto paja` delegates to the Paja implementation package. Keeping the binary
in `@kehto/cli` leaves room for future top-level commands without causing
package-bin collisions across `@kehto/*` packages.

## Primary APIs

| Area | Exports |
|------|---------|
| Command runner | `runKehtoCli`, `RunKehtoCliOptions` |

## Scope Boundaries

- Owns the top-level `kehto` binary and command routing.
- Delegates `kehto paja` to `@kehto/paja` instead of reimplementing runtime
  hosting behavior.
- Does not own Paja's option schema, server lifecycle, browser host, or service
  simulation adapters.
- Should be the only `@kehto/*` package that claims the `kehto` binary.

## API Reference

- Generated module: <a href="../api/modules/_kehto_cli.html" target="_self"><code>docs/api/modules/_kehto_cli.html</code></a>
- Local authoring how-to: [Use Paja for local napplet authoring](/how-tos/paja-local-authoring)
