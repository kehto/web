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

## Dev-server CORS requirement

The target iframe is sandboxed without `allow-same-origin`, so the napplet
document has an opaque origin and requests its own assets with `Origin: null`.
`<script type="module">` is always fetched in CORS mode, so a dev server that
does not allow that origin blocks the napplet's entry module and the frame
renders blank. Vite's default `server.cors` allowlist covers only `localhost`,
`127.0.0.1`, and `[::1]` origins, so it rejects `null`:

```js
// vite.config.js
export default {
  server: { cors: { origin: '*' } },
};
```

Any dev server works as long as it answers `Origin: null` with
`Access-Control-Allow-Origin: *` or `null`. Paja probes the target on startup
and logs a `paja.target.cors.error` entry in the message log, plus a console
warning, when the target would block the sandboxed frame.

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

Before Paja assigns a verified runtime-pointer document to `srcdoc`, it inserts
Kehto's local Class-1 CSP before the host-owned namespace prelude. The policy
denies all defaults; permits inline script/style, `data:`/`blob:` images, and
`data:` fonts; grants `connect-src` only to the resolved relay and Blossom
origins; explicitly denies worker, child, frame, media, object, manifest,
prefetch, base, and form capabilities; and ends with `frame-ancestors 'self'`.
The NIP-5D verified-srcdoc and opaque-sandbox rules do not mandate this CSP;
it is Kehto policy. Local target-URL authoring mode is intentionally outside
this verified-artifact policy path.

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

## NAP-UPLOAD modes

Paja keeps `memory` as the default upload simulator. It returns deterministic
`kehto-dev://` results and does not store bytes. Opt into real Blossom storage
with a shell-owned server and an active Dev, NIP-07, or NIP-46 signer:

```bash
kehto paja \
  --target-url http://127.0.0.1:5173 \
  --upload-mode blossom \
  --upload-server https://blossom.example \
  -- pnpm vite --host 127.0.0.1
```

Paja prompts with the napplet identity, file details, selected server, and a
public/durable warning before it signs or sends bytes. Production servers must
use HTTPS; plain HTTP is accepted only for loopback development hosts. The
server must allow Paja's browser origin, `PUT` and `OPTIONS`, plus the
`Authorization` and `Content-Type` CORS headers.

Explicit servers win. With no explicit server, Paja may use an independently
warmed snapshot of the active signer's newest BUD-03 kind `10063` `server`
tags. `upload.info` and `upload.upload` never initiate that discovery. Pointer
loader Blossom hints are artifact sources, not upload policy. The current path
uses the first server only, returns its direct HTTP(S) URL, and does not mirror
or construct BUD-10 URLs.

Completion requires the server descriptor to confirm the exact local SHA-256
and byte size as a non-negative safe integer. Missing or mismatched proof is a
failed result even after an HTTP success. The configured identity, provider,
signer, discovery author, and signed authorization pubkeys must agree; a fixed
pubkey without `signEvent` is read-only. This implements the draft
[NAP-UPLOAD at `a7cc174`](https://github.com/napplet/naps/blob/a7cc17463cbf5d9cb87884b31071bc4fc826034c/naps/NAP-UPLOAD.md).

Full package docs: [`docs/packages/paja.md`](../../docs/packages/paja.md).
Getting started: [`docs/how-tos/paja-getting-started.md`](../../docs/how-tos/paja-getting-started.md).
Local authoring how-to: [`docs/how-tos/paja-local-authoring.md`](../../docs/how-tos/paja-local-authoring.md).
Generated API module: `docs/api/modules/_kehto_paja.html` (run `pnpm docs:api`).
