---
"@kehto/paja": patch
---

The static Paja build (`/web/paja/`) now says up front that it can't fetch network resources. NAP-RESOURCE (napplet/naps#80 @ ae5b9c6) requires DNS-time private-IP checks. Only Paja's server proxy can do those, and the static build has no server. It used to advertise `https` and `blossom` anyway and then send every read to a missing `/__kehto/resource`, so every image came back `not-found`. Now its `resource.info` reports both schemes as disabled, and those reads fail with `unsupported-scheme` without touching the network. `data:` still works. A configurable remote proxy follows separately.
