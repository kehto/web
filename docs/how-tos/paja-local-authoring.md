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

## Verify the Runtime Surface

Inside the target iframe, enabled domains are present on
`window.napplet.<domain>` before authored app scripts run, and `shell.ready`
still receives `shell.init` through `@kehto/shell`. Disabled capability domains
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
