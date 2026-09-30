# Phase 105: Published Convention Adoption and Host Flows - Research

**Researched:** 2026-07-26  
**Domain:** Published Napplet contract adoption and live Paja/playground host integration  
**Confidence:** HIGH — npm and JSR release metadata, packed artifacts, exact release tags, and the local implementation are directly inspected. The published-package versus NAP-SHELL discrepancy in PKG-02 is resolved below as an explicit upstream-drift decision.

## Summary

[CITED: npm registry tarballs for `@napplet/core@0.29.0`, `@napplet/nap@0.29.0`, `@napplet/shim@0.27.0`, `@napplet/sdk@0.25.0`, and `@napplet/vite-plugin@0.12.0`] The requested npm line is internally coherent: `@napplet/nap@0.29.0` depends on core `^0.29.0`; shim and SDK each depend on core/nap `0.29.0`; and the Vite plugin declares the convention-bearing `archetypes` configuration. The published declarations expose the URI-authoritative intent model and NAP-RESOURCE byte API. The temporary Kehto mirror at `packages/services/src/intent-types.ts` explicitly says Phase 105 must replace it.

[VERIFIED: codebase `apps/playground/napplets/feed/src/main.ts`, `apps/playground/napplets/profile-viewer/src/main.ts`, `packages/paja/src/browser-adapter.ts`] The remaining user-visible work is real host wiring. Feed and profile-viewer still communicate through an INC `profile:open` event and both assign remote profile URLs directly to `img.src`; Paja still exposes a one-candidate development intent simulator. Playground currently has only a pure one-shot manifest-to-catalog builder. Replace those stand-ins with the published SDK/domain helpers, a persistent installed-verified catalog, and host-owned retained-delivery controllers. The catalog must be independent of live iframe instances.

[VERIFIED: JSR metadata API] The corresponding JSR packages are published on the same released line: core/nap `0.29.0`, shim `0.27.0`, SDK `0.25.0`, and Vite plugin `0.12.0`, created at 11:12–11:13Z on 2026-07-26. A stale rendered JSR page must not be treated as release authority; recheck registry metadata immediately before updating the lockfile.

[CITED: packed `@napplet/core@0.29.0` declarations; `napplet/web@60889f1c2476e063500c7ab6624af6abe0dbcbe5:packages/shim/src/shell.test.ts`; `naps/NAP-SHELL.md` master at `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`] PKG-02 is a genuine compatibility decision, not a normal package upgrade: published core omits `shell` from `NappletGlobal`, `NapDomain`, and `NAP_DOMAINS`, while the published shim explicitly expects no generic `window.napplet.shell` API; NAP-SHELL requires it. **Decision:** treat this as upstream package drift, adopt the released convention packages for their published surfaces, and retain Kehto's already-verified host-owned shell prelude until a corrected upstream release can replace it. Tests and active guidance must state and guard this exception.

