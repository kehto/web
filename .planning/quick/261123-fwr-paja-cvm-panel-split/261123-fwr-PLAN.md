---
quick_id: 261123-fwr
slug: paja-cvm-panel-split
date: 2026-11-23
---

# Split Paja's "Multiplayer providers" panel into ContextVM + Multiplayer signaling

## Why

The sidebar panel named "Multiplayer providers" mostly configures ContextVM
families, which work without any signaling profile. The only file-based way to
pin a CVM family was `simulation.multiplayer.registry`, which forced a
`soy-rtc/1` profile and signaling relays on hosts that only want plain CVM.

## Tasks

1. Config: add `simulation.cvm.registry` (validated with the existing family
   normalizer and `multiplayer.maxRegistryFamilies` cap). Make
   `PajaMultiplayerConfig.registry` optional and `@deprecated`; an empty legacy
   `registry: []` is dropped silently (no-op, and every previously saved browser
   setting has it).
2. Wiring: one resolver merges legacy multiplayer registry → `simulation.cvm.registry`
   → saved families (later wins per label/provider pair) and warns
   `PAJA_MULTIPLAYER_REGISTRY` once per page when a non-empty legacy registry is
   used. `browser-adapter.ts` uses it for both CVM paths.
3. UI: two sidebar sections — `#paja-section-cvm` "ContextVM providers"
   (discovery + saved families) and `#paja-section-multiplayer` "Multiplayer
   signaling" (profile, relays, ICE, dev namespace JSON). Sidebar collapse state
   gains a `cvm` key. Settings registry groups split the same way (setting keys
   unchanged: they are persisted).
4. Tests: unit (config, resolver + warning frequency/quietness, host page,
   sidebar sections), e2e discovery spec uses the new section and covers
   `simulation.cvm.registry` without a multiplayer profile; screenshots for PR.
5. Docs: new `docs/paja-cvm-providers.md`, trimmed `docs/paja-multiplayer.md`,
   README + `docs/packages/paja.md`, `docs/compatibility.md` entry, changeset.
