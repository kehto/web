---
slug: paja-acl-outbox-denials
status: resolved
trigger: "Fix Paja ACL controls that remain visually active after logging paja.acl.revoke, and make denied outbox.query responses conform to NAP-OUTBOX."
created: 2026-08-22
updated: 2026-08-22
---

# Debug: Paja ACL controls and canonical outbox denials

## Symptoms

**Expected:** Paja's ACL controls display and mutate the active napplet's exact verified identity. Revoking `outbox:read` immediately makes its button inactive; granting it immediately makes the button active. A denied `outbox.query` returns the canonical correlated NAP-OUTBOX result shape.

**Actual:** Clicking the active `outbox:read` control logs `paja.acl.revoke`, but the control remains visually active. The active ROM receives `outbox.query.error` with `denied: outbox:read` and reports discovery unavailable.

**Error messages:** `outbox.query.error`; `denied: outbox:read`; Paja log entry `paja.acl.revoke` while the `outbox:read` button remains active.

**Timeline:** Observed in current Paja after verified runtime-pointer tabs were introduced. The ROM previously discovered events successfully.

**Reproduction:** Open the supplied `gbc-emulator` naddr in Paja, use the ACL control for `outbox:read`, and compare the logged mutation, unchanged button state, and subsequent outbox query denial.

## Current Focus

hypothesis: CONFIRMED. Paja rendered ACL state against its static `dev-target:paja` configuration identity but mutated and enforced ACL state against the active tab's resolved `dTag:aggregateHash` identity. Separately, the runtime's generic denial response synthesized an undefined `outbox.query.error` envelope instead of the NAP-OUTBOX `outbox.query.result` error form.
test: Bind ACL rendering and click behavior to one active resolved identity, add a stateful rerender regression, and update runtime denial mapping with exact response-shape coverage.
expecting: The active target's button changes state after each mutation, identities remain isolated between tabs, permissive defaults remain permissive, grants remain available to opinionated runtimes, and denied outbox queries resolve through the canonical correlated result envelope.
next_action: ship the verified branch through a pull request.

## Authority

- `napplet/naps` PR #32, branch `nub-outbox`, exact head `4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e`, `naps/NAP-OUTBOX.md`.
- The draft permits shell ACL rejection, but defines `outbox.query.result` with optional `error`; it does not define `outbox.query.error`.
- NIP-5D PR #2303, exact head `eb45dfd7335b7f88cb53781984c553581d2b4c34`, `5D.md`.
- A required/injected `outbox` domain establishes availability, not an unconditional operation grant. Paja independently chooses a permissive developer-runtime ACL default.

## Evidence

- timestamp: 2026-08-22
  finding: The supplied naddr resolves to d-tag `gbc-emulator` and aggregate hash `a219066f98db62c1c6c5dde9d99fa4a5f7f990d0b0cf830b9aed60b2a5f05b3b` and declares `outbox` in its requirements.
  confirms: The failing request belongs to a resolved runtime-pointer identity, not Paja's static fallback identity.
- timestamp: 2026-08-22
  finding: `renderAclControls` checks `config.window.dTag` and `config.window.aggregateHash`, while `setAclCapability` uses `this.resolvedTarget` and runtime session enforcement uses the active window identity.
  confirms: The control's appearance and its mutation target different ACL entries.
- timestamp: 2026-08-22
  finding: Screenshots show `paja.acl.revoke` followed by an `outbox:read` control that remains visually active.
  confirms: The identity mismatch is observable through Paja's own mutation log and rerendered UI.
- timestamp: 2026-08-22
  finding: The new unit tests failed before the fix with the button still reporting `data-enabled="true"` after the active ROM entry was revoked, and with runtime output `outbox.query.error` lacking `events`.
  confirms: Both regressions are deterministic and independently covered.
- timestamp: 2026-08-22
  finding: After the fix, 22 focused Paja/runtime tests pass and the real Chromium runtime-pointer test passes the active `outbox:read` revoke/grant sequence with matching Paja log entries.
  confirms: Display, mutation, enforcement identity, and canonical query denial shape agree in unit and browser execution.

## Resolution

root_cause: Paja's ACL panel read the static fallback identity while ACL mutations and runtime enforcement used the active resolver-verified target identity. Runtime firewall and ACL denials also generated a generic `${request.type}.error` message, which is not valid for NAP-OUTBOX queries.
fix: Reuse the shared active-target identity resolver in Paja's ACL renderer and carry the resolved target through devtools state. Return denied `outbox.query` requests as correlated `outbox.query.result` envelopes with `events: []` and `error`, while preserving existing generic denials for other request types.
verification: Focused Vitest regressions pass (22/22); the focused Paja Chromium regression passes (2/2); `pnpm build` passes (32/32 tasks); `pnpm type-check` passes (17/17 packages); `pnpm test:unit` passes (145 files, 1700 tests); `pnpm docs:check` passes; `pnpm test:e2e` passes (83/83); and `npx aislop scan` reports 100/100. NAP-OUTBOX PR #32 was rechecked immediately before shipment and remains at exact head `4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e`.
files_changed: Paja devtools/runtime-tab state and tests; runtime denial dispatch and tests; Paja/runtime package docs and getting-started guidance; patch changeset for `@kehto/paja` and `@kehto/runtime`.