**Primary recommendation:** First resolve and record the PKG-02 shell-package exception; then upgrade every manifest and lockfile to the exact published npm/JSR line, delete the local intent-value mirror in favor of published exports, and wire each host around a persistent verified-install catalog plus a retained-delivery controller. Prove the feed → profile flow and object-URL media behavior in browser tests.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Published API/type ownership | Package boundary | Build tooling | [CITED: official npm tarballs] Core/nap/shim/sdk/plugin own public types and generated manifest contracts; Kehto consumes rather than recreates them. |
| Verified installed catalog | API / Backend runtime | Frontend host | [VERIFIED: Phase 104 verification; `manifest-intent-catalog.ts`] Signed-manifest contracts decide availability; frames are only delivery endpoints. |
| Intent default/chooser/retention policy | Host runtime | Browser/client | [CITED: `naps@a718915.../NAP-INTENT.md`] The host selects an authorized compatible installed handler and retains responsibility before acceptance; the binding receives only result/delivery. |
| Feed-to-profile invocation | Browser/client binding | Host runtime | [CITED: `NAP-INTENT.md`] Feed supplies the authoritative URI; the binding normalizes it and the host resolves/delivers it. |
| Profile media bytes and object URL lifetime | Browser/client binding | API / Backend resource service | [CITED: `naps@a718915.../NAP-IDENTITY.md`; official core declaration] The resource service fetches bytes under policy; the napplet owns display and revocation. |
| Theme state and pushes | API / Backend theme service | Paja/playground host | [VERIFIED: Phase 103 verification] `ThemeService` stores before its one eligible-session broadcast; each host routes user changes through it. |

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| PKG-01 | Published intent contracts. | [CITED: published core/nap 0.29.0 declarations] Import the canonical URI request, contract, result, and delivery types instead of the local mirror. |
| PKG-02 | Published shell contracts. | [CITED: packed core/shim 0.29.0/0.27.0; `naps/NAP-SHELL.md` master `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`] The released packages do **not** expose mandatory shell. Record this as upstream drift and preserve Kehto's conformant host-prelude implementation with package-alignment and browser guards. |
| PKG-03 | Published manifest and SDK contracts. | [CITED: published Vite plugin 0.12.0 declaration and npm tarball; published SDK 0.25.0 declaration] Build feed/profile with released imports and one profile archetype tag. |
| PKG-04 | Registry and lockfile alignment. | [VERIFIED: codebase package manifests and `pnpm-lock.yaml`; npm registry] Update all 29 consumers and workspace peer ranges, then regenerate the lockfile. |
| IDENTITY-05 | Resource-mediated profile media. | [CITED: `naps@a718915.../NAP-IDENTITY.md`; published core resource declarations] Use `resource.bytes()` then a revocable object URL, never a remote image URL. |
| THEME-04 | Host integration. | [VERIFIED: Phase 103 verification; codebase theme paths] Preserve the already-correct state-before-one-push service route and prove it with the released napplet line. |
| ARCH-03 | Playground profile convention. | [CITED: `naps@a718915.../NAP-INTENT.md`] Feed invokes `napplet:profile/open?pubkey=…`; profile registers delivery before it can receive buffered target-only data. |

## Project Constraints (from AGENTS.md)

- [VERIFIED: `AGENTS.md`] Before changing a NAP surface, check and record the owning `napplet/naps` ref; this phase uses NAP-INTENT PR #91 head `a718915ddefa2f03a0126579601f59d8bd86f7c4`, plus the merged identity/theme/resource authority recorded by Phases 103–104.
- [VERIFIED: `AGENTS.md`] Keep NAP changes wired across runtime, shell, Paja, playground, ACL/capability mapping, docs, and tests; do not allow a stale package export to override the NAP.
- [VERIFIED: `AGENTS.md`] Preserve the source-bound NAP-SHELL session boundary, `srcdoc` verified-byte loading, and opaque-origin sandbox; no pre-session capability traffic or raw host iframe delivery bypass.
- [VERIFIED: `AGENTS.md`] Use strict ESM TypeScript, lowercase-hyphenated filenames, public API JSDoc, explicit-path staging, focused tests, and build/type/unit/docs/AI-slop checks before shipping.
- [VERIFIED: `AGENTS.md`] Do not publish locally. Add changesets only for changed shipped `@kehto/*` outputs; a release is GitHub Actions plus the version/release PR flow.

## Standard Stack

### Core

| Library | Exact version | Purpose | Why standard |
|---|---:|---|---|
| `@napplet/core` | `0.29.0` | Canonical shared envelopes, `NappletGlobal`, resource and intent values. | [CITED: official npm tarball `core-0.29.0.tgz`] It exports the cross-domain types the existing local intent mirror copied. |
| `@napplet/nap` | `0.29.0` | Domain subpaths for intent, resource, identity, theme, and shell-facing types/helpers. | [CITED: official npm tarball `nap-0.29.0.tgz`] Its manifest records core `^0.29.0` and offers granular domain exports. |
| `@napplet/shim` | `0.27.0` | Published generic shim for non-shell NAP domains. | [CITED: official npm tarball `shim-0.27.0.tgz`; tagged `shell.test.ts`] It pins core/nap `0.29.0` but deliberately has no generic shell shim, so it cannot alone satisfy NAP-SHELL. |
| `@napplet/sdk` | `0.25.0` | Typed wrappers around injected domains for feed/profile consumers. | [CITED: official npm tarball `sdk-0.25.0.tgz`] Its manifest pins core/nap `0.29.0`. |
| `@napplet/vite-plugin` | `0.12.0` | NIP-5A build manifest generation including `archetypes`. | [CITED: official npm tarball `vite-plugin-0.12.0.tgz`] Its public declaration accepts one `{ slug, convention, eventKinds? }` entry per tag. |

