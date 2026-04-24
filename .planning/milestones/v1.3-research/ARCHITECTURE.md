# Architecture Research

**Domain:** v1.3 Demo-Functional + Playwright Parity — kehto shell host, napplet placement, harness driver API
**Researched:** 2026-04-17
**Confidence:** HIGH (all findings sourced directly from the codebase — zero speculation)

---

## System Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│  apps/demo  (vite dev :5174 / preview :4174 — demo audience)              │
│                                                                           │
│  index.html → src/main.ts → src/shell-host.ts                            │
│  src/shell-host.ts: bootShell() → createShellBridge(ShellAdapter)        │
│  ShellAdapter implements: relayPool(stub), auth(signer), services{...}   │
│                                                                           │
│  Napplets loaded as sandboxed iframes from /napplets/{name}/index.html   │
│  Served by serveDemoNapplets() Vite plugin → apps/demo/napplets/*/dist/  │
│                                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  bot     │  │  chat    │  │  feed    │  │ composer │  │ profile  │  │
│  │(existing)│  │(existing)│  │  (new)   │  │  (new)   │  │ (new)    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└───────────────────────────────────────────────────────────────────────────┘

                   ▲ different port, different webpack entry
                   │ same @kehto/* packages
                   ▼

┌───────────────────────────────────────────────────────────────────────────┐
│  tests/e2e/harness  (@test/harness — Playwright target :4173)             │
│                                                                           │
│  harness.ts: createShellBridge(mockHooks) + window.__* driver API        │
│  Serves fixture napplets from tests/fixtures/napplets/*/dist/            │
│                                                                           │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────┐                  │
│  │ auth-napplet │  │ publish-napplet │  │ pure-napplet│                  │
│  │  (existing)  │  │   (existing)   │  │  (existing) │                  │
│  └──────────────┘  └────────────────┘  └─────────────┘                  │
│  + new domain-exercise fixtures per phase                                 │
└───────────────────────────────────────────────────────────────────────────┘

Both tiers share: @kehto/shell, @kehto/runtime, @kehto/acl, @kehto/services
Both tiers share: @napplet/shim, @napplet/sdk (via pnpm workspace overrides)
```

---

## Question 1: Napplet Placement — Ship-with-Demo vs Test-Only

### Decision: Use Placement as a Contract, Not Convenience

The two directories serve distinct contracts. Choosing placement is a design decision about who the consumer is and what the napplet depends on.

**`apps/demo/napplets/*` — Ship-with-demo napplets**

These are bundled with and served by `apps/demo/vite.config.ts` via the `serveDemoNapplets()` plugin which reads from `apps/demo/napplets/*/dist/`. They:
- Use `@napplet/sdk` (the full API surface: `ipc`, `storage`, `relay`, `identity`, `theme`)
- Are meaningful to a human observer — they have UI, do real things
- Exercise the full protocol round-trip including real service backends (notifications, keys, media, identity)
- Are referenced by name in `DEMO_NAPPLETS` in `shell-host.ts` and mapped to DOM slots (`#chat-frame-container`, `#bot-frame-container`, etc.)
- Require DOM slots in `apps/demo/index.html` and topology entries in `topology.ts`

**`tests/fixtures/napplets/*` — Test-only fixture napplets**

These are served by `tests/e2e/harness/vite.config.ts` via `serveNapplets()` which reads from `tests/fixtures/napplets/*/dist/`. They:
- May use only `@napplet/shim` (no SDK needed — just the protocol primitives)
- Are purpose-built to exercise a specific protocol behavior in isolation
- Have no meaningful human UI — just enough DOM to let the test verify state
- Are loaded by name via `window.__loadNapplet__('auth-napplet')` from Playwright
- Signal completion via `window.parent.postMessage(['__TEST_DONE__', kind], '*')` to the harness

### Recommended Placement for New v1.3 Napplets

New single-purpose napplets that exercise one NUB domain and have meaningful UI belong in `apps/demo/napplets/*`. The demo's purpose is to show all 8 domains working end-to-end with real service backends. These also become Playwright targets when the spec navigates to the demo (`demo-audit-correctness.spec.ts` pattern — spawns a separate dev server on :4174).

New minimal fixtures that isolate a protocol behavior for deterministic test control belong in `tests/fixtures/napplets/*`. The harness serves these; Playwright tests on the harness at :4173 call `window.__loadNapplet__('name')`.

**The split for v1.3 new napplets:**

