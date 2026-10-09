---
phase: quick-261007-n18
status: verified
threats_open: 0
created: 2026-10-07
---

# Sidebar accordion security verification

Reviewed `e391a4f3..11e4a343`. This is UI preference work, not a new NAP wire or protocol conformance claim. Prior quick md2/jux protocol evidence is carried forward, not revalidated here.

| Threat | Evidence | Result |
| --- | --- | --- |
| T-n18-01 storage tampering | Fixed registry, own boolean properties only; invalid/mixed/prototype-looking values tested; no arbitrary merging | Mitigated |
| T-n18-02 storage denial | Getter/read/parse/write guarded; unit and browser getter/key-specific method failure coverage | Mitigated |
| T-n18-03 visibility privilege boundary | Only details.open changes; no DOM replacement; actual frame node/contentWindow, srcdoc, tab/window/generation checks; full 95-test browser suite | Mitigated |
| T-n18-04 preference disclosure | Dedicated key contains only known collapsed booleans, no secrets or resource values | Accepted low risk |
| T-n18-05 header spoofing | Static labels and selectors; storage never becomes text/HTML; native summaries and focus outline | Mitigated |

The storage-availability probe now guards getter access inside its existing try/catch. Its successful-path behavior, capability policy, relay routing, verification and sandbox rules are unchanged. No new dependency, network endpoint, authorization path, or unreviewed trust boundary was introduced. No open blocking threats found in this scoped review.
