---
status: complete
commit: 375b1ee
---

# Shared shell CSP enforcement

`@kehto/shell` now exports `prepareNappletSrcdoc`, policy construction/rendering
helpers and typed host overrides. The preparation path always places validated
CSP first, followed by the mandatory namespace. Host connection grants must be
exact HTTP(S)/WS(S) origins. Directive replacements can customize the conservative
baseline, including disabling WASM, while broad JavaScript evaluation and
bootstrap-suppressing script policies are rejected.

Both verified reference hosts consume the shared preparation API. Paja exposes
`csp` through `createPajaRuntimeHostConfig` and validates it before rebinding a
frame. Compatibility CSP helpers delegate to the shared policy. Existing
artifact policies remain additional restrictions. Local development wrappers
retain their bootstrap-only path and HMR.

Removed ineffective meta `frame-ancestors` and unsupported `prefetch-src` from
the reference policy. Updated package docs, host docs, the conformance mapping
and the minimal-host tutorial. Added minor Changesets for shell and Paja because
invalid origin inputs now throw and the generated policy changes.

## Authority and outcome

- NIP-5D: `dskvr/nips/5D.md@24711d9c47bbdd07908bf1d52bf677d9cbc530f0`.
- NAP-SHELL: `napplet/naps/naps/NAP-SHELL.md@a040914b4bbd3a5cd8a14b0f316a723c968ebfb2` (master).
- Conformant for this CSP change. No new NAP contract or upstream blocker.
- Kehto explicitly promotes the CSP-placement and narrow-connection SHOULDs to
  enforcement. The example source lists remain configurable defaults.

## Verification

- `pnpm build`: passed, 32 tasks.
- `pnpm type-check`: passed, 17 tasks (also runs build).
- `pnpm test:unit`: 150 files, 1,820 tests passed.
- `pnpm test:e2e`: 93 Chromium tests passed, including 8 public shell CSP tests,
  Paja defaults/overrides, playground verified loading and existing NAP lifecycles.
- `pnpm docs:check`: passed, including strict TypeDoc and all 9 package docs.
- `aislop@0.12.0 scan --changes`: 100/100, no findings; 10 production source files.
- `git diff --check`: passed.

## Limits

Preparation accepts already-verified HTML; it cannot authenticate a bare string.
The resolver, sandbox, source registry and handshake remain required. Inherited
or authored CSP can impose additional restrictions. Nonce/hash authorization for
the inline bootstrap is not supported; conflicting script overrides fail closed.
The existing unrelated root package.json workspaces edit was preserved and was
not committed.
