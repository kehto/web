---
"@kehto/acl": minor
"@kehto/runtime": minor
"@kehto/shell": minor
---

Complete the NAP rename: remove retired helper vocabulary from the public API
and the `shell.init` wire (clean break, no aliases).

**@kehto/acl**: Export the NAP message and capability resolver names only:
`NapMessage` and `resolveCapabilitiesNap`.

**@kehto/runtime**: Export the NAP enforcement, storage, message, and resolver
names only: `createNapEnforceGate`, `NapEnforceConfig`, `handleStorageNap`,
`NapMessage`, and `resolveCapabilitiesNap`.

**@kehto/shell**: Remove the retired mirror field from `ShellCapabilities` and
the dual-emit in `buildShellCapabilities` — the `shell.init` payload now carries
only the NAP-vocabulary `naps` array plus the conformant `domains`/`protocols`
shape. Drop the retired capability-lookup alias and re-export only the NAP
enforcement/message names.
