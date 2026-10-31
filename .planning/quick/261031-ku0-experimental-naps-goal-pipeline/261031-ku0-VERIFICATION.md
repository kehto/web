---
phase: quick-261031-ku0
verified: 2026-10-31T15:09:45Z
status: passed
score: 26/26 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: false
warnings:
  - id: W1
    item: "ACC-5 branch currency"
    detail: "origin/main has advanced by 07e5ca84 'Version Packages (#366)' (merged 2026-10-31 14:41Z). It touches docs/packages/{acl,paja,runtime,services,shell}.md and packages/shell/package.json, which the branch also changes. `git merge-tree --write-tree HEAD origin/main` exits 0 (clean), and GitHub reports PR #363 MERGEABLE. Merge main (no rebase) and rerun docs:check before landing, so the docs version rows line up."
  - id: W2
    item: "HC-1 scope: open upstream draft domains"
    detail: "RESERVED_NAP_DOMAINS (packages/acl/src/extensions.ts:40-48) covers the napplet/naps registry at 43cb3a4, kehto's in-tree domains and retired names. It does not cover the domains of open upstream draft PRs (location, motion, mesh, git, capture, torrent, blossom, worker, navigation, catalog, system, connect, hashtree, nzb, soulseek, class). validateExtensionDomain('x-location'), ('x-git') and ('x-mesh') all return null. Wire shadowing is still impossible, because every bare name needs the x- prefix, and the how-to documents that the list follows the registry (experimental-nap.md:33-37). But SKILL.md:13-17 says an open-draft domain belongs in kehto and must never be built as an x- alias, while checklist.md:7 checks the registry only and the validator accepts those names. A human should decide whether to reserve open-draft domains or align the skill text with the registry-only bound."
  - id: W3
    item: "ACC-2 subagent independence after k14"
    detail: "The only independent-subagent dry run (x-counter, ia2, commit 30a03fab) predates k14's kit-grammar (IN-09) and skill-text (IN-07) changes. The post-k14 run (x-tally) was done by the ku0 executor, which had kehto context, under the plan's fallback (SUMMARY Deviation 3). I reran x-tally's vitest against the packed tarballs and got 8/8, with imports limited to @kehto/shell, @kehto/paja, vitest and node:*. I did not rerun its Paja Chromium spec (Playwright is out of scope here)."
  - id: W4
    item: "Playground extension hook is bundled-only"
    detail: "apps/playground (private) hosts only the bundled x-echo (playground-extensions.ts:134-142). A downstream developer cannot plug their own x- NAP into the playground without editing it. Paja `extensions` is the out-of-tree path. This matches the locked ia2 decision ('playground demo hooks') and the PLAN DEL-6 truth, so it is not a gap. GOAL deliverable 6 ('the same, through demo hooks') can be read more broadly than that, though."
  - id: W5
    item: "aislop below the CLAUDE.md target"
    detail: "Score 95, with exactly the five complexity rows that already exist on main, and .aislop/config.yml is unchanged vs main. The 100/100 target is not met because of that existing debt. The SUMMARY records this."
---

# Quick 261031-ku0: Verification report

