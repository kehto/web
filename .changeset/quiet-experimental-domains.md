---
"@kehto/paja": patch
---

Allow napplets with unavailable required domains to run in Paja with a warning. Unknown optional domains load quietly, so napplets can detect absent namespace objects and gracefully degrade.
