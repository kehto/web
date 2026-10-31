---
"@kehto/paja": minor
---

Load experimental `x-` NAP extension modules from the config's `extensions` list. Paths are relative to the config file, and an entry may carry `settings`, `enabled` and `deniedDTags`. Paja serves each module from its own origin and validates it with the shell extension policy. Extension domains get the Interfaces tri-state toggle, ACL toggles for their capabilities, an Extensions settings section, `paja.extension.*` message-log entries and prelude bindings. A module that fails to load or collides is reported without dropping others. The existing `--firewall-mode` / `simulation.firewall.mode` option now pins the development target's firewall policy.
