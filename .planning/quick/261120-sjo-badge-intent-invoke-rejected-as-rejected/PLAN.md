---
quick_id: 261120-sjo
issue: kehto/web#523 (part 1, badge)
spec: napplet/naps master 377bf939 naps/NAP-INTENT.md (Error Handling)
---

# Badge NAP-INTENT `invoke rejected` honestly

NAP-INTENT uses `invoke rejected` for policy denial and for other pre-acceptance
rejections (unauthorized explicit handler, target refusing delivery). Paja's log
badged it `failed, not a denial`, which mislabels a firewall denial.

## Task
- `message-log-outcome.ts`: add `rejected` outcome for `intent.invoke.result` + `invoke rejected`.
- `browser-devtools.ts`: badge label `rejected (policy or handler)`; `host-page.ts` CSS.
- Tests drive the real `createIntentService` + `createCatalogIntentResolver` (denied, unauthorized explicit, accept throw, no handler, invalid convention, accepted).
- Paja README + docs/packages/paja.md; `@kehto/paja` patch changeset.
