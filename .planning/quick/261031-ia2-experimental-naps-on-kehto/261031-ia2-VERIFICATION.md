---
quick_id: 261031-ia2
phase: quick-261031-ia2-experimental-naps-on-kehto
verified: 2026-10-31T13:55:00Z
status: passed
score: 14/18 must-haves verified (8 deliverables, 4 hard constraints, 6 acceptance items)
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "An extension cannot shadow or override a built-in or upstream NAP domain (including llm); extension pushes go only to declared, own-domain x- types (D4, hard constraint 1, documented invariant)"
    status: failed
    reason: "The per-handler ServiceRuntimeContext only scopes pushes whose domain is an x- domain. Any other type falls through to the pre-existing built-in push path, so an x- extension's context can forge built-in pushes (theme.changed, identity.changed, llm.delta, gamepad.state) to any frame holding that domain. This works even with no pushCapabilities declared. The regression test that claims to prove the opposite only passes because its isDomainAllowed mock grants x-echo alone."
    artifacts:
      - path: "packages/runtime/src/runtime.ts"
        issue: "Line 471 diverts only isExtensionDomain(domain) messages to extensions.push(). Lines 472-485 still deliver built-in types for a handler attached under an x- name."
      - path: "packages/runtime/src/x-extension.test.ts"
        issue: "Lines 110-117 ('never lets an extension push a built-in domain') pass only because setup() at line 26 grants x-echo alone. With isDomainAllowed => true, theme.changed and llm.delta are delivered."
      - path: "docs/how-tos/experimental-nap.md"
        issue: "Lines 166-167 say pushes go 'only for declared x-<domain>.* types'. That is false for built-in types."
      - path: "skills/kehto-experimental-nap/reference/security-invariants.md"
        issue: "Lines 19-20 list 'only in your own domain' under 'Enforced by kehto'. That is false."
    missing:
      - "In createServiceContext (runtime.ts ~line 464), when isExtensionDomain(name) is true, reject any push whose domain is not `name`, before the built-in path runs."
      - "Rewrite x-extension.test.ts:110 so isDomainAllowed grants every domain, then assert theme.changed, identity.changed, llm.delta and gamepad.state are all refused. Add the same check through createShellBridge (shell-extensions.test.ts)."
  - truth: "Extensions never receive credentials, signer secrets, Paja LLM vault contents or other domains' data — proven by a regression test"
    status: partial
    reason: "The shell-level regression covers the context surface, signer and pubkey secrets, and other-domain traffic. No test exercises Paja: no assertion on the Paja factory context (PajaExtensionContext) and no assertion that the Paja LLM vault is unreachable. The 'vault' case is a stand-in llm.generate prompt string. Paja extension modules are dynamically imported into the Paja host-page realm (browser-extensions.ts:78), which also holds the vault. This trust boundary is not documented anywhere."
    artifacts:
      - path: "packages/shell/src/shell-extensions.test.ts"
        issue: "Lines 174-192 never touch Paja or its vault."
      - path: "packages/paja/src/browser-extensions.ts"
        issue: "Lines 99-104: the factory context is { settings } only, which is good, but no test pins it."
    missing:
      - "Add a Paja unit regression that asserts the factory context keys are exactly ['settings'] and that a module cannot read vault or LLM connection state through any API Paja hands it."
      - "Document in the how-to and security-invariants.md that Paja extension modules run as trusted host-page code."
  - truth: "Paja: extension domains appear in parity/simulation lists (D5)"
    status: partial
    reason: "Interface list, toggles, tri-state, Extensions section, ACL toggles and message-log entries are all wired. But getUnexpectedAdvertisedDomains (parity.ts:157) is exported and never called or tested. summarizePajaSimulation (the sim status line, browser-host.ts:248) does not reflect extension domains or their toggles."
    artifacts:
      - path: "packages/paja/src/parity.ts"
        issue: "getUnexpectedAdvertisedDomains is dead code with no test."
    missing:
      - "Use getUnexpectedAdvertisedDomains in Paja's parity reporting, or remove it, and add a parity.test.ts case with an x- domain."
      - "Optionally include enabled extension domains in the simulation summary."
