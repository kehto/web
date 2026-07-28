---
phase: 106
status: published
pr_readiness_checked_at: 2026-07-27T16:15:00Z
publication_checked_at: 2026-07-28T10:24:00Z
current_napplet_publication_checked_at: 2026-07-28T18:55:51Z
authority_verdict: conformant
tested_branch: chore/napplet-scheme-conformance
tested_source_sha: b2f4c2b80bd62586d28917239de6b93a299d5aa2
release_source_sha: b61b8cf5e4e40859b0fba6c6e690dc9726f03431
release_run: 30389303760
---

# Phase 106 Release Checklist

This checklist preserves Phase 106's original PR-readiness evidence and its
then-applicable execution boundary. Those plans did not authorize merge,
release metadata creation, tagging, or publishing. The separate post-merge
closure below records the later authorized publication and must not be confused
with the earlier PR-readiness verdict.

## Current-Napplet corrective publication — 2026-07-28

The earlier 0.29 publication was successful but ceased to satisfy Phase 106's
downstream terminal condition after `@napplet/core@latest` and
`@napplet/nap@latest` advanced to 0.31.0. PR #211 had no package changeset, so
its merge could not queue a compatibility release. The corrective source PR
adds explicit release intent, adopts the packaged canonical 0.31 contracts,
and completes the protected source → Version Packages → release sequence.

