# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** - 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** - 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** - 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** - 7 phases (16-22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [x] **v1.4: Productionization & Upstream Unblock** - 6 phases (23-28), 17 plans, 20 requirements, 49 E2E specs green ([archive](milestones/v1.4-ROADMAP.md) | [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- [x] **v1.5: Demo Stability & UAT Coverage** - 3 phases (29-31), 7 plans, 7 requirements, 53 E2E specs green ([archive](milestones/v1.5-ROADMAP.md) | [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- [x] **v1.6: Downstream Unblock & Shell Service Surface** - 5 phases (32-36), 12 plans, 21 requirements, 54 E2E specs green ([archive](milestones/v1.6-ROADMAP.md) | [audit](milestones/v1.6-MILESTONE-AUDIT.md))
- [x] **v1.7: NIP-5D Spec Adoption & New NUB Domains** - 5 phases (37-41), 17 plans, 41/41 requirements, 72 E2E specs green ([archive](milestones/v1.7-ROADMAP.md) | [audit](milestones/v1.7-MILESTONE-AUDIT.md))
- [x] **v1.8: Upstream Alignment & NIP-44 Decrypt** - 5 phases (42-46), 9 plans, 27/27 requirements, 86 E2E specs green ([archive](milestones/v1.8-ROADMAP.md) | [audit](milestones/v1.8-MILESTONE-AUDIT.md))
- [x] **v1.9: Napplet SDK Migration** - 3 phases (47-49), 3 plans, 12/12 requirements, 86 E2E specs green ([archive](milestones/v1.9-ROADMAP.md) | [audit](milestones/v1.9-MILESTONE-AUDIT.md))
- [x] **v1.10: Compatibility Window Cleanup & Decrypt Demo Parity** - 3 phases (50-52), 3 plans, 10/10 requirements, 86 E2E specs green ([archive](milestones/v1.10-ROADMAP.md) | [audit](milestones/v1.10-MILESTONE-AUDIT.md))
- [x] **v1.11: NIP-5A Gateway Artifact Parity** - 3 phases (53-55), 16/16 requirements, 551 unit tests, 87 E2E specs green ([archive](milestones/v1.11-ROADMAP.md) | [audit](milestones/v1.11-MILESTONE-AUDIT.md))
- [ ] **v1.12: NIP-5D Contract Conformance** - 4 phases (56-59), 34 requirements, pinned-spec contract conformance across shell, shim/runtime, gateway load checks, and 13 playground napplets.

---

## v1.12: NIP-5D Contract Conformance

**Goal:** Establish a precise repo-local NIP-5D contract from the pinned NIP-5D source, then bring the playground shell, shared napplet runtime/shim surface, and all 13 playground napplets into conformance with that contract.

**Pinned source:** `https://raw.githubusercontent.com/dskvr/nips/d80d7b25f9c4331acbeb40dbeb3b077caa80e885/5D.md`

**Baseline entering v1.12:** v1.11 closed with production-equivalent gateway artifact loading, 551 unit tests, `pnpm audit:csp`, `pnpm audit:gateway-artifacts`, and 87/87 Playwright E2E tests passing. `.planning/NIP-5D-DELTA-AUDIT.md` is the current-state delta inventory for this milestone.

**Coverage:** 34/34 requirements mapped.

**Critical invariant:** NIP-5D identity is shell-assigned at iframe creation from the NIP-5A `(dTag, aggregateHash)` tuple. AUTH/REGISTER/IDENTITY/NIP-01 negotiation is stale drift for NIP-5D protocol identity.

### Phases

- [x] **Phase 56: Contract Authority and Package Source Baseline** - Write the pinned-spec repo-local contract, repair stale spec/docs authority, classify extension surfaces, and ensure the playground consumes local protocol package sources being changed.
- [x] **Phase 57: Shell Capability Negotiation and Requires Enforcement** - Make shell capabilities authoritative for hosted `supports()`, expose manifest `requires` in gateway metadata, and reject or warn on missing capabilities at load time.
- [x] **Phase 58: Playground Napplet Contract Conformance** - Add explicit NIP-5D/NUB contracts to all 13 playground napplets, gate optional behavior with `supports()`, classify or replace raw demo envelopes, and rename stale protocol-auth wording.
- [ ] **Phase 59: Regression Guards and Full Verification** - Add the static/unit/E2E guards for sandboxing, source validation, no napplet `window.nostr`, requires coverage, supports behavior, raw-envelope exceptions, and run the full verification loop.

---

## Phase Details

### Phase 56: Contract Authority and Package Source Baseline

**Goal**: Establish the precise contract and remove authority drift before changing behavior.

**Depends on**: v1.12 requirements accepted; `.planning/NIP-5D-DELTA-AUDIT.md`; pinned NIP-5D source.

**Requirements**: CONTRACT-01, CONTRACT-02, CONTRACT-03, CONTRACT-04, CONTRACT-05, SOURCE-01, SOURCE-02, EXT-01

**Rationale**: The milestone should not implement against stale docs. The pinned NIP-5D source is small and explicit, while `RUNTIME-SPEC.md` and `napplet/specs/NIP-5D.md` contain drift. Package-source wiring is also a prerequisite because shim/NUB changes will not affect the playground if it keeps consuming published packages.

**Success Criteria** (what must be TRUE):
  1. The active repo-local NIP-5D contract cites only the pinned raw URL/commit as authoritative.
  2. `RUNTIME-SPEC.md` and `napplet/specs/NIP-5D.md` are repaired, replaced, or marked non-authoritative.
  3. The contract explicitly covers sandbox, transport, object envelopes, source identity, manifest `requires`, hosted `supports()`, and no napplet `window.nostr`.
  4. Extension candidates (`connect`, `class`, `nostrdb`, `identity.decrypt`, `relay.publishEncrypted`) have recorded classification decisions to drive later implementation.
  5. Playground protocol package resolution uses the repo-local package sources being changed, with a guard or documented check for drift.

