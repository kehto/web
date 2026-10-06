---
'@kehto/paja': patch
---

Foreground a reused intent handler tab and log intent eligibility.

When an intent resolved to a handler napplet that already had an open tab, the
intent was delivered over `postMessage` but the tab stayed in the background, so
the result was invisible until the user switched tabs manually. The reuse path
now calls `activateRuntimeTab()` before binding the generation, matching the
new-tab path, so a delivered intent always selects the handler tab.

`behavior.focus` is a hint, not a visibility switch: Paja's stage shows exactly
one tab, so honoring `focus: false` as "keep the handler in the background"
would report `handled: true` for a surface the user cannot see. Reuse still
leaves the caller's tab open, so nothing is replaced. Newly created handler tabs
behave the same way.

The `paja.pointer.resolved` message-log entry also records each installed
napplet's declared archetypes,
`requires` tags, and whether it is intent-eligible, warning when a napplet
declares archetypes without `["requires","inc"]`.
