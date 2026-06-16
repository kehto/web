# Requirements: Kehto Runtime — v1.20 NIP-5D Content-Addressed Runtime Resolution

**Defined:** 2026-06-16
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications — any Nostr client can embed sandboxed mini-apps by integrating @kehto/shell.
**Authoritative sources:** branch-HEAD `dskvr/nips` `nip/5d` (`5D.md`, PR #3) + `nostr-protocol/nips` PR #2287 (`5A.md` "Aggregate Hash", head `hzrd149/nips:nsite-aggragate-hash`).

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### NIP-5A/5D Resolution Module — `@kehto/nip` (Phase 84 / PR1)

- [ ] **RESOLVE-01**: A developer can import NIP-5D kind constants from `@kehto/nip` — `35129` (named/addressable, has `d`), `15129` (root/replaceable), `5129` (snapshot/regular).
- [ ] **RESOLVE-02**: The module parses a NIP-5D manifest event into structured fields: `dTag`, `path` entries (`{ path, sha256 }`), the aggregate `x` tag, `server` hints, `requires`, and optional `title`/`description`.
- [ ] **RESOLVE-03**: The module computes the NIP-5A aggregate hash from `path` tags (per-tag line `"<sha256> <abs-path>\n"` → sort ascending → concat UTF-8 → sha256 → lowercase hex) and a unit test asserts it against a pinned NIP-5A example vector.
- [ ] **RESOLVE-04**: The module verifies a manifest's recomputed aggregate equals its `["x","<hex>","aggregate"]` tag and rejects on mismatch.
- [ ] **RESOLVE-05**: The module verifies a manifest event's Nostr signature and rejects an invalid or forged signature.
- [ ] **RESOLVE-06**: The module fetches a blob from a Blossom server by sha256 and verifies `sha256(blob) === path hash`, rejecting on mismatch.
- [ ] **RESOLVE-07**: `@kehto/nip` builds and type-checks with the new subpath exported; unit tests cover the aggregate vector, signature, blob-hash, aggregate-vs-`x`, and every rejection path.

### Runtime Identity From Verified Bytes (Phase 85 / PR2)

- [ ] **IDENTITY-01**: The runtime derives a napplet keypair from the *computed* `(dTag, aggregateHash)` of verified bytes — `key-derivation` is fed resolver output, not gateway-asserted metadata.
- [ ] **IDENTITY-02**: `manifest-cache`, ACL state/store, and the shell session binding key on the computed `(dTag, aggregateHash)`.
- [ ] **IDENTITY-03**: The iframe `Window` maps to the computed identity via the existing source-derived binding (`markSourceDerivedIdentity` / `originRegistry`), so every inbound message resolves from `MessageEvent.source` to the same identity before dispatch.

### Content-Addressed Loading (Phase 85 / PR2)

- [ ] **LOAD-01**: The shell loads a napplet end-to-end — resolve the signed manifest from relays via NIP-65 outbox selection → fetch each blob from Blossom by sha256 → verify → assemble `/index.html` — backed by a minimal in-repo relay + Blossom simulation in the playground.
- [ ] **LOAD-02**: The shell injects verified bytes via `iframe.srcdoc` with `sandbox="allow-scripts"` and never `allow-same-origin` (opaque origin preserved, storage stays shell-mediated).
- [ ] **LOAD-03**: Any resolution/verification failure (missing manifest, bad signature, missing/forged blob, aggregate mismatch) rejects the load — no iframe is ever shown with unverified bytes.
- [ ] **LOAD-04**: The gateway is no longer in the trust path — `htmlUrl` / `GatewayNappletMetadata` are retired (or `htmlUrl` survives only as an accelerator hint whose output is verified against the signed manifest).
- [ ] **LOAD-05**: CSP / NAP-CONNECT policy is enforced via an injected `<meta http-equiv="Content-Security-Policy">` in the assembled HTML under `srcdoc`; firewall / storage / relay / ACL mediation behavior is unchanged.
- [ ] **LOAD-06**: The in-repo build (`shared-vite-config.ts`) emits NIP-5A `path` tags + one `["x","<hex>","aggregate"]` tag and uses kind `35129`, so the playground exercises the real resolve → verify → srcdoc path.
- [ ] **LOAD-07**: Existing tests asserting gateway / `htmlUrl` behavior are updated to the srcdoc model; `pnpm build`, `pnpm type-check`, unit, and E2E suites are green.

### Documentation Sync (Phase 85 / PR2)

- [ ] **DOCS-01**: `RUNTIME-SPEC.md` and `specs/NIP-5D.md` repin to branch-HEAD NIP-5D (kinds `35129`/`15129`/`5129`) and describe the relays → Blossom → verify → srcdoc loading + computed identity; no "backwards compatibility" language anywhere in the changed docs.
- [ ] **DOCS-02**: `@kehto/nip` (and `@kehto/runtime` / `@kehto/shell` where changed) READMEs / types / CHANGELOGs document the resolution + identity change; changesets are added.

## v2 Requirements

Deferred to a future milestone.

### Real Deployment & Instancing

- **FUTURE-01**: Real napplet publishing/deployment via the nsyte.run CLI (replaces the in-repo dev-only manifest build).
- **FUTURE-02**: NIP-5D instancing (`dskvr/nips#2`) — per-instance napplet identity/state scoping.

## Out of Scope

Explicitly excluded to prevent scope creep.

- **`@napplet/vite-plugin` build tooling** — the portable build plugin lives in the separate `@napplet` repo; only the in-repo `shared-vite-config.ts` re-sign step changes here.
- **NIP-5D instancing (`dskvr/nips#2`)** — deferred (FUTURE-02).
- **Backwards-compatibility shims or language** — this is a clean break; no dual-path loading and no "backwards compatibility" wording in changed docs.
- **Mass-renaming or refactoring unrelated runtime internals** beyond what the identity-source change requires.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| RESOLVE-01..07 | 84 | Complete |
| IDENTITY-01..03 | 85 | Complete |
| LOAD-01..07 | 85 | Complete |
| DOCS-01..02 | 85 | Complete |

---

*REQUIREMENTS.md last updated: 2026-06-16 — v1.20 milestone requirements defined.*
