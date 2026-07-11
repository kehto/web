# @kehto/paja

Development runtime for local napplet authoring and static pointer-loaded
napplet testing.

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
that URL through Paja as injected `srcdoc` lets Kehto install mandatory
`window.napplet.shell` plus enabled optional domains before app code runs. The
shell shim completes `shell.ready` / `shell.init` and caches capability queries,
while a `<base>` tag keeps the
app's own assets and HMR pointed at the target dev server without Vite, Svelte,
React, or any other framework lock-in.

The package provides the typed option model, CLI parser, runtime server, host
page, and host config surface. Local target-url mode keeps one target iframe
with a reload loop and a development console wired through a real
`ShellBridge`, `@kehto/runtime`, and service adapters for the current web NAP
surface: relay/outbox, storage, identity, keys, config, resource, theme, notify,
media, upload, intent, cvm, and inc. Relay/outbox defaults to live public relays
and uses NIP-65 relay-list bootstrap plus kind `3` contact-list reads for
identity flows; `--relay-mode memory` is the explicit deterministic fixture
mode. `shell` is the mandatory, non-toggleable handshake domain; the deprecated legacy package
path remains an upstream compatibility alias to `inc`. The upstream `dm` domain
is not advertised until Paja wires a deterministic development DM backend.

The console shows supported interfaces with per-domain injection toggles,
runtime ACL controls, signer controls, and a filterable message log with visible
error details. Paja auto-connects a browser NIP-07 signer when `window.nostr` is
available, can connect to a bunker/NIP-46 URI, and only uses the generated local
development signer when the Dev signer button is selected. Every signing or
publish operation still uses a browser confirmation prompt. There is no bypass
list.

The static Paja Runtime build is served at `/web/paja/` in the GitHub Pages
artifact. It uses the same browser host and service adapters, but loads verified
napplet HTML from pasted `naddr` or `nevent` pointers with `hmr: none`. Each
loaded pointer becomes a closeable header tab; loading an already-running
napplet opens a choice to load another instance, switch to the existing tab, or
cancel. Each tab includes a share control that copies a `/web/paja/?naddr=...`
or `/web/paja/?nevent=...` link for that pointer, and the browser remembers open
runtime tabs in local storage so returning to `/web/paja/` restores the previous
pointer set. An explicit pointer in the URL still takes precedence over restored
tabs.

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
