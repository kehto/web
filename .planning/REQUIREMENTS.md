# Requirements: Kehto Runtime - v1.13 Documentation Strategy & Monorepo Docs Site

**Defined:** 2026-05-23
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications.

**Milestone goal:** Turn Kehto's shipped runtime packages into a coherent public documentation system: content strategy, package docs, implementation tutorials, runtime/site guides, reference docs, and how-tos.

**Baseline entering v1.13:** v1.12 is archived with pinned-spec NIP-5D conformance across shell, shim/runtime, gateway load checks, and all 13 playground napplets. The repo currently has package READMEs, generated TypeDoc under `docs/api/`, historical migration docs under `docs/migrations/`, policy docs under `docs/policies/`, and no VitePress site configuration.

**Scope boundary:** This milestone is documentation and docs infrastructure. It may add docs tooling, site configuration, examples, and verification guards, but it does not change runtime protocol behavior, publish packages, or build the deferred Electron/Tauri host bridge implementations.

## v1 Requirements

### Content strategy and information architecture

- [ ] **STRAT-01**: Reader personas and core documentation jobs are defined for host-app implementers, package API consumers, napplet authors, and maintainers.
- [ ] **STRAT-02**: Documentation taxonomy separates reference docs, tutorials, how-tos, conceptual guides, package READMEs, policies, migration history, and release/process material.
- [ ] **STRAT-03**: The monorepo docs entry path explains what Kehto is, how it relates to `@napplet`, which packages exist, and where each reader should start.
- [ ] **STRAT-04**: Historical migration docs are clearly marked as archive/reference material and cannot be mistaken for current integration guidance.
- [ ] **STRAT-05**: A content maintenance plan defines ownership, source-of-truth rules, link expectations, and when package README content should be mirrored versus linked from the docs site.

### Package documentation

- [ ] **PKG-01**: Each public package page documents purpose, install command, peer dependencies, exported entry points, primary APIs, and package-specific scope boundaries.
- [ ] **PKG-02**: `@kehto/acl` docs explain capability state, identity keys, grants/revokes, migration helpers, and enforcement role with runnable examples.
- [ ] **PKG-03**: `@kehto/runtime` docs explain runtime creation, adapter hooks, message dispatch, service registration, enforcement, storage, relay, and lifecycle flow.
- [ ] **PKG-04**: `@kehto/shell` docs explain browser integration, iframe/session lifecycle, gateway loading, hosted `supports()`, manifest `requires`, and shell-side security boundaries.
- [ ] **PKG-05**: `@kehto/services` docs explain reference service factories, host bridge patterns, identity/decrypt, keys, media, notify, relay, cache, and theme integration.
- [ ] **PKG-06**: `@kehto/nip66` docs explain relay-discovery aggregation, pool adapters, state accessors, scope exclusions, and consumer integration.
- [ ] **PKG-07**: `@kehto/wm` docs explain structural window-management contracts, no-op strategy behavior, and consumer-owned layout algorithm boundaries.
- [ ] **PKG-08**: `@kehto/playground` docs explain the gateway-hosted 13-napplet demo, local development commands, verification role, and how to add or debug a playground napplet.

### Tutorials and how-tos

- [ ] **TUT-01**: A beginner tutorial guides a reader from install to a minimal Kehto host shell that creates a runtime, registers services, and hosts one sandboxed napplet.
- [ ] **TUT-02**: A runtime implementation guide walks through adapter hooks, ACL policy, service registration, shell bridge setup, gateway artifact loading, and teardown.
- [ ] **TUT-03**: A napplet integration tutorial shows how a napplet declares `requires`, checks hosted `supports()`, and uses NUB helper APIs without forbidden browser/protocol primitives.
- [ ] **TUT-04**: How-to guides cover common host tasks: grant a capability, register a service, handle unsupported `requires`, add a reference service, debug postMessage traffic, and verify a gateway artifact.
- [ ] **TUT-05**: Tips/troubleshooting content captures common failure modes from prior milestones, including stale package resolution, missing built napplet artifacts, sandbox policy drift, and raw-envelope exceptions.

### VitePress site

