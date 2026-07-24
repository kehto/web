---
phase: quick-260724-czo
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260724-CZO]
files_modified:
  - apps/playground/src/napplet-resolver.ts
  - tests/unit/napplet-resolver.test.ts
  - tests/unit/playground-gateway-guard.test.ts
  - tests/e2e/gateway-artifact-parity.spec.ts
  - packages/paja/src/runtime-resolver.ts
  - packages/paja/src/runtime-resolver.test.ts
  - packages/paja/src/browser-host.test.ts
  - tests/unit/srcdoc-csp-parity.test.ts
  - tests/e2e/paja-runtime-pointer.spec.ts
  - apps/playground/README.md
  - packages/paja/README.md
  - docs/packages/paja.md
  - .changeset/full-srcdoc-csp.md
must_haves:
  truths:
    - "Every verified playground and Paja runtime-pointer srcdoc receives the same complete Class-1 CSP before the host-owned NIP-5D namespace prelude."
    - "The policy is exactly: default deny; inline script/style; data/blob images; data fonts; only caller-granted connect origins; explicit denial of worker, child, frame, media, object, manifest, prefetch, base, and form capabilities; and frame ancestry restricted to 'self'."
    - "An empty grant produces connect-src 'none'; non-empty grants are deduplicated and sorted, with no wildcard, self, scheme-wide, relay, Blossom, or other source added by the CSP builder."
    - "Verified bytes remain loaded through srcdoc with sandbox=\"allow-scripts\" and without allow-same-origin; CSP and namespace injection remain outside the verified artifact bytes."
    - "The public Paja behavior is documented and released as a patch; the private playground receives matching documentation without a package bump."
    - "The branch is fully verified, committed with Conventional Commit and Co-Authored-By trailers, pushed, and opened as a PR whose body tags @jodobear and does not mention the downstream reference implementation."
  artifacts:
    - path: "apps/playground/src/napplet-resolver.ts"
      provides: "Complete Class-1 meta-CSP injection for verified playground HTML"
      contains: "injectCspMeta"
    - path: "packages/paja/src/runtime-resolver.ts"
      provides: "Matching complete Class-1 meta-CSP injection for verified Paja runtime pointers"
      contains: "injectPajaRuntimeCsp"
    - path: "tests/unit/srcdoc-csp-parity.test.ts"
      provides: "Direct equality and granted-origin regression contract across both CSP builders"
      contains: "injectPajaRuntimeCsp"
    - path: "tests/e2e/gateway-artifact-parity.spec.ts"
      provides: "Browser proof of the complete policy and injection order in playground srcdoc"
      contains: "Content-Security-Policy"
    - path: "tests/e2e/paja-runtime-pointer.spec.ts"
      provides: "Browser proof of the complete policy and injection order in Paja pointer srcdoc"
      contains: "srcdoc"
    - path: ".changeset/full-srcdoc-csp.md"
      provides: "Patch release metadata for @kehto/paja"
      contains: "@kehto/paja"
  key_links:
    - from: "apps/playground/src/shell-host.ts"
      to: "apps/playground/src/napplet-resolver.ts"
      via: "injectCspMeta(resolved.indexHtml, origins) remains nested inside injectNappletNamespacePrelude"
      pattern: "injectNappletNamespacePrelude"
    - from: "packages/paja/src/browser-target-frame.ts"
      to: "packages/paja/src/runtime-resolver.ts"
      via: "runtime-pointer indexHtml and only normalized resolved relay/Blossom origins flow through injectPajaRuntimeCsp before namespace injection"
      pattern: "injectPajaRuntimeCsp"
    - from: "tests/unit/srcdoc-csp-parity.test.ts"
      to: "both CSP builders"
      via: "the extracted meta content must be byte-for-byte equal for the same granted-origin set"
      pattern: "Content-Security-Policy"
---

# Quick Task 260724-czo: Inject a full Class-1 CSP into verified srcdoc loaders

## Objective

Replace the connect-only meta policies in the verified playground and Paja
runtime-pointer loaders with one complete Class-1 baseline while retaining only
the origins explicitly granted by each caller. Preserve the current verified
bytes → CSP injection → NIP-5D namespace injection → opaque-origin srcdoc flow.

Protocol provenance is already resolved for this quick task:

- `nostr-protocol/nips` PR #2303, head
  `78efc118278e3ed42201eba9b60530b65835d7ed`, `5D.md`, requires verified bytes
  through `srcdoc` and `sandbox="allow-scripts"` without `allow-same-origin`, but
  does not define a baseline CSP.