| Napplet | Placement | Rationale |
|---------|-----------|-----------|
| `feed` (relay:read showcase) | `apps/demo/napplets/feed` | Has UI, exercises real relay NUB, meaningful for demo audience |
| `composer` (relay.publish + keys.sign flow) | `apps/demo/napplets/composer` | Has UI, exercises signing flow end-to-end |
| `profile-viewer` (identity.* reads) | `apps/demo/napplets/profile-viewer` | Has UI, exercises identity NUB reads |
| `theme-tester` (theme.get + apply) | `apps/demo/napplets/theme-tester` | Has UI, shows theming round-trip |
| `nub-relay-fixture` (pure relay subscribe/publish) | `tests/fixtures/napplets/nub-relay-fixture` | Deterministic, no UI needed, harness-only |
| `nub-identity-fixture` (pure identity.* reads) | `tests/fixtures/napplets/nub-identity-fixture` | Deterministic, harness-only |
| `nub-storage-fixture` (pure storage NUB) | `tests/fixtures/napplets/nub-storage-fixture` | Deterministic, harness-only |
| `nub-notify-fixture` (pure notify.* calls) | `tests/fixtures/napplets/nub-notify-fixture` | Deterministic, harness-only |
| `nub-ifc-fixture` (pure ifc.emit + ifc.on) | `tests/fixtures/napplets/nub-ifc-fixture` | Deterministic, harness-only |
| `nub-keys-fixture` (pure keys.* forwarding) | `tests/fixtures/napplets/nub-keys-fixture` | Deterministic, harness-only |

**Trade-off summary:**