### Supporting

| Existing component | Purpose | Use |
|---|---|---|
| `@kehto/services` catalog resolver and intent service | [VERIFIED: Phase 104 verification] Exact installed-contract resolution and result-before-task ordering. | Retain; replace only its temporary imported value types and connect it to host state. |
| `ThemeService` plus eligible ShellBridge route | [VERIFIED: Phase 103 verification] State-before-one-push theme delivery. | Retain in both hosts; do not fork a theme broadcaster. |
| Vitest 4.1.2 / Playwright 1.54.0 | [VERIFIED: root `package.json`] Unit/type/static checks and opaque-origin user-flow proof. | Add focused host and published-contract tests, then run relevant browser specs. |

### Exact dependency changes

| Current | Target | Where |
|---|---|---|
| `@napplet/core` `0.28.0` | exact `0.29.0` | [VERIFIED: package manifests] All direct napplet consumers and fixture pins that currently name core. |
| `@napplet/nap` `0.28.0` | exact `0.29.0` | [VERIFIED: package manifests] All direct napplet consumers and fixture pins that currently name nap. |
| `@napplet/shim` `0.26.8` / `^0.26.8` | exact `0.27.0` | [VERIFIED: package manifests] Playground napplets, fixtures, and shell development dependency. |
| `@napplet/sdk` `0.24.4` | exact `0.25.0` | [VERIFIED: package manifests] Playground napplets and fixtures that use the SDK. |
| `@napplet/vite-plugin` `0.11.2` | exact `0.12.0` | [VERIFIED: package manifests] Playground app, every playground napplet, and all napplet fixtures. |
| `>=0.23.0 <=0.28.x` peer/dev ranges | `>=0.29.0 <0.30.0` | [VERIFIED: `packages/{acl,cli,paja,runtime,services,shell}/package.json`, plus firewall for core] Keep downstream compatibility inside the verified core/nap minor line while the lockfile resolves exact 0.29.0. |

**Installation:** [CITED: npm registry] Update every manifest listed by `rg -l '"@napplet/(core|nap|shim|sdk|vite-plugin)"' --glob package.json` (29 files at research time), then run `pnpm install --lockfile-only` and inspect all new integrity entries. Do not use a broad semver range in napplet/fixture apps: their purpose is to compile and exercise the released contract exactly.

## Package Legitimacy Audit

| Package | Registry evidence | Published | Source repo | Verdict | Disposition |
|---|---|---|---|---|---|
| `@napplet/core@0.29.0` | [VERIFIED: npm registry + exact GitHub tag] | 2026-07-26 | `sandwichfarm/napplet` | Verified official release | Use exact version and recorded integrity. |
| `@napplet/nap@0.29.0` | [VERIFIED: npm registry + exact GitHub tag] | 2026-07-26 | `sandwichfarm/napplet` | Verified official release | Use exact version and recorded integrity. |
| `@napplet/shim@0.27.0` | [VERIFIED: npm registry + exact GitHub tag] | 2026-07-26 | `sandwichfarm/napplet` | Verified official release | Use exact version and recorded integrity; preserve Kehto's shell prelude. |
| `@napplet/sdk@0.25.0` | [VERIFIED: npm registry + exact GitHub tag] | 2026-07-26 | `sandwichfarm/napplet` | Verified official release | Use exact version and recorded integrity. |
| `@napplet/vite-plugin@0.12.0` | [VERIFIED: npm registry + exact GitHub tag] | 2026-07-26 | `sandwichfarm/napplet` | Verified official release | Use exact version and recorded integrity. |

