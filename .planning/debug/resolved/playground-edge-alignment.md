---
status: resolved
trigger: "The playground lines no longer connect to nodes correctly."
created: "2026-07-31"
updated: "2026-07-31"
---

# Playground edge alignment

## Symptoms

- Expected: topology connector lines terminate at their corresponding node anchors.
- Actual: connector lines are visibly offset from nodes in the playground.
- Errors: none reported.
- Timeline: regression; previously worked.
- Reproduction: open the playground topology and inspect node-to-node connectors.

## Current Focus

- hypothesis: confirmed — LeaderLine renders body-level SVGs while topology nodes
  are clipped by a nested scroll container.
- test: render the current playground and compare the topology viewport with
  card port and SVG geometry before and after scrolling.
- expecting: connector output remains inside the visible topology canvas and
  moves with it.
- next_action: resolved

## Evidence

- 2026-07-31: Reproduced at 1280x900. `#topology-pane` covered y=58..368,
  while node ports began at y=584; unbounded LeaderLine SVGs therefore drew
  outside the canvas and behind relay/debug panels.
- 2026-07-31: Confirmed `initTopologyEdges` already repositions on scroll, but
  had no clipping for LeaderLine's document-body SVG output.
- 2026-07-31: Added canvas clipping after every position update; targeted
  browser coverage and the visual scroll repro confirm no paths spill into
  the surrounding panels.

## Eliminated

## Resolution

- root_cause: LeaderLine appends its connector SVGs to document.body, outside
  the overflow boundary that clips the topology's node cards.
- fix: Compute an inset clip path against #topology-pane after creating,
  resizing, or scrolling connector lines.
- verification: focused topology unit tests, `pnpm build`, `pnpm type-check`,
  `pnpm test:unit` (1,565 tests), `pnpm docs:check`, `aislop` 100/100,
  `pnpm exec playwright test tests/e2e/topology-lines.spec.ts`, and visual
  browser screenshots pass. The full E2E run was attempted but its shared
  4173 harness was unavailable, producing unrelated connection-refused
  harness/fixture failures after the playground checks had passed.
- files_changed: apps/playground/src/topology.ts,
  tests/e2e/topology-lines.spec.ts.
