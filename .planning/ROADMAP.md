# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** — 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** — 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** — 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** — 7 phases (16–22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [x] **v1.4: Productionization & Upstream Unblock** — 6 phases (23–28), 17 plans, 20 requirements, 49 E2E specs green ([archive](milestones/v1.4-ROADMAP.md) | [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- [x] **v1.5: Demo Stability & UAT Coverage** — 3 phases (29–31), 7 plans, 7 requirements, 53 E2E specs green ([archive](milestones/v1.5-ROADMAP.md) | [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- [x] **v1.6: Downstream Unblock & Shell Service Surface** — 5 phases (32–36), 12 plans, 21 requirements, 54 E2E specs green ([archive](milestones/v1.6-ROADMAP.md) | [audit](milestones/v1.6-MILESTONE-AUDIT.md))

---

## Awaiting Next Milestone

v1.6 shipped 2026-04-23. No active milestone.

Run `/gsd:new-milestone` to start v1.7.

**v1.7 candidate scope (deferred from v1.6):**
- NIP-5D spec resync (dskvr/nips branch nip/5d — class-posture delegation paragraph)
- NUB-CLASS adoption (shell emits `class.assigned` envelope)
- NUB-CONNECT adoption (per-napplet CSP; SHELL-*-POLICY audit gates)
- NUB-CONFIG reference service (new 9th NUB domain)
- NUB-RESOURCE reference service (new 10th NUB domain)
- `@kehto/nip66` demo wiring (NIP66-05 follow-up)
- `@kehto/wm` implementation (post-skeleton — waits on a real consumer use case)
- CACHE polish (kehto#1 — `HostCacheBridge` type alias + optional default; naming parity)
- Shell-side NIP-44 decrypt surface (kehto#9 — awaits napplet/napplet#3 NUB decision)
- Electron / Tauri host-bridge reference impls (carryover v1.4 tech debt)
- Multi-OS CI matrix (carryover v1.4 tech debt)

**Archived phases:** All 37 phase directories (v1.0 → v1.6) live under `milestones/v{version}-phases/`. Live `phases/` directory is empty until next milestone starts.

---

*ROADMAP.md last restructured: 2026-04-23 after v1.6 milestone close.*