---

# Quick task 261031-ia2: experimental NAPs on kehto — Verification Report

**Goal (authoritative, GOAL.md final prompt revision, deliverables 1-8):** Let downstream developers build experimental NAPs on kehto without changing any kehto package. Document how, and ship an agent skill that walks them through it.
**Verified:** 2026-10-31
**Status:** gaps_found (initial run; closed, see Gap closure)
**Re-verification:** No (initial)
**Diff verified:** `git diff main...feat/experimental-naps` (14 commits, 98 files)

GOAL.md contains several pasted revisions of the prompt. The last revision, which adds deliverable 8 and the skill acceptance checks, is the one verified here.

## Observable Truths

### Deliverables

| # | Item | Status | Evidence |
|---|---|---|---|
| D1 | `ShellAdapter.extensions` declaration; `buildShellCapabilities`, `resolveShellEnvironment`, `isDomainAllowed`, `getShellDomainState` honor it; tri-state; per-frame grant/deny via `resolveEnvironment` | MET | `packages/shell/src/types.ts:484-498` (`extensions?`). `shell-extensions.ts:78-97` (declaration), `:139-164` (validation). `shell-init.ts:40-42` (advertisement skips `disabledDomains` and state `disabled`), `:73-75` (`resolveEnvironment` still intersected), `:115-118` (`getShellDomainState` uses the extension `state()`), `:134-136` (live services). `hooks-adapter.ts:343-349,393` (routes extension services). `isDomainAllowed` still reads the frozen per-frame environment (`shell-ready.ts:35`), which now contains x- domains. Tests: `shell-extensions.test.ts:108,146`; `tests/unit/experimental-nap.test.ts:61,104` |
| D2 | Binding injection in `renderNappletNamespacePrelude`/`injectNappletNamespacePrelude`; factory or vetted source; outside the signed bytes; srcdoc provenance kept | MET | `napplet-namespace.ts:37,40-51,86` (factories rendered only for exposed x- domains), `:1831-1864` (kit scoped to the domain, parent-source filter, frozen), `:1867,1875` (protected and host-owned). `shell-extensions.ts:234-243` (`{source}` accepted; `</script`, `<script` and `<!--` rejected). Test `shell-extensions.test.ts:213` strips the injection and asserts the artifact bytes are unchanged, forged-source replies are ignored, and napplet code can't replace the binding. Also `:244` (no binding for unexposed domains) |
| D3 | `x-<domain>:<action>` capabilities in @kehto/acl; built-ins can't be redefined; pure/WASM-ready; bit table unbroken | MET | `packages/acl/src/extensions.ts:28-48` (prefix, reserved list including `llm`), `:65-81`, `:110-130`, `:186-193` (`checkExtension`). `types.ts:70` (`AclEntry.ext`, no new bits). `mutations.ts:258-263` and `migrate.ts:15-18,62,77` keep `ext`. No imports outside the package. `runtime/src/acl-state.ts:81,196-216` (container routes x- caps). ACL panels: `paja/src/browser-devtools.ts:456-459`, `apps/playground/src/acl-panel.ts:237-248`. Firewall: the capability is the opClass (`x-extension.test.ts:64`). Consent uses the same domain-agnostic firewall prompt gate (`runtime.ts:620-633,697`). Tests: `packages/acl/src/extensions.test.ts` (11 cases) |
| D4 | Extension push through `sendToEligibleNapplet` for declared outbound types, with the source, ACL, block and firewall checks | **PARTIAL (BLOCKER, gap 1)** | The positive path works: `runtime.ts:451,471,492`, `service-extensions.ts:98-113` (owner, declared type, live session, domain grant, block, ACL, firewall), `service-types.ts:101`. Tests `x-extension.test.ts:77-108,119`. **But** only x- types are scoped. A probe through a real `createShellBridge` with default grants shows an `x-evil` extension with no `pushCapabilities` gets `sendToEligibleNapplet('w', {type:'theme.changed'})` → `true` and `identity.changed` → `true`, and both are posted to the frame. Runtime-level probe: `theme.changed`, `llm.delta`, `identity.changed` and `gamepad.state` are all delivered |
| D5 | Paja `extensions` in config/options; interface list tri-state, toggles, parity/simulation lists, message log | PARTIAL (WARNING, gap 3) | Config/options: `paja/src/options.ts:38-39,158-163,192`, `config-file.ts:30-34` (paths relative to the config), `extensions.ts:104-133`, `server.ts:93-100` (serves the module). Browser: `browser-host.ts:801-804` (load, install, firewall mode), `:402-433` (log entries, toggles, settings), `browser-extensions.ts:75-145`, `browser-devtools.ts:402-410` (shared tri-state toggle with ⚠), `browser-target-frame.ts:82,104,126` (prelude bindings). Parity helper `parity.ts:157` is unused. The simulation summary ignores extensions |
| D6 | Playground: same, through demo hooks and the ACL panel | MET | `apps/playground/src/demo-hooks.ts:317-322` (`extensions`, `disabledDomains`, `resolveEnvironment`). `playground-extensions.ts` (toggle, settings, denial, capabilities). `playground-frame-loader.ts:145` (bindings). `acl-panel.ts:237-248`. `main.ts:114-120` (debugger log on toggle) |
| D7 | `docs/how-tos/experimental-nap.md`, public exports only, linked from register-service.md, llm.md, package docs and READMEs | MET (but see gap 1 on the invariant text) | How-to is 191 lines and imports only from `@kehto/shell` (`:45,135-137`). Links: `register-service.md:85,93`; `llm.md:49`; `docs/packages/{acl:53,runtime:119,shell:160,paja:649,playground:45}`; `packages/{acl:118,runtime:357,shell:334,paja:621}/README.md`; `apps/playground/README.md:189`; root `README.md:64,106`; `how-tos/index.md:9`; vitepress `config.ts:65`. The security invariant at `:166-167` is inaccurate (gap 1) |
| D8 | Agent skill: frontmatter, trigger-rich description, linked references, steps, non-skippable invariants, "when NOT to use", scaffold kept in sync, shipped and documented | MET (but see gap 1 on the invariant text) | `skills/kehto-experimental-nap/SKILL.md:1-4` (frontmatter), `:12-19` (when NOT to use), `:21-33` (rules), `:35-73` (all seven steps), `:75-82` (templates). Shipped through `packages/shell/package.json` `files: ["dist","skills"]` with `scripts/copy-agent-skill.mjs`, `turbo.json` inputs and outputs, gitignored build copy. Install steps in `README.md:66-76`. `reference/security-invariants.md:19-20` overstates what is enforced (gap 1) |

