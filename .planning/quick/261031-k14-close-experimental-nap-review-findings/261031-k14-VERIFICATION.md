---
phase: quick-261031-k14-close-experimental-nap-review-findings
verified: 2026-10-31T14:10:00Z
status: passed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Quick Task 261031-k14: Close Experimental NAP Review Findings Verification Report

**Goal:** Close review INFO findings IN-01..IN-09 from `261031-ia2-REVIEW.md` on `feat/experimental-naps`. Each fix follows the locked decision and has a named regression. Add a `@kehto/services` README section on experimental `x-` NAPs, with a patch changeset.
**Verified:** 2026-10-31
**Status:** passed
**Re-verification:** No. This is the initial verification.
**Commits checked:** `git log 731ac455..HEAD` gives 9724fbf4, 8c0996f2, 34d789d6, 324bc4e1, 13bff891 and 0dfaf1d7 (planning). The working tree was clean before this report was written.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Code evidence | Test evidence |
|---|-------|--------|---------------|---------------|
| 1 | IN-01: `sanitizeExtensionDecisions` returns a frozen record. Deserialized state can still be granted and revoked. | VERIFIED | `packages/acl/src/extensions.ts:244` `Object.freeze(result)`. Grant and revoke spread into new objects. | `packages/acl/src/extensions.test.ts:91-102` checks `Object.isFrozen` on the direct result and on `deserialize(...).entries[...].ext`, then revokes and grants on the restored state, and checks that the original is unchanged. |
| 2 | IN-02: `AclStateContainer.check` denies unknown strings under both policies. Grant and revoke on them leave no entry and no mutation. `hasCapability` follows. | VERIFIED | `packages/runtime/src/acl-state.ts:85-87` `isKnownCapability` (`Object.hasOwn(CAP_MAP, …) \|\| isExtensionCapability`). Guards sit at `:241` (check), `:248` (grant, before `ensureRuntimeDefaultEntry`) and `:257` (revoke). JSDoc is at `:126-166`. Key link: `packages/runtime/src/runtime.ts:466-469` `hasCapability` calls `aclState.check`. The pure `@kehto/acl` check is unchanged, as decided. | `packages/runtime/src/acl-state.test.ts:185-206` tests `x-llm:generate`, `not-a-capability`, `x-echo:Bad`, `sign:event` and `''` under permissive and restrictive (all false), positive controls, and that no entry, no `getAllEntries` row and no observer mutation follow a bogus grant or revoke. `packages/runtime/src/x-extension-hardening.test.ts:134-148` checks the context level (built-in handler gets `not:a-cap` false and `relay:read` true; x-echo handler gets `x-echo:Bad_Action` false). |
| 3 | IN-08: deny wins for explicit x- decisions in either order. One-sided decisions are kept. The rule is documented in JSDoc, the acl README, docs/packages/acl.md and the ACL_KEYS row. | VERIFIED | `packages/acl/src/extensions.ts:271-273` gives `hasOwn ? a===true && b : b`, which is commutative and keeps one-sided decisions. JSDoc is at `:247-263`, with the example `false + true → false`. `packages/acl/src/migrate.ts:28-29` adds an ext bullet. `packages/acl/README.md:118-120`, `docs/packages/acl.md:52-54` and the ACL_KEYS row of `docs/compatibility.md:122` all state it. Searching for the old wording `grant on either side wins` in packages, docs and skills finds nothing. | `packages/acl/src/extensions.test.ts:104-124` checks the vector `true+false/false`, the mirrored order, `true+true`, a one-sided decision, and commutativity of `mergeExtensionDecisions` over all four vectors. |
| 4 | IN-09: kit request, send and on accept only the acl action grammar (64 characters at most) and throw TypeError otherwise. `kit.request` always generates the id. | VERIFIED | `packages/shell/src/napplet-namespace.ts:1848-1853`: `typeFor` uses `/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/` and `length > 64`. This is identical to `packages/acl/src/extensions.ts:51,123`. All three of request, send and on call `typeFor` (`:1856,1866,1869`). `:1859` strips `id` from the payload, so `request()` at `:177` generates one with `message.id ?? id()`. The JSDoc is at `packages/shell/src/shell-extensions.ts:41-53`, and the how-to at `docs/how-tos/experimental-nap.md:82-85`. | `packages/shell/src/shell-extensions.test.ts:298-338` runs 11 rejected and 4 accepted vectors through call, fire and listen. It checks each vector against `validateExtensionCapability`, which proves parity. It also checks that the posted id is not `'victim'`, that a spoofed `id: 'victim'` result does not settle the request, and that the generated id resolves with `{ text }` only. |
| 5 | IN-06: Paja matches extension routes on the pathname (query ignored). An unreadable module gets 404 `Not found`, and the response has no path. | VERIFIED | `packages/paja/src/server.ts:93` delegates to `serveExtensionModule` (`:144-163`). `requestPathname` (`:133-136`) strips `?` and `#`. A try/catch around `readFileSync` answers 404 `NOT_FOUND_HEADERS` + `'Not found'` (`:153-158`). The key link to `pajaExtensionUrl` is at `:149`. | `tests/unit/experimental-nap.test.ts:155-174`: a request for `/1.js?v=1` gets 200 with the fixture bytes. Requests for `/0.js` and `/0.js?v=2` get 404 with body `Not found` that does not contain the temp dir. |
| 6 | IN-07: the how-to, the Paja doc and README, and the skill say "No secrets in config `settings`" and name `/__kehto/config.json`. Served behavior is unchanged. | VERIFIED | `docs/how-tos/experimental-nap.md:140-145`, `docs/packages/paja.md:649-651`, `packages/paja/README.md:621-623`, `skills/kehto-experimental-nap/SKILL.md:60-62` and `skills/kehto-experimental-nap/reference/security-invariants.md:58-61`. No served-config code changed in this range. The claims are accurate: the bind default is `127.0.0.1` (`packages/paja/src/cli.ts:183`), and sidebar values are stored per domain under `kehto.paja.extension.<name>` (`packages/paja/src/browser-extensions.ts:43-61`). The skill templates are byte-identical to `tests/fixtures/experimental-nap` (cmp ran on all 4 files). | `tests/unit/experimental-nap-skill.test.ts:103-116` checks all 5 files for both strings. |
| 7 | IN-03: corrupt localStorage cannot inject non-string values, non-string d tags or a non-array disabled list. A numeric prefix leaves x-echo unconfigured, and a disabled string does not disable it. | VERIFIED | `apps/playground/src/playground-extensions.ts:59-85` `sanitizeStoredExtensionState`. `readStored` routes through it (`:89-95`). `enabled: !stored.disabled?.includes('x-echo')` (`:140`) now runs on a string array, which closes the substring bug. The `deniedFor` Map no longer needs a fallback (`:144-146`). | `tests/unit/playground-experimental-nap-hardening.test.ts:17-30` covers the pure vectors, including non-object inputs. `:32-39` stubs `localStorage`, resets the modules and reimports, then checks that `state()` is `'unconfigured'` and that `getDisabledPlaygroundExtensionDomains()` is `[]`. |
| 8 | IN-04: an x- toggle shows the explicit decision whatever the block state. Otherwise it shows the block-independent `adapter.defaultCheck(cap)`. | VERIFIED | `apps/playground/src/acl-panel.ts:243-248`: x- caps use `extensionToggleEnabled(aclSnapshot?.extensions, cap, () => adapter.defaultCheck(cap))`, and the old `extensions[cap] ?? true` hard-code is gone. `extensionToggleEnabled` is at `apps/playground/src/playground-extensions.ts:111-117` (an own-property decision wins, else `check()`). `defaultCheck` is declared at `apps/playground/src/playground-access-controls.ts:37-47`, wired at `:191` and implemented at `:265-269` as `aclState.check('', '__kehto-playground-default-policy__', '', capability)`. **This fallback does not depend on the block flag:** ACL keys are `${dTag}:${hash}` (`packages/acl/src/check.ts:24-26`), so the sentinel identity never has an entry. `checkExtension` returns `state.defaultPolicy === 'permissive'` before it reads any `blocked` flag (`packages/acl/src/extensions.ts:188-189`). The container `check` creates no entry (`acl-state.ts:240-245`), and block state lives only on per-identity entries. The executor also fixed the plan's sentinel slot: the pubkey slot would have keyed `:`. | Unit: `tests/unit/playground-experimental-nap-hardening.test.ts:42-56` covers decisions winning without calling the fallback, the `{}`/undefined fallback, and that `constructor` is not treated as a decision. Behavior: `tests/e2e/playground-usability-controls.spec.ts:90-160` blocks, reloads while blocked, then unblocks and expects `8 allowed` / `1 blocked`, where the 9 rows are 7 built-in plus 2 x-echo (`acl-panel.ts:77-85` plus the fixture caps). The verifier re-ran it and it passed. |
| 9 | IN-05: the global exists only in dev or with `?kehto-test`. The production preview without the flag has no global, and the e2e opts in. | VERIFIED | `apps/playground/src/playground-extensions.ts:130-132` checks `dev \|\| URLSearchParams.has('kehto-test')`. The assignment is gated at `apps/playground/src/main.ts:472-489`. `tests/e2e/helpers/demo-before-each.ts:19-27` adds a `path` option used by both gotos. `tests/e2e/experimental-nap.spec.ts:160,206` passes `{ path: '/?kehto-test' }`. | Unit: `playground-experimental-nap-hardening.test.ts:59-67`, including the `?kehto-testing` and `?x=kehto-test` negatives. E2E: `tests/e2e/experimental-nap.spec.ts:222-227` checks that `__clearAclEvents__` is a function and that `'__kehtoPlaygroundExtensions__' in window` is false. The verifier re-ran it and it passed. |
| 10 | Services: the `@kehto/services` README and docs/packages/services.md explain x- NAPs, and a patch changeset exists. | VERIFIED | `packages/services/README.md:667-683` and `docs/packages/services.md:126-142` both have `## Experimental x- NAPs` and the absolute link to `https://kehto.github.io/web/docs/how-tos/experimental-nap.html`. They state the spec-gap policy bounded by `43cb3a4`. The claim that no x- service ships holds: the only `'x-` strings in `packages/services/src` are JSON-schema `x-napplet-*` keywords. `.changeset/experimental-naps-services.md` exists and reads `"@kehto/services": patch`. | `pnpm docs:check` OK (re-run). |
| 11 | Gates: build, type-check, test:unit, docs:check and Chromium e2e are green. aislop is at least 95 with no new rows. | VERIFIED | See Behavioral Spot-Checks. All gates were re-run by the verifier. | 2545 tests pass, e2e is 11/11, aislop is 95 with 5 rows. |

