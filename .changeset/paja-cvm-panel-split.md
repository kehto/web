---
'@kehto/paja': minor
---

Split the sidebar's "Multiplayer providers" panel into **ContextVM providers** (CVM discovery and saved families) and **Multiplayer signaling** (`soy-rtc/1` profile, relays, STUN/TURN). Add `simulation.cvm.registry` so config files can pin CVM families without a signaling profile. `simulation.multiplayer.registry` still works but is deprecated and warns `[PAJA_MULTIPLAYER_REGISTRY]` once per page load; an empty `registry: []` is ignored quietly.

Type change: `PajaMultiplayerConfig.registry` is now optional (and `@deprecated`), and `normalizePajaMultiplayer` omits it when empty. Hosts that read `config.registry` directly need a `?? []` fallback.