[VERIFIED: npm registry; JSR metadata API; GitHub release tags] None has a `postinstall` script, the exact requested line is published on npm and JSR, and all five tags point to `napplet/web@60889f1c2476e063500c7ab6624af6abe0dbcbe5`. **Packages removed due to SLOP:** none. The source merge at `dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b` passed CI; the generated release commit's later CI failure was an unrelated stale tutorial SDK range, while its npm and JSR publication runs succeeded.

## Architecture Patterns

### System Architecture Diagram

```text
verified NIP-5A manifests                         user default / chooser policy
        |                                                        |
        v                                                        v
Persistent InstalledCatalog -- exact contracts --> CatalogIntentResolver
        |                                                        |
        |                                                retain delivery first
        |                                                        v
feed iframe -- intent.invoke URI --> intent service --> Host IntentController
  (attested dTag)                                      |           |
                                                       |           +-- starts/reuses target
                                                       v
                                              immediate accepted result
                                                       |
                                                       v
profile iframe ready -> published onDelivery buffer -> target-only IntentDelivery
                                                       |
                             relay kind 0 --> profile metadata -> resource.bytes(url)
                                                       |
                                               Blob -> object URL -> image; revoke on replace/pagehide

host theme selection -> ThemeService state -> eligible ShellBridge push -> required Paja/playground frames
```

[VERIFIED: Phase 104 verification; Phase 103 verification] The decisive separation is installed catalog versus runtime frame map. The installed catalog provides eligibility/selection even when a handler is closed; the controller handles window lifecycle and readiness after acceptance.

### Pattern 1: Replace the temporary type mirror, not the host abstractions

[VERIFIED: `packages/services/src/intent-types.ts`; CITED: packed `@napplet/nap@0.29.0` `intent/types` declaration] Delete this file's locally declared `IntentHandlerPreference`, `IntentBehavior`, `IntentInvokeOptions`, `IntentRequest`, `IntentContract`, `IntentCandidate`, `IntentAvailability`, `IntentAcceptedResult`, `IntentRejectedResult`, `IntentResult`, and `IntentDelivery` definitions; re-export or import the released canonical equivalents from `@napplet/core` / `@napplet/nap/intent/types` according to their published declaration ownership. Keep Kehto-only abstractions in `intent-service.ts` and `catalog-intent-resolver.ts`: `IntentResolver`, `IntentRetainedDelivery`, `IntentTargetController`, `IntentRetentionParams`, and catalog-entry/controller interfaces are host policy seams, not upstream wire types.

### Pattern 2: Persistent catalog plus controller per host

[VERIFIED: `apps/playground/src/playground-intent-catalog.ts`; `packages/paja/src/browser-adapter.ts`] Turn the playground's one-shot `buildPlaygroundIntentCatalog()` output into an installed-manifest catalog owned by the host; insert/replace only after `resolvePlaygroundNapplet()` has verified bytes and parsed its manifest, and remove it only when the installed artifact is removed—not when an iframe closes. Paja needs the equivalent catalog sourced from resolved pointers/verified manifests, replacing its `DEV_INTENT_*` simulator. Give each host an `IntentController` that accepts immutable retention params, opens or reuses the selected dTag, waits for the real NAP-SHELL readiness/session, sends exactly one `intent.deliver`, and owns retry/replacement/terminal policy privately.

### Pattern 3: Source-independent profile delivery

[CITED: `naps@a718915.../NAP-INTENT.md`] Feed must use the published intent helper to invoke `napplet:profile/open?pubkey=${encodeURIComponent(pubkey)}` and must not await visible handling. Profile-viewer must declare `requires: ['intent', 'relay', 'resource', 'theme']`, advertise `{ slug: 'profile', convention: 'napplet:profile/open' }`, register `intent.onDelivery()` during startup, validate only the opaque `delivery.payload.pubkey`, and load the profile. Remove the feed/profile INC imports, `profile:open` subscription, and every raw `inc.*` expectation in this flow. Test cold target start and source destruction after acceptance.

