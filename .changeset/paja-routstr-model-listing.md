---
"@kehto/paja": minor
"@kehto/services": minor
---

Add a loopback Routstr provider preset and a model dropdown for presets that
list their models.

`LLM_PROVIDER_PRESETS` gains `routstr` (`http://127.0.0.1:8008/v1`, OpenAI Chat
Completions, no credential) plus an optional `modelsPath` field. Paja renders a
model `<select>` instead of free-text entry for a preset that declares it,
seeded from one `GET <baseUrl><modelsPath>` (`/models` for Routstr), and shows
`Connected ✓ — n models` below the field. A failed listing names the cause —
including a server that does not allow this page cross-origin — and falls back
to free-text entry so the connection can still be saved. Editing the API base
URL re-lists the models.

The listing is a browser request like generation, so a loopback provider must
answer CORS on that route; nothing else about the connection changes and the
key is still placed only on requests to the connection's own base URL.
