# Tutorial: Napplet Integration

This guide is for authors building a napplet that will be hosted by Kehto.

## Step 1: Declare required NAPs

Every napplet should declare the NAPs it requires in its NIP-5A manifest build configuration.

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

Use short NAP names such as `identity`, `relay`, `storage`, `notify`, `keys`, `media`, `config`, `resource`, and `connect`.

## Step 2: Check injected domains

Hosted napplets should check the injected `window.napplet.<domain>` objects
instead of assuming every helper is available.

```ts
const canPublish = typeof window.napplet?.relay === 'object';
const canNotify = typeof window.napplet?.notify === 'object';

if (!canPublish) {
  document.querySelector('#status')!.textContent = 'relay unsupported';
}
```

Prefer graceful degradation for optional features. Required features should be declared in `requires` so the shell can reject or warn at load time.

## Step 3: Use NAP helpers

Use `@napplet/nap` helpers or the published napplet SDK surface for NAP operations. Do not send unclassified raw envelopes unless the host/playground has explicitly documented the exception.

```ts
import { relayPublish } from '@napplet/nap/relay';

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
