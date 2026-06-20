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
minimal host page, and host config surface. Phase 91 adds the browser host
bootstrap: the iframe is navigated by the runtime, receives a production-shaped
`shell.init` payload after `shell.ready`, and can be reloaded without restarting
the CLI or target app process. Later v1.22 phases add full shell/service wiring
and environment simulation controls.

Full package docs: [`docs/packages/dev-runtime.md`](../../docs/packages/dev-runtime.md).
Generated API module: `docs/api/modules/_kehto_dev-runtime.html` (run `pnpm docs:api`).
