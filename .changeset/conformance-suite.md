---
"@kehto/conformance": minor
"@kehto/cli": minor
---

Add `@kehto/conformance`, a runtime conformance suite that runs a reference probe napplet against the real Kehto runtime and shell, and route `kehto conformance` to it. This first slice covers NIP-5D core (sandbox, provenance, injection order and scope, `window.nostr`, port privacy and binding, source binding, manifest declarations, unknown and malformed envelopes, readiness independence), Kehto's strict required-domain preflight, and optional NAP-SHELL, across shell-present and shell-absent variants of the `minimal` and `full` profiles, with `pretty`, `json` and `junit` reporters. `kehto conformance` exits `0`, `1` or `2` and needs the optional `@playwright/test` peer.
