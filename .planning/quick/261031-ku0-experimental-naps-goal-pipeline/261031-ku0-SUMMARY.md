---
quick_id: 261031-ku0
phase: quick-261031-ku0
plan: 01
subsystem: experimental-naps
tags: [nap, x-extensions, acl, runtime, shell, paja, playground, spec-gap]
status: complete
branch: feat/experimental-naps
tasks_complete: [1, 2, 3, 4, 5, 6, 7]
tasks_pending: []
requirements: [DEL-1, DEL-2, DEL-3, DEL-4, DEL-5, DEL-6, DEL-7, DEL-8, HC-1, HC-2, HC-3, HC-4, SPEC-1, SPEC-2, SPEC-3, ACC-1, ACC-2, ACC-3, ACC-4, ACC-5, ACC-6]
key-files:
  modified:
    - packages/runtime/src/x-extension.test.ts
    - packages/shell/src/shell-init.ts
    - docs/policies/NIP-5D-CONFORMANCE.md
    - tests/unit/experimental-nap.test.ts
    - tests/e2e/experimental-nap.spec.ts
    - skills/kehto-experimental-nap/SKILL.md
    - skills/kehto-experimental-nap/reference/checklist.md
    - docs/how-tos/experimental-nap.md
    - tests/unit/experimental-nap-skill.test.ts
decisions:
  - "The skill links the NAP-LLM wiring guide by its hosted URL, because repo-relative kehto paths dangle in downstream checkouts"
  - "Downstream skill users scope vitest to *.test.ts, so the Playwright Paja spec template is not collected"
  - "main f5c3ee82 (#365) was merged into feat/experimental-naps (no rebase, no force-push), and every gate was rerun on the merged tree"
pr_comment: https://github.com/kehto/web/pull/363#issuecomment-6544893756
actuals:
  tokens: 38818
  tasks: 7
  commits: 8
---

# Quick 261031-ku0: Experimental NAPs goal, full pipeline pass, Summary