Placing demo-purpose napplets in `tests/fixtures/` would save build steps (they'd be included in the harness build path), but the harness serves `tests/fixtures/napplets/*/dist/` only — the demo serves `apps/demo/napplets/*/dist/` only. These are two different Vite servers on two different ports. Mixing them would require either changing both Vite configs or hardcoding cross-directory paths in both. The current split is clean and intentional.

Placing fixture napplets in `apps/demo/napplets/` would force the demo's topology to register DOM slots for invisible test aids, polluting `DEMO_NAPPLETS`, `topology.ts`, and `index.html`.

---

## Question 2: Shell Host Pattern — Real Backends + Stubbed Identity/Relay

### Current Pattern (v1.2)

`apps/demo/src/shell-host.ts` `createDemoHooks()` returns a `ShellAdapter` with:
- `relayPool`: fully stubbed (subscription returns a no-op `unsubscribe`)
- `auth.getSigner`: delegates to `signer-connection.ts` (real NIP-46 + NIP-07 via user interaction)
- `auth.getUserPubkey`: delegates to `signer-connection.ts`
- `services.identity`: `createIdentityService({ getSigner })` from `@kehto/services`
- `services.notifications`: `createNotificationService({ onChange, maxPerWindow: 50 })`

### Target Pattern for v1.3

The goal is: real service backends for `keys`, `media`, `notify`; identity kept real but without blocking test startup; relay kept stubbed so tests remain deterministic.

**Recommended `ShellAdapter` composition for v1.3 demo:**

```
ShellAdapter
  relayPool:    stub (unchanged — subscribe is no-op, publish is no-op)
  relayConfig:  stub (unchanged)
  auth:
    getUserPubkey: () => signerConnection.pubkey ?? ''
    getSigner:     () => signerConnection.signer
  services:
    identity:      createIdentityService({ getSigner })   // real reads from signer
    notifications: createNotificationService({ onChange }) // real accumulate + dispatch
    keys:          createKeysService({ getSigner })        // real forward to signer
    media:         createMediaService({ storageAdapter })  // real (or stub upload)
    theme:         createThemeService({ onThemeChange })   // real (apply to host CSS)
  crypto:        real (nostr-tools/pure verifyEvent + crypto.getRandomValues)
  shellSecretPersistence: real (localStorage)
  guidPersistence: real (localStorage)
  getConfigOverrides: () => demoConfig values
  onAclCheck:    (event) => pushAclEvent(...)             // existing, unchanged
```

**Stubbed relay pool is the key decision:** `relay.publish` and `relay.subscribe` are no-ops in the demo. This keeps the demo deterministic for IFC (inter-napplet communication goes through the shell's internal event buffer, not a relay), storage (state-handler uses the shell's internal Map, not a relay), and notifications (accumulate in-process). The only "relay" traffic that matters for the demo is ifc between the napplets — and that routes through the runtime's `ifcSubscriptions` map, not the relay pool.

**For tests (harness side):** The harness uses `createMockHooks()` from `@test/helpers` which already stubs everything. Tests that need a signer call `window.__setSigner__(mockSigner)`. Tests that need deterministic relay delivery call `window.__injectMessage__(windowId, [...])` directly.

### The "Test Determinism" Contract

When Playwright drives the demo (port 4174, `demo-audit-correctness.spec.ts` pattern), determinism comes from:
1. No real relay pool → no async relay events arriving from outside
2. Auth is either stubbed (test injects a mock signer) or skipped (test uses the harness instead)
3. Notification service is synchronous in its `onChange` callback
4. ACL state starts cleared (test calls `__aclClear__()` in `beforeEach`)

When Playwright drives the harness (port 4173), determinism is tighter — `createMockHooks()` controls everything.

**Recommendation:** For golden-path demo tests, use the harness (`:4173`) with purpose-built fixture napplets that exercise the same domains as the demo napplets, but without the demo's real signer dependency. Demo-targeting specs (`:4174`) are reserved for UX integration tests where the full demo surface (topology, ACL panels, debugger, node inspector) must be verified.

---

## Question 3: Playwright Spec Organization

### Current State

Existing specs at `tests/e2e/*.spec.ts` are organized by **protocol behavior category**:
- `auth.spec.ts` — AUTH handshake correctness (NIP-42 flow)
- `acl-enforcement.spec.ts`, `acl-lifecycle.spec.ts`, `acl-matrix-*.spec.ts` — ACL correctness
- `lifecycle.spec.ts`, `routing.spec.ts`, `replay.spec.ts` — protocol engine behaviors
- `demo-audit-correctness.spec.ts`, `demo-node-inspector.spec.ts` — demo surface verification

### Recommended Organization for v1.3

Organize by **test target layer**, not by NUB domain:

**Layer A — Harness protocol specs (`tests/e2e/*.spec.ts`, target :4173)**

These verify the runtime engine against minimal fixtures. Existing pattern is correct. Organize by NUB domain for v1.3 additions:

```
tests/e2e/
  nub-relay.spec.ts         # relay.subscribe, relay.publish, relay.event delivery
  nub-identity.spec.ts      # identity.* reads via service handler
  nub-storage.spec.ts       # storage.get/set/remove/keys NUB round-trips
  nub-notify.spec.ts        # notify.* service dispatch + onChange callback
  nub-ifc.spec.ts           # ifc.emit → ifc.event delivery, ifc channels
  nub-keys.spec.ts          # keys.* forwarding to signer
  nub-theme.spec.ts         # theme.get → theme.event delivery
  acl-enforcement.spec.ts   # (keep, migrate to NIP-5D envelopes)
  acl-lifecycle.spec.ts     # (keep, migrate)
  lifecycle.spec.ts         # (keep, migrate — window destroy/cleanup)
  routing.spec.ts           # (keep, migrate — NUB dispatch correctness)
  replay.spec.ts            # (assess — replay protection may not apply to envelopes)
  state-isolation.spec.ts   # (keep, migrate — per-napplet storage scoping)
  harness-smoke.spec.ts     # (keep, trivial — checks harness boots)
```

**Layer B — Demo surface specs (`tests/e2e/demo-*.spec.ts`, target :4174)**

These verify the demo UX — panels, napplets, topology, ACL interaction. Keep `demo-audit-correctness.spec.ts` as the model; add per-surface specs as demo surfaces are migrated:

```
tests/e2e/
  demo-shell-host.spec.ts       # Shell boots, napplets auth, topology renders
  demo-acl-panels.spec.ts       # ACL panels render, grant/revoke reflects in runtime
  demo-notification-service.spec.ts # (keep — tests notification panel UX)
  demo-node-inspector.spec.ts   # (keep — tests inspector panel)
  demo-signer-flow.spec.ts      # NIP-46 connect → identity.* read → relay.publish flow
  demo-napplet-feed.spec.ts     # feed napplet loads, subscribes, receives events
  demo-napplet-composer.spec.ts # composer sends relay.publish, sees OK
  demo-napplet-ifc.spec.ts      # chat→bot IFC round-trip (existing chat/bot napplets)
```

### Iteration Discipline: Per-Phase Gate Pattern

The recommended "build → run → Playwright → fix" loop discipline:

Each phase in v1.3 ends with a **phase gate spec** that must pass before the phase is complete. The gate spec is the acceptance criterion for that phase's changes. Pattern:

```
Phase N: Migrate [surface/napplet/nub]
  Step 1: Migrate the source (demo surface, napplet, harness, package)
  Step 2: pnpm build (turbo run build)
  Step 3: pnpm test:serve (start harness or demo server)
  Step 4: npx playwright test [relevant spec] (Playwright MCP)
  Step 5: Fix failures → back to step 3 (no rebuild needed for harness specs; rebuild for demo)
  Step 6: All specs in phase gate pass → phase done
```

**This works because:**
- Layer A specs (harness, :4173) only need the harness to rebuild after `@kehto/*` package changes — the `pnpm test:build` step handles this
- Layer B specs (demo, :4174) spawn their own dev server in `beforeAll` at a separate port — they don't use the `:4173` webServer from `playwright.config.ts`

**Build order for phase gate:**

```
turbo run build
  → packages/acl (no deps)
  → packages/runtime (depends on acl)
  → packages/services (depends on runtime)
  → packages/shell (depends on runtime)
  → tests/fixtures/napplets/* (depends on @napplet/shim, @napplet/vite-plugin)
  → apps/demo/napplets/* (depends on @napplet/sdk, @napplet/vite-plugin)
  → tests/e2e/harness (depends on @kehto/shell)
  → apps/demo (depends on @kehto/shell, @kehto/services, @kehto/runtime)
```

The turbo `build` pipeline already encodes these dependencies via `dependsOn`. The key ordering constraint: napplets must build before the host that serves them (harness or demo), since both serve pre-built `dist/` directories.

---

## Question 4: Driver/Harness API — window.__KEHTO_RUNTIME__ Escape Hatch

### Current Harness API (v1.2)

The harness exposes `window.__*` globals for Playwright, defined in `tests/e2e/harness/harness.ts`:

```typescript
window.__SHELL_READY__        // boolean sentinel — wait for this before proceeding
window.__TEST_MESSAGES__      // TappedMessage[] — live tap of all messages
window.__loadNapplet__(name)  // load a fixture napplet, returns windowId
window.__unloadNapplet__(wid) // remove a fixture napplet iframe
window.__clearMessages__()    // reset message tap
window.__getRelay__()         // ShellBridge reference (NOT safe to use directly in evaluate)
window.__getMockHooks__()     // MockHooksResult reference (NOT safe to use directly)
window.__injectMessage__(wid, data) // inject raw message as if from napplet
window.__createSubscription__(wid, subId, filters)
window.__publishEvent__(wid, event)
window.__closeSubscription__(wid, subId)
window.__getChallenge__(wid)  // get pending AUTH challenge for a windowId
window.__getNappletFrames__() // list loaded windowIds
// ACL control:
window.__aclRevoke__(pubkey, dTag, hash, cap)
window.__aclGrant__(pubkey, dTag, hash, cap)
window.__aclBlock__(pubkey, dTag, hash)
window.__aclUnblock__(pubkey, dTag, hash)
window.__aclPersist__()
window.__aclLoad__()
window.__aclClear__()
window.__aclCheck__(pubkey, dTag, hash, cap) → boolean
window.__aclGetEntry__(pubkey, dTag, hash) → unknown
window.__getNappPubkey__(wid) → string | undefined
window.__getNappEntry__(wid) → { pubkey, dTag, aggregateHash } | undefined
window.__setSigner__(signer) // inject mock signer into mockResult
window.__setConsentHandler__(mode) // 'auto-approve' | 'auto-deny'
window.__injectShellEvent__(topic, payload)
window.__getLocalStorageKeys__() → string[]
window.__getLocalStorageItem__(key) → string | null
window.__setLocalStorageItem__(key, value)
window.__clearLocalStorage__()
```

### Recommended Extension for v1.3 — NIP-5D Envelope-Aware Helpers

The existing `__injectMessage__` sends NIP-01 arrays. With NIP-5D envelopes, specs need to inject typed envelope objects. The cleanest approach is **additive helpers** that wrap `__injectMessage__` with the correct envelope shape:

```typescript
// New helpers to add to harness.ts:
window.__injectEnvelope__       // inject a NIP-5D envelope { type, ...payload } from a napplet
window.__sendEnvelope__         // alias for clarity in new specs
window.__getRuntime__           // returns a serializable snapshot of runtime state (NOT a live reference)
window.__getServiceNames__()    // → string[] of registered service names
window.__registerService__(name, handlerIndex) // register a named test service (pre-registered handlers)
window.__unregisterService__(name) // unregister a service
window.__getInjectedMessages__()  // messages that were sent TO napplets (shell→napplet direction)
```

**On `window.__KEHTO_RUNTIME__` / escape hatch:**

The harness should NOT expose the live `Runtime` or `ShellBridge` object through `window.evaluate()`. `page.evaluate()` in Playwright serializes return values via JSON; live objects with methods are not serializable. The current pattern (`window.__getRelay__()` returns the live relay reference) is only safe for calling methods — it is never used to return the bridge to the test.

The correct pattern for v1.3: expose **state-snapshot functions** that return plain serializable objects:

```typescript
// Returns a snapshot, NOT a live reference:
window.__getRuntimeSnapshot__ = () => ({
  sessionCount: relay.runtime.sessionRegistry.count(),
  serviceNames: [...serviceRegistry.keys()],
  aclEntryCount: relay.runtime.aclState.count(),
  subscriptionCount: relay.runtime.subscriptionCount?.() ?? -1,
});

// For debugging Playwright runs, expose to window but guard with env flag:
window.__KEHTO_DEBUG__ = import.meta.env.DEV ? {
  relay,
  tap,
} : undefined;
```

**Production build guard:** The `__KEHTO_DEBUG__` escape hatch should be conditionally set using Vite's `import.meta.env.DEV` (true in dev/test, false in production builds). The `__SHELL_READY__`, `__loadNapplet__`, etc. globals in the harness are already test-only because the harness package itself is `private` and never deployed. No production-build leak risk exists for the harness.

For the demo app (`apps/demo`), do NOT add `window.__KEHTO_RUNTIME__` at all. The `demo-audit-correctness.spec.ts` pattern tests the demo by inspecting DOM elements (`#chat-status`, `napplet-debugger`, frame locators) — not by querying runtime internals. This is the correct approach: test the demo as a user would observe it.

### New Harness Globals Needed for v1.3

| Global | Purpose | Added where |
|--------|---------|-------------|
| `__injectEnvelope__(wid, envelope)` | Send NIP-5D envelope from a napplet | `harness.ts` |
| `__getNubMessage__(domain)` | Get last message received by a NUB handler | `harness.ts` |
| `__getServiceNames__()` | List registered service names | `harness.ts` |
| `__registerService__(name)` | Register a pre-wired test service handler | `harness.ts` |
| `__unregisterService__(name)` | Unregister a service (for toggle tests) | `harness.ts` |
| `__getNotifications__()` | Return notification service state snapshot | `harness.ts` |
| `__setIdentityPubkey__(pubkey)` | Override the mock identity pubkey | `harness.ts` |

---

## Question 5: Release Rehearsal — changeset version Dry-Run

### Directory Layout and Artifact Expectations

`changeset version` reads from `.changeset/*.md` (existing staged changesets) and writes:
1. Updated `package.json` `version` fields for each affected package under `packages/`
2. `CHANGELOG.md` files in each affected package directory
3. Clears the consumed changeset `.md` files from `.changeset/`

The v1.2 milestone left 4 staged changesets at `.changeset/v1-2-*.md`. These are consumed by the `changeset version` dry-run in v1.3's release rehearsal phase.

**Expected artifact layout after `changeset version`:**

```
packages/acl/CHANGELOG.md          (updated)
packages/acl/package.json          (version bumped)
packages/runtime/CHANGELOG.md      (updated)
packages/runtime/package.json      (version bumped)
packages/services/CHANGELOG.md     (updated)
packages/services/package.json     (version bumped)
packages/shell/CHANGELOG.md        (updated)
packages/shell/package.json        (version bumped)
.changeset/v1-2-*.md               (deleted after consumption)
```

**Dry-run approach:** `changeset version` has no `--dry-run` flag. The standard approach is to run it in a git branch, inspect the diffs, then `git restore` to revert. The v1.3 release rehearsal phase should:
1. Create a release branch (`git checkout -b release/v1.3-rehearsal`)
2. Run `pnpm version-packages` (= `changeset version`)
3. Verify all `package.json` versions bumped correctly and all `CHANGELOG.md` entries are coherent
4. `git checkout main && git branch -D release/v1.3-rehearsal` to discard

**Upstream blocker:** `@napplet/core` is resolved via `pnpm.overrides` to `link:/home/sandwich/Develop/napplet/packages/core`. The `changeset publish` step (not part of v1.3 scope) would fail because `@napplet/core` is not on npm. The `changeset version` step runs fine locally because it only edits local `package.json` files.

**No additional directory or artifact layout changes are needed for v1.3.** The release rehearsal is a verification step, not a structural one.

---

## Recommended Project Structure Changes for v1.3

### New files and directories:

```
apps/demo/napplets/
  feed/                         # new demo napplet (relay:read showcase)
    src/main.ts
    index.html
    package.json
    vite.config.ts
    tsconfig.json
  composer/                     # new demo napplet (relay.publish + keys)
  profile-viewer/               # new demo napplet (identity.* reads)
  theme-tester/                 # new demo napplet (theme NUB)

tests/fixtures/napplets/
  nub-relay-fixture/            # new: relay NUB deterministic fixture
  nub-identity-fixture/         # new: identity NUB fixture
  nub-storage-fixture/          # new: storage NUB fixture (replaces/supplements auth-napplet for state tests)
  nub-notify-fixture/           # new: notify NUB fixture
  nub-ifc-fixture/              # new: ifc NUB pair fixture (two instances exercise channel)
  nub-keys-fixture/             # new: keys NUB fixture

tests/e2e/
  nub-relay.spec.ts             # new
  nub-identity.spec.ts          # new
  nub-storage.spec.ts           # new
  nub-notify.spec.ts            # new
  nub-ifc.spec.ts               # new
  nub-keys.spec.ts              # new
  nub-theme.spec.ts             # new
  demo-shell-host.spec.ts       # new (replaces/extends demo-audit-correctness)
  demo-signer-flow.spec.ts      # new
  demo-napplet-feed.spec.ts     # new
  demo-napplet-composer.spec.ts # new
  demo-napplet-ifc.spec.ts      # new

  # Existing — triage and migrate:
  auth.spec.ts                  # MIGRATE: NIP-01 AUTH → NIP-5D shell.ready/shell.init
  acl-enforcement.spec.ts       # MIGRATE: __publishEvent__/createSubscription remain; update envelope assertions
  acl-lifecycle.spec.ts         # MIGRATE: same
  acl-matrix-hotkey.spec.ts     # ASSESS: likely delete (signer/hotkey matrix, removed API)
  acl-matrix-relay.spec.ts      # MIGRATE: update to envelope format
  acl-matrix-signer.spec.ts     # DELETE: signer-service removed in v1.2
  acl-matrix-state.spec.ts      # MIGRATE: update to storage NUB envelope format
  auth-handshake.spec.ts        # DELETE: NIP-42 AUTH handshake is legacy; NIP-5D has no handshake
  inter-pane.spec.ts            # MIGRATE: ifc NUB envelope format
  lifecycle.spec.ts             # MIGRATE: window destroy semantics same; envelope format update
  replay.spec.ts                # ASSESS: replay detection may not apply to NIP-5D envelopes; likely migrate or delete
  routing.spec.ts               # MIGRATE: NUB dispatch assertions
  signer-delegation.spec.ts     # DELETE: signer-delegation removed in v1.2
  state-isolation.spec.ts       # MIGRATE: storage NUB envelope format
  harness-smoke.spec.ts         # KEEP: trivial sentinel spec
  shell-host.html               # KEEP: static HTML for harness (not a spec)
  test-napplet.html             # ASSESS: may be obsolete; check if referenced
```

### Modified files:

```
apps/demo/src/shell-host.ts     # Add keys/media/theme service registrations; update DEMO_NAPPLETS[]
apps/demo/src/main.ts           # Wire new demo napplets into topology
apps/demo/index.html            # Add DOM slots for new napplets
apps/demo/src/topology.ts       # Add new napplet nodes to topology graph
tests/e2e/harness/harness.ts    # Add new __* globals for NIP-5D envelope helpers
playwright.config.ts            # No structural change needed; webServer target stays :4173
pnpm-workspace.yaml             # No change needed (apps/demo/napplets/* already globbed)
```

---

## Integration Points — File-Level

### Boundary 1: Demo Shell Host ↔ New Demo Napplets

- **`apps/demo/src/shell-host.ts` `DEMO_NAPPLETS[]`** — add new entries with `name`, `label`, `statusId`, `aclId`, `frameContainerId` fields
- **`apps/demo/index.html`** — add `<div id="{name}-frame-container">` slots for each new napplet
- **`apps/demo/src/topology.ts` `buildDemoTopology()`** — add new napplet nodes and edges to the topology graph
- **`apps/demo/src/shell-host.ts` `createDemoHooks()`** — add `keys`, `media`, `theme` service registrations to the `services` map
- **`apps/demo/napplets/{name}/vite.config.ts`** — each new napplet needs its own `nip5aManifest({ nappletType: '...' })` plugin config
- **New napplets use**: `@napplet/sdk` (`ipc`, `storage`, `relay`, `identity`, `theme`, `keys`, `notify`) and `@napplet/shim` (auto-imported by SDK)

### Boundary 2: Harness ↔ New Fixture Napplets

- **`tests/e2e/harness/vite.config.ts`** — no change needed; the `serveNapplets()` plugin reads `tests/fixtures/napplets/*/dist/` generically
- **`pnpm-workspace.yaml`** — no change needed; `tests/fixtures/napplets/*` already globbed
- **New fixture napplets** — minimal `src/main.ts` that imports `@napplet/shim`, performs the NUB action under test, then signals via `window.parent.postMessage(['__TEST_DONE__', domain], '*')`
- **`tests/e2e/harness/harness.ts`** — add new `window.__*` helpers for NIP-5D envelope injection and state snapshots

### Boundary 3: Playwright ↔ Harness Driver API

- **`tests/e2e/harness/harness.ts`** — primary mutation point for new driver globals
- **`tests/e2e/*.spec.ts`** — consume window globals via `page.evaluate(() => window.__*__())`
- **No shared TypeScript types file** currently exists for the window global declarations; consider adding `tests/e2e/harness/types.d.ts` that declares the `Window` interface extensions so specs get type safety without importing from the harness bundle

### Boundary 4: Demo Playwright Specs ↔ Demo App

- **`tests/e2e/demo-*.spec.ts`** — spawn demo on `:4174` in `beforeAll` using `spawn('pnpm', ['--filter', '@kehto/demo', 'exec', 'vite', ...])` (existing pattern in `demo-audit-correctness.spec.ts`)
- **Demo specs use frame locators**: `page.frameLocator('#chat-frame-container iframe')` — new napplets need their `frameContainerId` wired in `DEMO_NAPPLETS`
- **Demo specs verify DOM elements**: `#chat-status`, `napplet-debugger`, `.topology-node`, `.acl-panel` — these are the observable surface, not runtime internals

### Boundary 5: @kehto/* Packages ↔ @napplet/* SDK (via pnpm overrides)

All package resolution goes through `pnpm.overrides` in root `package.json`. The 8 nub packages plus core/shim/sdk/vite-plugin are linked to `/home/sandwich/Develop/napplet/*`. Any API change in the napplet repo immediately affects the kehto build. The v1.3 milestone assumes stable napplet APIs — verify before starting each phase that the napplet repo is on a compatible commit.

---

## Data Flow — Build-to-Playwright Loop

```
Source change
    ↓
pnpm build (turbo)
    ├─ packages/* rebuild (if changed)
    ├─ tests/fixtures/napplets/* rebuild (if changed)
    ├─ apps/demo/napplets/* rebuild (if changed)
    ├─ tests/e2e/harness rebuild (if @kehto/shell changed)
    └─ apps/demo rebuild (if @kehto/* changed)
         ↓
pnpm test:serve (= pnpm --filter @test/harness dev)
  → starts harness at :4173 (serves harness.ts + fixture napplets from dist/)
         ↓
npx playwright test [spec-file]
  → Playwright opens Chromium at /usr/bin/chromium
  → page.goto('http://localhost:4173')
  → page.waitForFunction(() => window.__SHELL_READY__)
  → spec calls window.__loadNapplet__(), window.__injectEnvelope__(), etc.
  → assertions on window.__TEST_MESSAGES__, window.__aclCheck__(), etc.
         ↓
Fix failures → repeat from pnpm test:serve (no rebuild for harness-only changes)
           → or repeat from pnpm build (if package source changed)
```

For demo specs (Layer B):
```
pnpm build
    ↓
npx playwright test demo-*.spec.ts
  → spec's beforeAll spawns: pnpm --filter @kehto/demo exec vite --port 4174
  → page.goto('http://localhost:4174')
  → spec uses frame locators and DOM assertions
  → spec's afterAll kills dev server
```

**Build order dependency table:**

| Package | Depends on | Must build before |
|---------|-----------|-------------------|
| `packages/acl` | (none) | runtime, shell |
| `packages/runtime` | acl | shell, services, harness |
| `packages/services` | runtime | harness (if services used in harness) |
| `packages/shell` | runtime | harness, demo |
| `tests/fixtures/napplets/*` | @napplet/shim | harness (serves their dist/) |
| `apps/demo/napplets/*` | @napplet/sdk | demo (serves their dist/) |
| `tests/e2e/harness` | @kehto/shell | (Playwright target — must be last) |
| `apps/demo` | @kehto/shell, @kehto/services | (demo Playwright target) |

Turbo handles this via the `build` pipeline `dependsOn` declarations. The only manual ordering concern: turbo must be told that `tests/e2e/harness#build` depends on `packages/shell#build` (check `turbo.json`).

---

## Anti-Patterns

### Anti-Pattern 1: Sharing Fixture Napplets Between Harness and Demo

**What people do:** Put a new napplet in `tests/fixtures/napplets/` and reference it from both the harness Vite plugin and the demo Vite plugin.

**Why it's wrong:** The two Vite plugins (`serveNapplets` and `serveDemoNapplets`) hardcode different source directories. A fixture napplet has no human-meaningful UI and no topology slot in the demo. Cross-linking creates a dependency between two independently running Vite servers and complicates the build pipeline.

**Do this instead:** Fixture napplets go in `tests/fixtures/`, demo napplets in `apps/demo/napplets/`. If a protocol behavior needs both a demo-quality UI and a deterministic test fixture, build two separate napplets — one per location.

### Anti-Pattern 2: Exposing the Live Runtime Reference via window.__KEHTO_RUNTIME__

**What people do:** Set `window.__KEHTO_RUNTIME__ = relay.runtime` in the harness and call methods on it in `page.evaluate()`.

**Why it's wrong:** `page.evaluate()` serializes return values via structured clone. Methods on live objects are not cloneable. When a spec does `const rt = await page.evaluate(() => window.__KEHTO_RUNTIME__)`, it gets an empty object. The pattern works for calling void methods (`window.__KEHTO_RUNTIME__.aclState.grant(...)`) but breaks for any method that returns a non-primitive.

**Do this instead:** Expose named helper functions that wrap specific runtime queries and return serializable values. The existing `window.__aclCheck__()` pattern is correct — it returns a `boolean`, not an `AclState`.

### Anti-Pattern 3: Per-NUB Playwright Specs Targeting the Demo (Port 4174)

**What people do:** Write `nub-relay.spec.ts` that navigates to the demo on `:4174` to test the relay NUB.

**Why it's wrong:** The demo has a real signer dependency (NIP-46 or NIP-07), a real topology, real ACL panel rendering. Testing the relay NUB through the demo makes specs slow, flaky (waiting for signer UI), and brittle (topology DOM changes break specs). The demo is for UX-level verification, not protocol correctness.

**Do this instead:** NUB correctness specs target the harness (`:4173`) with purpose-built fixture napplets. Demo specs verify the UX surface (panels, debugger, topology nodes) and the end-to-end golden path with a mock signer injected via `__setSigner__`.

### Anti-Pattern 4: Rebuilding All Packages for Every Playwright Fix Iteration

**What people do:** Run `pnpm build` before every `npx playwright test` invocation during the fix loop.

**Why it's wrong:** Turbo caches are helpful, but a full `turbo run build` still touches package `tsup` compilation even with cache hits. For harness-targeting specs, the harness bundles on-the-fly via Vite in dev mode — Vite's HMR handles changes instantly without a full rebuild.

**Do this instead:** During fix iteration:
- For harness spec fixes (changes only in `tests/e2e/harness/harness.ts` or `tests/e2e/*.spec.ts`): no rebuild needed — `pnpm test:serve` keeps the Vite dev server running with HMR
- For package changes (`packages/*`): rebuild only the changed package (`pnpm --filter @kehto/runtime build`), then restart `pnpm test:serve`
- Only run `pnpm build` (full turbo) at phase gate to verify the full build is green

### Anti-Pattern 5: Writing Demo Specs That Assert on Runtime Internals

**What people do:** In `demo-*.spec.ts`, do `page.evaluate(() => window.__aclCheck__(...))` to verify an ACL state after clicking an ACL panel button.

**Why it's wrong:** The demo does not expose `window.__aclCheck__`. That global only exists in the harness. Demo specs must verify behavior through observable UX effects (DOM changes, message content in the debugger, napplet frame content).

**Do this instead:** Demo specs use `page.locator()` on DOM elements: `expect(page.locator('napplet-debugger')).toContainText('denied: relay:write')`. This is what `demo-audit-correctness.spec.ts` does correctly today.

---

## Sources

- `/home/sandwich/Develop/kehto/apps/demo/src/shell-host.ts` — existing shell host boot pattern
- `/home/sandwich/Develop/kehto/apps/demo/src/main.ts` — existing demo wiring
- `/home/sandwich/Develop/kehto/apps/demo/vite.config.ts` — demo Vite plugin (serveDemoNapplets)
- `/home/sandwich/Develop/kehto/tests/e2e/harness/harness.ts` — current harness driver API
- `/home/sandwich/Develop/kehto/tests/e2e/harness/vite.config.ts` — harness Vite plugin (serveNapplets)
- `/home/sandwich/Develop/kehto/playwright.config.ts` — Playwright config (webServer at :4173)
- `/home/sandwich/Develop/kehto/tests/e2e/demo-audit-correctness.spec.ts` — demo spec pattern (port 4174, frame locators)
- `/home/sandwich/Develop/kehto/tests/e2e/acl-enforcement.spec.ts` — harness spec pattern (window.__ API)
- `/home/sandwich/Develop/kehto/tests/e2e/auth.spec.ts` — existing AUTH spec (to triage)
- `/home/sandwich/Develop/kehto/apps/demo/napplets/bot/src/main.ts` — existing demo napplet pattern (@napplet/sdk usage)
- `/home/sandwich/Develop/kehto/tests/fixtures/napplets/auth-napplet/src/main.ts` — existing fixture napplet pattern
- `/home/sandwich/Develop/kehto/package.json` — pnpm.overrides, workspace scripts
- `/home/sandwich/Develop/kehto/pnpm-workspace.yaml` — workspace package globs
- `/home/sandwich/Develop/kehto/.planning/PROJECT.md` — v1.3 milestone scope

---
*Architecture research for: v1.3 Demo-Functional + Playwright Parity — integration architecture*
*Researched: 2026-04-17*
