---
"@kehto/paja": minor
---

Allow the static GitHub Pages Paja runtime to be built with explicit live relay and Blossom upload backends. `build-paja-pages.mjs` now honors comma-separated `PAJA_RELAY_URLS` and `PAJA_UPLOAD_SERVERS` environment variables, and `createPajaRuntimeHostConfig` accepts a `simulation` override. When neither env var is set, the static build keeps its previous defaults.