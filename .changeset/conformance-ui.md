---
"@kehto/conformance": minor
---

Add the conformance web UI and `kehto conformance --ui`: a live page (verdict, counts, advertised-versus-tested domain matrix, scope-grouped checks with authority links, transcript, deep links, JSON download) served on loopback, with `--exec`, `--port` and `--no-open`, and one debounced re-run per rebuild of the served bundle over server-sent events. The browser bundle exports `mountKehtoConformanceUi`; `@kehto/conformance/cli` exports `startLiveUi` and `renderUiPage`.
