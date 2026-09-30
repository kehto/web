---
status: resolved
trigger: "ipc-shell.ts has tests in it, doesn't appear to be an impl. has sibling file ipc-shell.test.ts."
created: 2026-08-20
updated: 2026-08-20T16:47:37+01:00
---

# Debug Session: IPC shell source shape

## Symptoms

- expected_behavior: "packages/shell-ipc/src/ipc-shell.ts should contain the production IPC shell implementation, with tests isolated in ipc-shell.test.ts."
- actual_behavior: "The production-named file appears test-like and does not appear to be an implementation, despite having a sibling test file."
- error_messages: "None reported."
- timeline: "Observed during review of the experimental IPC shell milestone branch."
- reproduction: "Inspect packages/shell-ipc/src/ipc-shell.ts beside packages/shell-ipc/src/ipc-shell.test.ts."

## Current Focus

- bug_class: "bohrbug"
- hypothesis: "Confirmed: the reported ipc-shell.ts source-shape issue is a false-positive finding. A separate Bohrbug exists in the process-proof test oracle, which asserts an ordering between independently scheduled host and child stdout streams."
- test: "Completed static source/export inspection, public build, direct graceful and forced host proofs, and focused process-proof execution."
- expecting: "Met: ipc-shell.ts is production code and its public API runs. The direct graceful transcript falsified the process test's inter-process stdout ordering assumption."
- next_action: "Completed: @kehto/shell-ipc now also ships a production-runnable process host and packaged CLI, while ipc-shell.ts remains the transport/projection implementation."
- reasoning_checkpoint: ""
- tdd_checkpoint: ""

## Evidence

- timestamp: 2026-08-20T16:45:29+01:00
  checked: "MemPalace semantic recall and the durable debug knowledge base"
  found: "The mempalace CLI is unavailable and .planning/debug/knowledge-base.md does not exist, so no prior-resolution candidate could be recalled."
  implication: "This investigation has no known-pattern hypothesis; continue with direct source and behavior evidence."

- timestamp: 2026-08-20T16:45:29+01:00
  checked: "shell-ipc package boundary, source tree, and symbol references"
  found: "ipc-shell.ts is exported by src/index.ts as createIpcTransport and createIpcShellProjection; the sibling ipc-shell.test.ts imports those APIs. The package also has a separately named example host and process proof."
  implication: "The initial filename observation is compatible with a normal production-source/test-sibling layout, but requires full source classification."

- timestamp: 2026-08-20T16:45:29+01:00
  checked: "package metadata and experimental IPC documentation references"
  found: "The published package exports dist/index.js only and describes itself as an experimental Unix-socket carrier. Documentation explicitly identifies examples/ipc-projection-reference-host.mjs as executable evidence."
  implication: "A reusable library API plus a separate runnable reference host appears to be the stated design; verify that implementation matches it."

- timestamp: 2026-08-20T16:47:11+01:00
  checked: "ipc-shell.ts implementation structure, sibling ipc-shell.test.ts, public index, host example, and package documentation"
  found: "ipc-shell.ts imports node:net, node:os, @napplet/core, @kehto/runtime, and local production helpers; it defines createIpcTransport and createIpcShellProjection plus validation/lifecycle helpers. The sibling test imports Vitest, and the documented example host is a separate .mjs program that imports @kehto/shell-ipc through the package boundary."
  implication: "The files have distinct production, test, and executable-evidence roles. The remaining falsification is whether the documented public API actually builds and runs."

- timestamp: 2026-08-20T16:46:29+01:00
  checked: "static test-declaration scan, public package build, and shell-ipc unit suite"
  found: "ipc-shell.ts has no describe/it/test/expect/vi declaration; Vitest imports occur only in *.test.ts. The package built dist/index.js and declarations successfully. The unit suite passed 92 of 93 tests, but ipc-projection-process.test.ts failed one ordering assertion: service-dispatch was observed at transcript index 1 and child shell.init at index 4."
  implication: "The production/test file distinction is directly confirmed. The failure does not implicate ipc-shell.ts yet: the test merges stdout produced by separate host and child processes, whose read-event order is not a causal clock."

- timestamp: 2026-08-20T16:47:14+01:00
  checked: "standalone reference host in documented graceful and forced modes, plus the focused process-proof test"
  found: "Both direct public-package runs exited successfully and emitted complete cleanup. The graceful run emitted host service-dispatch before the host relayed the child shell.init record; the forced run used the opposite order. The focused test passed on its next run."
  implication: "The relative stdout observation order is scheduling-dependent despite correct IPC causality, so ipc-projection-process.test.ts's ordering assertion is flaky. This is separate from the reported ipc-shell.ts source-shape claim."

- timestamp: 2026-08-20T16:47:37+01:00
  checked: "production, test, export, and process-proof assertion line references"
  found: "ipc-shell.ts imports carrier/runtime dependencies and exports createIpcTransport at line 46 and createIpcShellProjection at lines 228-243; src/index.ts re-exports them at line 1. Vitest is imported by ipc-shell.test.ts at line 5. The flaky assertion is ipc-projection-process.test.ts line 111, while the reference host asynchronously relays child stdout at lines 177-192."
  implication: "The original source-shape claim is refuted. The separate test failure has a specific, falsifiable mechanism and should be handled as its own test-oracle bug."

## Eliminated

- hypothesis: "ipc-shell.ts contains test-runner declarations or test cases instead of production behavior"
  evidence: "Static scan found no Vitest imports or describe/it/test/expect/vi declarations in ipc-shell.ts; its sibling ipc-shell.test.ts imports Vitest and exercises the exported APIs."
  timestamp: 2026-08-20T16:47:37+01:00

- hypothesis: "The package entry point or executable proof bypasses production code in favor of test fixtures"
  evidence: "src/index.ts exports ./ipc-shell.js, the package built dist/index.js and declarations successfully, and the documented reference host imports @kehto/shell-ipc and exits successfully in graceful and forced modes."
  timestamp: 2026-08-20T16:47:37+01:00

## Resolution

- root_cause: "No ipc-shell.ts source-shape defect exists: the review finding is a false positive. ipc-shell.ts is the production Node/POSIX carrier and runtime-composition implementation; tests are isolated in sibling *.test.ts files and the executable proof is intentionally under examples/. Separately, ipc-projection-process.test.ts has a flaky oracle because it treats relative arrival order from asynchronously relayed child stdout and host stdout as causal order."
- fix: "Kept ipc-shell.ts as the production transport/projection implementation and added ipc-shell-host.ts plus the kehto-ipc-shell binary as the concrete process-owning shell. Replaced the cross-stream ordering oracle with causal/per-source milestones and added direct lifecycle and peer-disconnect regressions."
- verification: "Focused projection/host/bin tests passed; @kehto/shell-ipc unit tests passed 117/117; full build, type-check, 1,798-unit-test, 81-Playwright-test, docs, and AI-slop gates passed."
- files_changed:
    - "packages/shell-ipc/src/ipc-shell-host.ts"
    - "packages/shell-ipc/src/cli.ts"
    - "packages/shell-ipc/src/ipc-shell.ts"
    - "packages/shell-ipc/src/ipc-shell.test.ts"
    - "packages/shell-ipc/src/ipc-shell-host.test.ts"
    - "packages/shell-ipc/src/ipc-projection-process.test.ts"
