---
status: passed
---

# Goal verification

| Requirement | Evidence |
| --- | --- |
| planRead rejection is a network reason, no approval asked | `outbox-network-reasons.test.ts` (subscribe, query, getEvent; transport error, `relay timeout`, router-thrown `policy denied`) |
| Approval denied stays `policy denied` | `outbox-network-reasons.test.ts`; existing `approval-review.test.ts` |
| Transport throw inside approval is a network reason | `outbox-network-reasons.test.ts`; `relay-failure-reasons.test.ts` (runtime relay.subscribe) |
| Partial relay failure -> events + `incomplete` | `outbox-network-reasons.test.ts` (one relay throws, one silent, none answer, none attach) |
| Loader failure falls back | `outbox-network-reasons.test.ts` (planRead, resolveRelays, end-to-end subscribe) |
| Paja surfaces | `browser-relay-runtime.test.ts` (every live relay fails; declined planned publish) |
| Repro | 15 of 17 new services tests fail on the staging base; the 2 that pass assert behaviour that was already right (denial, consent refusal) |

Gates: `pnpm build` ok, `pnpm type-check` ok, `pnpm test:unit` 288 files / 3718 tests, `pnpm docs:check` OK, Playwright 36/36 across `paja-relay`, `paja-single-window`, `paja-runtime-pointer`, `paja-version-consent` (workers=1), aislop 100/100 with 1 pre-existing warning (baseline 100/100, same warning).

Not run: the full Playwright suite. The exact Paja trigger from the issue was not reproduced live; Paja's transport treats a failed relay like EOSE, so Paja reads cannot mark that relay `incomplete` yet.