- `napplet/naps` `origin/master` at
  `6461e4b` contains no CSP contract.

Therefore this is an explicit Kehto security-policy gap, not a NIP-5D or NAP
wire change. Do not describe the Class-1 policy as protocol-mandated.

The exact ordered policy contract is:

`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src <sorted-grants-or-'none'>; worker-src 'none'; child-src 'none'; frame-src 'none'; media-src 'none'; object-src 'none'; manifest-src 'none'; prefetch-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`

Local Paja target-URL mode is not a verified runtime-pointer artifact path and is
out of scope. Do not add this policy to that path.

## Tasks

<task type="tracer" tdd="true">
  <name>Task 1: Enforce the complete policy in the verified playground path</name>
  <files>apps/playground/src/napplet-resolver.ts, tests/unit/napplet-resolver.test.ts, tests/unit/playground-gateway-guard.test.ts, tests/e2e/gateway-artifact-parity.spec.ts</files>
  <behavior>
    - "Given no granted origins, injectCspMeta emits the exact ordered Class-1 directives with connect-src 'none' and final directive frame-ancestors 'self'."
    - "Given duplicate, unsorted origins, connect-src contains each supplied origin once in sorted order and contains no other network source."
    - "HTML with a head, only an html element, or neither still receives one policy meta inside/prepended to the document as today."
    - "Every browser-loaded playground srcdoc contains the complete policy ending in frame-ancestors 'self' before data-kehto-nip5d-injection, remains allow-scripts-only, and the resource fixture retains its explicitly granted origin."
  </behavior>
  <action>
    Update the failing playground assertions first, then change `injectCspMeta`.
    Build the meta content in the exact directive order stated in the Objective.
    Deduplicate and sort only the passed `origins`; use `connect-src 'none'` when
    the set is empty. Do not add `'self'`, `*`, protocol wildcards, default relay
    URLs, Blossom URLs, or any origin not present in the input.

    Preserve the existing insertion behavior for `<head>`, `<html>` without a
    head, and fragments. Keep `shell-host.ts` wiring unchanged:
    `injectCspMeta(resolved.indexHtml, origins)` must remain the inner operation
    and `injectNappletNamespacePrelude` the outer operation so the policy meta
    precedes the runtime bootstrap while its inline-script allowance permits the
    host-owned prelude and authored verified script.

    Strengthen the unit/static/browser tests to assert the exact directives in
    order, including final `frame-ancestors 'self'`, absence of ungranted
    sources, CSP-before-namespace order, verified srcdoc, and `allow-scripts`
    without `allow-same-origin`. Do not weaken the existing provenance or
    gateway-not-in-trust-path assertions.

    When the focused unit and browser checks are green, stage only these four
    files and create an atomic Conventional Commit such as
    `fix(playground): enforce a complete CSP on verified srcdoc`, including
    useful `Tested:`, `Directive:`, and
    `Co-Authored-By: Codex <noreply@openai.com>` trailers.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/unit/napplet-resolver.test.ts tests/unit/playground-gateway-guard.test.ts &amp;&amp; pnpm exec playwright test tests/e2e/gateway-artifact-parity.spec.ts --workers=1</automated>
  </verify>
  <done>The playground's real verified srcdoc path carries the exact complete policy before namespace injection, exposes only its granted connect origins, retains opaque-origin sandboxing, and the first atomic commit is green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Give Paja the identical policy and prove cross-loader parity</name>
  <files>packages/paja/src/runtime-resolver.ts, packages/paja/src/runtime-resolver.test.ts, packages/paja/src/browser-host.test.ts, tests/unit/srcdoc-csp-parity.test.ts, tests/e2e/paja-runtime-pointer.spec.ts</files>
  <behavior>
    - "injectPajaRuntimeCsp emits the same exact ordered Class-1 meta content as injectCspMeta for identical grant sets, ending with frame-ancestors 'self'."
    - "Paja deduplicates and sorts the passed grants, emits connect-src 'none' for an empty set, and never adds a source on its own."
    - "The runtime-pointer browser path derives grants only from its resolved relay and Blossom server lists, injects CSP before the namespace prelude, and stays in about:srcdoc with allow-scripts-only sandboxing."
    - "The non-verified target-URL path retains its existing base/namespace behavior and is not given the runtime-pointer CSP."
  </behavior>
  <action>
    Add failing Paja and parity tests first. Expand `injectPajaRuntimeCsp` to the
    exact same ordered policy while preserving `escapeAttribute`, current
    `<head>`/`<html>`/fragment insertion, and origin deduplication/sorting.

    Add `tests/unit/srcdoc-csp-parity.test.ts` as the drift gate: import both
    exported builders, extract the Content-Security-Policy meta value, and prove
    byte-for-byte equality for empty and non-empty duplicate/unsorted grants.
    Also prove that the resulting `connect-src` set is exactly the supplied set.

    Extend Paja's existing source guard and `paja-runtime-pointer.spec.ts` to
    assert the complete ordered policy through the final
    `frame-ancestors 'self'` directive,
    CSP-before-`data-kehto-nip5d-injection` ordering, `about:srcdoc`, and
    opaque-origin sandbox. Keep
    `browser-target-frame.ts` nesting and `connectOrigins([...relays,
    ...blossomServers])` unchanged. Add a guard that local target-URL mode still
    omits this verified-artifact CSP rather than broadening the quick task.

    When focused Paja, parity, and browser checks are green, stage only these
    five files and create a second atomic Conventional Commit such as
    `fix(paja): match the verified srcdoc CSP baseline`, with `Tested:`,
    `Directive:`, and `Co-Authored-By: Codex <noreply@openai.com>` trailers.
  </action>
  <verify>
    <automated>pnpm exec vitest run packages/paja/src/runtime-resolver.test.ts packages/paja/src/browser-host.test.ts tests/unit/srcdoc-csp-parity.test.ts &amp;&amp; pnpm exec playwright test tests/e2e/paja-runtime-pointer.spec.ts --workers=1</automated>
  </verify>
  <done>Playground and Paja return byte-for-byte identical complete CSP content for equal grants, Paja's verified runtime-pointer browser path receives it before namespace injection, no ungranted origin appears, and the target-URL path remains unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: Align docs, add release metadata, run full gates, and open the PR</name>
  <files>apps/playground/README.md, packages/paja/README.md, docs/packages/paja.md, .changeset/full-srcdoc-csp.md</files>
  <action>
    Update the playground README plus Paja package and generated-site package
    docs to state that verified srcdoc loads receive the complete local Class-1
    baseline before the host-owned namespace prelude. List the directive
    categories: default denial; inline script/style; data/blob image and data
    font rendering; caller-granted connections; explicit worker/child/frame/
    media/object/manifest/prefetch/base/form denial; and the final
    `frame-ancestors 'self'` restriction. Explain that `connect-src` contains
    only caller-granted origins. Keep the wording explicit that NIP-5D fixes the
    verified srcdoc/opaque sandbox contract while the CSP baseline is Kehto
    policy.

    Add `.changeset/full-srcdoc-csp.md` with an `@kehto/paja: patch` entry for
    the shipped runtime-pointer hardening. Do not add a changeset for the private
    playground, and do not bump another package because no other shipped package
    output changes.

    Run the focused checks again, then the complete repository gates:
    `pnpm build`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:e2e`,
    `pnpm docs:check`, `pnpm audit:csp`,
    `pnpm dlx aislop@0.12.0 scan --changes --base origin/main`, and
    `git diff --check`. The AI-slop result must be 100/100. The CSP audit must
    continue proving authored napplet distributions contain no CSP meta while
    the host injects policy after verification.

    Commit the four release/documentation files with a Conventional Commit and
    `Tested:`, `Directive:`, and
    `Co-Authored-By: Codex <noreply@openai.com>` trailers. Confirm the branch
    contains only task-owned changes, push `fix/full-srcdoc-csp`, and open a PR.
    The PR body must tag `@jodobear`, cite both checked refs and the intentional
    policy-gap conclusion, summarize the exact policy and granted-origin rule,
    list verification output, and avoid mentioning the downstream product,
    project, or implementation used as behavioral reference. Read the PR back
    with `gh pr view --json url,state,headRefName,headRefOid,body` and confirm its
    head OID equals the pushed local HEAD.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/unit/napplet-resolver.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/srcdoc-csp-parity.test.ts packages/paja/src/runtime-resolver.test.ts packages/paja/src/browser-host.test.ts &amp;&amp; pnpm exec playwright test tests/e2e/gateway-artifact-parity.spec.ts tests/e2e/paja-runtime-pointer.spec.ts --workers=1 &amp;&amp; pnpm build &amp;&amp; pnpm type-check &amp;&amp; pnpm test:unit &amp;&amp; pnpm test:e2e &amp;&amp; pnpm docs:check &amp;&amp; pnpm audit:csp &amp;&amp; pnpm dlx aislop@0.12.0 scan --changes --base origin/main &amp;&amp; git diff --check</automated>
  </verify>
  <done>Docs and the Paja patch changeset match the shipped policy; all focused and full gates pass with AI-slop 100/100; atomic commits are pushed; and an open PR at the pushed head tags @jodobear, cites the checked protocol refs, and contains no downstream implementation reference.</done>
</task>

## Threat model

### Trust boundaries

| Boundary | Description |
|---|---|
| Verified artifact → host-generated srcdoc | Signed and hash-verified HTML becomes executable only after host policy and namespace injection. |
| Granted origins → CSP meta | Caller-selected relay, Blossom, or static origins become the only permitted network egress sources. |
| CSP meta → opaque iframe runtime | Browser enforcement must precede both host-owned bootstrap and authored script execution. |

### STRIDE threat register

| Threat ID | Category | Component | Severity | Disposition | Mitigation plan |
|---|---|---|---|---|---|
| T-czo-01 | Elevation of privilege | Both CSP builders | high | mitigate | Install the exact default-deny Class-1 directives, deny worker, child, frame, media, object, manifest, prefetch, base, and form capabilities, and finish with `frame-ancestors 'self'`. |
| T-czo-02 | Information disclosure | `connect-src` construction | high | mitigate | Use only deduplicated/sorted caller grants; empty grants become `'none'`; parity and browser tests reject implicit sources. |
| T-czo-03 | Tampering | CSP/namespace injection order | high | mitigate | Preserve CSP as the inner transform and namespace prelude as the outer transform; assert CSP appears first in both real srcdoc paths. |
| T-czo-04 | Tampering | Cross-loader policy drift | medium | mitigate | Directly compare extracted policy values for equal inputs and assert the same exact directive list in both E2E paths. |
| T-czo-05 | Denial of service | Inline host/runtime bootstrap under strict CSP | medium | mitigate | Retain only the required inline script/style allowances and prove the mandatory namespace/handshake paths still boot in Playwright. |
| T-czo-06 | Information disclosure | `img-src data: blob:` and `font-src data:` | low | accept | These non-network sources are the deliberate Class-1 rendering allowance; all remote defaults remain denied. |

## Source coverage audit

| Source | Item | Coverage |
|---|---|---|
| GOAL | Complete matching Class-1 CSP in both verified srcdoc loaders | Tasks 1-2 |
| REQ | QUICK-260724-CZO: preserve only granted `connect-src` origins | Tasks 1-2 |
| RESEARCH | NIP-5D PR #2303 requires verified srcdoc plus opaque `allow-scripts` sandbox but defines no baseline CSP | Objective, Tasks 1-3 |
| RESEARCH | `napplet/naps` master `6461e4b` has no CSP contract | Objective, Task 3 |
| CONTEXT | Preserve namespace injection order and verified-byte provenance | Tasks 1-2 |
| CONTEXT | Add regression coverage and release metadata | Tasks 1-3 |
| CONTEXT | Full gates, AI-slop 100/100, atomic commits, push, and PR | Task 3 |
| CONTEXT | PR tags @jodobear and omits downstream implementation references | Task 3 |

No source item is deferred or missing. No dependency or package installation is
introduced.

## Stop conditions

Do not push or open the PR, and report the task incomplete, if any of these is
true:

- playground and Paja do not emit byte-for-byte identical policy content for
  the same grants;
- either verified browser srcdoc lacks any directive in the exact Class-1
  contract, omits final `frame-ancestors 'self'`, or places another directive
  after it;
- `connect-src` contains any source not supplied by the owning caller;
- CSP no longer precedes namespace injection, or either iframe gains
  `allow-same-origin`;
- local Paja target-URL mode is unintentionally brought into the verified
  runtime-pointer policy scope;
- any focused/full gate fails, AI-slop is below 100/100, the pushed OID differs
  from local HEAD, or the PR body violates its tag/provenance constraints.

## Success criteria

- Both verified srcdoc paths receive the same complete policy while preserving
  only granted `connect-src` origins.
- Existing content verification, source provenance, namespace injection, and
  opaque-origin sandbox behavior stay intact.
- Unit, static, parity, and browser regressions make policy drift fail closed.
- Public docs and the `@kehto/paja` patch changeset match the behavior.
- All repository gates pass, changes are committed atomically and pushed, and
  the open PR satisfies the requested tagging and wording constraints.

## Output

Create
`.planning/quick/260724-czo-inject-a-full-class-1-csp-into-verified-/260724-czo-SUMMARY.md`
when execution is complete.
