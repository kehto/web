---
'@kehto/paja': patch
---

Foreground a reused intent handler tab and log intent eligibility.

When an intent resolved to a handler napplet that already had an open tab, the
intent was delivered over `postMessage` but the tab stayed in the background, so
the result was invisible until the user switched tabs manually. The reuse path
now calls `activateRuntimeTab()` before binding the generation, matching the
new-tab path. An explicit `behavior.focus: false` opts out of focus stealing
while still delivering the intent.

`loadRuntimePointer()` also logs each installed napplet's declared archetypes,
`requires` tags, and whether it is intent-eligible, warning when a napplet
declares archetypes without `["requires","inc"]`.
