# `@kehto/nip/89` — NIP-89 app-handler discovery

Answer "**who can open an event of kind N?**" using
[NIP-89](https://github.com/nostr-protocol/nips/blob/master/89.md) — essential for
any runtime that hosts or launches other apps (the napplet model, "open with…"
menus, unknown-kind fallbacks).

`nostr-tools` ships no NIP-89 helper. This module provides pure parsers for both
event kinds plus URL-template expansion — no relay, signer, or framework coupling.

## Two kinds

| Kind | Name | What it carries |
|------|------|-----------------|
| `31990` | handler information | an app's supported `k` kinds + per-platform URL templates |
| `31989` | handler recommendation | a user endorsing handlers (`a` tags) for a given kind |

## API

| Export | Description |
|--------|-------------|
| `parseHandlerInformation(event)` | kind-31990 → `{ kinds, metadata, platforms, address, … }` |
| `handlesKind(info, kind)` | does this handler declare support for `kind`? |
| `buildHandlerUrl(target, values)` | expand a `<bech32>` / `<raw>` URL template |
| `parseHandlerRecommendation(event)` | kind-31989 → `{ recommendedKind, recommendations }` |
| `HANDLER_INFORMATION_KIND` / `HANDLER_RECOMMENDATION_KIND` / `HANDLER_PLATFORMS` | constants |

## Usage

```ts
import {
  parseHandlerInformation,
  handlesKind,
  buildHandlerUrl,
} from '@kehto/nip/89';

const info = parseHandlerInformation(kind31990Event);
info.kinds;              // [1, 30023]
info.metadata.name;      // 'My Reader'

if (handlesKind(info, 1)) {
  // Open an nevent on the web target:
  const target = info.platforms.web?.[0];
  if (target) {
    const url = buildHandlerUrl(target, { bech32: neventString });
    // 'https://app.example/e/nevent1…'  (undefined if a needed placeholder is missing)
  }
}
```

Resolving user recommendations:

```ts
import { parseHandlerRecommendation } from '@kehto/nip/89';

const rec = parseHandlerRecommendation(kind31989Event);
rec.recommendedKind;                  // 1
rec.recommendations[0].address;       // '31990:<handler-pubkey>:<d>'
rec.recommendations[0].relay;         // optional relay hint to fetch the 31990 event
```

URL templates use `<bech32>` (NIP-19 entity) and/or `<raw>` (hex id / `kind:pubkey:d`
coordinate). `buildHandlerUrl` returns `undefined` when the template needs a value
you didn't supply, so you can fall through to the next target.
