# Phase 89: Spec / Doc Refresh & Conformance Sweep - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning/execution
**Mode:** Auto-generated (discuss skipped; spec from REQUIREMENTS.md + audit + the modernization that landed in phases 86–88)

<domain>
## Phase Boundary

Final phase of v1.21. Bring the prose/spec docs + changesets into line with the code that shipped in
phases 86–88 (NAP-SHELL handshake, NAAT archetypes, full @napplet 0.12/0.13 modernization, conformant
`{domains,protocols}` capability shape, inc wire) and the v1.22 bonus (vite-plugin 0.8.1 / napplet/web#53).
Requirements: DOCS-01..04 + VERIFY-01.

Out of scope: any further code/behavior change (phases 86–88 own that). Renaming internal kehto
identifiers (`createNubEnvelopeDispatcher`, `IfcDomain`, `ifc-handler.ts`, etc.) — leave them; they are
internal and the runtime dual-routes ifc+inc.
</domain>

<decisions>
## Implementation Decisions

### DOCS-01 — `specs/NIP-5D.md` refresh
- Change the authority citation from `dskvr/nips` branch / PR #2287 / kind-35128 to **`nostr-protocol/nips` PR #2303** (`5D.md`) and the current NIP-5A reference.
- Sweep NUB → NAP terminology throughout; `nub:` → `nap:` capability prefix (note `nub:` accepted alias).
- Document the manifest `archetype` (`["archetype","<slug>","<NAP-N>"]`) and optional `source` tags (added in Phase 87).
- Reflect the NAP-SHELL capability wire shape `capabilities: { domains: string[], protocols: Record<string,string[]> }` (the conformant shape kehto now emits, validated against the real @napplet/shim@0.13).

### DOCS-02 — local NAP mirrors
- Add `specs/NAP-SHELL.md` and `specs/NAP-INTENT.md` — concise local mirrors of the two merged registry NAPs (napplet/naps), referenced from `specs/NIP-5D.md`. Keep them faithful to the registry text (handshake: shell.ready/shell.init, supports(domain,protocol?), services, class number|null; intent: invoke/available/handlers/changed, archetype dispatch). Cite the registry URLs.

### DOCS-03 — RUNTIME-SPEC.md + comment sweep
- Refresh `RUNTIME-SPEC.md` to the #2303 / NAP model and note the current @napplet toolchain: core/nap/sdk 0.12, shim 0.13, vite-plugin 0.8.1; the inc wire; the `{domains,protocols}` handshake; napplet/web#53 resolution.
- Sweep stale NUB/AUTH/REGISTER prose in source DOC COMMENTS and READMEs where it misleads (e.g. `@napplet/nub` mentions in JSDoc → `@napplet/nap`; "NUB" → "NAP" in user-facing doc strings). Do NOT rename internal identifiers or change behavior. The `@napplet/nub` package is gone — no source should reference it as the live dependency; doc comments should say `@napplet/nap`. Priority: package READMEs (acl/runtime/services/shell/nip/playground) section headers + the most-read JSDoc; exhaustive comment perfection is not required, but no doc should cite `@napplet/nub` as current.

### DOCS-04 — unknown-`type` uniformity
- Verify: truly unrecognized message `type`s are silently ignored across known domains, EXCEPT where a NAP spec sanctions structured errors (NAP-INTENT permits `.result`/`.error`; storage emits `.result` with error field per its canonical contract). This is mostly a verification + a short note in RUNTIME-SPEC or a code comment; normalize only a clear-cut divergence, otherwise document the sanctioned exceptions. No risky behavior changes.

### Changesets (part of VERIFY-01)
Existing: `@kehto/nip` (archetype, v1.20), `@kehto/services` (adapter), `@kehto/shell` (handshake patch).
ADD changesets for the @napplet 0.12/0.13 modernization (peer dep `@napplet/core ^0.5`→`^0.12`, `@napplet/nub`→`@napplet/nap`, core API `registerNub`→`registerNap`/`NubHandler`→`NapHandler`):
- `@kehto/acl`, `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, `@kehto/firewall` — minor (peer-dependency modernization; consumers must move to `@napplet/core@^0.12` + `@napplet/nap`).
- `@kehto/shell` ALSO: the conformant `shell.init` `capabilities.{domains,protocols}` superset (NAP-SHELL alignment with shim 0.13) — minor (can be a separate changeset or merged note; the existing handshake changeset is patch — consider bumping to minor or adding a second).
Each changeset body: one line summarizing the change + the migration note for consumers (require @napplet/core@^0.12, @napplet/nap; shell emits {domains,protocols}).

### VERIFY-01 — final gates
- `pnpm build` (24/24), `pnpm type-check` (13/13), `pnpm test:unit`, full `pnpm test:e2e` (was 80/80) all green after doc/changeset changes (docs shouldn't affect tests, but run them).
- `pnpm changeset status` (or equivalent) shows every changed @kehto package has a changeset.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/NIP-5D-2303-DELTA-AUDIT.md` (G7, G8) + `.planning/REQUIREMENTS.md` (DOCS-01..04, VERIFY-01).
- Registry source for the mirrors: https://github.com/napplet/naps (naps/NAP-SHELL.md, naps/NAP-INTENT.md, SPEC.md, projections/web.md) and NIP-5D PR https://github.com/nostr-protocol/nips/pull/2303 (5D.md).
- `specs/NIP-5D.md` (existing stale mirror to rewrite), `RUNTIME-SPEC.md`.
- Package READMEs: packages/{acl,runtime,services,shell,nip}/README.md, apps/playground/README.md.
- `.changeset/` (existing changesets; add the modernization ones).
- napplet/web#53 (resolved; vite-plugin 0.8.1) — cite in RUNTIME-SPEC / a build note.
</canonical_refs>

<specifics>
## Specific Ideas

- The NIP-5D + NAP-SHELL + NAP-INTENT full text is captured in the audit's source review and the registry; mirror faithfully but concisely.
- Keep `@napplet/nub` ONLY in historical changelog/migration-archive contexts; everywhere describing current behavior must say `@napplet/nap`.
</specifics>

<deferred>
## Deferred Ideas
- CLEANUP-01 (drop naps/nubs dual-emit + trim capability superset to just {domains,protocols}) — future, once no consumer needs the legacy fields.
- Renaming internal kehto `ifc`/`Nub` identifiers — cosmetic, future.
</deferred>

---

*Phase: 89-spec-doc-refresh-conformance-sweep*
*Context: 2026-06-17 (reflects the @napplet 0.12/0.13 modernization that landed in phases 86–88 + v1.22 bonus)*
