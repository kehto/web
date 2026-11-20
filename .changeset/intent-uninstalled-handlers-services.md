---
"@kehto/services": minor
---

`createCatalogIntentResolver` takes a new optional `offerUninstalledHandlers(request, context)` hook. It runs only when no installed handler is compatible with an invoke and the request isn't for an explicit catalog `handler`. A host can use it to search for a handler, install one through its own verified load, and return the new catalog ID. The resolver delivers only if the reloaded, verified catalog entry supports the exact convention. `available()` and `handlers()` stay installed-only. If the offer is declined, finds nothing, or throws, the original `no handler` / `unsupported *` rejection is kept. This follows the MAY in NAP-INTENT's "Recommended handler resolution" on napplet/naps master @ 377bf939 (kehto/web#523).
