# @kehto/dev-runtime

Single-window development runtime for local napplet authoring.

The runtime is designed to be used from a napplet package script:

```json
{
  "scripts": {
    "dev": "kehto-dev-runtime --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1"
  }
}
```

The target URL is explicit on purpose. Kehto can spawn any framework command and
wait for that URL, but it does not guess which URL the framework chose. Loading
that URL directly in the runtime iframe preserves the app's own HMR behavior
without Vite, Svelte, React, or any other framework lock-in.

Phase 90 provides the package, typed option model, CLI parser, runtime server,
minimal host page, and host config surface. Phase 91 adds the single-window
browser host and reload loop. Phase 92 wires the host through a real
`ShellBridge`, `@kehto/runtime`, and deterministic development service adapters
for the current web NAP surface: relay/outbox, storage, identity, keys, config,
resource, theme, notify, media, upload, intent, cvm, and inc. `shell` is the
mandatory handshake domain; the deprecated legacy package path remains an
upstream compatibility alias to `inc`.

Later v1.22 phases add explicit environment simulation controls.

Full package docs: [`docs/packages/dev-runtime.md`](../../docs/packages/dev-runtime.md).
Generated API module: `docs/api/modules/_kehto_dev-runtime.html` (run `pnpm docs:api`).
