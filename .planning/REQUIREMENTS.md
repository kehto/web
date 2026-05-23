# Requirements: Kehto Runtime - v1.14 GitHub Pages Web Portal

**Defined:** 2026-05-23
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications.

**Milestone goal:** Turn the GitHub Pages deployment into a public `/web/` portal that links to the playground and docs, with the playground deployed at `/web/playground/` and VitePress docs deployed at `/web/docs/`.

**Baseline entering v1.14:** v1.13 is archived with a buildable VitePress docs site, generated API integration, docs quality gates, and an existing playground-only GitHub Pages workflow. Current Pages packaging uploads `.pages/playground`, uses `PLAYGROUND_BASE_PATH=/${{ github.event.repository.name }}/`, and does not publish the docs site or a portal slash page.

**Scope boundary:** This milestone is GitHub Pages publication infrastructure. It may add or revise static artifact packaging, Pages workflow steps, base-path configuration, smoke checks, and minimal portal content. It does not change runtime protocol behavior, publish npm packages, add custom domains, or fix unrelated playground feature bugs.

## v1 Requirements

### Portal entry point

- [x] **PAGE-01**: Visitor can open `https://kehto.github.io/web/` and see a Kehto entry page rather than the playground shell directly.
- [x] **PAGE-02**: Visitor can navigate from the `/web/` entry page to `/web/playground/` and `/web/docs/` through explicit links.
- [x] **PAGE-03**: The entry page is static and build-owned, with no dependency on the playground runtime, docs dev server, or external services.

### Playground deployment

- [x] **PLAY-01**: Visitor can open `https://kehto.github.io/web/playground/` and load the playground shell assets with the correct Pages base path.
- [x] **PLAY-02**: The playground static NIP-5A gateway metadata points napplet iframe URLs under `/web/playground/napplet-gateway/`.
- [x] **PLAY-03**: All 13 built playground napplets are included in the Pages artifact with their `.nip5a-manifest.json` metadata represented as static gateway routes.
- [x] **PLAY-04**: The playground Pages build no longer depends on `github.event.repository.name` to derive the public base path.

### Documentation deployment

- [ ] **DOCS-01**: Visitor can open `https://kehto.github.io/web/docs/` and load the VitePress docs site with the correct Pages base path.
- [ ] **DOCS-02**: Docs assets, navigation, package pages, policies, migration archive pages, and generated API reference links resolve under `/web/docs/`.
- [ ] **DOCS-03**: The docs Pages build reuses the existing docs quality gates instead of creating a second unchecked docs build path.

### Pages workflow and verification

- [ ] **VERIFY-01**: The GitHub Pages workflow builds and uploads one unified artifact rooted at `/web/` that contains the entry page, playground, and docs.
- [ ] **VERIFY-02**: Local or CI verification fails if `/web/`, `/web/playground/`, `/web/docs/`, or a representative playground gateway manifest is missing from the generated artifact.
- [ ] **VERIFY-03**: Final verification records the Pages artifact build, docs check, playground gateway artifact audit, build/type/unit smoke, and route-shape proof needed before deployment.

## Future Requirements

Deferred to later milestones.

### Production polish

- **HOSTING-01**: Custom domain, DNS, analytics, and production launch approval flow.
- **HOSTING-02**: Versioned docs or playground deployments for multiple package release lines.
- **HOSTING-03**: Embedded live playground examples inside documentation pages.

### Operational automation

- **OPS-01**: Deployment status badges, release notes, or changelog publication on the `/web/` entry page.
- **OPS-02**: Post-deploy browser smoke against the live GitHub Pages URL.

## Out of Scope

Explicitly excluded for v1.14. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Runtime protocol behavior changes | This milestone only changes static publication paths and verification. |
| Package publication to npm | Publishing remains a separate release process. |
| Custom domain, DNS, or analytics | The requested target is `kehto.github.io/web/`; domain polish can follow. |
| Fixing decrypt-demo pending fixture behavior | Backlog 999.1 remains valid but is unrelated to routing the Pages site. |
| Rewriting docs content strategy or package docs | v1.13 shipped docs content; v1.14 publishes it under the requested path. |
| Multi-OS CI matrix expansion | Existing verification stays focused on Pages artifact correctness and current repo gates. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PAGE-01 | Phase 65 | Complete |
| PAGE-02 | Phase 65 | Complete |
| PAGE-03 | Phase 65 | Complete |
| PLAY-01 | Phase 66 | Complete |
| PLAY-02 | Phase 66 | Complete |
| PLAY-03 | Phase 66 | Complete |
| PLAY-04 | Phase 66 | Complete |
| DOCS-01 | Phase 67 | Pending |
| DOCS-02 | Phase 67 | Pending |
| DOCS-03 | Phase 67 | Pending |
| VERIFY-01 | Phase 67 | Pending |
| VERIFY-02 | Phase 67 | Pending |
| VERIFY-03 | Phase 67 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-05-23*
*Last updated: 2026-05-23 after roadmap creation*
