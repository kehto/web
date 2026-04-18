# Phase 21: Fixture Napplets & Layer-A Specs - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous)

<domain>
## Phase Boundary

Build per-NUB-domain fixture napplets at `tests/fixtures/napplets/` and matching `nub-<domain>.spec.ts` Layer-A specs that drive the runtime via the harness driver API (`window.__*` globals from Phase 16) — independent of the demo server. Protocol correctness becomes verifiable without booting the demo.

Covers requirement: **E2E-09**.
</domain>

<decisions>
## Implementation Decisions

### Locked Directives

**D-01 — One fixture napplet per non-stub NUB domain (6 total).**
Domains: `identity`, `ifc`, `notify`, `relay`, `storage`, `theme`. Each fixture napplet is minimal — single-purpose, `<title>nub-<domain> fixture</title>`, no UI beyond what's needed for harness assertions.

**D-02 — Existing `tests/fixtures/napplets/auth-napplet`, `publish-napplet`, `pure-napplet` are legacy.** Per Phase 20 iteration log, harness specs against them are skipped because they use NIP-01 array protocol incompatible with v1.2 NIP-5D shell. Plan 21 may either:
- (a) delete them and replace with new SDK-based fixtures, OR
- (b) keep legacy fixtures alongside but mark them clearly deprecated with a README

Recommended: (a) — delete legacy fixtures and create 6 new SDK-based fixtures. Cleanliness > backward compat for v1.3.

