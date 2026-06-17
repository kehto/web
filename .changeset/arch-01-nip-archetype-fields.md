---
"@kehto/nip": minor
---

feat(nip): parse the NAAT archetype axis + source tag from NIP-5D manifests (ARCH-01)

`parseNappletManifest` now reads two additional manifest tags into structured
fields on `NappletManifest`:

- **`archetypes`** — every `["archetype","<slug>","<NAP-N>"]` tag becomes an
  entry `{ slug, nap? }`, preserving tag order. The optional `nap` (3rd tag
  element) is the recommended default wire protocol. The field is always present
  and defaults to `[]` when no archetype tag exists.
- **`source`** — the optional upstream source URL from the `source` tag, omitted
  when absent.

This is strictly additive and backward-compatible: every existing field, parse
path, and throw path is unchanged. The archetype axis is the foundation NAP-INTENT
uses to derive a napplet's archetype availability from its signed manifest rather
than host-injected catalog data.
