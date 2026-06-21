# Use the Dev Runtime for Local Napplet Authoring

Use `@kehto/dev-runtime` when you want a local napplet app to run inside a real
Kehto iframe while keeping the app dev server's own HMR.

## Install

```bash
pnpm add -D @kehto/dev-runtime
```

Use the matching package-manager command in npm or Yarn projects:

```bash
npm install --save-dev @kehto/dev-runtime
yarn add --dev @kehto/dev-runtime
```

## Add a Dev Script

Keep the app dev server command separate from the Kehto wrapper. The target URL
stays explicit so Kehto does not guess framework ports.

### pnpm

```json
{
  "scripts": {
    "dev": "kehto-dev-runtime --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1"
  }
}
```

### npm

```json
{
  "scripts": {
    "dev": "kehto-dev-runtime --target-url http://127.0.0.1:5173 -- npm run dev:app -- --host 127.0.0.1",
    "dev:app": "vite"
  }
}
```

### Yarn

```json
{
  "scripts": {
    "dev": "kehto-dev-runtime --target-url http://127.0.0.1:5173 -- yarn dev:app --host 127.0.0.1",
    "dev:app": "vite"
  }
}
```

Run the script and open the printed runtime URL:

```bash
pnpm dev
```

The browser page shows one top bar, one sandboxed target iframe, and one bottom
bar. The app source still reloads through the framework dev server; the runtime
reload button reinitializes the Kehto shell state around the same target URL.

## Use an Existing Target Server

If another process already serves the app, omit the command:

```bash
kehto-dev-runtime --target-url http://127.0.0.1:5173
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
kehto-dev-runtime --config kehto.dev.json
```

CLI flags override the matching config-file fields, so a script can keep common
defaults in `kehto.dev.json` and still switch one mode for a test:

```bash
kehto-dev-runtime --config kehto.dev.json --theme dark
```

## Verify the Runtime Surface

Inside the target iframe, `shell.ready` receives `shell.init` through
`@kehto/shell`. Disabled capability domains are removed from the advertised
`domains` and `naps` lists, while enabled domains route through Kehto runtime
and reference services.

The package API reference is generated at
[docs/api/modules/_kehto_dev-runtime.html](../api/modules/_kehto_dev-runtime.html).
