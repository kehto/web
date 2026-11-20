---
"@kehto/paja": patch
---

Images load again in the static Paja build (`/web/paja/`). It used to send every `https` and `blossom` read to a `/__kehto/resource` server proxy that a static host doesn't have, so every image came back `not-found`. Without a proxy, static Paja now fetches resources directly from the browser, with no cookies and no referrer, and drops destinations it can tell are private from the URL. That covers `localhost`, `.local` and similar names, names without a dot, private or reserved IP literals, and redirects that end on one. Blossom bytes are still hash-checked. NAP-RESOURCE (napplet/naps#80 @ ae5b9c6) asks for DNS-time private-IP checks, which a browser can't make for its own fetches, so a public-looking name that resolves to a private address isn't caught. That is a recorded spec gap. The Paja server and its proxy now share one public-address check.
