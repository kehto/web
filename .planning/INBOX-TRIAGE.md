# Open-issue audit — 2026-10-15

The audit started with eleven open issues on `kehto/web`, against main
`fcf0a387`. Each issue was checked against implementation and the owning
protocol document before changing code or issue state. PRs remain open; no
merge or release was performed. The primary checkout's unrelated rebrand work
and `package.json` edit were preserved.

| Issue | Evaluation | Action |
| --- | --- | --- |
| #304 | Relay subscriptions survived matching ACL revoke/block. | PR [#309](https://github.com/kehto/web/pull/309) and issue comment. |
| #302 | Persistence failure was unobservable to the ACL caller. | PR [#310](https://github.com/kehto/web/pull/310) and issue comment. |
| #301 | Runtime ACL lacked an owned-state quota setter. | PR [#311](https://github.com/kehto/web/pull/311) and issue comment. |
| #300 | ACL enumeration lacked the principal required for keyed mutation. | PR [#312](https://github.com/kehto/web/pull/312) and issue comment. |
| #293 | Colon-containing window IDs collided during upload teardown. | PR [#313](https://github.com/kehto/web/pull/313) and issue comment. |
| #292 | Upload callbacks outlived their owning window/service. | PR [#313](https://github.com/kehto/web/pull/313) and issue comment. |
| #280 | Read grammar fixed by #282; internal canonical prefix remained. | PR [#314](https://github.com/kehto/web/pull/314) and partial-resolution comment. |
| #271 | CVM gap-close, transfer ceiling, documentation, and ID generation follow-ups remained. | PR [#315](https://github.com/kehto/web/pull/315) and issue comment. |
| #257 | Opaque Blossom byte reads already fixed by merged #281 (`5b3c7093`). | Closed with [resolution comment](https://github.com/kehto/web/issues/257#issuecomment-6195038014); 109 relevant tests passed. |
| #237 | Shell UUID generation assumed a secure-context method. | This PR fixes all three host UUID call sites; 2,162 unit tests and 125 browser tests passed. |
| #187 | Mandatory acceptance assertions contradict current protocol authority. | [Detailed correction comment](https://github.com/kehto/web/issues/187#issuecomment-6195327756); left open. The proposed conformance product is not implemented. |

## Authority and decisions

- NIP-5D: PR #2303 head `020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`,
  `dskvr/nips/5D.md`.
- NAP-RELAY: draft #2 `9f30b3505335a52c574ff570576687d6467021ff`.
  #304 follows policy-driven subscription termination and suppresses stale delivery.
- NAP-STORAGE: draft #3 `4f4cf0ca7ecbd24c284a5d63bcd85e3de6af37ca`.
  #301 preserves per-principal quota checks. #302/#300 are host ACL API policy.
- NAP-UPLOAD: draft #33 `f5cc981e527e2cc1572793a7a6e5082e5271ac49`.
  #292/#293 preserve live request correlation and isolate host endpoint lifetimes.
- NAP-RESOURCE: draft #80 `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`.
  #257 is resolved within the byte-fetch policy scope. #280 normalization is
  explicit host policy; supplied resource cache keys stay byte-for-byte unchanged.
- NAP-CVM: draft #31 `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`;
  CEP-41: `contextvm/contextvm-docs@3b4f9dc9f9012a418abd9faec6a70db774754862`,
  `src/content/docs/reference/ceps/cep-41.md`. #271 selects permitted immediate
  gap failure and the fixed request deadline. This is scoped transport
  conformance, not certification of all newer CVM session/payment semantics.
- NAP-SHELL and web projection: `napplet/naps` master
  `19de5ce1cea40cd4c76089cdd8126e9f87648049` (shell text unchanged from
  previously checked `3fdba1accd508ab54939b277d426127c5af8faf8`). #237 changes
  host ID generation only. #187 is invalid as written: shell is optional,
  identity is established independently of readiness, and unary local
  `supports(domain)` works before initialization. Open drafts remain authority;
  unmerged status alone is not a semantic gap. The comment preserves the valid
  general feature proposal without falsely claiming implementation.

## Verification

Every implementation branch ran build, type-check, the full unit suite, docs,
and the changes-only AI-slop gate (100/100). Browser suites ran for runtime,
shell, Blossom, and CVM changes. At the final review, PRs #309–#315 had green
GitHub CI. Each PR records exact test counts and authority scope. Test-only
CVM timer stabilization is the same shared prerequisite across branches.


Final #237 validation: build, type-check, full unit suite, docs audit, full
browser suite including genuine HTTP/HTTPS capability tests, and AI-slop 100/100
passed. The current open issue list was rechecked; no additional issues appeared.
