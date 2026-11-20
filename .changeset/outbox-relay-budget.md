---
"@kehto/firewall": minor
"@kehto/runtime": patch
"@kehto/services": patch
"@kehto/shell": patch
"@kehto/paja": patch
---

Keep large relay plans approvable within one Firewall request (kehto/web#455).
An `outbox.subscribe` for a 709-follow timeline used to close with
`policy denied` even under a default allow, because its plan named more relay
origins than a request may carry.

- `@kehto/firewall` exports `MAX_PERMISSION_REQUIREMENTS` (128), re-exported by
  `@kehto/runtime`. The cap itself is unchanged.
- OUTBOX read plans contact at most 127 relay origins. The reference router
  picks a larger plan's relays by author coverage, deterministically and with
  napplet hints last, and the service bounds any router's plan before approval.
  Approval names each origin once. Unusable relay URLs are skipped instead of
  failing the plan, and a read that left an author without relays is
  `incomplete: true` (NAP-OUTBOX napplet/naps#32 at `8865f73d`).
- An OUTBOX publish keeps every required own/inbox relay. When those cannot fit
  one approval it fails before signing with `too many relays`, never a denial;
  only explicit `options.relays` extras are trimmed.
- Runtime `relay.*` approval names each origin once, and a host plan over the
  cap fails with `too many relays` instead of a denial. COUNT does the same with
  `too-expensive` (NAP-COUNT napplet/naps#69 at `9353a0c6`).
- The browser approval prompt shows the origins of one mediated operation as a
  single "contact N origins" row listing the exact origins. Groups up to
  `openOriginLimit` (a new `createBrowserApprovalUi` option, default
  `DEFAULT_PROMPT_OPEN_ORIGINS` = 5) start open; Paja exposes it as the
  `firewall.promptOpenOrigins` setting.
