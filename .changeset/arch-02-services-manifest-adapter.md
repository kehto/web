---
"@kehto/services": minor
---

feat(services): manifest → IntentCatalogEntry adapter for NAP-INTENT (ARCH-02 + ARCH-04)

Adds `manifestToIntentCatalogEntry`, a pure adapter that maps a resolved
NIP-5A/5D napplet manifest's archetype tags into an `IntentCatalogEntry` — the
shape `createCatalogIntentResolver.loadCatalog` consumes. This sources NAP-INTENT
availability and handler candidacy from verified manifests instead of
host-injected catalog data.

Each archetype `{ slug, nap }` becomes a keyed support record with `actions`
defaulting to `['open']` (the NAP-INTENT default action) and `protocols` derived
from the archetype tag's NAP-N (`[]` when absent).

The adapter takes a minimal structural input (`ManifestArchetypeInput =
{ dTag, title?, archetypes: {slug, nap?}[] }`) so `@kehto/services` stays free of
any `@kehto/nip` dependency — callers pass `resolved.manifest` directly by duck
typing. An integration test wires manifest tag → adapter → resolver → service
dispatch end-to-end (ARCH-04).