**Goal (GOAL.md final block):** downstream developers can build experimental NAPs on kehto without changing any kehto package. This must be documented and shipped with an agent skill.
**Verified:** 2026-10-31T15:09:45Z on `feat/experimental-naps` at `9978be97` (equal to `origin/feat/experimental-naps`, PR #363 head)
**Status:** passed, with 5 warnings and no blockers
**Re-verification:** No. This is the initial verification for ku0.

## Independent evidence gathered

| Check | Command | Result |
|---|---|---|
| Full unit suite | `pnpm test:unit` | `Test Files 198 passed (198)`, `Tests 2549 passed (2549)`, exit 0 (matches the recorded result) |
| Targeted extension suites | `npx vitest run` on the 10 extension, fixture, skill, playground-hardening, #303 and lifetime files | `Test Files 10 passed (10)`, `Tests 140 passed (140)` |
| PR state | `gh pr view 363` | OPEN, not draft, MERGEABLE, head `9978be97` |
| PR CI | `gh pr checks 363` | Build & Type-Check, Vitest, Playwright, Detect CI/Playwright Scope and Changeset deletion guard all pass (run 41212366228, headSha `9978be97`, success) |
| CI Playwright detail | job log | All 6 `experimental-nap.spec.ts` tests passed (lines 80, 117, 135, 162, 217, 235). `paja-llm.spec.ts:51` passed. `166 passed` |
| CI docs gate | job log | `[audit:docs] OK — checked 9 public package docs…` |
| Spec refs | `gh api repos/napplet/naps/commits/master`; `gh pr view 2303 -R nostr-protocol/nips` | `43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab`; `OPEN 6e24617cde507c0a87fa170af9ed6b2b46545b2d` (both unchanged) |
| Upstream not filed | `gh search prs/issues --repo napplet/naps --author @me` ("x- prefix", "not-configured", "experimental domains") | `[]` for all three |
| Template byte-sync | `cmp` of 4 templates against the fixture; playground copy against the fixture | identical |
| Tarball skill | `npm pack --dry-run --json` in packages/shell | 8 `skills/kehto-experimental-nap/*` files; `diff -r` against the repo skill shows IDENTICAL |
| x-tally dry run | `npx vitest run` in scratch `dry-run-ku0` (deps are `file:` tarballs) | `Tests 8 passed (8)`; imports only `@kehto/shell`, `@kehto/paja`, vitest, node:* |
| aislop (recorded) | read `ku0-aislop.json` | score 95 "Healthy", 5 complexity rows (browser-host ×2, browser-intent-builder:49, cvm-nostr-transport, intent-uri:22) |
| Invariants unchanged | `git diff --quiet origin/main...HEAD` on `service-extensions.test.ts`, `nip5d-conformance-guard.test.ts`, `.aislop` | all exit 0 |
| ACL bits | `git diff origin/main...HEAD -- acl-state.ts \| grep '^+' \| grep -c '1 <<'` | `0`; last bit `CAP_LLM_GENERATE = 1 << 27` (acl-state.ts:43) |
| Commit trailers | loop over `git rev-list --no-merges origin/main..HEAD` | every commit has `Co-Authored-By` |
| Main currency | `git log HEAD..origin/main` | `07e5ca84 Version Packages (#366)` is ahead; merge-tree is clean (see W1) |

## Observable truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | DEL-1: `ShellAdapter.extensions` is validated, advertised, environment-granted and routed | VERIFIED | Type at `packages/shell/src/types.ts` (`extensions?: readonly ShellExtension[]`). Validation is `defineShellExtension`/`resolveShellExtensions` (shell-extensions.ts:145-214). Advertisement at shell-init.ts:38-42. Environment and services at shell-init.ts:58-77 and 138-140. Routing goes through `mergeExtensionServices` (hooks-adapter.ts:343-349, override refused). The bridge grant is `isDomainAllowed: shellReadyState.isDomainAllowed` (shell-bridge.ts:195-198). Tests: shell-extensions.test.ts:168 and :195 |
| 2 | DEL-1: tri-state through `getShellDomainState`, failing closed | VERIFIED | shell-init.ts:119-126 delegates to `readShellExtensionState` (shell-extensions.ts:233-242: unknown or throwing gives `disabled`). Tests: shell-extensions.test.ts:136 and :168; experimental-nap.test.ts:68 |
| 3 | DEL-1: `resolveEnvironment` narrows only | VERIFIED | `intersectInOrder(available, granted)` (shell-init.ts:69-76). Tests: shell-extensions.test.ts:217, experimental-nap.test.ts:111, and e2e Paja `deniedDTags` (spec l.126-132) and playground `setDenied` (l.217-233) |
| 4 | DEL-2: prelude bindings outside artifact bytes, per-binding scripts | VERIFIED | `renderExtensionScripts` (napplet-namespace.ts diff: one `<script data-kehto-nip5d-extension>` per exposed x- domain, handoff symbol read and deleted by the prelude, frozen host-owned object). `{ source }` is supported (shell-extensions.ts:256-271, rejecting script and comment markup). Test shell-extensions.test.ts:267 strips the injected markup and gets back the artifact exactly, and covers hijack resistance. Paja passes bindings at browser-target-frame.ts:82, 104 and 126 |
| 5 | DEL-3: x- namespace, `AclEntry.ext`, no new bits, pure acl | VERIFIED | `packages/acl/src/extensions.ts:28-275`, `types.ts` `ext?`, `deserialize` sanitizes (mutations.ts) and migrate merges deny-wins. `@kehto/acl` has no `dependencies` (peer only), and extensions.ts imports only sibling modules. Bits are unchanged |
| 6 | DEL-3: runtime ACL, firewall opClass, consent, ACL panels | VERIFIED | acl-state.ts `isKnownCapability` denies unknown strings, and x- routes through check/grant/revokeExtension. Tests: x-extension.test.ts:64 (opClass block) and :75 (ask raises one host-local `firewall-policy` consent, sends no envelope). Panels: Paja browser-devtools.ts:458 and the playground acl-panel, with e2e `[data-acl-capability="x-echo:send"]` (spec l.109, l.193) |
| 7 | DEL-4: scoped declared push with session, grant, block, ACL and firewall checks | VERIFIED | `push()` in service-extensions.ts (own domain, `handlerFor(domain) === handler`, `declaredPolicy(pushCapabilities)`, session, `isDomainAllowed`, `isBlocked`, `enforce`, `pushAdmitted`). Runtime scoping at runtime.ts:451-479: x- handlers never reach the built-in push branch. `pushAdmitted` (runtime.ts:710-714) drops on deny or ask. Tests: x-extension.test.ts:94, :127, :137, :147; x-extension-hardening.test.ts:98-131 |
| 8 | DEL-5: Paja config, options, served modules, failure isolation | VERIFIED | options.ts:38-39, 158-160, 192; config-file.ts:31-34, 67; server.ts:93 and 144-160 (pathname match, generic 404). Tests: experimental-nap.test.ts:137, :162, :183 |
| 9 | DEL-5: Paja UI tri-state, toggles, settings, log entries, simulation status, parity | VERIFIED | browser-host.ts:250-251 (simulation token), 406-440 (parity, `paja.extension.loaded`/`error`/`configured`); browser-devtools.ts:402-411 and 458. The e2e spec asserts `⚠ x-echo`, then `unconfigured`, then `supported`, then `off`, plus the log entries (l.83-103, l.141). It passed in CI |
| 10 | DEL-6: playground through demo hooks, header toggle, ACL panel, frame-loader bindings, gated hook | VERIFIED (W4) | playground-extensions.ts:134-210; main.ts:472-489 (hook gated on dev or `?kehto-test`); byte-identical x-echo copy. The e2e spec covers the playground matrix plus the ENABLE/DISABLE log (l.162-215) and the hook-off test (l.235). It passed in CI |
| 11 | DEL-7: how-to with public exports only, linked everywhere | VERIFIED | docs/how-tos/experimental-nap.md (Spec status l.20, sections 1-6, Security invariants, Promote it). All 17 link sources contain `experimental-nap`. docs/llm.md has the in-tree vs out-of-tree section (l.42-49). The skill test `the how-to imports only public @kehto/* exports` passes |
| 12 | DEL-8: skill content, invariants, When NOT, templates, shipping | VERIFIED (W2) | SKILL.md has frontmatter `name` and a trigger-rich `description`, steps 1-7, four "Rules you cannot skip", "When NOT to use this" pointing at the hosted NAP-LLM page, and a Templates table. It ships in the repo (README.md:60-76 install steps) and in the `@kehto/shell` tarball (`files: [dist, skills]`, `build` runs `scripts/copy-agent-skill.mjs`, `.gitignore` excludes the build copy) |
| 13 | HC-1: no shadowing or aliasing of reserved domains or built-in capabilities; rejection and acceptance tested | VERIFIED (W2) | `validateExtensionDomain`/`validateExtensionCapability` (extensions.ts:65-130). Tests: acl extensions.test.ts:12-44, shell-extensions.test.ts:110 and :159, the experimental-nap.test.ts:244 drift guard, e2e Paja shadow-llm refusal with `llm.generate` surviving (spec l.91-95), and playground `declare` (l.207-214) |
| 14 | HC-2: router security unchanged | VERIFIED | The #303 suite is byte-identical to main and passes. The `handleMessage` body keeps the live session, registration, `isDomainAllowed`, `isBlocked`, `enforce`, firewall(respond=false), registration/handler/lifetime/session pinning, the same-domain prefix and the `allowed()` recheck before send (service-extensions.ts:73-108). The only addition is the one-`.result` rule for x- |
| 15 | HC-3: no credentials, secrets, vault or other domains' data | VERIFIED | shell-extensions.test.ts:245 seeds `nsec-never-leaves`, `user-secret-pubkey` (l.42) and an llm `vault-secret` request, and asserts the context keys are only the 4 scoped methods and that no sentinel appears. experimental-nap.test.ts:213 shows the Paja factory gets `{ settings: { get } }` only. The trust boundary (module runs in the host page) is stated honestly at experimental-nap.md:133-137 and in security-invariants.md:30 |
| 16 | HC-4: built-ins, NAP-LLM included, unchanged with no config | VERIFIED | shell-extensions.test.ts:181 passes, and `paja-llm.spec.ts:51` passed in CI |
| 17 | HC-4: compat path warns, is tracked, is tested and has a retirement plan | VERIFIED | shell-ready.ts `warnOnEnvironmentWidening` (once per page, `[KEHTO_COMPAT_SHELL_ENV_OVERRIDE]`, names the replacement, reports only a count). docs/compatibility.md:9-36 gives the identifier, owner, old and replacement behavior, warning site, tests, reason and removal prerequisites. Tests: shell-extensions.test.ts:350 and :369; shell-environment-lifetime.test.ts passes |
| 18 | SPEC-1: refs re-checked and recorded | VERIFIED | `43cb3a4` and NIP-5D `6e24617` re-confirmed live today. The refs appear in the SUMMARY, the PR body (l.13-17, l.116) and NIP-5D-CONFORMANCE.md:327-331 |
| 19 | SPEC-2: three spec gaps documented next to the code | VERIFIED | acl extensions.ts:1-21; shell-extensions.ts:1-12; the getShellDomainState JSDoc (shell-init.ts:107-109); experimental-nap.md:20-43; NIP-5D-CONFORMANCE.md:325-353 |
| 20 | SPEC-3: upstream draft written and not filed | VERIFIED | `.planning/quick/261031-ia2-experimental-naps-on-kehto/UPSTREAM-PROPOSAL-DRAFT.md` (`# DRAFT (not filed)`, Proposals 1 and 2). The skill has `reference/upstream-proposal.md`. gh searches return `[]` |
| 21 | ACC-1: fixture outside packages/ on entry points only, with unit and Chromium matrix in both hosts | VERIFIED | `tests/fixtures/experimental-nap/` uses type-only `@kehto/shell` imports (x-echo.js:19-22). The unit matrix is at experimental-nap.test.ts:64-134. The e2e matrix covers advertisement, supports(), round trip, push observed in the frame, unconfigured to supported, ACL deny, firewall, resolveEnvironment and collision, in Paja (l.80-145) and the playground (l.162-233). All passed in CI |
| 22 | ACC-2: skill checks and dry run | VERIFIED (W3) | experimental-nap-skill.test.ts:36 (frontmatter), :53 (paths), :74 and :89 (exports), :111 (byte-identity with the fixture and playground), :120 (tarball). x-tally 8/8 reproduced. The PR body reports both dry runs (l.63, l.66) |
| 23 | ACC-3: gates | VERIFIED (W5) | unit 2549 reproduced. CI build, type-check, docs gate and Playwright are green on HEAD. aislop recorded at 95 with baseline rows only |
| 24 | ACC-4: six minor changesets, none deleted, untouched packages excluded | VERIFIED | `.changeset/experimental-naps-{acl,paja,playground,runtime,services,shell}.md` are all `minor`. No deletions. firewall, nip and wm have 0 changed files |
| 25 | ACC-5: atomic Conventional Commits, no rebase or force-push, trailers present | VERIFIED (W1) | 33 commits since `origin/main`, Conventional subjects, all with trailers. The #365 merge was no-rebase (`c3544160`). origin/main has since advanced again with a release-metadata commit (W1) |
| 26 | ACC-6: PR body has refs, spec gaps and skill location, with no stale claims; ku0 comment; CI green | VERIFIED | PR body sections at l.13 (Spec refs), l.17 (gaps), l.41 (Where the skill ships) and l.112 (ku0 subsection). No `patch changeset` text remains. The comment URL is recorded in the SUMMARY. CI is green |

**Score:** 26/26 truths verified (0 present-but-behavior-unverified). Every behavior-dependent truth (the tri-state transitions, push gating, consent, compat warning frequency and binding provenance) is covered by a passing unit test that I reran or by a Playwright spec that passed in CI on the same head.

## Key links

| From | To | Status |
|---|---|---|
| shell-init `buildShellCapabilities`/`resolveShellEnvironment`/`getShellDomainState` | shell-extensions `resolveShellExtensions`/`readShellExtensionState` | WIRED (shell-init.ts:3-7, 40, 121-122, 138) |
| shell-bridge `isDomainAllowed` | shell-ready per-frame environment | WIRED (shell-bridge.ts:195-198) |
| hooks-adapter `mergeExtensionServices` | runtime `createServiceExtensionRouter` | WIRED (hooks-adapter.ts:343-349, 393) |
| napplet-namespace `renderExtensionScripts` | shell-extensions `bindingSource` | WIRED |
| service-extensions | acl-state check, `createFirewallGate`, consent | WIRED (runtime.ts:707-714) |
| runtime `createServiceContext.sendToEligibleNapplet` | `extensions.push` | WIRED (runtime.ts:479) |
| Paja options/config-file | paja extensions normalize/rebase | WIRED |
| Paja server `serveExtensionModule` | browser-host `loadPajaExtensions`/`installPajaExtensions` | WIRED (server.ts:93; browser-host.ts:808-839) |
| playground demo-hooks/frame-loader | playground-extensions | WIRED |
| skill templates | fixture and playground copy | WIRED (byte-identical, test-guarded) |
| shell package.json | copy-agent-skill.mjs | WIRED (tarball lists 8 skill files) |
| shell-ready `warnOnEnvironmentWidening` | docs/compatibility.md entry | WIRED |

## Anti-patterns

| File | Pattern | Severity | Note |
|---|---|---|---|
| added lines in `git diff origin/main...HEAD` | TBD/FIXME/XXX | none | The only matches are planning-doc table text, not code markers |
| packages/paja/src/browser-extensions.ts:103 | `values[key]` on a plain object | Info | `settings.get('constructor')` returns a truthy inherited value. It is not a secret leak, but `Object.hasOwn` would be stricter |
| tests/unit/experimental-nap.test.ts:19-25 | imports `packages/paja/src/*` internals | Info | This is the kehto-side test; the fixture itself uses entry points only (ACC-1 holds) |
| runtime.ts:710-714 (`pushAdmitted`) | push firewall honors hard policy only (no opClass/matchers) | Info | Documented in service-types.ts:96-104. It is still stricter than built-in pushes, which skip the firewall entirely |

## Gaps summary

No blocking gaps. Every GOAL.md deliverable (1-8), hard constraint, spec-check item and acceptance item is backed by code, by tests I reran (unit 2549/2549; 140 targeted; x-tally 8/8) and by green CI on the PR head, including all 6 experimental-nap Chromium tests. Five warnings need a human decision or a routine follow-up:

- W1: merge `origin/main` (#366 Version Packages) before landing. The merge is clean.
- W2: decide whether `RESERVED_NAP_DOMAINS` should also cover open upstream draft domains, or align SKILL.md "When NOT to use" with the registry-only bound.
- W3: the independent subagent dry run predates k14; the post-k14 dry run was the executor's.
- W4: the playground hosts only the bundled x-echo. That is by design (ia2), but narrower than a broad reading of deliverable 6.
- W5: aislop is at 95 because of debt that already exists on main.

---

_Verified: 2026-10-31T15:09:45Z_
_Verifier: Claude (gsd-verifier)_

## Warning follow-up (2026-10-31)

- W1: merged origin/main `07e5ca84` (Version Packages #366) cleanly; build 32/32, type-check 17/17, unit 2549,
  docs:check OK, aislop 95 (5 rows) on the merged tree.
- W2: SKILL.md and checklist now say the validator knows only the registry and in-tree domains, and that open
  napplet/naps draft PRs must be checked by hand.
- W3: a fresh independent subagent (no kehto source access) built `x-dice` from the skill shipped in a newly
  packed @kehto/shell tarball (post-k14, post-merge): vitest 9/9, Paja Chromium 1/1, tsc clean, no friction.
- W4: kept as the recorded design (the playground hosts its bundled x-echo; Paja `extensions` is the out-of-tree route).
- W5: aislop 95 equals main; the remaining rows are pre-existing complexity debt.
