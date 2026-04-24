---
'@kehto/wm': patch
---

Replace the Phase 35 throwing-stub `createWmService` with a working no-op default and ship the structural-primitive public surface consumers implement against:

- Add `LayoutStrategy`, `WindowState`, `WindowPlacement` interfaces (D1–D3).
- `createWmService({ hooks, strategy? })` — `strategy` defaults to a no-op identity (returns windows unchanged) so consumers can ship a working shell before implementing concrete layouts (D4).
- Remove the algorithm-prescriptive `Layout = 'dwindle' | 'master-stack' | 'floating' | (string & {})` alias — consumers pick their own algorithm names (H-04 prevention).
- No concrete layout algorithms ship in this package. See README for a consumer-integration example.
