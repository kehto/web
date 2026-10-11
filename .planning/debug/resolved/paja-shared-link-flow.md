---
status: resolved
trigger: "Intent links are for sharing with people; show handler UI only when a saved default conflicts with the link's napplet hint"
created: 2026-10-10
updated: 2026-10-10
---

## Current Focus

hypothesis: Paja wrongly treats every incoming shared link as an editable protocol request and retains its dialog after delivery.
next_action: Push the verified change, open its PR, and confirm the CI result.

## Acceptance

- Opening an ordinary shared link opens its verified handler and delivers the opaque payload without a protocol form or extra Launch click.
- Saved default and link hint agree: open directly.
- Applicable saved default conflicts with a valid napplet hint: ask which named app to use. Preserve the saved default unless the user explicitly changes it.
- No URI, JSON payload, role jargon, or completed-delivery modal in the recipient flow.
- Preserve verified signed bytes, authenticated launcher sender, source-bound dispatch, readiness retention, exactly-once delivery, and default precedence.
- Host errors and genuinely missing/ambiguous handlers use clear recipient-facing recovery, not the old protocol form.

## Protocol Authority

NAP-INTENT PR106 at fc121fc264615482143eda86125863d2e1f741a2 was checked before this record or any code change. Resolution precedence is authorized explicit selection, applicable saved default, permitted compatible recommendation, then installed resolution/choice. The spec mandates verification and ordinary host installation/execution policy, not an editable review dialog for every shared link. Clicking a shared link follows Paja's ordinary verified-pointer navigation policy; conflict choices authorize an explicit handler and never silently mutate defaults.

## Implementation Plan

1. Trace incoming links, launcher, defaults, catalog routing, and current UI ownership. Verify scope against the pinned spec.
2. Replace routine review with automatic verified dispatch, lightweight progress/error state, and a named-app default/hint conflict choice.
3. Update browser regressions for direct cold/warm delivery, conflict choices, unchanged defaults, invalid hints, no replay, and payload preservation. Synchronize docs and add a Paja changeset.
4. Run focused checks, required build/type/unit/docs/browser/quality gates, commit, push, and open a PR with the spec ref and validation evidence.

## Evidence

- Primary main has unrelated package.json workspace edits; preserved. New clean worktree branches from origin/main 929e3e98.
- Screenshot shows Review intent link, URI, raw Payload, empty Compatible handler, role/default actions, and Delivered status together. The current controller shows that form for every incoming link and leaves it open after terminal delivery.
- Replaced unconditional protocol review with direct verified navigation, a nonmodal progress/error notice, and named app choices. Successful delivery closes the notice; accepted navigation consumes its URL intent to prevent reload replay.
- Focused browser regressions exposed a real persistence bug: catalog hydration depended on running tabs, so opening the shared app could hide the saved app from later resolution. Store only discovery pointers separately, reverify them on load, and preserve pointers through ordinary pointer-only navigation.
- All 12 focused browser tests passed with one worker and zero retries, including direct fresh/warm delivery, explicit versus one-time preference changes, invalid signatures/contracts, cancellation, authenticated sender, delayed readiness, primitive/null/array payloads, and no reload replay.
- Updated both Paja documentation surfaces and the conformance policy; added a Paja patch changeset.
- Final validation: pnpm build (32 tasks), pnpm type-check (17 tasks), pnpm test:unit (2,095 tests), pnpm docs:check (9 package docs), and CI=true pnpm test:e2e --workers=1 --retries=0 (120 tests) passed. The focused 12 browser tests also passed at 375px. Gateway audit passed for 15 artifacts. AI-slop gate passed at the existing 95/100 baseline with zero errors and five pre-existing size/complexity warnings; config unchanged.
- An initial concurrent unit run hit an unrelated CEP-41 50ms liveness timing assertion; the full sequential run passed. An optional tracing run timed out and left an incomplete trace; the complete zero-retry browser runs above passed.
- Rechecked NAP-INTENT PR106 before closeout: still open at fc121fc264615482143eda86125863d2e1f741a2. Exact outer pointers retain authorized explicit-selection precedence; only recommendations conflict with saved defaults.

## Resolution

Implemented and verified. Ordinary sharing opens content directly; applicable default/hint conflicts use named app buttons and explicit preference changes. Wire contracts, authenticated source, verified artifact provenance, and readiness retention remain conformant to the pinned NAP-INTENT draft. Native external source identity remains intentionally deferred as the existing upstream spec gap.
