---
slug: resource-bytes-policy-denial
status: resolved
trigger: "The live shell trace reports resource.bytes.error blocked-by-policy after the NAP-RESOURCE server-hint implementation; the canonical Napplet packages have now been released."
created: 2026-08-26
updated: 2026-08-26
---

# Debug: Resource bytes policy denial

## Symptoms

**Expected:** A napplet using the canonical NAP-RESOURCE API supplies its ordered
Blossom server hints and receives verified ROM bytes.

**Actual:** The shell trace records `resource.bytes.error` with
`blocked-by-policy`.

**Error messages:** `resource.bytes.error blocked-by-policy`

**Timeline:** Observed after Kehto's draft-aware host implementation was opened
as PR #251, while the installed Napplet package line still emitted the legacy
resource request shape.

**Reproduction:** Load the affected napplet through the shell/Paja path and let
it request its `blossom:sha256:` ROM resource with the server list declared by
the napplet.

## Current Focus

hypothesis: Confirmed. The live napplet imported the legacy shim, which replaced
Kehto's hint-aware host projection and emitted a URL-only `resource.bytes`;
Paja then had no accepted Blossom candidate and returned `blocked-by-policy`.
test: Upgrade the complete Napplet package matrix to core/nap 0.32.0, shim
0.30.0, and SDK 0.28.0; consume the packaged resource contract; restore the
normal shim path; and verify both the installed shim output and the browser flow.
expecting: Confirmed. The canonical shim emits `servers`, the reference service
forwards them only for `blossom:`, and Paja attempts accepted public HTTPS hints
before configured defaults.
next_action: None; the implementation and release evidence are verified.

## Authority

- NAP-RESOURCE exact ref `9511232f69313aa7953d110e35d32cc28d506f66`; server-hint semantic commit `75312589cdc5012be0ac09d7aa87e265564d3bf8`.
- Packaged implementation merge `19e0029b228127769a0ebdcf0b6b2f30293bd284` (napplet/web PR #206).
- Published npm targets: `@napplet/core@0.32.0`, `@napplet/nap@0.32.0`, `@napplet/shim@0.30.0`, and `@napplet/sdk@0.28.0`.
- Successful Publish run `32994902759` at release-fix head `b007587a`.

## Evidence

- timestamp: 2026-08-26
  finding: The screenshot shows a correlated `resource.bytes.error` with `blocked-by-policy`, proving the request reaches the resource domain but no resolver candidate succeeds.
  confirms: This is downstream of capability discovery and upstream of successful byte delivery.
- timestamp: 2026-08-26
  finding: Before publication, npm exposed core 0.31.1, nap 0.31.2, shim 0.29.2, and SDK 0.27.2; that shim line emits legacy resource requests without the new server metadata.
  confirms: Kehto's host projection could be overwritten by a package shim that could not express the draft contract.
- timestamp: 2026-08-26
  finding: Publish run `32994902759` succeeded and npm now exposes core/nap 0.32.0, shim 0.30.0, and SDK 0.28.0 with `ResourceBytesRequest`, `ResourceInfo.maxServers`, and canonical bulk `requests` exports.
  confirms: The package boundary is cleared and Kehto can migrate to the official contract.
- timestamp: 2026-08-26
  finding: The installed shim 0.30.0 runtime emits `servers` on single requests and canonical per-resource `requests` on bulk requests; the resource demo now imports that shim and the published resource SDK normally.
  confirms: The package assignment no longer downgrades Kehto's hint-aware host projection.
- timestamp: 2026-08-26
  finding: Focused contract tests passed 124/124, unit tests passed 1706/1706, and Playwright passed 84/84 including the real resource-demo browser path.
  confirms: The package graph, host/service/Paja routing, and browser integration remain coherent.

## Eliminated

- Waiting for package publication: all required npm versions are now public with registry integrity metadata.

## Resolution

root_cause: The previously published `@napplet/shim@0.29.2` installed a legacy
  NAP-RESOURCE projection that could not serialize Blossom server hints. A
  napplet importing it replaced Kehto's hint-aware projection, leaving Paja
  without an eligible server and producing `blocked-by-policy`.
fix: Adopt the published core/nap 0.32.0, shim 0.30.0, and SDK 0.28.0 graph;
  consume canonical resource types; restore the resource demo's normal shim and
  SDK imports; and pin source, merge, release, and publication evidence in the
  regression guards and policy docs.
verification: `pnpm build`; `pnpm type-check`; focused Vitest 124/124;
  `pnpm test:unit` 145 files / 1706 tests; `pnpm docs:check`; AI-slop 100/100;
  `pnpm test:e2e` 84/84.
files_changed: Napplet dependency manifests and lockfile; resource service and
  shell resource types; playground resource demo; contract/conformance guards;
  package and policy documentation; changeset.
