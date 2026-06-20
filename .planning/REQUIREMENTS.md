# Requirements: Kehto Runtime — v1.22 Single-Window Development Runtime

**Defined:** 2026-06-21
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications — any Nostr client can embed sandboxed mini-apps by integrating @kehto/shell.
**Milestone goal:** Ship a real single-window development runtime that a napplet author can install as a `dev` script, point at their app dev server or child command, and use to exercise the napplet inside a full Kehto runtime iframe with HMR and real NAP/service wiring.
**Parity source:** Current `@napplet/nap` web-facing domains in `/home/sandwich/Develop/napplet/packages/nap/src`: shell, relay, outbox, storage, identity, keys, config, resource, theme, notify, media, upload, intent, cvm, inc, and deprecated ifc compatibility.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase unless marked as a cross-phase verification gate.

### Developer Runtime Package

- [x] **DEVRT-01**: A publishable `@kehto/dev-runtime` workspace package exists with ESM output, typed public API, README, TypeDoc coverage, npm/JSR metadata, and a changeset.
- [x] **DEVRT-02**: The package exposes a CLI that can be used from any napplet package manager script as `pnpm/npm/yarn dev` by either pointing at an existing target URL or spawning a user-supplied dev command and waiting for its URL.
- [x] **DEVRT-03**: The runtime is framework-agnostic: HMR is preserved by loading the target app URL directly in the sandbox iframe, without Vite-specific assumptions or bundling the napplet source.
- [x] **DEVRT-04**: The package exposes typed programmatic helpers for building the dev runtime URL/config so non-CLI hosts and tests can reuse the same option contract.

### Single-Window Host Experience

- [x] **HOST-01**: The dev runtime serves a single browser window with exactly one active napplet iframe and minimal visible chrome: a top bar and a bottom bar, with no playground-style panes, cards, or debug side rails enabled by default.
- [x] **HOST-02**: The top bar surfaces only runtime identity/status essentials and target reload controls; the bottom bar surfaces compact service/runtime status and errors.
- [x] **HOST-03**: The iframe sandbox and shell handshake match production Kehto behavior, including `allow-scripts` without `allow-same-origin`, runtime-derived identity, and `shell.init` capability payloads.
- [x] **HOST-04**: The host can reload/reinitialize the runtime around a still-running target app so author edits and HMR cycles do not require restarting the CLI process.

### NAP and Service Parity

- [ ] **PARITY-01**: Every current web NAP domain supported by `@napplet/nap` is represented in the dev runtime capability contract: shell, relay, outbox, storage, identity, keys, config, resource, theme, notify, media, upload, intent, cvm, inc, and ifc compatibility.
- [ ] **PARITY-02**: Every Kehto service that can be wired today is wired into the dev runtime with real implementations or explicit deterministic development adapters: relay/outbox, storage, identity, keys, config, resource, theme, notify/notification, media/audio, upload, intent, cvm, ACL, firewall, NIP-5D resolution, artifact cache, and manifest cache.
- [ ] **PARITY-03**: Any NAP/service gap discovered during implementation is filled in the appropriate `@kehto/*` package rather than hidden behind a dev-runtime-only workaround; intentional unsupported behavior must be documented with a test.
- [ ] **PARITY-04**: A static parity guard compares the current `@napplet/nap` domain/message surface with Kehto runtime/service handling so future protocol additions cannot silently drift.

### Environment Simulation and Runtime Controls

- [ ] **SIM-01**: The dev runtime accepts sensible options for runtime capability toggles, ACL config, firewall config, identity/signer mode, relay fixtures, storage persistence, cache behavior, upload backend, media/audio behavior, and config/theme defaults.
- [ ] **SIM-02**: Options can be supplied from CLI flags and a config file with the same schema; invalid combinations fail fast with actionable messages.
- [ ] **SIM-03**: The minimal UI exposes a compact way to see and adjust development-only simulation state without becoming a full playground UI.
- [ ] **SIM-04**: Defaults are useful out of the box: a napplet author can run the dev script against a local app and get real identity, storage, relay, notification, theme, config, resource, upload, media, intent, cvm, ACL, firewall, and cache behavior without custom host code.

### Coverage, Documentation, and Release Readiness

- [ ] **VERIFY-01**: Unit coverage proves CLI option parsing, config schema validation, URL/command handling, HMR-preserving iframe target behavior, service wiring, and simulation controls.
- [ ] **VERIFY-02**: E2E coverage launches the dev runtime against at least one real napplet fixture and proves shell init, iframe rendering, HMR/reload behavior, minimal chrome, and representative NAP traffic through the wired services.
- [ ] **VERIFY-03**: Text coverage is complete: package README, docs package page, tutorial/how-to usage, API reference links, and release notes explain how to use the runtime from `pnpm/npm/yarn dev`.
- [ ] **VERIFY-04**: `pnpm build`, `pnpm type-check`, `pnpm test:unit`, focused dev-runtime e2e, docs checks when docs change, and AI-slop scan pass before PR.
- [ ] **VERIFY-05**: The branch is committed, pushed, has a clear PR, and is ready for normal npm/JSR release workflow pending trusted-publisher/package setup.

## Future Requirements

- **REMOTE-01**: Remote device or LAN tunneling workflow for phone/tablet testing.
- **MULTI-01**: Multiple simultaneous napplet windows for host-shell integration testing.
- **INSPECT-01**: Full playground-grade debugger panes and protocol timeline, if needed after the minimal runtime proves useful.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Framework-specific adapters | The runtime must work with many stacks by loading a target URL, not by owning each framework's dev server. |
| Replacing the existing playground | The playground remains the broad demo/inspection surface; this milestone creates a focused author runtime. |
| Publishing from a local machine | This repo publishes through tag-triggered GitHub Actions; local publish remains out of scope. |
| Multi-window shell UX | The requested runtime is single-window with one napplet iframe. |

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DEVRT-01 | 90 | Complete |
| DEVRT-02 | 90 | Complete |
| DEVRT-03 | 90 | Complete |
| DEVRT-04 | 90 | Complete |
| HOST-01 | 91 | Complete |
| HOST-02 | 91 | Complete |
| HOST-03 | 91 | Complete |
| HOST-04 | 91 | Complete |
| PARITY-01 | 92 | Pending |
| PARITY-02 | 92 | Pending |
| PARITY-03 | 92 | Pending |
| PARITY-04 | 92 | Pending |
| SIM-01 | 93 | Pending |
| SIM-02 | 93 | Pending |
| SIM-03 | 93 | Pending |
| SIM-04 | 93 | Pending |
| VERIFY-01 | 90-94 | Pending |
| VERIFY-02 | 91-94 | Pending |
| VERIFY-03 | 94 | Pending |
| VERIFY-04 | 94 | Pending |
| VERIFY-05 | 94 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-06-21 after user objective for a real single-window napplet development runtime*
