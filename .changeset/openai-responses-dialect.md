---
"@kehto/services": minor
"@kehto/paja": minor
---

Add an OpenAI Responses dialect (`protocol: 'openai-responses'`, `POST <baseUrl>/responses`) to the HTTP LLM provider, with streaming, tool calls, reasoning summaries, an `openai-responses` preset and an opt-in `responses.profile: 'chatgpt-sign-in'` endpoint option for subscription-backed access tokens. The dialect is stateless (`store: false`, full history each turn). Paja accepts connections saved with the new protocol.
