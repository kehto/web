---
"@kehto/runtime": minor
---

Dispatch the NAP-LLM `llm` domain (napplet/naps PR #134 at `3e10939`) to a registered `llm` service. Without one, each sanctioned request receives one `llm.<op>.result` carrying `{ code: 'unsupported', message }`; ACL denials use the same NAP result shape. Adds the `llm:generate` ACL bit.
