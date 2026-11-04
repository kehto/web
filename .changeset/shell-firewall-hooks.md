---
'@kehto/shell': minor
---

`ShellAdapter` now accepts `getFocusContext`, `onFirewallEvent` and `firewallPersistence`, and `adaptHooks` forwards them to the runtime firewall. A shell built on `createShellBridge` gets focus-scaled rate budgets, sees firewall flags and refusals, and can keep firewall config across reloads. `FirewallEvent` and `FirewallPersistence` are also exported from `@kehto/shell`. Hosts that set none of these see no change.