- **Protocol authority:** merged `napplet/naps` master
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`, especially
  `naps/NAP-INTENT.md`, `naps/NAP-INC.md`, and `naps/NAP-SHELL.md`. The
  implementation is conformant; no Kehto-only protocol extension was used.
- **Canonical Napplet source:** `napplet/web`
  `7b675622e13870628ce174833d7b2a33cf32a0ab` for canonical INC/INTENT
  alignment and release commit
  `03ad65b66413e5798536ef48695ffc4c2508f2c3`.
- **Corrective source and Changeset:** [PR
  #220](https://github.com/kehto/web/pull/220) merged as
  `9390eca7d294375e8330730c411ed5aef74a7a61`. Its explicit Changeset covered
  all eight packages whose shipped output or compatibility metadata changed:
  ACL, CLI, firewall, NIP, Paja, runtime, services, and shell.
- **Source exact-main gates:** [CI
  #30387669270](https://github.com/kehto/web/actions/runs/30387669270),
  [Pages #30387670585](https://github.com/kehto/web/actions/runs/30387670585),
  and [AI Slop Badge
  #30387669702](https://github.com/kehto/web/actions/runs/30387669702) all
  succeeded on exact source SHA `9390eca7d294375e8330730c411ed5aef74a7a61`.
- **Generated release metadata:** [Version Packages PR
  #221](https://github.com/kehto/web/pull/221) merged as exact release source
  `b61b8cf5e4e40859b0fba6c6e690dc9726f03431`. Its generated package,
  changelog, JSR, documentation-version, and Changeset-deletion checks passed.
- **Release exact-main gates:** [CI
  #30388794341](https://github.com/kehto/web/actions/runs/30388794341),
  [Pages #30388794322](https://github.com/kehto/web/actions/runs/30388794322),
  and [AI Slop Badge
  #30388796044](https://github.com/kehto/web/actions/runs/30388796044) all
  succeeded on exact release source
  `b61b8cf5e4e40859b0fba6c6e690dc9726f03431`.
- **Publication:** authorized [Release
  #30389303760](https://github.com/kehto/web/actions/runs/30389303760)
  completed successfully on that exact SHA. Its npm OIDC and topologically
  ordered JSR publish steps both passed.

### Current public registry versions

Direct npm and JSR `latest` queries returned the same intended versions:

| Package | npm `latest` | npm Napplet peer range | JSR `latest` |
| --- | --- | --- | --- |
| `@kehto/acl` | `0.17.0` | core/nap `>=0.31.0 <0.32.0` | `0.17.0` |
| `@kehto/cli` | `0.4.0` | core/nap `>=0.31.0 <0.32.0` | `0.4.0` |
| `@kehto/firewall` | `0.5.0` | core `>=0.31.0 <0.32.0` | `0.5.0` |
| `@kehto/nip` | `0.5.0` | — | `0.5.0` |
| `@kehto/paja` | `0.10.0` | core/nap `>=0.31.0 <0.32.0` | `0.10.0` |
| `@kehto/runtime` | `0.20.0` | core/nap `>=0.31.0 <0.32.0` | `0.20.0` |
| `@kehto/services` | `0.18.0` | core/nap `>=0.31.0 <0.32.0` | `0.18.0` |
| `@kehto/shell` | `0.19.0` | core/nap `>=0.31.0 <0.32.0` | `0.19.0` |

Paja's published JSR metadata pins the matching internal Kehto releases and
maps `@napplet/core` plus `@napplet/nap` to `^0.31.0`.

### Current clean downstream proof

A new temporary npm project, with no workspace overrides or existing lockfile,
successfully installed `@kehto/paja@latest`, `@napplet/core@latest`, and
`@napplet/nap@latest`. It resolved Paja/core/nap as
`0.10.0`/`0.31.0`/`0.31.0`, deduplicated Napplet through Paja's complete Kehto
dependency graph, and reported zero vulnerabilities. Direct ESM import and a
179.2 KiB Node-platform esbuild bundle both exposed the public
`startPajaServer` function.

## Prior 0.29 post-merge publication closure — 2026-07-28

At that point, the initial registry-publication gap was closed for the Napplet
0.29 package line. This section is retained as historical evidence; the
current-Napplet terminal proof is the corrective publication recorded above.

- **Source PR:** [PR #204](https://github.com/kehto/web/pull/204) merged as
  `b85db51db838866de753b275b9d34ec908785bd2`.
- **Planning closeout:** [PR #210](https://github.com/kehto/web/pull/210)
  merged as `c3cc7f27ea4681e8b3334a5b109e228c97ff96a8`.
- **Release metadata:** generated [Version Packages PR
  #209](https://github.com/kehto/web/pull/209) merged as
  `4eafa058d18cf245b23d49b23bc29dda0b7d7651`.
- **Release-gate repair:** [PR #211](https://github.com/kehto/web/pull/211)
  merged as the exact release source
  `54ef2ead03ee0c37783727468b8658b6dc224137`.
- **Exact-main validation:** [CI
  #30299386244](https://github.com/kehto/web/actions/runs/30299386244)
  completed successfully on that exact SHA, including build, type-check, docs,
  Vitest, and Playwright. [Pages
  #30299386308](https://github.com/kehto/web/actions/runs/30299386308)
  also completed its artifact build, audit, and deployment successfully on the
  same SHA.
- **Publication:** authorized [Release
  #30350331202](https://github.com/kehto/web/actions/runs/30350331202)
  completed successfully on that exact SHA. Its npm OIDC publish and
  topologically ordered JSR publish steps both passed.

### Public registry versions

Direct npm `latest` and JSR `latest` queries returned the same intended
versions:

| Package | npm `latest` | npm Napplet peer range | JSR `latest` |
| --- | --- | --- | --- |
| `@kehto/acl` | `0.16.0` | core/nap `>=0.29.0 <0.30.0` | `0.16.0` |
| `@kehto/cli` | `0.3.0` | core/nap `>=0.29.0 <0.30.0` | `0.3.0` |
| `@kehto/firewall` | `0.4.0` | core `>=0.29.0 <0.30.0` | `0.4.0` |
| `@kehto/paja` | `0.9.0` | core/nap `>=0.29.0 <0.30.0` | `0.9.0` |
| `@kehto/runtime` | `0.19.0` | core/nap `>=0.29.0 <0.30.0` | `0.19.0` |
| `@kehto/services` | `0.17.0` | core/nap `>=0.29.0 <0.30.0` | `0.17.0` |
| `@kehto/shell` | `0.18.0` | core/nap `>=0.29.0 <0.30.0` | `0.18.0` |

The published JSR `jsr.json` files use the matching internal Kehto versions.
Where packages directly import the Napplet contracts, their maps use
`jsr:@napplet/core@^0.29.0` and `jsr:@napplet/nap@^0.29.0`; Paja 0.9.0's
published JSR metadata directly confirms both mappings.

### Clean downstream proof

A new temporary npm project, with no workspace overrides or existing lockfile,
successfully ran:

```text
npm install @kehto/paja@latest @napplet/core@latest @napplet/nap@latest
```

The resolved top-level versions were Paja `0.9.0`, core `0.29.0`, and nap
`0.29.0`; npm deduplicated core/nap through Paja's Kehto dependency graph with
no peer-resolution error. A dynamic ESM import of `@kehto/paja` passed, and
esbuild produced a non-empty 182,507-byte Node-platform bundle from the
installed Paja entry point.

## Final local release gate — validated source

- **Validated branch/source:** `chore/napplet-scheme-conformance` at
  `b2f4c2b80bd62586d28917239de6b93a299d5aa2`.
- **Target-main synchronization:** fetched `origin/main` at
  `dd79b04122c94ab63a08b856c377eb2e807f6644`; that commit is the merge-base
  and an ancestor of the validated source SHA. No merge, rebase, or rewritten
  history was needed.
- **Authority:** `node scripts/verify-napplet-authorities.mjs --check` — exit
  0 (`PR #89-#92 and five published packages reconciled`). The verified
  upstream refs remain the merged `napplet/naps` master
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`, NAP-INC #89 current head
  `e0cd5848abb70a7450ed0eabfef9e8d04f4b41b3` (semantic verdict:
  conformant), governance/web #90 `896c32c92deee68dc4d10fc1132b62df20cccb6f`,
  open NAP-INTENT #91 `a718915ddefa2f03a0126579601f59d8bd86f7c4`, and
  symmetric channels #92 `c5cd06f7be6d4690b303949abb26e87ff62f4729`.
- **Build:** `pnpm build` — exit 0 (32 Turbo tasks successful).
- **Type check:** `pnpm type-check` — exit 0 (32 build and 17 type-check
  tasks successful).
- **Unit tests:** `pnpm test:unit` — exit 0; 125 files / 1,571 tests passed.
- **Focused browser E2E:** the seven-file command below — exit 0; 9 passed.
- **Full browser E2E:** `pnpm test:e2e` — exit 0; 80 tests ran with the only
  allowed skip being `tests/e2e/paja-runtime-pointer.spec.ts`, guarded by
  `PAJA_LIVE_POINTER_TEST` because it requires live Nostr relays and Blossom.
- **Docs:** `pnpm docs:check` — exit 0; TypeDoc, VitePress, and all 9 public
  package docs passed the audit.
- **AI-slop:** exactly `npx --yes aislop@0.12.0 scan -d` — exit 0; scanner
  version 0.12.0, 244 files, 100/100 clean run (3 configured suppressions).
- **Whitespace/index safety:** `git diff --check`, `git diff --quiet`, and
  `git diff --cached --quiet` — exit 0.
- **Changesets:** `pnpm changeset status` — exit 0; its expected minor output
  includes the seven locked packages below (plus separately retained patch
  entries for `@kehto/playground` and `@test/harness`).

## Authority and focused unit evidence

- Authority verdict: [conformant Phase 106 authority revalidation](./106-AUTHORITY-REVALIDATION.md).
- Focused conformance matrix: [47 requirements / 9 files / 94 tests passed](./106-CONFORMANCE-MATRIX.md).
- The full release gate, changeset accounting, target-main CI evidence, and PR
  check state are deliberately unexecuted at this task boundary.

## Focused real-shell browser evidence

- **Command:** `pnpm test:e2e -- tests/e2e/napplet-auth.spec.ts tests/e2e/inc-roundtrip.spec.ts tests/e2e/nap-inc-playground.spec.ts tests/e2e/identity-flow.spec.ts tests/e2e/theme-broadcast.spec.ts tests/e2e/playground-profile-intent.spec.ts tests/e2e/profile-open.spec.ts`
- **Started:** `2026-07-27T15:54:41Z`
- **Finished:** `2026-07-27T15:54:58Z`
- **Duration:** 17 seconds (including the repository `test:build` prerequisite)
- **Exit status:** 0
- **Playwright result:** 9 passed, 0 failed, 0 skipped, one configured worker.
- **Tested branch/source:** `chore/napplet-scheme-conformance` at `1302489f71a2a065bf314d729128f27d852629b4`.

| Required flow class | Real-shell test result | Trust-boundary evidence exercised |
| --- | --- | --- |
| Pre-session and domain-gated shell startup | `tests/e2e/napplet-auth.spec.ts` — `chat napplet reaches ready state at :4174`; `bot napplet reaches ready state at :4174` — PASS | The built playground frames complete the host-owned `shell.ready`/`shell.init` startup path; no page-visibility-only substitute was used. |
| Exact INC event and symmetric-channel routing | `tests/e2e/inc-roundtrip.spec.ts` — `chat input triggers inc envelope; bot reply appears in chat messages`; `tests/e2e/nap-inc-playground.spec.ts` — `two live playground frames retain exact NAP-INC events and symmetric channel lifecycle` — PASS | The live sibling frames exercise exact event routing plus symmetric handles, retained closures, and trusted parent/source ordering. |
| URI-authoritative, buffered, source-independent intent delivery | `tests/e2e/playground-profile-intent.spec.ts` — `accepts the feed profile convention before its source closes and cold-starts one profile delivery without INC`; `tests/e2e/profile-open.spec.ts` — `profile-viewer receives the published profile convention from the feed frame` — PASS | The accepted `napplet:profile/open` delivery survives source closure, cold-starts the verified target once, and proves `intent.deliver` without an `inc.*` carrier. |
| Identity sign-out and resource-mediated revocable media | `tests/e2e/identity-flow.spec.ts` — `profile-viewer waits for NAP-INTENT delivery instead of reading identity directly` — PASS | The real profile frame exposes canonical identity/intent APIs while rejecting direct identity access and legacy signer/Nostr terms; the Phase 105 verified profile path remains resource-mediated and revocable rather than remote-image based. |
| State-before-one-push atomic theme updates | `tests/e2e/theme-broadcast.spec.ts` — `clicking host dark button stores then pushes one complete theme through the injected API`; `a required-theme profile reads current state and receives one matching change` — PASS | A forged sibling `shell.ready` produces no update; eligible frames receive exactly one complete stored theme and `theme.get()` observes the same atomic value. |

## Allowed-skip evidence

No test was skipped in this run. The existing optional live-network Good Morning
Protocol case was not part of this focused seven-file command, so there is no
optional skip to record here. Any mandatory skip or failure would have blocked
this checklist.

## Changeset audit

`.changeset/phase-105-published-package-line.md` remains byte-unchanged and
contains exactly these minor entries: `@kehto/acl`, `@kehto/cli`,
`@kehto/firewall`, `@kehto/paja`, `@kehto/runtime`, `@kehto/services`, and
`@kehto/shell`. The unrelated historical changesets inspected and preserved
unchanged are `phase-102-acl-inc`, `phase-102-runtime-inc`,
`phase-102-services-inc`, `phase-102-shell-inc`, `phase-103-acl-identity-theme`,
`phase-103-paja-identity-theme`, `phase-103-runtime-identity-theme`,
`phase-103-services-identity-theme`, and `phase-103-shell-identity-theme`.
No changeset was added, combined, edited, or deleted by Phase 106-03.

## PR and release state at this task boundary

| Item | State |
| --- | --- |
| PR #204 URL/head/check state | Existing [PR #204](https://github.com/kehto/web/pull/204) was verified to target `chore/napplet-scheme-conformance`; pushed-head/check evidence remains the next task. |
| Seven-package changeset state | Exact, preserved, and accepted by `pnpm changeset status` as recorded above. |
| Branch synchronization | `origin/main` `dd79b04122c94ab63a08b856c377eb2e807f6644` is an ancestor of the validated source SHA; no synchronization commit was needed. |
| Full build/type/unit/docs/AI-slop gate | Every required local gate passed on validated source `b2f4c2b80bd62586d28917239de6b93a299d5aa2`; PR push/check evidence remains pending. |

## First pushed evidence — green CI

- **Pushed evidence SHA:** `07d044c473b5520424f22f094266053749e972ad`
  (`docs(106): record final release gates`). PR #204's `headRefOid` equalled
  this SHA before its checks were evaluated.
- **CI run:** [CI #30283262028](https://github.com/kehto/web/actions/runs/30283262028)
  completed successfully for this exact SHA.
- **Required PR checks:** [Detect CI Scope](https://github.com/kehto/web/actions/runs/30283262028/job/90034649715)
  — PASS; [Build & Type-Check](https://github.com/kehto/web/actions/runs/30283262028/job/90034682977)
  — PASS; [Detect Playwright Scope](https://github.com/kehto/web/actions/runs/30283262028/job/90034682993)
  — PASS; [Vitest](https://github.com/kehto/web/actions/runs/30283262028/job/90034683107)
  — PASS; [Playwright](https://github.com/kehto/web/actions/runs/30283262028/job/90035043561)
  — PASS.
- **Changeset protection:** [Changeset deletion guard](https://github.com/kehto/web/actions/runs/30283261976/job/90034649244)
  — PASS. The `Verify generated JSR metadata is synced` build sub-step was
  intentionally scope-skipped because this is not a generated Version Packages
  change.
- **Final-head caveat:** the next evidence commit changes only this checklist;
  PR #204 must be rechecked at its new exact head before it may be called
  merge-ready.

## UI audit disposition — explicit non-blocking protocol-release debt

The [Phase 105 UI audit](../105-published-convention-adoption-and-host-flows/105-UI-REVIEW.md)
scored the Paja and playground hosts **12/24** from automated desktop (1280×720)
and mobile (375×812) captures. This is **not a visual pass or visual sign-off**.
It remains visible, non-blocking protocol-release debt because the focused Phase
106 evidence proves the protocol/runtime behavior required for PR #204 without
claiming that its hosts meet the audit's visual bar.

- **recoverability:** profile/feed denial, unavailable, and not-found states lack
  keyboard-accessible retry or reconnect actions; Paja can expose an unstyled raw
  target-load error.
- **Legibility and type scale:** embedded status, label, and metadata content is
  commonly 9–10px, below a robust readable default.
- **Semantic tokens and spacing:** Paja and embedded napplets retain hard-coded
  colors and ungoverned pixel increments instead of a shared token and spacing
  scale.
- **Mobile composition:** the playground's tall sparse topology loses hierarchy
  at 375px, while Paja hides target context, clips dense controls, and wraps its
  footer into fragments.

**Owner and scope:** Kehto maintainers own a separately scoped post-merge UI
follow-up. Phase 106 includes no broad UI redesign, token migration, or visual
approval. The functional and security dependency record remains the [Phase 105
verification](../105-published-convention-adoption-and-host-flows/105-VERIFICATION.md)
and the [closed Phase 105 ASVS L1 report (29/29 threats,
0 open)](../105-published-convention-adoption-and-host-flows/105-SECURITY.md).

## Original Plan 106-02 boundary (historical)

The authorized endpoint for Phase 106 is a green, merge-ready
[PR #204](https://github.com/kehto/web/pull/204). This Plan 106-02 does not
claim the final PR head/check state or mergeability; that evidence remains
pending the Plan 106-03 release gate. It does not authorize merge of PR #204,
creating a Version Packages PR, exact-target-`main` CI confirmation, a tag,
`release.yml` dispatch, or any publish operation.

The following are informational, unexecuted post-merge steps owned by the
release process:

1. A Kehto maintainer merges the green PR #204.
2. After `main` CI is green, `publish.yml` creates or updates the generated
   Version Packages PR.
3. The generated release-metadata guard verifies docs package-version rows and
   JSR metadata, then a maintainer merges that Version Packages PR.
4. The maintainer identifies the exact target `main` SHA and verifies the CI
   run for that same SHA before release.
5. Only then may a maintainer push the release tag or dispatch `release.yml`,
   which is the sole npm/JSR publisher.
