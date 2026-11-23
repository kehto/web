# @kehto/cli

Top-level Kehto command namespace for local tooling.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
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
| Version | `0.8.3` |
| Runtime entry | `./dist/index.js` |
| Binary | `kehto` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/paja`, `@kehto/conformance` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.42.0 <0.46.0` |
| `@napplet/nap` | `>=0.37.0 <0.46.0` |
| `nostr-tools` | `>=2.23.3 <=2.x` |
| `@playwright/test` | `^1.54.0` (optional; needed by `kehto conformance`) |

## Commands

```bash
kehto paja --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1
```

```bash
kehto conformance --profile minimal
kehto conformance --reporter junit --out conformance.xml
kehto conformance --ui --exec "pnpm build --watch"
```

`kehto conformance` delegates to `@kehto/conformance/cli`: it runs the NIP-5D
and NAP runtime conformance catalog against a real Kehto runtime in headless
Chromium and exits `0` (pass), `1` (an error-severity check failed) or `2`
(usage or harness error). It needs the optional `@playwright/test` peer and its
Chromium. `--ui` serves the live web UI instead and re-runs on each rebuild of
the served bundle. See [@kehto/conformance](./conformance.md).

`kehto paja` delegates to the Paja implementation package. Keeping the binary
in `@kehto/cli` leaves room for future top-level commands without causing
package-bin collisions across `@kehto/*` packages.

Real NAP-UPLOAD is opt-in and its server remains shell-owned:

```bash
kehto paja \
  --target-url http://127.0.0.1:5173 \
  --upload-mode blossom \
  --upload-server https://blossom.example \
  -- pnpm vite --host 127.0.0.1
```

Repeat `--upload-server` to provide an ordered list. These CLI values replace
servers from the config file. Without `--upload-mode blossom`, Paja retains its
deterministic memory simulator.

## Primary APIs

| Area | Exports |
|------|---------|
| Command runner | `runKehtoCli`, `RunKehtoCliOptions` |

## Scope Boundaries

- Owns the top-level `kehto` binary and command routing.
- Delegates `kehto paja` to `@kehto/paja` instead of reimplementing runtime
  hosting behavior, and `kehto conformance` to `@kehto/conformance/cli`.
- Does not own Paja's option schema, server lifecycle, browser host, or service
  simulation adapters.
- Should be the only `@kehto/*` package that claims the `kehto` binary.

## API Reference

- Generated module: <a href="../api/modules/_kehto_cli.html" target="_self"><code>docs/api/modules/_kehto_cli.html</code></a>
- Local authoring how-to: [Use Paja for local napplet authoring](/how-tos/paja-local-authoring)
