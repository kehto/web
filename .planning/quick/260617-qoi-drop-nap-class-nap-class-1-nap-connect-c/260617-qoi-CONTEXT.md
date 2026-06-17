# Quick Task 260617-qoi: Drop NAP-CLASS, NAP-CLASS-1, NAP-CONNECT — Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Task Boundary

Clean-break removal of NAP-CLASS, NAP-CLASS-1, and NAP-CONNECT from the kehto monorepo.
No backwards compat, no deprecation shims, no aliases. These NAPs were
deferred/removed upstream (napplet/web#48, @napplet v0.33.0 — "too complicated, inactive
until further notice") and kehto must match: drop support entirely.

**Stop condition:** zero first-party `class`/`connect` residue in source, tests, and
hand-authored docs/specs. `pnpm build`, `pnpm type-check`, `pnpm test:unit` all green;
`pnpm docs:check` green (docs change); AI-slop gate restored to 100; changesets present.
</domain>

<decisions>
## Implementation Decisions (LOCKED — do not revisit)

### Strip CLASS entirely (user decision)
@napplet is removing class support entirely — NOT merely deferring the NAP-CLASS domain
while keeping the NAP-SHELL opaque integer. So even the `shell.init.class` wire field is
removed. There is NO class concept anywhere in kehto after this task.

- **@kehto/runtime**
  - Delete the `NappletClass` type (`packages/runtime/src/types.ts`) and its re-export
    from `packages/runtime/src/index.ts`.
  - Delete `CLASS_CAPABILITY_ALLOWLIST` and the entire class pre-filter in
    `packages/runtime/src/enforce.ts` (the `class-1`/`class-2` allowlist, the
    "unknown class token → deny all" branch, the class-before-capability check).
  - Remove the `'class-forbidden'` value from `EnforceResult.reason`
    (both `enforce.ts` and `types.ts`) and any branch that returns it.
  - Remove the `class` field from `SessionEntry` (`types.ts`) and everywhere it is set
    (`runtime.ts` resolveIdentityByWindowId object literal ~line 455 builds
    `{ dTag, aggregateHash, class: entry.class }` → drop `class`).
  - Drop the `class` parameter threaded through `enforceNub` /
    `resolveIdentityByWindowId` signatures.
  - Remove `'class'` from the runtime capability ontology / any capability token list.

- **@kehto/shell**
  - Delete `packages/shell/src/types/internal-class.ts` (NappletClass re-export +
    `ClassAssignmentPayload`).
  - Delete `classToWireCode` and the `shell.init.class` wire field emission in
    `packages/shell/src/shell-ready.ts`; remove the SHELL-02 numeric-wire-code mapping.
  - Remove `class` from the `onNip5dIframeCreate` hook return type
    (`packages/shell/src/types.ts`) and from the shell-host hook that supplies it.
  - Remove `'class'` from the capability lists in `packages/shell/src/shell-init.ts`
    (there are TWO copies of the ontology array in that file).
  - Drop `NappletClass` re-export from `packages/shell/src/index.ts`.

### Remove CONNECT entirely
- **@kehto/shell**
  - Delete `packages/shell/src/connect-store.ts` and
    `packages/shell/src/types/internal-connect.ts` (ConnectGrant, ConsentResult,
    connect-store types).
  - Remove `connectStore` + `connectGrantKey` exports from
    `packages/shell/src/index.ts`, and the `connectStore` getter on `ShellBridge`
    (`packages/shell/src/shell-bridge.ts`).
  - Remove the CSP `connect-src` middleware machinery, the `POST /__connect-grants`
    sync endpoint wiring, consent-flow surfaces for connect, and the
    `shell:connect-revoked` CustomEvent signal (grep for `connect-revoked`,
    `__connect-grants`, `connect-src`, `configureServer`/`configurePreviewServer`
    connect plugin code).
  - Remove `'connect'` from the capability lists in `packages/shell/src/shell-init.ts`.
- **@kehto/runtime**
  - Remove `'connect'` from the capability ontology and any connect-specific dispatch.

### CRITICAL boundary — do NOT remove (these are NOT connect/class)
- The runtime **consent handler** (`consentHandlerRef`, `ConsentHandler`,
  `onConsentRequest`, POLICY-02 destructive-signing-kind consent, firewall-policy
  ConsentRequest variant) is for SIGNING / FIREWALL consent, NOT connect consent.
  Leave it fully intact. Only connect-specific consent UI/store is removed.
- The firewall package and its rate-limiting / op-class machinery
  (`firewall-state.ts` `opClass` strings like `relay:write`) are unrelated to
  NAP-CLASS. Do not touch.
- `internal-resource.ts` `'class-forbidden'` ResourceErrorCode: this is a RESOURCE
  error vocabulary value, not the runtime enforcement reason. Check whether anything
  still emits it after class removal (`resource-service.ts`). If it becomes an
  unreachable/orphan code, remove it AND its emission together; if resource policy
  still legitimately uses it independent of NAP-CLASS, leave it. Decide by reading the
  emit sites — do not guess.

### Tests move with the code
- Delete class-only / connect-only specs whose entire reason for existing is the dropped
  feature: `tests/e2e/class-invariant.spec.ts`, `tests/e2e/connect-consent.spec.ts`,
  `tests/e2e/connect-csp-preview.spec.ts`, `tests/e2e/connect-revocation.spec.ts`.
- Update mixed specs/fixtures that merely *reference* class/connect:
  `packages/shell/src/shell-init.test.ts`, `packages/shell/src/shell-init.ts` ontology,
  `packages/shell/tests/no-window-nostr.test.ts` ontology list,
  `packages/shell/src/shell-supports-conformance.test.ts` (`class: null` fixtures),
  `packages/shell/src/shell-bridge.test.ts` (connectStore / entry.class assertions),
  `tests/unit/napplet-resolver.test.ts`, `tests/e2e/gateway-artifact-parity.spec.ts`.
  Update expected capability counts/arrays to the post-removal ontology.
- e2e is NOT run by this quick task's gate (CI runs workers=1), but specs must still
  compile under `pnpm type-check`. Delete/trim so type-check stays green; do not leave
  dangling imports of removed exports.

### Docs move with the code
- Delete hand-authored policy docs: `docs/policies/SHELL-CLASS-POLICY.md`,
  `docs/policies/SHELL-CONNECT-POLICY.md`. Remove their entries from any docs index /
  VitePress sidebar config (`docs/.vitepress/config.*`).
- Edit references in `docs/policies/NIP-5D-CONFORMANCE.md`, `RUNTIME-SPEC.md`,
  `docs/packages/runtime.md`, `docs/packages/shell.md`, and the package READMEs
  (`packages/runtime/README.md`, `packages/shell/README.md`) to drop class/connect
  capability rows, the `class-forbidden` reason, NappletClass, connectStore, etc.
- `docs/api/**` and `docs/.vitepress/dist/**` are GENERATED (typedoc + vitepress build).
  Do NOT hand-edit them — they regenerate via the docs build / `pnpm docs:check`.
  Re-export removal must not break typedoc (`--treatWarningsAsErrors`): every type still
  referenced in docs must remain exported.
- Historical dated design specs under `docs/superpowers/specs/` are point-in-time
  records — leave them as-is (they document past designs, not current API).
- Update any kehto specs that define NAP-CLASS/NAP-CONNECT (check `specs/`).

### Release
- Changesets: `@kehto/runtime` + `@kehto/shell` are breaking removals → on 0.x a
  breaking change is a `minor` bump (per AGENTS.md). Add a changeset for any other
  package whose shipped output changes (e.g. `@kehto/services` if a resource code is
  removed). Test-/comment-only changes ship nothing — no bump.

</decisions>

<specifics>
## Specific Ideas

- There are TWO capability-ontology array literals in `shell-init.ts` — fix both.
- After edits, the residue gate is a grep: zero first-party (non-generated, non-dist,
  non-historical-spec) matches for `NappletClass`, `class-forbidden` (unless legitimately
  kept for resource policy), `CLASS_CAPABILITY_ALLOWLIST`, `classToWireCode`,
  `connectStore`, `ConnectGrant`, `connect-src`, `__connect-grants`, `connect-revoked`,
  `'class'`/`'connect'` capability tokens.
- Build dist `.d.ts` files (`packages/*/dist/`) regenerate on `pnpm build`; ignore them
  in the residue grep — they reflect source.
</specifics>

<canonical_refs>
## Canonical References

- Upstream removal: napplet/web#48 (@napplet v0.33.0 "NAP-SHELL Alignment — defer
  NAP-CLASS/NAP-CONNECT"). kehto goes further per user: strip class entirely incl. wire.
- `AGENTS.md` — SDLC: no-drift (code+tests+docs together), changesets (0.x breaking →
  minor), DoD = shipped PR with green build/type-check/unit + docs:check + slop gate.
</canonical_refs>
