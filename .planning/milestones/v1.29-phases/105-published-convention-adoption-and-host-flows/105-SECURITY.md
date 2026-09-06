---
phase: 105
slug: published-convention-adoption-and-host-flows
status: verified
threats_total: 29
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-07-27
verified: 2026-07-27
---

# Phase 105 — Security

> ASVS L1 verification of the threat registers authored in Plans 01–12.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm/JSR registry and lock artifacts → workspace | Published declarations become trusted build and runtime inputs. | Package code, type declarations, versions, provenance |
| Published values → Kehto host policy | External protocol shapes enter selection, authorization, retention, and delivery. | Intent contracts, sender identity, relay events |
| Verified resolver → installed catalog | Signed and hash-verified manifest facts become handler authority. | dTag, aggregate hash, archetypes, restart descriptor |
| Parent and registered iframe source → host lifecycle | Only the current opaque frame generation may initialize or receive data. | `shell.ready`, `shell.init`, retained intent delivery, theme |
| Remote profile metadata → resource rendering | Untrusted media locations cross host fetch policy before reaching the DOM. | Resource bytes, Blob URLs, revocation lifecycle |
| Implementation → tests, docs, and release metadata | Evidence and guidance must describe the active protocol boundary exactly. | Spec refs, static guards, changeset entries |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation evidence | Status |
|-----------|----------|-----------|----------|-------------|---------------------|--------|
| T-105-01-01 | Tampering | Manifest/JSR version graph | high | mitigate | Exact bounded public ranges, JSR maps, generated lock importers, and passing package type checks | closed |
| T-105-01-SC | Tampering | npm install | high | mitigate | `published-napplet-contract.test.ts` verifies official lineage and absence of `postinstall` for the selected releases | closed |
| T-105-02-01 | Tampering | App dependency pins | high | mitigate | Exact playground/feed pins, regenerated lock checkpoint, and passing application builds | closed |
| T-105-03-01 | Tampering | App/fixture resolution | high | mitigate | Exact group-B/fixture pins, generated importers, and passing profile/resource builds | closed |
| T-105-04-01 | Tampering | Final dependency lineage | high | mitigate | Dynamic manifest/JSR/lock and released-contract tests verify versions, source/release refs, and official package lineage | closed |
| T-105-04-02 | Spoofing | `shell.init` source | high | mitigate | `napplet-namespace.test.ts` covers parent-source trust, first-init caching, and one-ready/one-init lifecycle | closed |
| T-105-04-03 | Elevation of Privilege | Namespace replacement | high | mitigate | Mandatory shell regressions prove direct and whole-namespace assignment cannot replace the host-owned shell surface | closed |
| T-105-04-SC | Tampering | npm/pnpm install | high | mitigate | Package-legitimacy guard imports the exact verified release line and rejects install-script drift | closed |
| T-105-05-01 | Tampering | Type migration | medium | mitigate | Competing local intent mirror removed; canonical released types and positive/negative service fixtures pass | closed |
| T-105-05-02 | Elevation of Privilege | Handler selection | high | mitigate | Catalog resolver tests enforce exact installed compatibility, ambiguity failure, and sender-aware authorization | closed |
| T-105-05-03 | Spoofing | Delivery sender | high | mitigate | Intent service constructs the sender from authenticated runtime context and ignores caller-provided sender claims | closed |
| T-105-06-01 | Spoofing | Paja catalog insertion | high | mitigate | Paja catalog accepts resolver-verified immutable records only and never frame claims | closed |
| T-105-06-02 | Elevation of Privilege | Paja handler policy | high | mitigate | Default, chooser, and explicit targets are revalidated against exact contracts and sender policy | closed |
| T-105-06-03 | Tampering | Paja retained delivery | high | mitigate | Delivery is frozen before acceptance and bound to one current target generation with exactly-once tests | closed |
| T-105-07-01 | Spoofing | Paja ready generation | high | mitigate | Ready handling maps `MessageEvent.source` through current registered origin/session and tab generation | closed |
| T-105-07-02 | Information Disclosure | Paja delivery/theme target | high | mitigate | Target-only browser regressions exclude a forged sibling and deliver only to the selected eligible session | closed |
| T-105-07-03 | Denial of Service | Paja stale teardown | medium | mitigate | Host clears ownership before frame removal, invalidates stale waiters, and retries a current catalog record | closed |
| T-105-08-01 | Spoofing | Playground catalog insertion | high | mitigate | Playground installation records originate only from `resolvePlaygroundNapplet` verified output | closed |
| T-105-08-02 | Elevation of Privilege | Playground handler selection | high | mitigate | Exact compatibility and sender-aware authorization are rechecked before cold resolution and delivery | closed |
| T-105-08-03 | Spoofing | Playground ready generation | high | mitigate | Registered `MessageEvent.source` and current record-object token are required before one target send | closed |
| T-105-09-01 | Spoofing | Delivery sender/recipient | high | mitigate | Full browser flow proves runtime-attested feed dTag and one selected-target delivery after registered readiness | closed |
| T-105-09-02 | Information Disclosure | Profile media | high | mitigate | Consumers use `resourceBytes`, assign Blob URLs only, and revoke on replacement, error, clear, and pagehide | closed |
| T-105-09-03 | Denial of Service | Stale media work | medium | mitigate | Generation tokens discard stale completions and revoke their object URLs in focused media tests | closed |
| T-105-10-01 | Tampering | Static evidence | high | mitigate | Classification-aware guards assert structural markers in exact active package and host files | closed |
| T-105-10-02 | Repudiation | Authority provenance | medium | mitigate | Executable evidence records the exact NAP, published source, and release refs used by the migration | closed |
| T-105-11-01 | Repudiation | Package/spec provenance | medium | mitigate | Active runtime/package policy documents state selected versions, exact refs, and the retained shell exception | closed |
| T-105-11-02 | Tampering | Changeset coverage | medium | mitigate | `pnpm changeset status` confirms all seven changed shipped packages use the required minor classification | closed |
| T-105-12-01 | Information Disclosure | Media guidance | medium | mitigate | Paja/playground docs require host resource policy, Blob-only rendering, and complete revocation | closed |
| T-105-12-02 | Elevation of Privilege | Selection guidance | medium | mitigate | Host docs require installed exact compatibility, validated chooser/defaults, and sender-aware authorization | closed |

All 29 planned threats have implementation or executable-evidence mitigations.
At ASVS L1, the completed unit, static, build, docs, and browser gates provide
the required verification depth. No threat at or above the configured `high`
blocking threshold remains open.

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-27 | 29 | 29 | 0 | Codex (`gsd-secure-phase`, ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition.
- [x] No accepted risks require documentation.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-07-27