- [ ] **SITE-01**: A VitePress docs site is added under `docs/` or an equivalent docs-owned workspace without polluting root package metadata beyond necessary scripts.
- [ ] **SITE-02**: Site navigation exposes Start, Concepts, Tutorials, How-tos, Package Reference, API Reference, Policies, and Migration Archive sections.
- [ ] **SITE-03**: The docs site builds locally and in the monorepo task graph with stable output, relative/base-safe links, and no dependency on the playground dev server.
- [ ] **SITE-04**: Package README and docs-site content stay aligned through a documented source-of-truth rule, generated include strategy, or explicit link strategy.
- [ ] **SITE-05**: VitePress pages use the repo's existing generated TypeDoc output or docs build flow without breaking `pnpm docs:api`.

### Reference docs and verification

- [ ] **REF-01**: Generated API reference links are reachable from package docs and the VitePress site for every public package.
- [ ] **REF-02**: Public package exports documented in package docs match current package barrels and package manifests.
- [ ] **REF-03**: Docs commands verify build, link integrity or equivalent route coverage, TypeDoc generation, and markdown/source consistency.
- [ ] **REF-04**: CI or local scripts fail on broken docs build, missing docs navigation entries for public packages, and stale package/API reference links.
- [ ] **REF-05**: Final verification records the docs build, API docs generation, package-doc coverage check, link/navigation checks, and existing repo build/type/test smoke needed to prove docs work did not break runtime packages.

## Future Requirements

Deferred to later milestones.

### Hosted docs publication

- **PUB-01**: Production docs hosting, custom domain, analytics, and deployment approval flow.
- **PUB-02**: Versioned docs for multiple package release lines.

### Interactive examples

- **EXAMPLE-01**: Embedded live playground examples inside the docs site.
- **EXAMPLE-02**: StackBlitz/WebContainer-style runnable host-shell tutorial.

### Release automation

- **REL-01**: Documentation release notes generated from changesets and milestone archives.
- **REL-02**: Package API diff reports published with each release.

## Out of Scope

Explicitly excluded for v1.13. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Runtime protocol behavior changes | This milestone documents the shipped runtime; protocol changes belong in separate feature milestones with tests. |
| Package publication to npm | Docs can prepare release guidance, but actual package publishing remains a release process. |
| Public production docs deployment | Site build and local/CI verification are in scope; hosting/domain rollout can follow after content shape is stable. |
| Electron/Tauri host bridge reference implementations | Still deferred product work; docs may describe the interface boundaries only. |
| Multi-OS CI matrix expansion | Docs CI can be added, but broad OS matrix work remains a separate infrastructure milestone. |
| Rewriting historical migration archives as current guides | Archives should be labeled and linked, not rewritten into active guidance unless content is intentionally promoted. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STRAT-01 | Phase 60 | Pending |
| STRAT-02 | Phase 60 | Pending |
| STRAT-03 | Phase 60 | Pending |
| STRAT-04 | Phase 60 | Pending |
| STRAT-05 | Phase 60 | Pending |
| SITE-02 | Phase 60 | Pending |
| PKG-01 | Phase 61 | Pending |
| PKG-02 | Phase 61 | Pending |
| PKG-03 | Phase 61 | Pending |
| PKG-04 | Phase 61 | Pending |
| PKG-05 | Phase 61 | Pending |
| PKG-06 | Phase 61 | Pending |
| PKG-07 | Phase 61 | Pending |
| PKG-08 | Phase 61 | Pending |
| REF-02 | Phase 61 | Pending |
| TUT-01 | Phase 62 | Pending |
| TUT-02 | Phase 62 | Pending |
| TUT-03 | Phase 62 | Pending |
| TUT-04 | Phase 62 | Pending |
| TUT-05 | Phase 62 | Pending |
| SITE-01 | Phase 63 | Pending |
| SITE-03 | Phase 63 | Pending |
| SITE-04 | Phase 63 | Pending |
| SITE-05 | Phase 63 | Pending |
| REF-01 | Phase 63 | Pending |
| REF-03 | Phase 64 | Pending |
| REF-04 | Phase 64 | Pending |
| REF-05 | Phase 64 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-05-23*
*Last updated: 2026-05-23 after roadmap creation*
