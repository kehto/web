---
"@kehto/shell": minor
---

Advertise the NAP-LLM `llm` domain (napplet/naps PR #134 at `3e10939`) when a host registers an `llm` service and inject `window.napplet.llm` (`select`, `describe`, `generate` with `requestId`, `signal` and `onDelta`, `cancel`) with typed `{ code, message }` failures. Adds `ShellAdapter.llm` (`isAvailable`, optional `isConfigured`) and `getShellDomainState(hooks, domain)` returning `supported`, `unconfigured` or `disabled` for host UIs.
