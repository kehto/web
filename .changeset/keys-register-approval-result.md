---
"@kehto/services": patch
---

`keys.registerAction` now gets exactly one `keys.registerAction.result` when its
approval doesn't execute (kehto/web#520), as NAP-KEYS (napplet/naps#9 at
`8869a4cf`) requires. `denied`/`cancelled` reply `policy denied`;
`capacity`/`busy`/`unavailable` reply `approval capacity reached`/`approval
busy`/`approval unavailable`. A request with no `action` now gets `invalid
action` with `actionId: ''` instead of throwing, and a destroyed window's
pending approval stays silent.