**Plans**: [56-01-PLAN.md](phases/56-contract-authority-and-package-source-baseline/56-01-PLAN.md)

**Completed**: 2026-05-22 ([summary](phases/56-contract-authority-and-package-source-baseline/56-01-SUMMARY.md) | [verification](phases/56-contract-authority-and-package-source-baseline/56-VERIFICATION.md))

### Phase 57: Shell Capability Negotiation and Requires Enforcement

**Goal**: Make the shell, not static shim knowledge, the source of truth for capabilities.

**Depends on**: Phase 56

**Requirements**: SUPPORTS-01, SUPPORTS-02, SUPPORTS-03, SUPPORTS-04, REQUIRES-01, REQUIRES-04, REQUIRES-05, EXT-02, EXT-03

**Rationale**: Pinned NIP-5D requires load-time checking of manifest `requires` tags and runtime `window.napplet.shell.supports()`. Both are currently incomplete: gateway metadata omits `requires`, and hosted napplets see a static shim fallback.

**Success Criteria** (what must be TRUE):
  1. The shell builds a capability inventory from real services, extension classifications, and permission policy.
  2. Hosted `window.napplet.shell.supports()` reflects that shell inventory for bare, `nub:`, and `perm:` names.
  3. Static shim capability fallback is excluded from the hosted playground contract.
  4. Gateway metadata carries parsed `requires` tags.
  5. The playground shell rejects or warns before marking a napplet usable when a required capability is missing.
  6. Crypto-related mediated operations are either documented as NUB operations with clear boundaries or removed from the conformance path.

**Plans**: [57-01-PLAN.md](phases/57-shell-capability-negotiation-and-requires-enforcement/57-01-PLAN.md)

**Completed**: 2026-05-22 ([summary](phases/57-shell-capability-negotiation-and-requires-enforcement/57-01-SUMMARY.md) | [verification](phases/57-shell-capability-negotiation-and-requires-enforcement/57-VERIFICATION.md))

### Phase 58: Playground Napplet Contract Conformance

**Goal**: Bring every playground napplet into the contract through manifest declarations, capability checks, and explicit raw-surface boundaries.

**Depends on**: Phase 57

**Requirements**: REQUIRES-02, REQUIRES-03, RAW-01, RAW-02, NAPPLET-01, NAPPLET-02, NAPPLET-03, NAPPLET-04

**Rationale**: The playground is the user-visible integration proof. All 13 napplets currently import the shim and use NUB surfaces, but their manifests omit `requires`, none exercises hosted `supports()`, and several carry raw demo envelopes or stale AUTH wording.

**Success Criteria** (what must be TRUE):
  1. All 13 playground napplets declare their required NUBs in source and built NIP-5A manifests.
  2. Optional or degraded features are gated with hosted `supports()` calls.
  3. Identity readiness probes used only to emulate old AUTH/authenticated state are replaced with a real NIP-5D ready/capability path.
  4. `demo.publishTheme`, `demo.decrypt.fixtures`, raw `notify.create/list`, raw `resource.bytes`, and raw `theme.changed` listeners are removed, replaced, or explicitly classified in the allowlist.
  5. Stale AUTH/authenticated wording is renamed wherever it describes protocol identity rather than user/signer authentication.

**Plans**: [58-01-PLAN.md](phases/58-playground-napplet-contract-conformance/58-01-PLAN.md)

**Completed**: 2026-05-22 ([summary](phases/58-playground-napplet-contract-conformance/58-01-SUMMARY.md) | [verification](phases/58-playground-napplet-contract-conformance/58-VERIFICATION.md))

### Phase 59: Regression Guards and Full Verification

**Goal**: Prevent drift and prove the full conformance milestone end to end.

**Depends on**: Phase 58

**Requirements**: GUARD-01, GUARD-02, GUARD-03, GUARD-04, GUARD-05, GUARD-06, E2E-35, E2E-36, VERIFY-01

**Rationale**: This milestone changes cross-package protocol behavior and every playground napplet. Completion requires guards that fail on the exact drift classes from the delta audit plus full build/type/unit/CSP/artifact/E2E verification.

**Success Criteria** (what must be TRUE):
  1. Static/unit guards cover sandbox policy, no `allow-same-origin`, `MessageEvent.source` source validation, no napplet `window.nostr`, no direct forbidden browser APIs, manifest `requires` coverage, hosted `supports()` behavior, and allowed raw-envelope exceptions.
  2. E2E proves missing required NUB capability rejection or compatibility warnings at load time.
  3. E2E proves all 13 playground napplets boot through the gateway path with declared `requires` and shell-derived `supports()`.
  4. `pnpm build`, `pnpm type-check`, `pnpm test:unit`, `pnpm audit:csp`, `pnpm audit:gateway-artifacts`, and `pnpm test:e2e` pass.
  5. All remaining deviations are documented as deliberate NUB extensions or demo/test-only surfaces.

**Plans**: Pending

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 56. Contract Authority and Package Source Baseline | 1/1 | Completed | 2026-05-22 |
| 57. Shell Capability Negotiation and Requires Enforcement | 1/1 | Completed | 2026-05-22 |
| 58. Playground Napplet Contract Conformance | 1/1 | Completed | 2026-05-22 |
| 59. Regression Guards and Full Verification | 0/0 | Not started | - |

---

*ROADMAP.md last updated: 2026-05-22 - Phase 58 completed.*
