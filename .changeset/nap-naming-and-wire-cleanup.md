---
"@kehto/acl": minor
"@kehto/runtime": minor
"@kehto/shell": minor
---

Complete the NAP rename: eradicate the legacy `nub` vocabulary from the public
API and the `shell.init` wire (clean break, no aliases).

**@kehto/acl**: Rename `NubMessage` → `NapMessage` and `resolveCapabilitiesNub`
→ `resolveCapabilitiesNap`.

**@kehto/runtime**: Rename `createNubEnforceGate` → `createNapEnforceGate`,
`NubEnforceConfig` → `NapEnforceConfig`, `handleStorageNub` → `handleStorageNap`,
and the re-exported `NubMessage` / `resolveCapabilitiesNub` to their `Nap`
equivalents.

**@kehto/shell**: Remove the legacy `nubs` field from `ShellCapabilities` and
the dual-emit in `buildShellCapabilities` — the `shell.init` payload now carries
only the NAP-vocabulary `naps` array plus the conformant `domains`/`protocols`
shape. Drop the `nub:` capability-lookup alias. Rename the re-exported
`createNubEnforceGate` / `NubEnforceConfig` / `NubMessage` to their `Nap`
equivalents.
