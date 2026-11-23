---
quick_id: 261123-fwr
status: complete
date: 2026-11-23
---

# Summary

- Sidebar: `#paja-section-cvm` "ContextVM providers" (discovery + saved families) and
  `#paja-section-multiplayer` "Multiplayer signaling" (signaling JSON). Both start collapsed;
  collapse state is stored per section.
- Config: `simulation.cvm.registry` pins families without a signaling profile.
  `multiplayer.registry` is optional, deprecated, merged first (lowest precedence) and warns
  `[PAJA_MULTIPLAYER_REGISTRY]` once per page when non-empty; `registry: []` is dropped quietly.
- Settings registry groups split into "ContextVM providers" and "Multiplayer signaling";
  setting keys unchanged because they are persisted overrides.
- Docs: new `docs/paja-cvm-providers.md`, signaling-only `docs/paja-multiplayer.md`,
  README / package doc sections, compatibility register entry, changeset (`@kehto/paja` minor).
- Verification: build, type-check, 4608 unit tests, docs:check, aislop 100/100, Playwright
  `paja-cvm-discovery` (3 modes), `paja-multiplayer`, `paja-single-window`, `paja-runtime-pointer`.
- Deviation: executed inline rather than via spawned planner/executor agents.
