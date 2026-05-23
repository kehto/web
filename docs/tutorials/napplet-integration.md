# Tutorial: Napplet Integration

This guide is for authors building a napplet that will be hosted by Kehto.

## Step 1: Declare required NUBs

Every napplet should declare the NUBs it requires in its NIP-5A manifest build configuration.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { napplet } from '@napplet/vite-plugin';

export default defineConfig({
  plugins: [
    napplet({
      artifactMode: 'single-file',
      requires: ['identity', 'relay'],
    }),
  ],
});
```

Use short NUB names such as `identity`, `relay`, `storage`, `notify`, `keys`, `media`, `config`, `resource`, and `connect`.

## Step 2: Check hosted support

Hosted napplets should ask the shell what it supports instead of assuming every helper is available.

```ts
const canPublish = await window.napplet.shell.supports('relay');
const canNotify = await window.napplet.shell.supports('notify');

if (!canPublish) {
  document.querySelector('#status')!.textContent = 'relay unsupported';
}
```

Prefer graceful degradation for optional features. Required features should be declared in `requires` so the shell can reject or warn at load time.

## Step 3: Use NUB helpers

Use `@napplet/nub` helpers or the published napplet SDK surface for NUB operations. Do not send unclassified raw envelopes unless the host/playground has explicitly documented the exception.

```ts
import { relayPublish } from '@napplet/nub/relay';

await relayPublish({
  kind: 1,
  content: 'hello from a napplet',
  tags: [],
  created_at: Math.floor(Date.now() / 1000),
});
```

## Step 4: Avoid forbidden primitives

Inside hosted napplet source, avoid:

- `window.nostr`;
- direct `localStorage`, `sessionStorage`, or IndexedDB persistence;
- direct WebSocket relay connections;
- direct signing/encryption primitives;
- `allow-same-origin` assumptions.

Kehto shell mediates identity, signing, storage, relay, and host capabilities.

## Step 5: Verify through the gateway path

Build the napplet and load it through the same gateway artifact route used by the playground:

```bash
pnpm --filter ./apps/playground/napplets/<name> build
pnpm --filter @kehto/playground preview --port 4174
```

The meaningful proof path is `/napplet-gateway/<dTag>/<aggregateHash>/index.html`, not a direct dev-server file URL.