### Pattern 4: Await resource bytes and own object URL cleanup

[CITED: `naps@a718915.../NAP-IDENTITY.md`; published core 0.29.0 declaration] For each accepted `http`/`https` profile picture/banner, call `await resource.bytes(url)`, then `URL.createObjectURL(blob)` and assign only that blob URL to the image. Keep one active URL per image; revoke before replacement, on image error, when clearing profile, and on `pagehide`. Do not use a direct remote `src`; do not rely on the current asynchronous `bytesAsObjectURL()` handle for immediate rendering. Expand the host resource origin policy only for deterministic test origins and preserve resource service scheme/origin/size/MIME controls.

**Specification gap (rechecked 2026-07-27):** `napplet/naps` master
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24` contains no standalone
`NAP-RESOURCE.md`. NAP-IDENTITY at that exact ref nevertheless mandates
`window.napplet.resource.bytes(url)` for profile picture/banner bytes. Phase 105
therefore follows that explicit delegation plus the published
`@napplet/core`/`@napplet/nap` 0.29.0 resource contract and Kehto's existing
resource policy; it does not infer any additional missing wire semantics.

### Pattern 5: Keep the Phase 103 theme route intact

[VERIFIED: Phase 103 verification; `packages/services/src/theme-service.ts`] Do not add a new theme subscription or raw iframe loop. Paja's `setThemeMode()` and playground preferences continue to call `ThemeService.publishTheme()`, which updates stored state then calls the one bridge fan-out. Test a required-theme frame loaded after the host value is selected (`theme.get` sees it), plus exactly one matching `theme.changed` after an update.

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
|---|---|---|---|
| Intent URI parsing and normalization | A feed-local parser or manually constructed wire request | [CITED: published `@napplet/nap@0.29.0` `intent` declaration and NAP-INTENT] `intentInvoke(uri, options?)` | Preserves query handling and rejects malformed/duplicate/conflicting query data before transport. |
| Intent public types | A second local contract copy | [CITED: published core/nap declarations] Released `Intent*` types | Avoids package/source type drift. |
| Handler selection | First-running-frame or catalog-order selection | [VERIFIED: Phase 104 resolver] Exact contracts + defaults/chooser/authorization | Installed eligibility and user choice are security-relevant. |
| Target delivery buffer | INC event or source-window callback map | [CITED: NAP-INTENT] Published `onDelivery` plus host retained-delivery controller | Delivery survives source teardown and has no visible INC dependency. |
| Remote media fetch | Direct `<img src>` or napplet `fetch` | [CITED: NAP-IDENTITY and core ResourceApi] NAP-RESOURCE `bytes()` | Enforces host policy in the opaque-origin sandbox. |
| Theme fan-out | Per-host postMessage loops | [VERIFIED: Phase 103] `ThemeService` → eligible `ShellBridge` | Guarantees state-before-one-push and recipient filtering. |

## Common Pitfalls

### Do not mistake a non-shell shim for a NAP-SHELL implementation

[CITED: packed core/shim declarations; `naps/NAP-SHELL.md` master `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`] Neither the generic core global type nor shim 0.27.0 supplies mandatory `window.napplet.shell`, even though the current NAP-SHELL draft requires it. Do not delete Kehto's already-injected host-owned prelude during package adoption. The approved phase decision is to retain that implementation as an explicit upstream-package-drift exception and encode it in the contract test and active docs.

### A catalog built from frames loses cold-start intent handling

[VERIFIED: Phase 104 verification] Current frames are lifecycle state, not manifest authority. If a host deletes the profile candidate when its iframe closes, the feed cannot invoke the installed profile app on a cold start. Mutate installed catalog state at verified install/remove boundaries and maintain a separate `dTag → live target/session` index for delivery.

### Completion-style UI semantics corrupt accepted intent results

[CITED: NAP-INTENT draft] `ok: true` only means the controller retained delivery responsibility. Do not show success as "profile opened" or add `handled`, window, protocol, delivery-ID, or INC status fields. The browser proof must assert immediate acceptance before target delivery and one target-only buffered delivery after readiness.

### Object URLs leak or stale async loads repaint the wrong profile

[CITED: NAP-IDENTITY resource resolution] Associate each media fetch with the current profile request/token. If a later profile wins, revoke the stale URL and do not overwrite the current image. Verify every clear/error/pagehide path revokes its object URL.

### Resource policy becomes an SSRF bypass

[CITED: NAP-IDENTITY; existing `createResourceService`] Do not relax `isOriginGranted`, private-IP/DNS protection, byte caps, or MIME handling merely to display profile media. Use known fixture origins for tests and fail to fallback UI on denied/invalid media.

## Code Examples

### Feed invokes a published convention URI

```ts
// Source: [CITED: NAP-INTENT draft PR #91 at a718915...]
import { intentInvoke } from '@napplet/nap/intent';

