---
"@kehto/paja": minor
---

Every Paja timeout, interval, cap and abuse bound is now a user-changeable default. A
top-bar **Settings** dialog, generated from the new settings registry, edits them and
persists overrides per host origin (`kehto:paja:settings.v1`). Config files accept a
validated `settings` block: server-scope keys apply to the CLI/server process and
browser-scope keys seed the host page. Bounds keep abuse guards on and security floors
raise-only. New exports: `PAJA_SETTING_DEFINITIONS`, `getPajaSetting`,
`setActivePajaSettings`, `normalizePajaSettings`, `normalizePajaConfigSettings`,
`createPajaSettingsStore` and related types. The LLM vault now persists the iterations
its unlocked key was derived with.
