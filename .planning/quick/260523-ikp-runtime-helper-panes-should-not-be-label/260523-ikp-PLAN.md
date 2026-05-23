---
quick_id: 260523-ikp
slug: runtime-helper-panes-should-not-be-label
status: completed
created: 2026-05-23
---

# Quick Task 260523-ikp: Runtime helper panes should not be labeled napplet

## Goal

Make runtime/demo helper panes visually distinct from real playground napplets and remove empty ACL-control space from cards that do not expose inline ACL controls.

## Tasks

1. Classify topology surfaces
   - Files: `apps/playground/src/shell-host.ts`, `apps/playground/src/topology.ts`
   - Action: add a display classification for runtime demo surfaces and split them into their own rendered region after the napplet region
   - Verify: rendered markup contains a runtime-demo region and runtime demo cards do not use the `napplet` kicker
   - Done: [x]

2. Collapse empty ACL slots
   - Files: `apps/playground/src/topology.ts`, `apps/playground/index.html`
   - Action: render ACL slots only for cards with inline ACL controls and avoid reserving blank slot height for runtime demo cards
   - Verify: runtime demo cards have no `.topology-acl-slot` placeholder, while normal napplet cards retain ACL controls
   - Done: [x]

3. Add regression coverage and verify
   - Files: `tests/unit/demo-topology-render.test.ts`
   - Action: lock the new topology grouping and empty-slot behavior in unit coverage
   - Verify: type-check, focused unit tests, and relevant E2E pass
   - Done: [x]
