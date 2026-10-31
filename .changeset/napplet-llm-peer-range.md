---
'@kehto/acl': patch
'@kehto/cli': patch
'@kehto/firewall': patch
'@kehto/paja': patch
'@kehto/runtime': patch
'@kehto/services': patch
'@kehto/shell': patch
---

Widen the `@napplet/*` peer ranges so the `llm` domain installs without peer conflicts: `@napplet/core` now accepts `>=0.32.0 <0.37.0` and `@napplet/nap` accepts `>=0.32.0 <0.36.0`. The `llm` subpath first ships in `@napplet/nap@0.35.0`, and `@napplet/nap@0.35.1` requires `@napplet/core@^0.36.0`. The old `<0.35.0` cap made npm fail with ERESOLVE and made pnpm print unmet-peer warnings (kehto/web#364).
