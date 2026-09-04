---
status: resolved
trigger: "Paja leaves a large Blossom-backed napplet on its wrapper placeholder even though resource.bytes.result messages arrive; active downloads must not be rejected by the injected namespace's absolute request timeout"
created: 2026-09-04
updated: 2026-09-04
---

# Paja active resource transfer timeout

## Symptoms

expected: Active `resource.bytes` and `resource.bytesMany` transfers remain pending
  until the runtime sends a terminal result/error or the napplet explicitly cancels.
actual: The injected namespace starts the same absolute 30-second timer used for
  ordinary request/response domains. When it fires, the listener is removed and the
  promise rejects while Paja may continue downloading and later log ignored results.
errors: The wrapper has no rejection UI, so it remains at “Loading packaged
  application…”; Paja may subsequently show `resource.bytes.result` messages.
timeline: First reproduced with the PR #205 large-asset optimizer deployment on
  2026-09-04. The namespace timer predates this deployment.
reproduction: Load the deployed large-asset napplet in Paja while one of its ten
  bounded Blossom resources takes longer than 30 seconds to finish.

## Current Focus

hypothesis: Confirmed. The shell namespace's absolute request timeout rejects active
  resource transfers and drops their late terminal envelopes.
test: Exercise the public rendered namespace with a resource result delivered after
  the ordinary request deadline.
expecting: Current code rejects before the late result; fixed code keeps the resource
  request pending while an ordinary request still times out.
result: Focused regressions, full repository gates, and the deployed Paja
  reproduction pass.
next_action: None; merge the verified fix and release the updated shell package.

## Evidence

- timestamp: 2026-09-04T13:15:00Z
  result: `packages/shell/src/napplet-namespace.ts` uses one 30-second timer for all
    requests and removes the listener on expiry without sending `resource.cancel`.
- timestamp: 2026-09-04T13:16:00Z
  result: Paja logs terminal resource results after the napplet remains on the
    wrapper placeholder; its log preview JSON-serializes `Blob` as `{}`.
- timestamp: 2026-09-04T13:18:00Z
  result: The same optimized HTML reaches the game within one second in Chromium
    when supplied through a conforming `resource.bytes` implementation.
- timestamp: 2026-09-04T13:20:00Z
  result: NAP-RESOURCE PR #80 head
    `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1` defines complete-Blob terminal
    results, explicit cancellation, and no progress messages. Its 30-second fetch
    timeout is a runtime policy recommendation, not a napplet-side absolute deadline.
- timestamp: 2026-09-04T13:28:00Z
  result: The single-resource regression failed RED because the transfer state was
    `rejected` after 30,001 ms; 30 pre-existing tests passed.
- timestamp: 2026-09-04T13:29:00Z
  result: The single-resource regression passed GREEN at 31/31 while the ordinary
    identity request still rejected after the same deadline.
- timestamp: 2026-09-04T13:30:00Z
  result: The batch regression independently failed RED at 31/32, then passed GREEN
    at 32/32 after `resource.bytesMany` opted out of the local deadline.
- timestamp: 2026-09-04T13:35:00Z
  result: Full validation passed: build 32/32, type-check 17/17, unit tests
    1,721/1,721, strict docs, lint, 84/84 Playwright tests, and AI-slop 100/100.
- timestamp: 2026-09-04T13:41:00Z
  result: The patched local Paja loaded the deployed PR #205 artifact over real
    Blossom. Its first resource result arrived after the old deadline, all ten
    results completed in 113,382 ms, the wrapper was replaced by the game launch
    screen, and Chromium reported zero page errors.
- timestamp: 2026-09-04T13:52:00Z
  result: Independent review rejected the first fix because removing the local
    deadline without exposing NAP-RESOURCE cancellation could retain a listener
    forever when a runtime never sends a terminal envelope.
- timestamp: 2026-09-04T13:54:00Z
  result: Single and batch cancellation tests each failed RED before wiring and
    passed GREEN afterward. An abort now rejects with `AbortError`, emits the
    existing `resource.cancel`, removes correlation, and ignores late results.
- timestamp: 2026-09-04T14:00:00Z
  result: Final reviewed validation passed: build 32/32, type-check 17/17, unit
    tests 1,723/1,723, strict docs, 84/84 Playwright tests, and AI-slop 100/100.

## Eliminated

- hypothesis: `blob: {}` in the Paja log proves the iframe received a plain object.
  reason: Paja creates a real `Blob`, posts it directly, and its devtools preview uses
    `JSON.stringify`, whose representation of a `Blob` is `{}`.
- hypothesis: The optimized wrapper or game cannot boot from reconstructed bytes.
  reason: A real Chromium run with the same ten exact blobs replaced the wrapper and
    reached the game's `Running...` state without page errors.

## Resolution

root_cause: The injected `window.napplet` namespace applied its ordinary absolute
  30-second request timeout to `resource.bytes` and `resource.bytesMany`. It removed
  the matching listener and rejected the napplet promise even while the Paja runtime
  continued downloading. Late terminal results were logged by Paja but ignored by
  the iframe.
fix: Let resource byte and batch correlation wait for the runtime's terminal result
  or error. Expose the canonical `AbortSignal` option so callers can cancel, emit
  `resource.cancel`, remove the listener, and drop late results. Keep the existing
  30-second deadline for ordinary request/response domains. Document that runtimes
  own fetch deadlines and callers own explicit cancellation, consistent with
  NAP-RESOURCE PR #80 at `fa6bcc69`.
verification: Four regressions failed before their respective implementation change
  and pass afterward. Build, type-check, 1,723 unit tests, strict docs, 84 Playwright
  tests, and AI-slop 100/100 pass on the reviewed implementation. The real deployed
  large-asset napplet reaches the game launch screen through patched Paja after a
  113-second active transfer.
files_changed: `packages/shell/src/napplet-namespace.ts`,
  `packages/shell/src/napplet-namespace.test.ts`,
  `docs/policies/SHELL-RESOURCE-POLICY.md`, patch changeset, and this debug record.