Evidence-backed audit of the GOAL.md final prompt block on `feat/experimental-naps` (PR #363).
Tasks 1-5 were run by one executor and Tasks 6-7 by a later one. This file collects per-task
evidence (command and result), the fixes made and the commits.

## Tasks 1–5

Run 2026-10-31 14:17Z to 14:28Z on `feat/experimental-naps`, starting at `3b551b67`. Merge base
with `origin/main` is `0cfe30ee`, and `git log HEAD..origin/main` was empty at the start.

### Spec refs (SPEC-1)

| Ref | Value | Result |
|---|---|---|
| napplet/naps master | `43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab` (`gh api repos/napplet/naps/commits/master --jq .sha`) | Unchanged from planning, so the refs stand |
| Documents read at that SHA | `naps/NAP-SHELL.md` (154 lines), `projections/web.md` (97), `README.md` (274) | NAP-SHELL: `capabilities` in `shell.init` (`"capabilities": { "domains": [...] }`, l.96), `supports(domain)` is a local projection query (l.32, l.56). web.md: discovery is "Presence of `window.napplet.<domain>`, injected before napplet scripts run" (l.21) |
| Spec-gap grep | `grep -inE "experimental\|x-[a-z]\|extension\|unconfigured\|not-configured\|not configured"` over the three files | One hit only, `Outbox-aware` in the README registry (an `x-` substring false positive). No experimental prefix, no extension capabilities, no interface configuration state, which confirms the three spec gaps |
| Registry vs `RESERVED_NAP_DOMAINS` | Registry domain column: `config cvm display identity inc intent keys link media notify outbox pow relay resource shell storage theme upload value` | All 19 present in `packages/acl/src/extensions.ts` (loop printed no `MISSING`) |
| NIP-5D | nostr-protocol/nips#2303, `OPEN`, head `6e24617cde507c0a87fa170af9ed6b2b46545b2d` | Same head as the existing `Source pins` section of the NIP-5D policy |

**Result:** discovery and advertisement are conformant: an x- domain appears in `capabilities.domains`,
there is a host-injected `window.napplet[<domain>]`, and `supports()` is a local presence query.
Experimental naming (`x-`), extension capabilities (`x-<domain>:<action>`) and the host-only
`unconfigured` state are three bounded Kehto spec-gap policies.

### Task 1: acl and runtime (SPEC-1, SPEC-2, DEL-3, DEL-4, HC-1, HC-2)

| Step | Command | Result |
|---|---|---|
| Spec check | see the Spec refs table | master `43cb3a4` unchanged; NIP-5D head `6e24617` |
| ACL bits untouched | `grep -v '^[[:space:]]*//' packages/runtime/src/acl-state.ts \| grep -c '1 << 2[89]'` | `0`. The last bit is `CAP_LLM_GENERATE = 1 << 27` (l.43) |
| No bit added on branch | `git diff origin/main...HEAD -- packages/runtime/src/acl-state.ts \| grep '^+' \| grep -c '1 <<'` | `0` |
| acl pure, zero deps | `node -e "process.exit(Object.keys(require('./packages/acl/package.json').dependencies ?? {}).length)"` | exit 0. `extensions.ts` imports only `./capabilities.js`, `./check.js`, `./types.js` |
| acl rejection and acceptance tests | `grep` in `packages/acl/src/extensions.test.ts` | All five named cases present (l.12, 16, 33, 38, 44) |
| #303 suite byte-identical | `git diff --quiet origin/main...HEAD -- packages/runtime/src/service-extensions.test.ts` | exit 0 |
| Router diff is additive | `git diff origin/main...HEAD -- packages/runtime/src/service-extensions.ts` | For non-`x-` domains `declaredPolicy` keeps the old rule (own `messageCapabilities` key, explicit `null` or an `ALL_CAPABILITIES` string). Live session, registration, lifetime, ACL/enforce, firewall, same-domain response prefix and the `allowed()` recheck before send are all still on the path. Added: `x-` domains gate only on their own `x-` capability, an `x-` reply is exactly one `<type>.result`, and scoped `push()` |
| Gap: x- ask consent | `grep -n "'ask'" packages/runtime/src/x-extension.test.ts` (before) | No match, so the gap was confirmed |
| Fix | Added `raises host-local consent once for an x- capability under ask policy` to `x-extension.test.ts` | Under `ask`: consent called once with `{ type: 'firewall-policy', windowId, napplet: dTag }`, handler not called, `sent` empty (no invented envelope). The second request dispatches once with exactly one `x-echo.say.result`. Passed with no runtime change, so this is regression coverage only and needs no changeset |
| Suites | `npx vitest run packages/acl/src packages/runtime/src/acl-state.test.ts packages/runtime/src/x-extension.test.ts packages/runtime/src/x-extension-hardening.test.ts packages/runtime/src/service-extensions.test.ts packages/runtime/src/llm-dispatch.test.ts` | `Test Files 10 passed (10)`, `Tests 299 passed (299)` |
| Build and type-check | `pnpm turbo run build type-check --filter=@kehto/runtime...` | `Tasks: 6 successful, 6 total` |

Commit: `dd8de3b3` test(runtime): cover firewall ask consent for x- capability routes.

### Task 2: shell (DEL-1, DEL-2, HC-1, HC-3, HC-4, SPEC-2)

| Step | Evidence | Result |
|---|---|---|
| DEL-1 advertisement | `shell-init.ts` `buildShellCapabilities` l.38-42 | Adds each `shellExtensions(hooks)` domain unless it is in `disabledDomains` or `readShellExtensionState` returns `disabled` |
| Fail closed | `shell-extensions.ts` `readShellExtensionState` l.233-242 | Unknown values and a throwing `state()` give `disabled` |
| Service registration | `hooks-adapter.ts` `mergeExtensionServices` l.343-349 | `resolveShellExtensions(..., Object.keys(services))` refuses overrides. Test `shell-extensions.test.ts:163` expects `/cannot override/` |
| Bridge grant | `shell-bridge.ts` l.195-198 | `isDomainAllowed: shellReadyState.isDomainAllowed` reads the per-frame environment from `resolveShellEnvironment` |
| DEL-2 prelude | `shell-extensions.test.ts:267` `builds window.napplet[x-echo] outside the artifact bytes and stays host-owned`; `:340` `renders no binding for domains the frame does not expose` | Pass. Stripping the meta and `data-kehto-nip5d-(extension\|injection)` scripts gives back the artifact exactly |
| Paja target path | `grep -n extensions packages/paja/src/browser-target-frame.ts` | l.82 `getShellExtensionBindings(adapter.extensions, domains)`, passed to `prepareNappletSrcdoc(resolvedTarget.indexHtml, …)` at l.104 and to `injectNappletNamespacePrelude` at l.126 |
| HC-3 | `shell-extensions.test.ts:245` `never hands an extension credentials, signer secrets or other domains' data` | Pass |
| HC-4 built-ins | `shell-extensions.test.ts:181` `keeps built-in domains, NAP-LLM included, unchanged without extension config`, plus the llm cases in `shell-init.test.ts` and `shell-bridge.test.ts` | Pass |
| Compat path | describe `originRegistry.setEnvironment compatibility (KEHTO_COMPAT_SHELL_ENV_OVERRIDE)` (l.346), plus `shell-environment-lifetime.test.ts` | Pass. `docs/compatibility.md` "Frame environment widening — shell" has the identifier, owner, old and replacement behavior, the warning site (`shell-ready.ts` `warnOnEnvironmentWidening`, once per page), the regression tests, the reason for retention and the removal prerequisites |
| Gap: JSDoc spec-gap label | The `getShellDomainState` JSDoc had no "spec gap" phrase | Fixed: added a paragraph saying `unconfigured` is a bounded Kehto spec-gap policy, because napplet/naps `43cb3a4` defines no interface state and wire advertisement stays binary. Doc only, covered by the existing shell minor changeset |
| Gap: NIP-5D policy | `grep -n "ShellAdapter.extensions" docs/policies/NIP-5D-CONFORMANCE.md` found nothing | Fixed: added an `### Experimental x- extensions` subsection under the #303 section. It records the refs (`43cb3a4`, NIP-5D head `6e24617`), the conformance result, the three bounded policies and the provenance rule (separate `data-kehto-nip5d-extension` scripts, verified bytes through `prepareNappletSrcdoc`, gateway untrusted). No allowlist row was added |
| Guard unchanged | `git diff --quiet origin/main...HEAD -- tests/unit/nip5d-conformance-guard.test.ts` | exit 0 |
| Suites | `npx vitest run packages/shell/src/shell-extensions.test.ts packages/shell/src/shell-environment-lifetime.test.ts packages/shell/src/shell-init.test.ts packages/shell/src/shell-bridge.test.ts packages/shell/src/napplet-namespace.test.ts tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-gateway-guard.test.ts` | `Test Files 7 passed (7)`, `Tests 184 passed (184)` |
| Greps | `KEHTO_COMPAT_SHELL_ENV_OVERRIDE` in compatibility.md and shell-ready.ts; `data-kehto-nip5d-extension` in the policy (l.347); `sed -n 90,116p shell-init.ts \| grep -ic "spec gap"` | All hit (`1`) |
| Build and type-check | `pnpm turbo run build type-check --filter=@kehto/shell...` | `Tasks: 10 successful, 10 total` |

Commit: `58c3244b` docs(shell): record experimental x- extension spec-gap policy and srcdoc provenance.

### Task 3: Paja (DEL-5, HC-1, HC-3, HC-4)

| Step | Evidence | Result |
|---|---|---|
| Config, options, served modules | `tests/unit/experimental-nap.test.ts`: `serves the configured module and loads it into a settings-backed extension`, `resolves config-relative module paths and reports policy failures without breaking others`, `matches extension routes on the pathname and answers a generic 404 … (IN-06)` | Pass |
| HC-3 for Paja | `hands a factory only settings, never vault, signer or other host state`; `keys stored settings by domain, not module file name (WR-07)` | Pass |
| UI wiring | `browser-host.ts` `attachPajaExtensions` l.406-440 | Parity through `getUnexpectedAdvertisedDomains(…, loaded domains)`, `paja.extension.loaded`/`error`/`configured` log entries, and `setSimulationStatus` writes `<domain>:<state\|off>` (l.247-252) |
| Gap: browser assertions for status and log | `grep -n "simulation-status\|paja.extension.configured" tests/e2e/experimental-nap.spec.ts` (before) | No match, so the gap was confirmed |
| Fix (e2e) | Paja test 1: `#simulation-status` contains `x-echo:unconfigured` (l.87), then `x-echo:supported` after save (l.102), and there is exactly one `paja.extension.configured` entry (l.103). Toggle test: `x-echo:off` after disabling (l.141) | UI agreed; no source change |
| Gap: HC-1 drift guard | No test tied the Paja domain lists to `RESERVED_NAP_DOMAINS` | Fixed: `reserves every domain Paja advertises or simulates, and rejects its x- alias`. Every `PAJA_ADVERTISED_DOMAINS` and `PAJA_SIMULATION_DOMAINS` entry is in `RESERVED_NAP_DOMAINS`, and `validateExtensionDomain` rejects both the bare name and its `x-` alias. Passed; no domain was missing |
| Unit suites | `npx vitest run tests/unit/experimental-nap.test.ts packages/paja/src/{options,config-file,parity,server,browser-host,browser-llm-vault,browser-llm-connections}.test.ts` | `Test Files 8 passed (8)`, `Tests 88 passed (88)` |
| Build | `pnpm build` | `Tasks: 32 successful, 32 total` |
| Paja e2e | `npx playwright test tests/e2e/experimental-nap.spec.ts --project chromium --workers=1 -g "x-echo in Paja"` | `3 passed (7.9s)` |
| HC-4 e2e | `npx playwright test tests/e2e/paja-llm.spec.ts --project chromium --workers=1` | `1 passed (4.0s)` |

Commit: `c0935f0e` test(paja): assert extension simulation status, configured log and reserved-domain coverage.

### Task 4: playground (DEL-6, HC-4)

| Step | Evidence | Result |
|---|---|---|
| Demo hooks | `demo-hooks.ts` l.316-323 | `extensions: getPlaygroundExtensions()`, `disabledDomains` merged with `getDisabledPlaygroundExtensionDomains()`, `resolveEnvironment` goes through `resolvePlaygroundExtensionEnvironment` |
| Frame loader | `playground-frame-loader.ts` l.143-147 | `prepareNappletSrcdoc(resolved.indexHtml, { domains, extensions: getPlaygroundExtensionBindings(domains), … })` |
| ACL panel | `acl-panel.ts` l.237-248 | x- rows come from the explicit decision, otherwise `adapter.defaultCheck(cap)` |
| Header control and log | `main.ts` l.115-121 | `addSystemMessage(\`${enabled ? 'ENABLE' : 'DISABLE'} extension ${domain} …\`)` |
| Test hook gate | `main.ts` l.472 | Exposed only in dev or with `?kehto-test` |
| Byte identity | `cmp apps/playground/src/extensions/x-echo.js tests/fixtures/experimental-nap/x-echo.js` | Identical |
| Types | `npx tsc -p apps/playground/tsconfig.json --noEmit` (after build) | exit 0, `0` errors, so there are none in the 10 branch-changed playground files |
| Gap: toggle log assertion | `grep -n "ENABLE extension x-echo" tests/e2e/experimental-nap.spec.ts` (before) | No match, so the gap was confirmed |
| Fix (e2e) | In the playground matrix test, after the save: toggle off, expect `data-state=disabled` and `napplet-debugger` to contain `DISABLE extension x-echo`; toggle on, expect `supported` and `ENABLE extension x-echo` (l.179-186). Enabled state restored before the rest | Message renders; no source change |
| Unit | `npx vitest run tests/unit/playground-experimental-nap-hardening.test.ts tests/unit/playground-gateway-guard.test.ts` | `Test Files 2 passed (2)`, `Tests 23 passed (23)` |
| e2e | `pnpm build && npx playwright test tests/e2e/experimental-nap.spec.ts tests/e2e/playground-usability-controls.spec.ts tests/e2e/acl-revoke-relay-write.spec.ts tests/e2e/acl-revoke-storage-write.spec.ts tests/e2e/demo-audit-correctness.spec.ts tests/e2e/demo-service-toggle.spec.ts --project chromium --workers=1` (ports 4173/4174 were free, so Playwright started fresh preview servers) | `20 passed (34.1s)`, including all 6 experimental-nap tests |

Commit: `854b2ebb` test(playground): assert extension toggle log entries.

### Task 5: fixture and acceptance matrix (ACC-1, HC-1)

| Step | Command | Result |
|---|---|---|
| Import gate | `grep -rhoE "from '[^']+'\|import\('[^']+'\)" tests/fixtures/experimental-nap \| sort -u \| grep -vE "'(@kehto/(shell\|paja)\|vitest\|@playwright/test\|node:[a-z/]+\|\./[A-Za-z0-9._-]+)'" \| (! grep .)` | Prints nothing. The specifiers are `./x-echo.js`, `@kehto/paja`, `@kehto/shell`, `@playwright/test`, `node:http`, `node:url`, `vitest`, `import('@kehto/shell')` |
| Fixture in CI | `vitest.config.ts` include `tests/fixtures/experimental-nap/*.test.ts` | Present |
| Fixture and unit | `pnpm build && npx vitest run tests/fixtures/experimental-nap tests/unit/experimental-nap.test.ts` | `Test Files 2 passed (2)`, `Tests 21 passed (21)`, including `type-checks against the published @kehto/shell and @kehto/paja declarations` |
| Chromium e2e (Task 4 run, same tree) | Task 4's e2e command | All 6 experimental-nap tests passed |
| Chromium e2e (Task 5 rerun) | `npx playwright test tests/e2e/experimental-nap.spec.ts --project chromium --workers=1` | `5 passed, 1 failed`. The failure is environmental (see below) |

**Environmental note (Task 5 rerun).** Between the Task 4 and Task 5 runs, another process started
a playground **vite dev server** on 127.0.0.1:4174. This executor did not start it: PID 88941,
parent `pnpm --filter @kehto/playground exec vite --host 127.0.0.1 --port 4174 --strictPort`,
reparented to PID 1, cwd `apps/playground`. `reuseExistingServer` therefore served dev mode, where
`__kehtoPlaygroundExtensions__` is exposed on purpose. So
`keeps the extension test hook off without ?kehto-test (IN-05)` failed (`Expected: false, Received: true`)
while the other five passed. This executor did not kill it, because it does not own it. The same spec
passed 6/6 in Task 4 against the Playwright-launched preview, and no source or spec change was made
after that run. Task 7 should check `lsof -nP -iTCP:4174 -sTCP:LISTEN` and stop that dev server
before running the full e2e gates.

#### ACC-1 acceptance matrix

Lines refer to `tests/unit/experimental-nap.test.ts` (unit) and `tests/e2e/experimental-nap.spec.ts`
(Paja and playground) at `854b2ebb`.

| Scenario | Shell unit | Paja e2e (Chromium) | Playground e2e (Chromium) |
|---|---|---|---|
| Advertisement | `is advertised, answers supports(), …` l.71 (`buildShellCapabilities` domains), l.73 (`shell.init` `capabilities.domains` contains `x-echo`) | `advertises, configures, …` l.84 (toggle `data-state=unconfigured`), l.91 (`say: 'function'`) | `advertises, configures, round-trips, …` l.167 (toggle state), l.157 (`chatFrame` polls `typeof say === 'function'`) |
| `supports()` | `supports()` is a local presence query on `window.napplet` (NAP-SHELL l.56; `napplet-namespace.ts` l.355). The binding is rendered for an exposed domain (`renders its binding into the prelude only`, l.131) and not for an unexposed one (`shell-extensions.test.ts:340`) | l.90-91 `shell.supports('x-echo') === true`; l.130-131 `false` when withheld | l.169-172 `shell.supports('x-echo') === true` |
| Request/response | `round-trips a request and delivers the push event` l.85-86 (`x-echo.say.result` `> hello`) | l.106 `say('hi') === 'ok:echo>hi'` | l.189 `say('hi') === 'ok:pg>hi'` |
| Push event (observed in frame) | l.87 `x-echo.heard` posted to the frame window after the result | l.107 `expect.poll(() => heard(frame)).toEqual(['echo>hi'])` through `onHeard` in the frame | l.190 `expect.poll(() => heard(frame)).toEqual(['pg>hi'])` |
| Unconfigured to supported | l.74 `unconfigured`, l.76 `not-configured` result, l.78 `supported` | l.84-85 `⚠ x-echo`, l.87 status `unconfigured`, l.97 `error:not-configured`, l.100 `supported`, l.102 status `supported`, l.103 configured log | l.167-168 `⚠ x-echo`, l.174 `error:not-configured`, l.177 `supported` |
| ACL deny | `honors ACL deny for the request and for the push separately` l.96 (push dropped after `x-echo:listen` revoke), l.99 (request dropped after `x-echo:send` revoke) | l.109-112 `[data-acl-capability="x-echo:send"]` off, `say` gives `timeout`; regranted at l.114 | l.193-196 `#chat-acl [data-acl-capability="x-echo:send"]` off, `timeout`; regranted at l.198 |
| Firewall block | `is dropped by a firewall block without an invented envelope` l.105-107 (`opClass: 'x-echo:send'` block, no replies) | `drops x-echo under a firewall deny …` l.119 (`firewall.mode: 'deny'`), l.124 `timeout` | l.201-202 `setFirewallPolicy('chat','deny')`, `timeout`; l.204 `allow` restores |
| resolveEnvironment disable | `is withheld from a frame whose resolveEnvironment disables it` l.116 (not in `shell.init` domains), l.118 (request not routed) | l.126-131 `deniedDTags` feeds `resolveEnvironment`: `{ present: false, supports: false }`; l.132 `missing` | `withholds x-echo from one napplet through resolveEnvironment` l.222 `setDenied`, l.232 chat has no `x-echo` while preferences keeps it |
| Collision rejection | `rejects a colliding declaration` l.124 (`domain: 'llm'` throws `ShellExtensionError`), l.125 (declared twice) | l.94 `[data-extension-failure="shadow-llm.js"]` "reserved NAP domain", l.95 one `paja.extension.error`, l.91 built-in `llm.generate` survives | l.207-214 `declare('llm' \| 'x-llm' \| 'x-echo' \| 'x-new')` gives reserved / aliases llm / declared twice / `null` |

No cell is empty. The shell-unit `supports()` cell is indirect by design: `supports()` runs in the
napplet frame. The unit layer proves its input (the binding is present only for exposed domains),
and both Chromium hosts call `supports()` directly. No fixture change was needed, so template
byte-sync is untouched.

No commit (no files changed).

### Deviations (Tasks 1–5)

- **Task 1:** the x- ask-consent regression passed on first run, so no runtime fix and no changeset
  amendment was needed.
- **Tasks 3 and 4:** the new e2e assertions passed against the existing UI. No source changes, so
  no changeset amendments.
- **Task 5:** the Chromium rerun hit a foreign dev server on port 4174 (see the environmental note).
  This is not a code defect. Recorded rather than fixed, because the process is not owned by this
  executor.
- The pre-existing `as unknown as` casts in the playground e2e block (l.201-222) were left alone,
  and no new double assertions or `new Function` were added. No aislop config change.

### Commits (Tasks 1–5)

| Task | Commit | Message |
|---|---|---|
| 1 | `dd8de3b3` | test(runtime): cover firewall ask consent for x- capability routes |
| 2 | `58c3244b` | docs(shell): record experimental x- extension spec-gap policy and srcdoc provenance |
| 3 | `c0935f0e` | test(paja): assert extension simulation status, configured log and reserved-domain coverage |
| 4 | `854b2ebb` | test(playground): assert extension toggle log entries |
| 5 | none | evidence only |

Not pushed. PR #363 was not touched (Tasks 6-7).

### Self-check (Tasks 1–5): PASSED

All four commits exist on `feat/experimental-naps`. Each carries the `Co-Authored-By: Claude Opus 5.5`
trailer and deletes no files. The branch was not switched. The only untracked path is this ku0
planning directory, which Task 7 commits.

## Tasks 6–7

Run 2026-10-31 14:30Z to 14:50Z on `feat/experimental-naps`, starting at `854b2ebb`. `$S` means the
session scratchpad, `/private/tmp/claude-501/-Users-sandwich-Develop-kehto/93aa7a20-a5bc-46bf-b056-42efe2bbf04d/scratchpad`.

### Task 6: how-to, links, skill, upstream draft and the dry run (DEL-7, DEL-8, ACC-2, SPEC-3)

| Step | Command | Result |
|---|---|---|
| Gap: how-to export check | `grep -n "imports only public" tests/unit/experimental-nap-skill.test.ts` (before) | No match, so the gap was confirmed |
| Fix | Added `the how-to imports only public @kehto/* exports`. It parses every `import { … } from '@kehto/…'` block in `docs/how-tos/experimental-nap.md`, requires a bare `@kehto/<name>` specifier, and checks each name against `exportedNames(packages/<name>/src/index.ts)` | Passed on first run (two `@kehto/shell` blocks at l.47 and l.155), so this is regression coverage |
| Gap: dangling NAP-LLM path | `grep -n "docs/llm.md" skills/kehto-experimental-nap/SKILL.md` | l.16, so the gap was confirmed |
| Regression first | Extended `links only to files that exist`: any backticked relative file path (``/`([\w.-][\w./-]*\/[\w./-]*\.(?:md\|ts\|js\|json\|mjs))`/``) must resolve inside the skill directory. Routes (leading `/`), `@scope/name` specifiers, globs and placeholders are skipped | RED: `SKILL.md names docs/llm.md, which does not exist in the skill` (1 failed, 6 passed) |
| Fix | `docs/llm.md` replaced by `<https://kehto.github.io/web/docs/llm.html>` (`docs/.vitepress/dist/llm.html` exists after `docs:check`) | GREEN: `Tests 7 passed (7)` |
| Link loop | `for f in <17 sources>; do grep -c experimental-nap "$f"; done` | All 17 files ≥ 1, `missing=0`. Every `docs/packages/*.md` and package README link is absolute `https://kehto.github.io/web/docs/how-tos/experimental-nap.html`. `docs/llm.md` l.45-49 has the in-tree vs out-of-tree contrast |
| Skill content | Read SKILL.md | Frontmatter `name` and a trigger-rich `description` (asserted by the test). Steps 1-7 cover name and collision check, wire contract and `messageCapabilities`/`pushCapabilities`, capabilities, implementation (service, push, binding, `state()`), registration (`ShellAdapter.extensions`, Paja), tests and upstream. Four "Rules you cannot skip", a "When NOT to use this" pointing to NAP-LLM wiring, and the Templates table are present |
| Shipping | `grep -n skills README.md packages/shell/README.md` | Root README l.62-76 (install via `node_modules/@kehto/shell/skills` or `degit`). `packages/shell/README.md` l.334-335 says the package ships the skill under `skills/`. The test asserts `files` contains `skills` and that `build` runs `copy-agent-skill.mjs` |
| Dangling-path grep (plan verify) | `grep -rnE '`[A-Za-z0-9._-]+/…\.(md\|ts\|js\|json\|mjs)`' SKILL.md reference \| grep -vE '`(templates\|reference)/'` | No output |
| SPEC-3 draft | `UPSTREAM-PROPOSAL-DRAFT.md` l.1 | `# DRAFT (not filed)`. Proposal 1 is the `x-` prefix with no `x-<registered>` aliases (l.16-25); Proposal 2 is the `not-configured` state (l.28+). The skill's `reference/upstream-proposal.md` is the downstream template |
| SPEC-3 search | `gh search prs --repo napplet/naps --author @me "experimental" --json number,title` | `[{"number":98,"title":"NAP-DISPLAY: register the draft interface"}]`, which is unrelated (merged, created 2026-08-20) |
| SPEC-3 search | `gh search issues --repo napplet/naps --author @me "not-configured" --json number,title` | `[]`, so nothing from this work is filed |
| docs gate | `pnpm docs:check` | `[audit:docs] OK — checked 9 public package docs …` |

**Dry run (ACC-2).**

| Step | Command | Result |
|---|---|---|
| a. Pack | `pnpm build`, then `pnpm --dir packages/<p> pack --pack-destination $S/tarballs-ku0` for acl, firewall, runtime, services, shell, nip, wm and paja | 8 tarballs (acl 0.20.0, firewall 0.6.1, nip 0.8.0, paja 0.26.0, runtime 0.27.0, services 0.27.0, shell 0.26.0, wm 0.0.2) |
| a. Skill in tarball | `tar -tzf kehto-shell-0.26.0.tgz \| grep -c package/skills/kehto-experimental-nap/` | `8`: SKILL.md, 3 reference files, all 4 templates. Extracted to `$S/skill-ku0`; `diff -r` against `skills/kehto-experimental-nap` reports IDENTICAL |
| b. Template run | `$S/templates-run-ku0`: the 4 templates copied verbatim (`cmp` OK), `npm init -y`, every tarball as a dependency plus an `overrides` entry, `@napplet/core`/`@napplet/nap` 0.32.0, `nostr-tools` 2.23.3, `vitest` 4.1.2, `@playwright/test` 1.59.1, `typescript` 5.9.3 (all lockfile versions), `@types/node` 22.20.5 | `package-lock.json` resolves every `@kehto/*` to `file:../tarballs-ku0/…` |
| b. vitest (first) | `npx vitest run` | **Friction:** `FAIL x-echo.paja.spec.ts: Playwright Test did not expect test.beforeAll() to be called here`. Vitest's default include collects `*.spec.ts`. `x-echo.test.ts` passed 6/6 |
| b. Playwright | `npx playwright test --project chromium` | `1 passed` |
| d. Fix | `38e72465`: SKILL.md step 6, `reference/checklist.md` and the how-to's test section tell users to scope vitest to `*.test.ts` (`test: { include: ['**/*.test.ts'] }`). The path guard skips globs. Templates are unchanged, so fixture and playground byte-sync are untouched | Skill test 7/7 |
| d. Rerun b | Rebuilt, repacked shell, re-extracted (IDENTICAL), fresh `npm install` (shipped SKILL.md matches the repo), `vitest.config.ts` added as the skill now says | vitest **6/6** (1 file), Paja Chromium **1/1** |
| c. x-tally | `$S/dry-run-ku0`: scaffolded from `$S/skill-ku0` alone. `validateExtensionDomain('x-tally')` gives `null`, both `x-tally:count`/`x-tally:watch` give `null`, `x-relay` gives `aliases the reserved NAP domain relay`. Module `x-tally.js`: `x-tally.add {id, amount}` → `.result {id, total, unit}`, push `x-tally.changed {total, unit}`, `unconfigured` until a `unit` setting exists | — |
| c. vitest | `npx vitest run` | **8/8**: name checks, tri-state, advertised plus `not-configured`, add plus push, `invalid-request` contract error, ACL deny silent, push dropped on `x-tally:watch` revoke, `relay` shadow rejected |
| c. Paja Chromium | `npx playwright test --project chromium` | **1/1**: `unconfigured` toggle, `supports('x-tally')`, `not-configured`, settings save, `supported`, two adds (2, 5) with pushes `['2 votes','5 votes']` |
| c. tsc | `npx tsc -p .` (strict, `checkJs`, `@types/node`) | Clean, no output |

Friction notes:
1. The vitest include also collected the Playwright spec. This was a skill defect, fixed in `38e72465`.
2. `@types/node` is not a direct kehto dependency (the lockfile has only the transitive 12.20.55), so the
   dry run used 22.20.5, as the ia2 run did.
3. The binding's `kit.request('add')` and `kit.on('changed')` take the short action name. Only the template
   shows this, and the prose does not spell it out, but copying the template got it right.

There was no other friction. Both test templates adapted by search and replace, and every documented
Paja element id worked as written.

### Task 7: changesets, gates, commits, push and PR #363 (ACC-3, ACC-4, ACC-5, ACC-6)

| Step | Command | Result |
|---|---|---|
| Branch | `git branch --show-current` | `feat/experimental-naps` |
| Currency | `git fetch origin && git log --oneline HEAD..origin/main` | **main moved**: `f5c3ee82 fix(deps): admit @napplet/nap 0.35.x and core 0.36.x in published peer ranges (#365)` |
| Merge | `git merge --no-edit origin/main` | Only `.planning/STATE.md` conflicted (`last_activity_desc`), resolved to the newer l9b line. Commit `c3544160` (parents `38e72465` and `f5c3ee82`). No rebase, no force-push. `HEAD..origin/main` is now empty |
| Changed packages | `git diff --name-only origin/main...HEAD -- packages apps \| cut -d/ -f1-2 \| sort -u` | `apps/playground packages/acl packages/paja packages/runtime packages/services packages/shell`. firewall, nip and wm: 0 files |
| Minor | `grep -L ': minor' .changeset/experimental-naps-*.md` | No output, so all six are minor |
| None deleted | `git diff --diff-filter=D --name-only origin/main...HEAD -- .changeset` | No output |
| Status | `pnpm changeset status --since=origin/main` | Minor: acl, paja, playground, runtime, services, shell. Patch: `@kehto/cli` and `@test/harness`, which are dependent bumps (they appeared before the merge too; no changeset names them) |
| Wording | Re-read all six against the final behavior | Accurate. ku0's only shipped-output change is SKILL.md text inside the `@kehto/shell` tarball, which the existing shell minor changeset already covers ("ships the `kehto-experimental-nap` agent skill"). No amendment |
| build | `pnpm build` | `Tasks: 32 successful, 32 total` |
| type-check | `pnpm type-check` | `Tasks: 17 successful, 17 total` |
| unit | `pnpm test:unit` | `Test Files 198 passed (198)`, `Tests 2549 passed (2549)` |
| docs | `pnpm docs:check` | `[audit:docs] OK — checked 9 public package docs, VitePress routes, TypeDoc targets, and docs gate wiring` |
| Ports | `lsof -nP -iTCP:4173/4174 -sTCP:LISTEN` before every run | Free before each run |
| e2e run 1 | `npx playwright test <plan list> tests/e2e/paja-*.spec.ts --project chromium --workers=1` | `90 passed`, `2 failed`: `paja-intent-links.spec.ts:210` (checkbox click did not change state) and `paja-llm.spec.ts:51` l.104 (`typeof napplet.llm` is `object` right after disable) |
| Flake classification | The two specs in isolation, then `--repeat-each=3` on the two tests | `20 passed`, then `6 passed`. Neither spec is touched by the branch (`git diff --stat origin/main...HEAD` empty for both), and main CI at `f5c3ee82` is green. Logged to `deferred-items.md` |
| e2e run 2 (final tree) | Same list | **`92 passed (1.4m)`**: experimental-nap 6, playground-usability-controls 5, acl-revoke-relay-write 1, acl-revoke-storage-write 1, demo-audit-correctness 3, demo-service-toggle 4, paja-llm 1, nip5d-contract-conformance 4, paja-console-visibility 3, paja-fs-pickers 3, paja-gamepad-indicators 4, paja-intent-links 19, paja-manifest-kinds 6, paja-runtime-pointer 10, paja-single-window 18, paja-version-consent 4. The known paja-manifest-kinds clipboard flake did not recur |
| Leaked dev server | `lsof` after each run | `127.0.0.1:4174` held by an orphaned `vite` dev server (outer `pnpm` PPID 1) that `demo-audit-correctness.spec.ts` spawns and does not fully kill. Stopped both times. Root cause of the earlier stray server, logged to `deferred-items.md` |
| aislop | `npx -y aislop@0.12.0 ci --json \| tee $S/ku0-aislop.json` | Top-level keys `schemaVersion, cliVersion, version, score, label, scoreable, coverage, engines, engineDefinitions, diagnostics, findingAssessment, summary`. **score 95 "Healthy"**, `errors 0, warnings 5, files 327` |
| aislop rows | `diagnostics[]` | `complexity/file-too-large paja/src/browser-host.ts`, `complexity/function-too-long paja/src/browser-host.ts:665`, `complexity/function-too-long paja/src/browser-intent-builder.ts:49`, `complexity/file-too-large services/src/cvm-nostr-transport.ts`, `complexity/function-too-long shell/src/intent-uri.ts:22`. These are exactly the five pre-existing main rows. `.aislop/config.yml` is unchanged vs main. The CLAUDE.md 100/100 target is **not met** because of this pre-existing debt |
| Forbidden patterns | `git diff 854b2ebb 38e72465 \| grep '^+' \| grep -cE 'new Function\|as unknown as\|as any as'` | `0` |
| Clean tree | `git status --porcelain -- packages apps tests docs skills scripts .changeset` | Empty |
| Push | `git push` (no force) | `3b551b67..c3544160 feat/experimental-naps -> feat/experimental-naps`, and HEAD equals `origin/feat/experimental-naps` |
| PR state | `gh pr view 363 --json state` | `OPEN`; no new PR opened |
| PR body | `gh pr edit 363 --body-file $S/pr-body-ku0.md` | The services bullet now says `minor` (citing `3b551b67`); `grep -ci 'patch changeset'` gives `0`. Verification is updated with ku0 numbers and the dry run, there is a new `### Pipeline pass 261031-ku0` subsection, and Out of scope notes the leaked dev server. All existing sections are kept, and `43cb3a4` still appears |
| PR comment | `gh pr comment 363 --body-file $S/pr-comment-ku0.md` | <https://github.com/kehto/web/pull/363#issuecomment-6544893756> (refs, result, commits, gates, dry run, follow-up) |
| CI | `gh pr checks 363 --watch` | See the CI line below |

### Deviations (Tasks 6–7)

1. **[Rule 1 - Bug] Skill told downstream users nothing about scoping vitest.** Found by the dry run
   (Task 6 step b). Fixed in `38e72465` (SKILL.md, checklist, how-to). Template run b was redone green.
2. **[Rule 3 - Blocking] `origin/main` moved during the pass** (`f5c3ee82`, #365). Merged as the plan
   requires (`c3544160`), and every Task 7 gate was rerun on the merged tree.
3. **Subagent dry run done by the executor.** No subagent-spawning tool was available in this executor,
   so step c followed the plan's fallback: the executor scaffolded `x-tally` reading only `$S/skill-ku0`
   (plus the packed tarballs installed from npm), and never read kehto sources for it.
4. **Two pre-existing e2e flakes and a dev-server leak** in specs this branch doesn't touch. Classified with
   isolated and repeated runs, then logged in `deferred-items.md`. These are out of scope, so the specs
   were not changed.
5. The `@types/node` version (22.20.5) for the dry run is not in `pnpm-lock.yaml` as a direct
   dependency. It matches the ia2 dry run.

### Commits (Tasks 6–7)

| Task | Commit | Message |
|---|---|---|
| 6 | `dfa13566` | docs(skill): link hosted NAP-LLM wiring guide and guard skill paths and how-to exports |
| 6 | `38e72465` | docs(skill): scope downstream vitest away from the Paja Playwright spec |
| 7 | `c3544160` | chore(merge): merge origin/main (#365 peer ranges) into feat/experimental-naps |
| 7 | (this commit) | docs(planning): record quick task 261031-ku0 (experimental NAPs goal pipeline) |

### Self-check (Tasks 6–7)

## Self-check: PASSED

All seven code-side commits exist (`dd8de3b3`, `58c3244b`, `c0935f0e`, `854b2ebb`, `dfa13566`, `38e72465`,
`c3544160`). Each carries the `Co-Authored-By: Claude Opus 5.5` trailer, and they are on
`origin/feat/experimental-naps`. The Task 6 commits delete no files. `tests/unit/experimental-nap-skill.test.ts`,
`skills/kehto-experimental-nap/SKILL.md` and `deferred-items.md` exist. The branch was never switched.
