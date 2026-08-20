---
status: fixed
trigger: "Resolve kehto/web#186: NAP-SHELL is not injected by the NIP-5D namespace prelude; identify the AGENTS.md gap that allowed the protocol violation"
created: "2026-07-11T16:00:00Z"
updated: "2026-07-11T16:20:00Z"
issue: "https://github.com/kehto/web/issues/186"
spec: "napplet/naps master naps/NAP-SHELL.md at 5febc8b072e567da2bbe25ac7e2706acece13260"
---

# Debug Session: NAP-SHELL namespace prelude

## Symptoms

- expected_behavior: "`renderNappletNamespacePrelude({ domains: ['shell', ...] })` installs the mandatory `window.napplet.shell` API with `ready()`, `supports(domain, protocol?)`, `services`, and `onReady()`, installs the shell.init receiver before emitting one bare shell.ready message, and caches the returned environment for local queries."
- actual_behavior: "The generated `makeDomain()` has no shell case, so the prelude exposes no usable NAP-SHELL object, emits no shell.ready message, and never caches shell.init."
- error_messages: "No thrown error. `window.napplet.shell` is absent or empty, no shell.ready is posted, ready cannot resolve, and supports cannot report host capabilities."
- timeline: "Reported 2026-07-11 against distributed @kehto/shell 0.16.7 and reproduced on current main source (package manifest 0.17.1). The violation originated in the earlier NIP-5D namespace-prelude implementation."
- reproduction: "Render the prelude with domains ['shell', 'relay', 'outbox'], execute it in an iframe-like window, assert window.napplet.shell API shape, and observe parent.postMessage for exactly one { type: 'shell.ready' }. Deliver shell.init and verify ready/onReady/services/supports use the cached environment."

## Current Focus

- hypothesis: "Confirmed: a false AGENTS.md rule classified shell.supports as compatibility after NAP-SHELL already owned it. The callable prelude then implemented 23 optional domains but omitted shell, while Paja/playground readiness shortcuts and unstable logging proxies hid the missing handshake and defeated duplicate-ready idempotency."
- test: "Add an iframe-level prelude regression covering API installation, receiver-before-ready ordering, exactly-once shell.ready, shell.init caching, local supports/services, one-shot onReady, namespace wrapping, and unknown capability behavior."
- expecting: "Focused test fails on current main before implementation and passes only when NAP-SHELL bootstrap semantics match upstream spec."
- next_action: "Commit the verified fix, push the branch, and open the issue-closing PR."
- reasoning_checkpoint: ""
- tdd_checkpoint: ""

## Evidence

- timestamp: "2026-07-11T16:00:00Z"
  source: "gh issue view 186 --repo kehto/web"
  finding: "Issue reproduces absent NAP-SHELL API, absent shell.ready emission, and absent shell.init cache in distributed 0.16.7 and current main."
- timestamp: "2026-07-11T16:00:00Z"
  source: "napplet/naps master naps/NAP-SHELL.md at 5febc8b072e567da2bbe25ac7e2706acece13260"
  finding: "NAP-SHELL is mandatory and foundational; its web binding is window.napplet.shell; ready/onReady/services/supports are local over cached shell.init; shim normally auto-emits shell.ready after receiver is live."
- timestamp: "2026-07-11T16:02:00Z"
  source: "pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts packages/paja/src/browser-host.test.ts tests/unit/playground-gateway-guard.test.ts"
  finding: "Red regression: 6 failures proved missing shell API, missing Paja/playground propagation, and redundant authored playground shell.ready."
- timestamp: "2026-07-11T16:03:00Z"
  source: "git history/blame for AGENTS.md and packages/shell/src/napplet-namespace.ts"
  finding: "AGENTS.md commit bc65b399 called shell.supports compatibility 11 days after NAP-SHELL was created; callable prelude commit 6eb3b036 followed that false boundary and omitted shell."
- timestamp: "2026-07-11T16:06:00Z"
  source: "focused Vitest and package type-checks"
  finding: "47 focused unit/static tests passed; @kehto/shell and @kehto/paja type-checks passed."
- timestamp: "2026-07-11T16:08:00Z"
  source: "pnpm exec playwright test tests/e2e/paja-single-window.spec.ts tests/e2e/gateway-artifact-parity.spec.ts tests/e2e/naps-path-conformance.spec.ts --workers=1"
  finding: "7/7 browser tests passed after rebuilding real package output; Paja and all hosted playground frames expose mandatory NAP-SHELL, cache shell.init, and preserve reload/idempotency behavior."

## Eliminated

- hypothesis: "Host-side shell.ready responder is missing or non-conformant."
  evidence: "Existing handleShellReady registers the session, sends shell.init once per registered window lifecycle, and passes existing duplicate/reload tests."
- hypothesis: "Optional domain presence can replace NAP-SHELL capability negotiation."
  evidence: "NAP-SHELL explicitly defines a separate mandatory local API and handshake; both contracts coexist."

## Quality cleanup plan

1. Replace the unsafe `Document` double assertion with an `EventTarget`-compatible single assertion.
2. Keep the prelude as one self-contained function because `Function#toString()` places it before verified artifact scripts without importing code into signed bytes.
3. Document a rule-scoped scanner exception for only the resulting file/function length findings; do not change the pinned scanner config or suppress any semantic rule.
4. Re-run focused tests and the exact AI-slop changes gate before shipping.

## Resolution

- root_cause: "AGENTS.md falsely treated `window.napplet.shell.supports()` as a compatibility-only bridge after NAP-SHELL already made it mandatory. The callable namespace prelude consequently implemented optional NAP domains but omitted NAP-SHELL. Paja and playground readiness shortcuts plus unstable Window logging proxies masked the missing handshake and made duplicate ready delivery appear as fresh sessions."
- fix: "The host-owned prelude now always installs immutable NAP-SHELL lifecycle/query APIs, receives and caches the first parent `shell.init` before posting one bare `shell.ready`, and survives namespace wrapping. Paja and playground now gate readiness on NAP-SHELL, use stable Window proxies, avoid premature session registration, and consume the same mandatory bootstrap. Authored playground artifacts no longer emit a competing ready message. Guidance, package docs, policies, migrations, audit scripts, unit guards, browser tests, and shell/Paja changesets move with the behavior."
- verification: "`pnpm build` 32/32; `pnpm type-check` 17/17; `pnpm test:unit` 102 files and 1320 tests; `pnpm docs:check` green; full `pnpm test:e2e` 71/71; focused post-cleanup Vitest 47/47; shell/Paja post-cleanup type-check green; `pnpm dlx aislop@0.12.0 scan --changes --base HEAD` 100/100. `pnpm lint` exited zero but Turbo found no configured lint tasks."
- files_changed: "Shell prelude/types/tests/docs; Paja browser host/frame/devtools/tests/docs; playground host/artifact config/tests/docs; NIP-5D policy/migrations/runtime spec; AGENTS.md guardrails; gateway audit; shell and Paja changeset; debug record."
