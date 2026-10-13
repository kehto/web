---
status: complete
---
# Experimental domain admission

Implemented in 2623b79a on fix/optional-experimental-domains, isolated from the primary checkout's branding PR and unrelated package.json changes.

## Result

Paja warns and continues when required domains are unavailable. Unknown optional domains load quietly; browser coverage proves namespace-based fallback before readiness and after reload. Unsupported and disabled domains remain absent, with signature/hash verification, CSP, and ACL enforcement unchanged. Playground retains required-domain rejection and optional-domain admission.

The original report arrived indirectly without an error or pointer. Inspection and tests found valid unknown O tags already accepted; the concrete hard rejection was the required-domain admission check. No experimental wire contract or service was invented. Unknown-domain CLI toggles remain unsupported because those controls describe implemented capabilities.

## Authority

Conformant with NIP-5D PR #2303 at dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7 (Required and Optional Capabilities / Runtime Domain Availability). Checked napplet/naps master@d73f6f9480dcec1d75712cf4eafbe70337fe1e42, naps/NAP-SHELL.md and projections/web.md. Both refs rechecked unchanged before shipping. Unknown experimental domains have no owning NAP in this registry; this work changes admission only. No changes to shell handshake semantics.

## Verification

- Regression-first: five new required-domain/stale-navigation cases failed against the old rejection; optional-domain cases passed.
- Focused Vitest: 66 tests passed.
- pnpm build: 32 tasks passed.
- pnpm type-check: 17 tasks passed.
- pnpm test:unit --maxWorkers=4: 168 files, 2,117 tests passed. The initial unrestricted run passed all assertions but failed on an unrelated unhandled CVM relay timeout; the complete rerun passed without errors.
- Focused Paja pointer browser suite: 10 passed, including signed O/R manifests, disabled keys, absent unknown namespace, byte identity, and reload.
- pnpm test:e2e: all 123 passed.
- pnpm docs:check: strict TypeDoc, site build, and nine-package docs audit passed.
- pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json: 100/100, no diagnostics.
- git diff --check: passed.

Only @kehto/paja shipped output changed; its patch changeset is retained.
