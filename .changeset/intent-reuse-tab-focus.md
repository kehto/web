---
'@kehto/paja': patch
---

Foreground a reused intent handler tab and log intent eligibility.

When an intent resolved to a handler napplet that already had an open tab, the
intent was delivered over `postMessage` but the tab stayed in the background, so
the result was invisible until the user switched tabs manually. The reuse path
now calls `activateRuntimeTab()` before binding the generation, matching the
new-tab path. When reusing an existing handler tab, an explicit
`behavior.focus: false` preserves the active tab while still delivering the
intent. Newly created handler tabs retain their existing activation behavior.

The `paja.pointer.resolved` message-log entry also records each installed
napplet's declared archetypes,
`requires` tags, and whether it is intent-eligible, warning when a napplet
declares archetypes without `["requires","inc"]`.
