# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** — 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** — 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** — 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** — 7 phases (16–22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [x] **v1.4: Productionization & Upstream Unblock** — 6 phases (23–28), 17 plans, 20 requirements, 49 E2E specs green ([archive](milestones/v1.4-ROADMAP.md) | [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- [x] **v1.5: Demo Stability & UAT Coverage** — 3 phases (29–31), 7 plans, 7 requirements, 53 E2E specs green ([archive](milestones/v1.5-ROADMAP.md) | [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- [x] **v1.6: Downstream Unblock & Shell Service Surface** — 5 phases (32–36), 12 plans, 21 requirements, 54 E2E specs green ([archive](milestones/v1.6-ROADMAP.md) | [audit](milestones/v1.6-MILESTONE-AUDIT.md))
- [x] **v1.7: NIP-5D Spec Adoption & New NUB Domains** — 5 phases (37–41), 17 plans, 41/41 requirements, 72 E2E specs green; Phase 42 deferred to v1.8 ([archive](milestones/v1.7-ROADMAP.md) | [audit](milestones/v1.7-MILESTONE-AUDIT.md))

---

## Awaiting Next Milestone

v1.7 shipped 2026-04-24. No active milestone.

Run `/gsd:new-milestone` to start v1.8.

**v1.8 candidate scope (carried over from v1.7):**

- **Phase 42: NIP-44 decrypt surface (DECRYPT-01..03 + E2E-27)** — deferred from v1.7; soft-gated on napplet/napplet#3 NUB-surface decision between `relay.subscribeEncrypted` vs `identity.decrypt`. Re-evaluate at v1.8 kickoff; ship if upstream has resolved.
- **Provisional-types retirement (single atomic swap)** — delete `packages/shell/src/types/provisional-{class,connect,resource}.ts` when upstream publishes `@napplet/nub@^0.3.0` (class+connect subpaths) and `^0.2.2` (resource subpath); swap imports to canonical paths.
- **Nyquist validation retroactive pass (optional)** — run `/gsd:validate-phase 37..41` to generate VALIDATION.md artifacts for v1.7 phases if desired.
- **Cosmetic polish** — `apps/demo/napplets/resource-demo/index.html` h2 label still references stale port `:5174` (GRANTED_URL correctly uses `:4174`).
- **Electron / Tauri HostXxxBridge reference impls** (v1.4 carryover tech debt).
- **Multi-OS CI matrix** (v1.4 carryover — ubuntu-latest only currently).
- **`identitySource: 'auth' | 'source'` type-discriminant rename** (v1.6 carryover tech debt).
- **`bridge.injectEvent('auth:identity-changed', ...)` rename** (v1.6 carryover tech debt).
- **`pnpm.overrides @napplet/nub>@napplet/core` workaround retirement (SEED-001)** — gated on upstream publish-time workspace-specifier fix.

**Archived phases:** Phase directories 37–41 remain in `.planning/phases/` pending cleanup or next-milestone archival.

---

*ROADMAP.md last restructured: 2026-04-24 after v1.7 milestone close.*