void intentInvoke(`napplet:profile/open?pubkey=${encodeURIComponent(pubkey)}`);
```

### Profile consumes target-only delivery and safe image bytes

```ts
// Source: [CITED: NAP-INTENT + NAP-IDENTITY]
import { intentOnDelivery } from '@napplet/nap/intent';
import { resourceBytes } from '@napplet/nap/resource';

let activeImageUrl: string | undefined;

intentOnDelivery((delivery) => {
  const pubkey = readCanonicalPubkey(delivery.payload);
  if (delivery.convention === 'napplet:profile/open' && pubkey) loadProfile(pubkey);
});

async function setProfileImage(remoteUrl: string): Promise<void> {
  const blob = await resourceBytes(remoteUrl);
  const next = URL.createObjectURL(blob);
  if (activeImageUrl) URL.revokeObjectURL(activeImageUrl);
  activeImageUrl = next;
  picture.src = next;
}
```

## Recommended Project Structure

```text
apps/playground/src/
├── installed-napplet-catalog.ts       # persistent verified manifest records
├── playground-intent-controller.ts    # retain/start/ready delivery policy
├── shell-host.ts                      # verified install lifecycle populates catalog
└── playground-intent-catalog.ts       # adapter remains the manifest → entry conversion
packages/paja/src/
├── installed-napplet-catalog.ts       # pointer/manifest-backed installed records
└── browser-intent-controller.ts        # Paja retained-delivery lifecycle policy
packages/services/src/
├── intent-service.ts                  # host-neutral wire/service seam (retain)
└── catalog-intent-resolver.ts          # exact policy-aware resolver (retain)
apps/playground/napplets/
├── feed/src/main.ts                   # published intent caller + resource-safe avatars
└── profile-viewer/src/main.ts          # published delivery receiver + safe profile media
```

## State of the Art

| Old approach | Current approach | Impact |
|---|---|---|
| [VERIFIED: feed/profile source] INC `profile:open` broadcast and receiver registration | [CITED: NAP-INTENT; packed nap 0.29.0] URI `intentInvoke()` followed by target-only `intentOnDelivery()` | Invocation accepts retained responsibility independently of source iframe lifetime. |
| [VERIFIED: Paja adapter and playground catalog] live frame/dev simulator decides available handler | [VERIFIED: Phase 104 verification] verified installed-manifest catalog plus a host lifecycle controller | Cold target start and user policy remain possible without trusting a running iframe. |
| [VERIFIED: feed/profile source] remote URL written to `img.src` | [CITED: NAP-IDENTITY; packed nap 0.29.0] `resourceBytes()` then revocable blob URL | Profile media remains behind host resource policy and has explicit memory cleanup. |
| [CITED: packed core/shim 0.29.0/0.27.0] generic published packages omit shell | [CITED: NAP-SHELL master `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`; verified Kehto host code] retained host-owned NAP-SHELL prelude until a reviewed upstream correction | The plan must preserve the live mandatory shell surface rather than assuming dependency adoption supplies it. |

## Documentation and Release Impacts

- [VERIFIED: `AGENTS.md`] Update affected package READMEs/API documentation and the user-facing playground/Paja documentation in the same branch as the code. Document the URI and target-delivery semantics, resource-mediated avatar/profile media, and the no-INC profile route.
- [CITED: packed core/shim declarations; `naps/NAP-SHELL.md` master `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`] Do not describe `@napplet/shim@0.27.0` as providing `window.napplet.shell`; document the approved PKG-02 host-prelude decision and its compatibility boundary.
- [VERIFIED: `AGENTS.md`] Add a changeset only if shipped `@kehto/*` output changes. Keep package documentation version rows aligned with generated release metadata; do not perform local publishing.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | [VERIFIED: root `package.json`] Vitest 4.1.2 and Playwright 1.54.0 |
| Config | [VERIFIED: codebase] `vitest.config.ts`, `playwright.config.ts` |
| Quick run | `pnpm exec vitest run tests/unit/published-napplet-contract.test.ts tests/unit/playground-intent-catalog.test.ts` |
| Full suite | `pnpm build && pnpm type-check && pnpm test:unit && pnpm test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| PKG-01/03 | Released declarations compile and publish the required intent/manifest surfaces; local mirror is absent. | type + static | `pnpm exec vitest run tests/unit/published-napplet-contract.test.ts` | ❌ Wave 0 |
| PKG-02 | NAP-SHELL remains live before `shell.ready`, preserves one init/ready and synchronous supports, and records the Kehto host-prelude upstream-drift decision. | browser + static | `pnpm exec vitest run tests/unit/published-napplet-contract.test.ts && pnpm exec playwright test tests/e2e/paja-single-window.spec.ts` | ❌ extend |
| PKG-04 | Every consumer pin/range and lock snapshot resolves only the selected npm/JSR-published line. | static | `pnpm exec vitest run tests/unit/napplet-package-alignment.test.ts` | ❌ Wave 0 |
| ARCH-03 | Feed URI → accepted result → cold profile target ready → one attested delivery, then source teardown. | browser integration | `pnpm exec playwright test tests/e2e/playground-profile-intent.spec.ts` | ❌ Wave 0 |
| IDENTITY-05 | Feed/profile render only blob URLs, revoke stale/cleared URLs, and use NAP-RESOURCE on denied/valid media paths. | unit + browser | `pnpm exec vitest run tests/unit/profile-resource-media.test.ts` | ❌ Wave 0 |
| THEME-04 | Paja and playground initial required-theme read plus one matching changed update. | browser integration | `pnpm exec playwright test tests/e2e/paja-single-window.spec.ts tests/e2e/theme-broadcast.spec.ts` | ✅ extend |

### Wave 0 Gaps

- [ ] `tests/unit/published-napplet-contract.test.ts` — inspect installed declarations/package manifests and prevent reintroducing `intent-types.ts` mirror.
- [ ] `tests/unit/napplet-package-alignment.test.ts` — enumerate the 29 manifest consumers, peer ranges, lockfile resolutions, integrity provenance, and exact npm/JSR release versions.
- [ ] `tests/unit/profile-resource-media.test.ts` — object URL creation/revocation and denied/stale fetch vectors.
- [ ] `tests/e2e/playground-profile-intent.spec.ts` — live feed/profile cold start, source teardown, exact target delivery, no INC envelope, safe media.

## Security Domain

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | yes | [VERIFIED: Phase 101/104 verification] Runtime derives source dTag from the established session; no caller sender. |
| V4 Access Control | yes | [VERIFIED: Phase 104 verification] Exact installed contracts, explicit-handler authorization, user default/chooser policy, and eligible-session sends. |
| V5 Input Validation | yes | [CITED: NAP-INTENT/IDENTITY] Validate canonical pubkeys and delivery payload shape locally; keep URI parsing in the published binding. |
| V6 Cryptography | yes | [VERIFIED: playground `loadNapplet`] Resolve/verify manifests and artifact bytes before catalog insertion or `srcdoc` rendering. |

| Threat | STRIDE | Mitigation |
|---|---|---|
| Running-frame spoof selects a profile handler | Spoofing / elevation | [VERIFIED: Phase 104] Select only verified installed exact contracts; then map selected dTag to host-created target. |
| Source closes before target starts | Denial / tampering | [CITED: NAP-INTENT] Retain immutable delivery before result and buffer until `onDelivery`. |
| Remote profile URL bypasses sandbox/resource policy | SSRF / information disclosure | [CITED: NAP-IDENTITY] `resource.bytes()` through host policy; blob URLs only in the iframe. |
| Object URL retains old private bytes | Information disclosure | [CITED: browser URL API pattern; core ResourceApi] Revoke on replacement, error, clear, and pagehide. |
| Dependency substitution during a fresh release | Supply chain | [VERIFIED: package legitimacy check] Human provenance/integrity checkpoint before installation; no postinstall scripts were reported. |

## Resolved Decisions and Open Questions

1. **Resolved — PKG-02 package/spec mismatch:** Retain Kehto's conformant injected host-owned prelude, document the missing upstream export as package drift, and guard the release upgrade against removing or overriding `window.napplet.shell`.
2. **Open — What product UI chooses an ambiguous profile handler in each host?**
   - What we know: [VERIFIED: Phase 104 resolver] the resolver already has an injected chooser/default seam and rejects ambiguity without one.
   - Recommendation: Paja can use its existing host/devtools selection surface and playground can use an explicit host chooser; both must receive only exact compatible installed candidates.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | pnpm install/build/tests | ✓ | v25.2.1 | — |
| pnpm | workspace lockfile update | ✓ | 10.8.0 | — |
| npm registry | published package audit | ✓ | npm 11.6.2 | — |
| Playwright tooling | browser proof | ✓ | 1.54.0 declared | run its configured local browser harness |
| Exact JSR releases | PKG-04 registry-parity claim | ✓ | core/nap 0.29.0; shim 0.27.0; SDK 0.25.0; Vite plugin 0.12.0 | recheck JSR metadata API before lockfile update |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | None. All implementation recommendations are tied to inspected npm artifacts, NAP authority, prior verification, or current code. | — | — |

## Sources

### Primary

- [CITED: npm registry tarballs] `@napplet/core@0.29.0`, `@napplet/nap@0.29.0`, `@napplet/shim@0.27.0`, `@napplet/sdk@0.25.0`, `@napplet/vite-plugin@0.12.0` — exact package manifests and declarations inspected.
- [CITED: `naps/NAP-INTENT.md` at `a718915ddefa2f03a0126579601f59d8bd86f7c4`] URI invocation, exact contracts, accepted-result meaning, retained target delivery, and manifest tags.
- [CITED: `naps/NAP-IDENTITY.md` at `a718915ddefa2f03a0126579601f59d8bd86f7c4`] NAP-RESOURCE requirement for profile picture/banner bytes.
- [CITED: `naps/NAP-SHELL.md` master at `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`] mandatory shell, one ready/init, and synchronous local support semantics.
- [VERIFIED: Phase 103 and 104 verification reports] Existing theme and host-independent intent conformance seams.

### Secondary

- [VERIFIED: JSR metadata API] Exact current JSR releases for all five packages, used to confirm PKG-04 registry parity.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — npm tarballs, JSR metadata, exact GitHub tags, source CI, and successful publication runs confirm the requested package versions and lineage.
- Architecture: HIGH — Phase 103/104 verified seams and current Paja/playground gaps are directly inspected.
- Pitfalls: HIGH — derived from NAP security semantics, prior verification, and concrete raw-INC/direct-image/current-simulator code.

**Research date:** 2026-07-26  
**Valid until:** 2026-08-02 — recheck npm integrity, JSR metadata, NAP-SHELL master, and draft PR #91 head immediately before dependency installation.
