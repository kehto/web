---
phase: 111-policy-core-and-rate-limits
plan: 02
status: complete
---

# Pure approval policy checkpoint

Added typed interface/resource/network/registered-extension policy with verified catalog+artifact principals and separate development identities. Interface access composes automatically with narrower requirements. Explicit denial wins; session and once scopes bind host endpoint/request tokens. Grant ingestion detaches/freeze snapshots. Persistent JSON excludes ephemeral grants, bounds input/output size and rejects invalid or unknown schemas and duplicate IDs. Legacy broad allows produce no new authority.

Verification: 32 permission tests plus 18 independent rate tests pass (50 focused). Full unit run before the final missing-domain coercion regression: 178 files / 2281 tests pass; final added regression passes in the focused run. Firewall build and type-check pass. Strict TypeDoc/docs:check pass. Final changed-file aislop 0.12.0 score 100, zero findings. git diff --check passes.

Implementation choice: TypeScript DOM declarations supply the standard WHATWG URL value parser type for origin normalization. No DOM, network or clock side effects are introduced. @kehto/firewall remains dependency-free. Domain protocol validation and NAP-CONNECT canonical manifest parsing remain separate; generic origin normalization does not rewrite signed manifest fields.

Remaining: runtime coordinator/storage outcomes and identity plumbing (112), service authorization (113), host startup/UI/management (114), and regression/shipping audit (115). Pure tests do not establish full integration. Compatibility diagnostics and retirement of old behavioral exports remain mandatory before shipping.
