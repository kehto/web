---
phase: 114-paja-and-playground-approval-flows
plan: 01
subsystem: browser-admission
tags: [runtime, shell, csp, verified-source, network]
dependency_graph:
  requires: [113-18]
  provides: [shared-browser-admission, closed-csp-registry]
  affects: [paja, playground]
status: complete
---

# Phase 114 Plan 01: shared browser admission

`RuntimePermissions.admit` now binds exact non-interface launch requirements to the same source- and revision-bound token as required and optional interface admission. Its one-time operation grants remain separate. `admitBrowserDocument` registers one trusted provisional source, waits for the runtime decision without committing bytes, injects the approved namespace and closed CSP into the verified HTML, revalidates immediately before a synchronous host commit, and retires a committed frame when its admission is invalidated. Abort, replacement, denial, malformed identity, and stale answers cannot commit or remove a replacement source.

The CSP builder has three modes: isolated, mediated resource, and direct network. The first two contain no remote browser origin. Direct mode omits `resource` and admits only exact origins in the seven reviewed remote-capable source directives. Frame, child, object, manifest, form, and base authority stay closed; unknown directive/options and wildcard sources fail. Required resource plus direct authority fails before prompting, while an optional resource request is omitted with a typed reason. Browser navigations still require each host's lifecycle retirement hook, which the later Paja/playground plans will wire.

## Verification

- `pnpm exec vitest run packages/runtime/src/permission-admission.test.ts packages/shell/src/browser-admission.test.ts packages/shell/src/napplet-csp.test.ts` — 76 tests passed, including real runtime prompt and grant revocation paths.
- Runtime, Firewall, and shell builds/type checks passed; `pnpm docs:check` passed.
- Changed-file `aislop@0.12.0` scan scored 100/100.

## Protocol authority

Before implementation, the exact source text was rechecked at NIP-5D PR #2303 `5560820fa4f37f45b8ab742a11aeb3001b17dc67`, NAP-RESOURCE PR #80 `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`, NAP-CONNECT PR #19 `ec81a3a4a1fc4da1ad2601215353b7f822e44b8f`, and `napplet/naps` master `19de5ce1cea40cd4c76089cdd8126e9f87648049`. The implementation follows verified-srcdoc, opaque-sandbox, domain-availability, and NAP-RESOURCE isolation requirements. The exact direct-network CSP grant taxonomy is a bounded Kehto host policy; it does not claim full NAP-CONNECT conformance while that draft's manifest-fold and response-CSP assumptions differ from current NIP-5D.