**D-03 — Each fixture napplet uses `@napplet/sdk`.** Same package shape as demo napplets: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`. Naming: `@kehto/fixture-nub-<domain>`. NO `addEventListener('message')` exemptions — fixtures are minimal and use SDK only.

**D-04 — One Layer-A spec per fixture napplet (6 specs total).**
- `tests/e2e/nub-identity.spec.ts` — load fixture, harness `__getServiceNames__` includes 'identity'; `__injectEnvelope__` for `identity.getPublicKey` returns `.result` envelope (use `__getNubMessage__` to assert).
- `tests/e2e/nub-ifc.spec.ts` — load fixture, exercise `ifc.subscribe` + `ifc.emit` round-trip via two fixture instances (or via `__injectEnvelope__` + `__getNubMessage__`).
- `tests/e2e/nub-notify.spec.ts` — `notify.create` + `notify.list` + `notify.dismiss` round-trip; `__getNotifications__` reflects state.
- `tests/e2e/nub-relay.spec.ts` — `relay.publish` + `relay.publishEncrypted` envelope shapes; runtime returns `.result` envelopes.
- `tests/e2e/nub-storage.spec.ts` — `storage.setItem` + `storage.getItem` round-trip; envelopes correct.
- `tests/e2e/nub-theme.spec.ts` — `theme.changed` push from harness, fixture receives.

All Layer-A specs target `:4173` (harness), use `aclBeforeEach` (NOT `demoBeforeEach`), and drive via harness globals only — no DOM iframe interaction beyond loading napplets.

**D-05 — Stub-domain Layer-A specs.** Per ROADMAP Phase 21 success criterion 3: `nub-keys.spec.ts` and `nub-media.spec.ts` exist and explicitly document stub scope. They assert the stub response shape (e.g., "not implemented" or empty result) without asserting real backend behavior. No fixture napplet for keys/media — these specs use `__injectEnvelope__` directly to assert runtime stub behavior.

So total Layer-A specs = 8 (6 active + 2 stub).

**D-06 — Test harness build pipeline.** Fixture napplets must be built before Playwright runs; `pnpm-workspace.yaml` `tests/fixtures/napplets/*` glob already includes them, so they're auto-discovered. Update `turbo.json build:napplets` (Phase 16 task) to include `tests/fixtures/napplets/*` outputs if not already.

**D-07 — Iteration loop.** Phase closes after all v1.3 Layer-A specs (8 new) + Layer-B specs (Phase 17/18/19/20) green together. Record in `.planning/phases/21-fixture-napplets-layer-a-specs/21-ITERATION-LOG.md`.

### Claude's Discretion
- Whether legacy `auth-napplet`/`publish-napplet`/`pure-napplet` fixtures stay or get deleted (recommended: delete per D-02 option a)
- Exact harness commands (`__loadNapplet__('nub-identity')` etc.) — verify in `tests/e2e/harness/harness.ts`
- Whether nub-ifc spec uses 2 fixture instances (round-trip) or just one (envelope-shape only)
- Whether the nub-keys / nub-media stub specs document the stub by asserting an explicit error envelope or by asserting the message simply doesn't crash

### Anti-features
- No raw `addEventListener('message')` in fixture napplets (no SDK-gap exemption needed — fixtures are minimal).
- No `window.nostr`, no signer-service, no BusKind, no kind 29001/29002.
- No new core-compat.ts consumers.
- No demo-server dependencies in Layer-A specs (target :4173 harness only).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Demo napplet templates from Phase 19/20 (composer/preferences/toaster/feed/profile-viewer) are templates for fixture napplets — strip UI down to essentials.
- Phase 16 17 driver globals: `__injectEnvelope__`, `__getNubMessage__`, `__getServiceNames__`, `__registerService__`, `__unregisterService__`, `__getNotifications__`, `__setIdentityPubkey__`, `__nappletReady__`, `__loadNapplet__`, `__aclClear__`, `__clearLocalStorage__`, `__SHELL_READY__`, etc.
- Phase 16 helper: `aclBeforeEach` (canonical for harness specs at :4173).
- Phase 16 `tests/e2e/harness-smoke.spec.ts` is the reference Layer-A spec shape.

### Established Patterns
- pnpm-workspace.yaml includes `tests/fixtures/napplets/*` glob (verified earlier).
- Each fixture napplet's package.json mirrors demo napplets: `@napplet/shim` + `@napplet/sdk` link deps.
- Layer-A spec convention: target `:4173`, use harness globals only, no `frameLocator` interactions on napplet content beyond load.
- Per Phase 20 iteration: harness auth specs are skipped against legacy fixtures — fixing that is THIS phase's job.

### Integration Points
- New: `tests/fixtures/napplets/{nub-identity,nub-ifc,nub-notify,nub-relay,nub-storage,nub-theme}/` directories
- Optional delete: `tests/fixtures/napplets/{auth-napplet,publish-napplet,pure-napplet}/` if D-02(a) chosen
- New: 8 Layer-A specs at `tests/e2e/nub-*.spec.ts`
- Iteration log at `.planning/phases/21-fixture-napplets-layer-a-specs/21-ITERATION-LOG.md`

</code_context>

<specifics>
## Specific Ideas

- Each fixture napplet's main.ts can be 5-15 lines: import SDK, do one or two SDK calls on init, exit. Goal is to be loadable + observable.
- For nub-ifc: use one fixture that subscribes + emits via SDK. Round-trip can be tested by harness `__injectEnvelope__` of an `ifc.message` envelope and assertion via `__getNubMessage__`.
- For nub-storage: fixture calls `sdk.storage.setItem('test', 'value')` on init. Spec asserts the harness sees the envelope and a `.result` comes back.
- For nub-theme: fixture subscribes to theme changes via SDK or postMessage exemption (theme-broadcast pattern from Phase 20). Spec uses `__injectEnvelope__` to push a `theme.changed` and asserts fixture observes.
- For nub-keys/nub-media stubs: no fixture napplet; spec uses `__injectEnvelope__('keys.register', ...)` and asserts the runtime returns either a stub-result envelope or a clear "not implemented" error. Document explicitly.

</specifics>

<deferred>
## Deferred Ideas

- Real fixture napplets for keys + media — explicitly out of scope (NAP-09 deferral; v1.4).
- Migrating legacy auth-napplet to SDK — not worth the effort; just delete it.
- Coverage of advanced relay actions (filters, EOSE timing) — basic envelope shape suffices.

</deferred>
