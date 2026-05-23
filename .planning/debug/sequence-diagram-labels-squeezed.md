---
slug: sequence-diagram-labels-squeezed
status: resolved
trigger: "sequence diagram is hard to read the labels, would be easier to read if it utilized more of the available space"
created: 2026-05-23
updated: 2026-05-23T10:59:12Z
---

# Debug: Sequence Diagram Labels Squeezed

## Symptoms

**Expected:** The debugger Sequence tab should spread lanes across the available viewport width so napplet lane labels are readable on wide screens.

**Actual:** The diagram is centered in a narrow band, leaving large unused horizontal space while lane headers and message labels overlap or become hard to read.

**Error messages:** None reported.

**Timeline:** Reported after the NIP-5D hosted playground work; visible in the screenshot attached to the debug request.

**Reproduction:** Open the playground, switch the debugger to the Sequence tab, and inspect the lane headers on a wide viewport.

## Current Focus

hypothesis: CONFIRMED — the sequence renderer uses a fixed 1000-unit viewBox plus fixed pixel height. SVG `preserveAspectRatio="xMidYMin meet"` is then height-limited, so the 1000px-wide drawing is centered instead of expanding to the available viewport width.
test: Inspect the sequence SVG renderer and debugger container sizing; update the render width from the live container width while keeping a 1000px minimum for smaller screens.
expecting: On wide viewports, the SVG viewBox width tracks the sequence container width and lane headers spread across the full panel.
next_action: Complete; patch, regression coverage, and verification are in place.

## Evidence

- timestamp: 2026-05-23T10:54:48Z
  finding: `apps/playground/src/sequence-diagram.ts` hard-codes `vbWidth = 1000` and renders `<svg width="100%" height="${height}" viewBox="0 0 1000 ${height}" preserveAspectRatio="xMidYMin meet">`.
  confirms: The diagram cannot use more than the fixed 1000-unit coordinate width when the fixed height constrains SVG scaling.
- timestamp: 2026-05-23T10:59:12Z
  finding: Focused E2E coverage now opens the Sequence tab at a 1920px viewport and asserts the SVG viewBox width is at least the live `#sequence-container` width.
  confirms: Regression guard directly covers the unused-horizontal-space symptom.

## Eliminated

- Not a missing-lane data bug. Existing E2E coverage already observes multiple lanes including `Shell`.

## Resolution

root_cause: `renderSequenceDiagram()` always used `vbWidth = 1000` while setting the SVG height to the content row height. With `preserveAspectRatio="xMidYMin meet"`, wide viewports were height-limited, so the 1000-unit drawing stayed centered and left unused horizontal space.
fix: Added an optional sequence diagram render width, measured the live sequence container in `<napplet-debugger>`, rendered the SVG with `max(1000, containerWidth)`, and observed container resizes while the Sequence tab is active.
verification: `pnpm type-check`; `pnpm test:build`; `CI=1 npx playwright test tests/e2e/shell-ui-state-surfaces.spec.ts --grep "Sequence Diagram renders"`; `pnpm test`; `pnpm audit:csp`; `pnpm audit:gateway-artifacts`; `CI=1 npx playwright test` (88 passed, 1 flaky media-controller pass on retry).
files_changed: `apps/playground/src/sequence-diagram.ts`; `apps/playground/src/debugger.ts`; `tests/e2e/shell-ui-state-surfaces.spec.ts`; `.planning/debug/sequence-diagram-labels-squeezed.md`.
