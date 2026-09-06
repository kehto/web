---
phase: 105-published-convention-adoption-and-host-flows
verified: 2026-07-27T14:41:01Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 105: Published Convention Adoption and Host Flows Verification Report

**Phase Goal:** Kehto consumes the released convention-capable Napplet line and Paja and playground prove the live intent, profile, resource, and theme behavior that users rely on.

**Verified:** 2026-07-27T14:41:01Z
**Status:** passed
**Re-verification:** Yes — the complete browser suite supplied the two previously
missing behavioral proofs, and the final run at `c7e0cbf` remained green after
hardening pointer-server teardown

## Authority and Scope

This review used the required local authorities directly, rather than treating
phase summaries as evidence:

- `NAP-INTENT` draft PR #91 at `a718915ddefa2f03a0126579601f59d8bd86f7c4`:
  URI-authoritative invocation, queryless convention identity, retained
  responsibility, buffered `onDelivery`, and target-ready delivery.
- `NAP-IDENTITY`, `NAP-THEME`, and `NAP-SHELL` at
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`: resource-byte delegation for
  profile media, complete current/equal changed themes, and the mandatory
  `shell.ready` / one `shell.init` / synchronous `supports()` lifecycle.
- `NAP-RESOURCE.md` is absent at that authority ref. The resource behavior is
  therefore correctly treated as the NAP-IDENTITY delegation plus Kehto host
  policy; NAP-DM remains unadvertised.

The inspected installed package line is core/nap `0.29.0`, shim `0.27.0`, SDK
`0.25.0`, and Vite plugin `0.12.0`. `published-napplet-contract.test.ts`
records and verifies the mandated source `dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b`
and release `60889f1c2476e063500c7ab6624af6abe0dbcbe5` refs against the
installed release artifacts.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Exact published-only convention releases are consumed; no API/overload is guessed, and Kehto keeps the required host-owned NAP-SHELL despite generic core/shim omission. | ✓ VERIFIED | Active manifests and frozen importers resolve the exact matrix; 28 namespace lifecycle tests and released-surface/package-alignment tests pass. `napplet-namespace.ts` retains parent-bound one-ready/one-init, local `supports`, and immutable shell behavior. |
| 2 | Paja/playground installed verified catalogs stay separate from frames and implement real compatible default/chooser/authorization/retained-target policy. | ✓ VERIFIED | Both catalog classes retain frozen manifest-derived records only; `main.ts` and `browser-adapter.ts` construct `createCatalogIntentResolver`. Focused controller/host tests cover defaults, chooser/explicit-target failure, exact aggregate matching, replacement, retries, and one delivery. |
| 3 | The live feed/profile intent flow uses the published URI, stable profile metadata, one buffered normalized attested delivery after readiness, including cold start and teardown, without visible INC. | ✓ VERIFIED | Code wiring is present: feed uses `intentInvoke(\`napplet:profile/open?pubkey=...\`)`; profile registers `intentOnDelivery` before readiness and filters the queryless convention; hosts post only `intent.deliver`, validate selected-record identity before/after readiness, and invalidate stale waits. The complete Playwright run passed both the cold-target/source-close and published feed-frame profile convention cases. |
| 4 | Profile media is obtained through NAP-RESOURCE bytes and displayed only with revocable safe object URLs, never direct remote image URLs. | ✓ VERIFIED | Feed and profile media controllers import `resourceBytes`, create/revoke one blob URL per sink, invalidate stale completions, clear on errors/pagehide, and are invoked by both napplets. `profile-resource-media.test.ts` passed all replacement, denial, stale-load, clear, and destroy paths. |
| 5 | Paja/playground supply current theme state and bridge one host update as one matching changed theme with synchronized stored state. | ✓ VERIFIED | Paja’s retained ThemeService-to-ShellBridge route and playground’s `onThemeBroadcast: relay.publishTheme(...)` wiring exist; the focused Paja host regression and all three browser theme state/store/push cases passed. |

**Score:** 5/5 roadmap must-haves verified

### Plan Must-Have Coverage

All 40 plan-frontmatter truths were independently checked. The table records
their outcome rather than accepting their corresponding SUMMARY claims.

| Plans | Must-haves checked | Status | Codebase evidence |
| --- | ---: | --- | --- |
| 105-01–04 | 10 | ✓ VERIFIED | Every active public range/JSR map and app/fixture exact pin agrees with the final lock. Dynamic alignment and released-contract tests passed; core/shim’s shell omission is explicitly guarded as upstream drift. |
| 105-05 | 3 | ✓ VERIFIED | `packages/services/src/intent-types.ts` is absent. Services import canonical `@napplet/core`/`@napplet/nap` values while `catalog-intent-resolver.ts` remains Kehto-owned policy. |
| 105-06–08 | 11 | ✓ VERIFIED | Both hosts use persistent verified catalogs, exact contract selection, retained unstarted tasks, source-bound ready gates, record-object tokens, finite 1–10 retries, and proactive catalog-change invalidation. The final A-never-ready/same-identity-replacement/B-delivers-once regressions passed. |
| 105-09 | 4 | ✓ VERIFIED | Published URI/profile/resource source and negative INC checks are present; unit media behavior passed. The declared Playwright proof passed for cold/reused targets, source teardown, and the published feed-frame convention flow. |
| 105-10 | 4 | ✓ VERIFIED | Active-source guards passed and reject legacy package, frame-derived catalog, profile INC, direct remote-media, and stale migration vocabulary. |
| 105-11–12 | 8 | ✓ VERIFIED | Active package/policy/host docs contain the release, shell-drift, resource-boundary, catalog/controller, profile/media, and theme guidance; the seven-package minor changeset is exact. |

### Required Artifacts

| Artifact group | Expected | Status | Details |
| --- | --- | --- | --- |
| Plans 01–04 package manifests, JSR maps, lock, and published-contract guards | Official package matrix and retained NAP-SHELL exception | ✓ VERIFIED | `verify.artifacts` reports 11/11 substantive files. Manual lock inspection confirms exact feed/profile importer pins and public package 0.29.0 resolution. |
| `packages/services/src/{intent-service,catalog-intent-resolver,index}.ts` | Canonical intent ownership and retained resolver policy | ✓ VERIFIED | 3/3 artifacts substantive; no local mirror import/re-export remains. |
| Paja catalog/controller/host/tabs | Persistent verified catalog and source-bound retained delivery | ✓ VERIFIED | 6/6 declared artifacts substantive and wired. `validateCurrent` uses exact selected-record object identity plus dTag/aggregate checks. |
| Playground catalog/controller/shell host | Same persistent catalog and generation lifecycle | ✓ VERIFIED | 3/3 declared artifacts substantive and wired. Catalog listener rejects stale waits on replacement/removal and lifecycle removes it on `pagehide`. |
| Feed/profile/media and Phase 105 guards | Published profile flow, safe media, anti-drift proof | ✓ VERIFIED | 10/10 declared code/test artifacts substantive; their browser profile and theme proofs passed in the full E2E run. |
| Docs and changeset | Current package/policy/host-flow guidance | ✓ VERIFIED | 7/7 declared docs/release artifacts substantive; changeset lists exactly acl, cli, firewall, paja, runtime, services, and shell as `minor`. |

`verify.artifacts` reported all 37 declared artifacts present and substantive.

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Public manifests / app pins | `pnpm-lock.yaml` | Generated importer versions | ✓ WIRED | The generic verifier could not expand brace paths and its cross-file regex did not find all four versions in one file. Direct importer inspection and the passing dynamic alignment test prove the link. |
| `intent-service.ts` | Released core/nap intent declarations | Canonical imports | ✓ WIRED | Automated link passed; active mirror file is absent. |
| Paja adapter/host | Catalog resolver and controller | Catalog snapshot → retained source-bound task | ✓ WIRED | `browser-adapter.ts` calls `createCatalogIntentResolver`; `browser-host.ts` installs `BrowserIntentController`, source-checks `shell.ready`, and posts `intent.deliver`. |
| Playground `main.ts` / `shell-host.ts` | Catalog resolver/controller | Installed records → `shell.ready` generation → delivery | ✓ WIRED | `main.ts` builds the resolver from `installedNapplets.intentCatalog`; host validates the exact record before cold resolution, after ready, and before final send. |
| Feed/profile napplets | Published intent/resource APIs | URI invoke, early delivery subscription, bytes → blob URL | ✓ WIRED | Both declared Plan-09 links pass automated verification and direct source inspection. |
| Theme services | Paja/playground ShellBridge | stored state → one changed event | ✓ WIRED | Paja attaches the retained bridge link; playground gives `onThemeBroadcast` to `relay.publishTheme`. Browser state, store, and push transitions passed. |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
| --- | --- | --- | --- | --- |
| Paja catalog | immutable `InstalledNappletRecord` | Resolver-verified pointer/manifest | dTag, aggregate hash, archetypes copied and frozen before catalog insert | ✓ FLOWING |
| Playground catalog | immutable `InstalledNappletRecord` | `resolvePlaygroundNapplet` verified artifact | Verified identity and archetypes inserted independently of frame lifecycle | ✓ FLOWING |
| Profile view | normalized delivered `pubkey` | `IntentDelivery.payload` then relay kind-0 subscription | `intentOnDelivery` filters convention and starts a generation-scoped real relay load | ✓ FLOWING |
| Profile images | per-sink object URL | `resourceBytes(url)` Blob | Only generated blob URL reaches sink `src`; stale/error/pagehide paths revoke it | ✓ FLOWING |
| Theme | current complete theme | ThemeService → ShellBridge publish | Host stores then bridges current value; focused Paja and browser state/store/push evidence pass | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Package alignment, released surfaces, active drift guards, catalogs/controllers, safe media | `pnpm exec vitest run` on nine focused Phase-105 files | 9 files, 90 tests passed | ✓ PASS |
| Mandatory retained NAP-SHELL prelude | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` | 28 tests passed | ✓ PASS |
| Complete browser/runtime proof | `pnpm test:e2e` | 79 passed, 1 optional live-network case skipped, 0 failed; profile cold-target/source-close, published feed convention, Paja runtime/INC, harness notify/relay/storage, and all theme cases passed | ✓ PASS |

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
| --- | --- | --- | --- |
| PKG-01 | 01, 04–10 | ✓ SATISFIED | Published imports replace the mirror; exact packages/authorities compile/import and retained catalog policy is wired. |
| PKG-02 | 01, 04, 11–12 | ✓ SATISFIED | Installed core/shim omission is demonstrated and documented as upstream drift; Kehto’s protected NAP-SHELL prelude has 28 passing lifecycle/security regressions. |
| PKG-03 | 02–04, 09–10 | ✓ SATISFIED | Exact app/fixture pins, released SDK/Vite imports, profile/resource implementation, and active guards pass. |
| PKG-04 | 01–04, 10–11 | ✓ SATISFIED | Dynamic package/JSR/lock test and manual importer inspection confirm one exact official line. |
| IDENTITY-05 | 09–10, 12 | ✓ SATISFIED | Both consumers use resource bytes and revocable object URLs; all focused media lifecycle cases pass. |
| THEME-04 | 07, 09–10, 12 | ✓ SATISFIED | Focused Paja bridge proof and live Paja/playground browser state, store, and push delivery all pass. |
| ARCH-03 | 06, 08–10, 12 | ✓ SATISFIED | Canonical installed-catalog and source-bound retained delivery code, controller regressions, and the live cold/reused feed/profile E2E all pass. |

No Phase 105 requirement is orphaned: every ID declared in the roadmap is
claimed by at least one plan and has implementation evidence above.

### Anti-Patterns Found

No blocking `TBD`, `FIXME`, or `XXX` markers, placeholder implementations,
hard-coded empty visible data paths, active profile INC route, or direct remote
profile image assignment were found in the Phase 105 production/test/docs
surface. Empty/null checks found in controllers are lifecycle guards and are
exercised by the focused regressions, not stubs.

## Gaps Summary

No missing or stubbed implementation was observed, so there is no
`gaps_found` blocker and nothing to defer to Phase 106. Automated code, wiring,
data-flow, package, authority, focused behavioral checks, and the complete
browser suite pass. The single skipped browser case is the existing optional
live-network Good Morning Protocol naddr fixture and is unrelated to the phase
must-haves.

---

_Verified: 2026-07-27T14:41:01Z_
_Verifier: the agent (gsd-verifier)_
