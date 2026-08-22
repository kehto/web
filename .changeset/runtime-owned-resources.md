---
"@kehto/services": patch
"@kehto/paja": patch
---

Keep NAP resource resolution runtime-owned: the service kernel delegates valid
URLs by default while retaining optional origin-grant hooks, and Paja permits
browser-readable HTTP(S) resources alongside data and configured Blossom URLs.