**Score:** 11/11 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/acl/src/extensions.ts` | frozen sanitize (IN-01), deny-wins merge (IN-08) | VERIFIED | `:244`, `:271-273`. Used by `migrate.ts` `withExt` and by `deserialize`. |
| `packages/runtime/src/acl-state.ts` | known-capability guard (IN-02) | VERIFIED | `:85-87`, `:241`, `:248`, `:257`. Reached from `runtime.ts:468`. |
| `packages/shell/src/napplet-namespace.ts` | kit grammar plus generated id (IN-09) | VERIFIED | `:1848-1863`. Serialized into the prelude and exercised through `runFrame`. |
| `packages/paja/src/server.ts` | pathname route plus generic 404 (IN-06) | VERIFIED | `:93`, `:133-163`. |
| `apps/playground/src/playground-extensions.ts` | sanitize / toggle / hook gate | VERIFIED | `:59`, `:111`, `:130`. Imported by `acl-panel.ts:12` and `main.ts:34`. |
| `tests/unit/playground-experimental-nap-hardening.test.ts` | IN-03/04/05 regressions | VERIFIED | 4 tests. All pass. |
| `.changeset/experimental-naps-services.md` | services patch changeset | VERIFIED | Present, `patch`. |

The acl, runtime, shell, paja and playground changesets were amended in place and kept at `minor`. No `.changeset/*.md` was deleted.

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `runtime.ts` `createServiceContext.hasCapability` (`:466-469`) | `acl-state.ts` `check` | `aclState.check(...)` denies unknown strings | WIRED |
| `migrate.ts` `withExt` | `extensions.ts` `mergeExtensionDecisions` | deny-wins merge | WIRED (the test runs through `migrateAclState`) |
| `napplet-namespace.ts` `typeFor` | `@kehto/acl` `ACTION_PATTERN` | inlined copy, with parity proven by the vector table against `validateExtensionCapability` | WIRED |
| `tests/e2e/experimental-nap.spec.ts` | `apps/playground/src/main.ts` gate | `demoBeforeEach(page, { path: '/?kehto-test' })` | WIRED (e2e passes) |
| `acl-panel.ts` | `extensionToggleEnabled` + `adapter.defaultCheck` | no-decision fallback | WIRED |
| `server.ts` `handleRequest` | `pajaExtensionUrl` | pathname comparison (`:149`) | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `acl-panel.ts` x- toggle | `initialEnabled` | `adapter.snapshot()` extensions, else `aclState.check` default policy on the live runtime | Yes | FLOWING |
| `playground-extensions.ts` entries | `stored` | `localStorage` passed through `sanitizeStoredExtensionState` | Yes | FLOWING |

### Behavioral Spot-Checks (re-run by the verifier)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Targeted regressions | `npx vitest run` on the acl extensions/migrate, runtime acl-state/x-extension(-hardening), shell-extensions, experimental-nap, experimental-nap-skill and playground hardening test files | 9 files, 113 tests passed | PASS |
| Build | `pnpm build` | 32/32 (cached) | PASS |
| Type-check | `pnpm type-check` | 17/17 | PASS |
| Unit suite (one run) | `pnpm test:unit` | 198 files, 2545 tests passed | PASS |
| Docs gate | `pnpm docs:check` | `[audit:docs] OK` | PASS |
| Chromium e2e | `npx playwright test tests/e2e/experimental-nap.spec.ts tests/e2e/playground-usability-controls.spec.ts --project=chromium --workers=1` (fresh preview servers; nothing was listening on 4173/4174 before) | 11 passed | PASS |
| Slop gate | `npx -y aislop@0.12.0 ci --json` | score 95. 5 code-quality rows (`browser-host.ts` x2, `browser-intent-builder.ts`, `cvm-nostr-transport.ts`, `intent-uri.ts`). This task touched none of these files. format/lint/ai-slop/security: 0 | PASS |
| Stale strings | `git grep -n "permissive default" -- apps/playground/src`; `git grep -in "grant on either side wins" -- packages docs skills` | no output | PASS |

### Probe Execution

No probes were declared or applicable. Step 7c was skipped.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| IN-01 | frozen sanitize result | SATISFIED | Truth 1 |
| IN-02 | unknown capability strings denied and ignored | SATISFIED | Truth 2 |
| IN-03 | sanitized playground storage | SATISFIED | Truth 7 |
| IN-04 | block-independent x- toggle default | SATISFIED | Truth 8 |
| IN-05 | gated test global | SATISFIED | Truth 9 |
| IN-06 | pathname route, generic 404 | SATISFIED | Truth 5 |
| IN-07 | no-secrets docs | SATISFIED | Truth 6 |
| IN-08 | deny-wins migration | SATISFIED | Truth 3 |
| IN-09 | kit grammar, generated id | SATISFIED | Truth 4 |
| SERVICES-README | services section plus patch changeset | SATISFIED | Truth 10 |

`261031-ia2-REVIEW.md:263-273` contains the "Info resolution (261031-k14)" table. It has one row per IN-01..IN-09 and names the same regressions verified above. No requirements are orphaned.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all files changed in range) | — | TBD/FIXME/XXX scan | — | None found |
| `packages/shell/src/napplet-namespace.ts` | 1859 | `const { id: _id, ...fields } = payload` throws on an explicit `null` payload, where the old `{ ...payload }` spread tolerated it | Info | Outside the typed contract (`payload?: Record<string, unknown>`; `undefined` defaults to `{}`). The throw is synchronous, inside the binding's own call. No security impact. Not a gap. |

### Notes on Decision Drift

- **IN-04:** CONTEXT.md recorded the decision as "falls back to `adapter.check`". The PLAN changed this to `adapter.defaultCheck`, because `adapter.check` is gated by the block flag and would leave toggles stale after reload-while-blocked. The implementation follows the PLAN and keeps the CONTEXT intent: decisions show independently of block, and an identity with no decision reads as the default policy. The e2e above confirms it. The CONTEXT line is now out of date, but this is not a code gap.
- **IN-06:** the plan's `new URL(…, 'http://paja.invalid')` was replaced by string stripping (`requestPathname`) to avoid a new aislop `hardcoded-url` row. The behavior matches what the plan requires, and the regression passes.

### Human Verification Required

None. Every behavior-dependent truth (IN-04 block independence, IN-05 global gating, IN-09 id correlation, IN-06 route behavior) has a passing behavioral test that the verifier ran.

### Gaps Summary

No gaps. All nine review findings and the services README requirement are implemented as decided. Each has a named regression, and all gates pass.

---

_Verified: 2026-10-31_
_Verifier: Claude (gsd-verifier)_