### Hard constraints

| # | Constraint | Status | Evidence |
|---|---|---|---|
| H1 | No shadow, alias or override of built-in or upstream domains or capabilities (including `llm`, `llm:generate`); reserved prefix; rejection and acceptance tested | **PARTIAL (BLOCKER, gap 1)** | Name and capability collisions are rejected and tested: `acl/extensions.test.ts:11-48`, `shell-extensions.test.ts:80-104`, `experimental-nap.test.ts:115,155`, e2e playground `:193-199` and Paja `:93`. Overriding a services key is rejected (`shell-extensions.ts:189-191`). **However**, an extension can still emit a built-in domain's push events (gap 1), which in effect overrides that domain's event stream |
| H2 | Router security properties unchanged: source-bound session, blocked identities, ACL, firewall, same-domain/same-source response pinning, recheck before send | MET | `service-extensions.ts:59-88`: same session/registration lookup, `allowed()` (domain grant, block, ACL), firewall, lifetime and registration pinning, `${domain}.` response prefix, `allowed()` recheck before `sendToNapplet`. The only change is the response length check, `domain.length + 1`, which is equivalent to the old `dot + 1`. Full unit suite passes |
| H3 | Extensions never receive credentials, signer secrets, Paja LLM vault or other domains' data; regression test | PARTIAL (WARNING, gap 2) | `shell-extensions.test.ts:174-192` (context keys are exactly the four narrow methods; no signer, pubkey or `llm.generate` payload reaches the extension). Nothing covers Paja's vault |
| H4 | Built-in domains (NAP-LLM included) work with no config changes; `originRegistry` workaround kept or retired under the compat rules | MET | `shell-extensions.test.ts:121`; full suite 2516/2516 passes. The compat path still widens and warns once with a stable identifier (`shell-ready.ts:72-106`). It is registered in `docs/compatibility.md:9-36` and tested at `shell-extensions.test.ts:254,273` |

