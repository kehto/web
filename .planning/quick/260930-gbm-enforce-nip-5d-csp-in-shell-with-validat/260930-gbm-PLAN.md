---
mode: quick-full
status: planned
must_haves:
  truths:
    - Shell owns a default CSP and validates host changes against NIP-5D constraints.
    - Verified Paja and playground output use the same shell preparation path.
    - Policy precedes all authored content and the mandatory shell bootstrap.
    - Host overrides remain possible without permitting broad JavaScript evaluation or wildcard connections.
  artifacts:
    - packages/shell/src/napplet-csp.ts
    - packages/shell/src/napplet-srcdoc.ts
    - tests/e2e/shell-csp.spec.ts
  key_links:
    - Paja and playground frame loaders call prepareNappletSrcdoc after resolution verifies artifacts.
    - Public shell exports include policy options and preparation functions.
---

# Shared NIP-5D CSP enforcement

## Context and authority

The user explicitly requires host-customizable CSP with the NIP-5D SHOULDs
enforced by the shell. Discussion is complete; implement without another approval.
Run the GSD quick planning/checking/execution/verification workflow inline.

Checked `dskvr/nips/5D.md` at `24711d9c47bbdd07908bf1d52bf677d9cbc530f0`
and `napplet/naps/naps/NAP-SHELL.md` on master at
`a040914b4bbd3a5cd8a14b0f316a723c968ebfb2` before implementation.
CSP is owned by NIP-5D, not a new NAP domain. NAP-SHELL handshake semantics stay
unchanged. The example baseline is configurable, not normative in every detail.

Kehto promotes CSP insertion before authored content and the recommendation
against wildcard/scheme-wide connect sources to enforced policy. Explicit host
network grants remain allowed. Broad `unsafe-eval` is rejected. Meta-unsupported
directives are rejected rather than presented as effective protection. Hosts must
set embedding restrictions on their HTTP response. Shell preparation accepts only
already-verified artifact HTML; existing resolver verification, identity binding,
sandboxing and source trust remain required and covered by existing guards.

Low-level bootstrap render/injection utilities remain available for development
wrappers. Verified hosts use the combined preparation API, which has no CSP opt-out.
Host-authored policies already inside the artifact remain additional restrictions;
the helper must never remove or weaken them. Keep the prelude executable when
validating script overrides. Defaults allow WASM but hosts may restrict it.

Initial tree: main at a7e0d12, with unrelated package.json workspaces addition.
Preserve that edit and exclude it from all commits. Branch: feat/shell-csp-policy,
created from freshly fetched origin/main.

## Tasks

### 1. Public shell policy and preparation API
- Files: shell CSP/srcdoc implementation, exports, unit/browser tests.
- Action: typed directive overrides, exact-origin connection grants, defensive
  serialization, first-head insertion and combined CSP/bootstrap preparation.
  Do not locate insertion points in arbitrary authored comments or scripts.
- Verify: unit tests for defaults, allowed changes, rejected policies, malformed
  HTML, mutation safety; real browser checks for WASM, blocked eval/network/worker,
  retained authored restrictions, overrides, bootstrap ordering and parent trust.
- Done: package consumers get the same enforcement as the reference hosts.

### 2. Reference host migration
- Files: Paja/playground resolvers and frame loaders, Paja runtime config, tests.
- Action: delegate compatibility CSP helpers to shell; use combined preparation
  in verified iframe paths; expose Paja host overrides and preserve development
  mode. Normalize relay URL hints to origins before granting direct connections.
- Verify: parity, config and conformance guards; browser tests for both hosts.
- Done: no duplicated policy construction; verification still precedes injection.

### 3. Docs, release and shipping
- Files: shell/Paja/playground docs, conformance policy, changeset, GSD records.
- Action: document the enforcement/default/override mapping and exact spec refs;
  changesets for shell and Paja; record verification and ship an open PR.
- Verify: build, type-check, unit suite, Playwright, docs:check, AI-slop gate.
- Done: atomic commits pushed, PR opened, unrelated work remains untouched.

## Plan check

All user requirements map to the three tasks. Tests include runtime browser
enforcement, not just CSP string comparisons. No new NAP message or dependency is
needed. Security review must include parser ordering, directive injection, origin
normalization, prelude suppression and existing-policy intersection.
