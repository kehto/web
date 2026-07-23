---
'@kehto/paja': patch
---

Diagnose dev servers that block the sandboxed napplet frame. The target iframe is sandboxed without `allow-same-origin`, so the napplet requests its own module scripts with `Origin: null`, which Vite's default `server.cors` allowlist rejects — the frame rendered blank with no signal from Paja. Paja now probes the target through `GET /__kehto/target-cors.json` and reports a `paja.target.cors.error` message-log entry plus a console warning naming the fix. Adds `probeTargetCors`, `classifyTargetCors`, and `PAJA_TARGET_CORS_HINT` exports.