### Acceptance

| # | Item | Status | Evidence |
|---|---|---|---|
| A1 | Fixture outside packages/ using only entry points; unit test and Chromium spec covering advertisement, supports(), req/resp, push, unconfigured→supported, ACL deny, firewall block, resolveEnvironment disable, collision, in Paja and the playground | MET | `tests/fixtures/experimental-nap/x-echo.js` uses only JSDoc type imports from `@kehto/shell`. `tsconfig.json` type-checks it against `packages/shell/dist`. Unit: `tests/unit/experimental-nap.test.ts:61-125,130-181`, `tests/fixtures/experimental-nap/x-echo.test.ts:41-84`. E2E: `tests/e2e/experimental-nap.spec.ts:80,114,132` (Paja) and `:158,204` (playground). Recorded as 5/5; not re-run, per instructions |
| A2 | Skill checks: frontmatter test; file paths and exports test; templates byte-identical; subagent dry run | MET | `tests/unit/experimental-nap-skill.test.ts:36,53,66,88,97`. The dry run (x-counter, tarballs) is recorded by the orchestrator and in the PR body; not re-executed |
| A3 | Gates | MET (unit re-run here) | `pnpm test:unit` re-run here: 196 files, 2516 tests passed. Targeted files: 74/74. Build 32/32, type-check 17/17, docs:check OK and aislop 95 are as recorded. Note that SUMMARY.md and the PR body say aislop **94** with **six** rows, while the recorded gate is 95 with five rows; reconcile the text |
| A4 | Minor changeset per changed package | MET | `.changeset/experimental-naps-{acl,runtime,shell,paja,playground}.md`, all `minor`. services has no shipped change |
| A5 | Branch and GSD flow | MET | `feat/experimental-naps`, 14 atomic conventional commits, PLAN and SUMMARY present |
| A6 | Open PR listing spec refs, spec-gap decisions and where the skill ships | MET (body repeats gap 1's inaccurate claim) | PR #363 is OPEN. Its body has "Spec refs checked" (`napplet/naps` `43cb3a4`, NIP-5D #2303), three spec gaps, "Where the skill ships", and an upstream draft at `UPSTREAM-PROPOSAL-DRAFT.md`. The body states "Pushes add three checks: … it must be in the handler's own domain", which is inaccurate per gap 1 |

**Score:** 14/18 items MET. Not met: D4 and H1 (one root cause, gap 1, BLOCKER), H3 (gap 2) and D5 (gap 3).

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Experimental-NAP unit files | `npx vitest run <acl/runtime/shell/unit/fixture/skill test files>` | 7 files, 74 tests passed | PASS |
| Full unit suite | `pnpm test:unit` | 196 files, 2516 tests passed | PASS |
| x- handler pushes built-in types (runtime, all domains granted) | scratch vitest probe of `createRuntime` | `theme.changed`, `llm.delta`, `identity.changed` and `gamepad.state` returned true and were sent | FAIL (gap 1) |
| x- extension forges pushes through a real shell bridge (default env) | scratch vitest probe of `createShellBridge` with `extensions:[x-evil]` and no pushCapabilities | `theme.changed`→true, `identity.changed`→true, both posted to the frame | FAIL (gap 1) |

The probes were scratch files outside the repo, in the session scratchpad. No repo file was changed.

## Anti-Patterns Found

| File | Line | Pattern | Severity |
|---|---|---|---|
| `packages/runtime/src/x-extension.test.ts` | 110-117 | Test title claims a security property that its mock setup hides | BLOCKER (gap 1) |
| `apps/playground/src/demo-hooks.ts` | 608-623 | The new `getPlaygroundShellAdapter` was inserted between `getPlaygroundShellEnvironment` and its JSDoc. That leaves an orphaned doc block and an undocumented export | Info |
| `packages/shell/src/shell-extensions.ts` | 183-184, 201 | Validation cache is keyed on array identity. Mutating a `ShellAdapter.extensions` array after first use returns the stale validated list | Info |
| `apps/playground/src/main.ts` | 469-485 | `__kehtoPlaygroundExtensions__` test hook (including `setFirewallPolicy`) is exposed in the shipped playground. It matches the existing `__clearAclEvents__` style | Info |
| debt markers (TBD/FIXME/XXX/TODO/HACK) in added lines | n/a | none | n/a |

## Human Verification (informational)

- E2E specs touched by count updates (`acl-revoke-relay-write`, `acl-revoke-storage-write`, `demo-audit-correctness`, `playground-usability-controls`) and `experimental-nap.spec.ts` were not re-run here, per instructions. Their recorded results are the evidence.

## Gaps Summary

There is one blocking root cause. The new per-handler push context scopes **x-** message types but not **built-in** ones, so any x- extension can forge `theme.changed`, `identity.changed`, `llm.delta`, `gamepad.state` (and any other recipient-mapped built-in push) into frames that hold those domains. This contradicts the hard "no shadowing/override" constraint and the invariants stated in the how-to, the skill and the PR. The unit test that claims to cover it is false-green. The fix is small: in `createServiceContext`, refuse non-own-domain pushes when the attached name is an x- domain, and harden the test with all domains granted.

Two lower-severity gaps:
- The "no Paja LLM vault" regression is not Paja-specific, and the host-realm trust boundary for Paja modules is not documented.
- Paja parity: `getUnexpectedAdvertisedDomains` is unused and untested, and the simulation summary ignores extensions.

Everything else is wired and tested: ACL namespace and grants, the shell declaration, advertisement and tri-state, prelude bindings with provenance, inbound routing security, Paja and playground hosting, how-to, skill with byte-synced templates and packaging, compat register, and changesets.

---

_Verified: 2026-10-31_
_Verifier: Claude (gsd-verifier)_


## Gap closure (2026-10-31, after verification)

- D4/H1 BLOCKER fixed: `createServiceContext` routes every push from an `x-` handler through the scoped
  extension path (`runtime.ts`), so built-in types (`theme.changed`, `identity.changed`, `llm.delta`,
  `gamepad.state`) are refused even with every domain granted. Regressions: `x-extension.test.ts`
  (all domains granted; built-in services unchanged) and `shell-extensions.test.ts` (through the bridge).
  Docs, the skill and the PR body now state the rule precisely.
- H3: `tests/unit/experimental-nap.test.ts` pins the Paja factory context to `{ settings: { get } }`; the
  host-page trust boundary is documented in the how-to and in the skill's security invariants.
- D5: Paja logs `paja.parity.unexpected` via `getUnexpectedAdvertisedDomains` (unit-tested), and the
  simulation status line lists extension domains and their state.
- Minor: playground JSDoc placement fixed; the extension validation cache re-validates mutated arrays
  (tested); SUMMARY aislop numbers corrected (95, equal to main).
- Gates after fixes: build 32/32, type-check 17/17, unit 2521 passed, docs:check OK, aislop 95 (5 rows,
  same as main), Chromium experimental-nap + playground-usability 10/10.
