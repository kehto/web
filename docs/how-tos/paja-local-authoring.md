# Use Paja for Local Napplet Authoring

Use `@kehto/cli` when you want a local napplet app to run inside Paja, the real
Kehto iframe authoring workshop, while keeping the app dev server's own HMR.

## Install

```bash
pnpm add -D @kehto/cli
```

Use the matching package-manager command in npm or Yarn projects:

```bash
npm install --save-dev @kehto/cli
yarn add --dev @kehto/cli
```

## Add a Dev Script

Keep the app dev server command separate from the Kehto wrapper. The target URL
stays explicit so Kehto does not guess framework ports.

### pnpm

```json
{
  "scripts": {
    "dev": "kehto paja --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1"
  }
}
```

### npm

```json
{
  "scripts": {
    "dev": "kehto paja --target-url http://127.0.0.1:5173 -- npm run dev:app -- --host 127.0.0.1",
    "dev:app": "vite"
  }
}
```

### Yarn

```json
{
  "scripts": {
    "dev": "kehto paja --target-url http://127.0.0.1:5173 -- yarn dev:app --host 127.0.0.1",
    "dev:app": "vite"
  }
}
```

Run the script and open the printed runtime URL:

```bash
pnpm dev
```

The browser page shows a development console beside one sandboxed target iframe
in target-url mode. The console includes interface injection toggles, ACL
controls, signer status, and a filterable message log. Paja fetches the target
HTML into injected `srcdoc` so `window.napplet.<domain>` exists before app
bootstrap, while target assets and HMR still resolve through the framework dev
server. The runtime reload button reinitializes the Kehto shell state around the
same target URL.

## Use an Existing Target Server

If another process already serves the app, omit the command:

```bash
kehto paja --target-url http://127.0.0.1:5173
```

## Add Simulation Config

Create `kehto.dev.json`:

```json
{
  "targetUrl": "http://127.0.0.1:5173",
  "simulation": {
    "identity": {
      "mode": "fixed",
      "pubkey": "4444444444444444444444444444444444444444444444444444444444444444"
    },
    "relay": { "mode": "disabled" },
    "capabilities": {
      "domains": {
        "relay": false,
        "outbox": false
      }
    },
    "theme": { "mode": "light" },
    "config": {
      "values": {
        "density": "compact"
      }
    }
  }
}
```

Then run:

```bash
kehto paja --config kehto.dev.json
```

CLI flags override the matching config-file fields, so a script can keep common
defaults in `kehto.dev.json` and still switch one mode for a test:

```bash
kehto paja --config kehto.dev.json --theme dark
```

## Use Real Blossom Uploads

Paja's default `memory` upload mode is a simulator and stores nothing. Add an
explicit shell-owned Blossom server for real `window.napplet.upload` traffic:

```json
{
  "targetUrl": "http://127.0.0.1:5173",
  "simulation": {
    "upload": {
      "mode": "blossom",
      "servers": ["https://blossom.example"],
      "discoverServers": true,
      "maxBytes": 10485760,
      "mimeTypes": ["image/png", "application/pdf"]
    }
  }
}
```

The equivalent CLI flags are `--upload-mode blossom` and repeatable
`--upload-server <url>`. Explicit servers win. Without one, signer lifecycle
may warm the active identity's newest BUD-03 kind `10063` server list. Neither
`upload.info` nor an upload request starts discovery, and pointer-resolution
Blossom hints are not upload endpoints.

Select Dev, NIP-07, or NIP-46 in the signer controls. A fixed pubkey alone is
read-only, and any disagreement between configured, provider, signer,
discovery, or signed-event pubkeys fails closed. Each upload first shows an
upload-specific prompt naming the napplet, bytes, MIME type, selected server,
and public/durable effect. Denial happens before authorization signing or
storage egress.

Use HTTPS except for `localhost`, `127.0.0.0/8`, or `[::1]` development
servers. Browser-facing Blossom servers must allow CORS `OPTIONS` and `PUT`
with `Authorization` and `Content-Type`. Paja currently uploads to the first
server only and returns its direct URL; it does not mirror or build BUD-10
URLs. A response is complete only when its descriptor confirms the exact
SHA-256 and integer byte size. See the pinned draft
[NAP-UPLOAD at `a7cc174`](https://github.com/napplet/naps/blob/a7cc17463cbf5d9cb87884b31071bc4fc826034c/naps/NAP-UPLOAD.md).

## Verify the Runtime Surface

Inside the target iframe, mandatory `window.napplet.shell` and enabled optional
domains are present before authored app scripts run. Its receiver is installed
before one `shell.ready`; the returned `shell.init` is cached for `ready()`,
`supports()`, `services`, and `onReady()`. Disabled optional capability domains
are removed from the injected namespace and from the advertised `domains` and
`naps` lists, while enabled domains route through Kehto runtime and reference
services.

The default relay/outbox backend is live. It queries configured public relays,
uses NIP-65 relay-list events (`kind:10002`) for outbox routing, and reads
contact-list events (`kind:3`) for identity/follow data. `window.napplet.count`
can send `count.query` requests for non-empty NIP-01 filter arrays and receives
exact aggregate counts from the active relay backend. Use `--relay-mode memory`
for deterministic fixture tests, or disable the relay domain to disable count as
well.

Paja auto-connects a browser NIP-07 signer when `window.nostr` is available,
can switch to a bunker/NIP-46 URI, and exposes a Dev signer button for explicit
synthetic local signing. Without a browser signer, bunker URI, fixed identity, or
Dev signer selection, `identity.getPublicKey` reports no connected account
instead of inventing one. Every sign or publish operation prompts in the browser
before it runs.

The package API reference is generated at
[docs/api/modules/_kehto_paja.html](../api/modules/_kehto_paja.html).
