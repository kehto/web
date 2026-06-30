# @kehto/paja

Single-window development runtime for local napplet authoring.

The runtime is designed to be used from a napplet package script:

```json
{
  "scripts": {
    "dev": "kehto paja --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1"
  }
}
```

The target URL is explicit on purpose. Kehto can spawn any framework command and
wait for that URL, but it does not guess which URL the framework chose. Loading
that URL directly in the runtime iframe preserves the app's own HMR behavior
without Vite, Svelte, React, or any other framework lock-in.

The package provides the typed option model, CLI parser, runtime server, host
page, and host config surface. The browser host keeps one target iframe with a
reload loop and a development console wired through a real
`ShellBridge`, `@kehto/runtime`, and deterministic development service adapters
for the current web NAP surface: relay/outbox, storage, identity, keys, config,
resource, theme, notify, media, upload, intent, cvm, and inc. `shell` is the
mandatory handshake domain; the deprecated legacy package path remains an
upstream compatibility alias to `inc`. The upstream `dm` domain is not
advertised until Paja wires a deterministic development DM backend.

The console shows supported interfaces with per-domain injection toggles,
runtime ACL controls, signer controls, and a filterable message log with visible
error details. Paja creates a generated local development signer by default and
can switch to a browser NIP-07 signer or a bunker/NIP-46 connection. Every
signing or publish operation still uses a browser confirmation prompt. There is
no bypass list.

The static Paja Runtime build is served at `/web/paja/` in the GitHub Pages
artifact. It uses the same browser host and service adapters, but loads verified
napplet HTML from a pasted `naddr` or `nevent` pointer with `hmr: none`.

Environment simulation can be supplied through CLI flags or a JSON config file:

```bash
kehto paja \
  --target-url http://127.0.0.1:5173 \
  --identity-mode fixed \
  --identity-pubkey 4444444444444444444444444444444444444444444444444444444444444444 \
  --relay-mode disabled \
  --capability relay:off \
  --capability outbox:off \
  --theme light \
  --config-value 'density="compact"'
```

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
    "theme": { "mode": "light" },
    "config": { "values": { "density": "compact" } }
  }
}
```

Full package docs: [`docs/packages/paja.md`](../../docs/packages/paja.md).
Getting started: [`docs/how-tos/paja-getting-started.md`](../../docs/how-tos/paja-getting-started.md).
Local authoring how-to: [`docs/how-tos/paja-local-authoring.md`](../../docs/how-tos/paja-local-authoring.md).
Generated API module: `docs/api/modules/_kehto_paja.html` (run `pnpm docs:api`).
