---
phase: 114-paja-and-playground-approval-flows
plan: 12
status: complete
---

# Host contract, documentation, and release gate

The Firewall guide, compatibility register, NIP-5D policy, package references,
Paja README, and playground README describe the implemented shared admission,
exact development identity, grant lifetimes, revocation, closed CSP, and
verified-only playground loader. Conformance guards cover both host consumers
and deliberate legacy demo wire exceptions. Changesets cover shipped Firewall,
runtime, shell, Paja, and service output; the playground is a private app.

Final gate: `pnpm type-check` (including build), `pnpm test:unit` (207 files,
2,625 tests), `KEHTO_HARNESS_PORT=43173 pnpm test:e2e` (133 Chromium tests),
`pnpm docs:check`, `pnpm changeset status`, `git diff --check`, and
`npx --yes aislop@0.12.0 scan -d` (100/100) passed.

Checked NIP-5D PR #2303 at `5560820fa4f37f45b8ab742a11aeb3001b17dc67`,
NAP-SHELL master at `19de5ce1cea40cd4c76089cdd8126e9f87648049`,
NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`,
NAP-CONNECT PR #19 at `ec81a3a4a1fc4da1ad2601215353b7f822e44b8f`,
NAP-NOTIFY PR #11 at `67877ef6c31ec8acee3125c1d8b4c781010e37dc`,
and NAP-CVM PR #52 at `b1ecaa529971ade6d5bc806bc0a990db0dc2356f`.
The retained `notify.create/list/read` demo wire is documented as outside the
current NAP-NOTIFY draft; no new NAP behavior is inferred from it.
