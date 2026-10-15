---
status: resolved
trigger: "Issues #293 and #292: upload teardown cancels another window and permits late requester delivery"
---

## Evaluations

- #293 is valid: startsWith(windowId + ':') also selects a distinct colon-bearing
  window ID. The API has no restriction excluding such IDs.
- #292 is valid: upload progress/completion send callbacks are not guarded by a
  live requester token. Backend cancellation need not settle synchronously.
- Both issues concern upload ownership and teardown and will share one focused PR.

## Protocol authority

Checked NAP-UPLOAD draft PR #33 at
`f5cc981e527e2cc1572793a7a6e5082e5271ac49`, `naps/NAP-UPLOAD.md`, plus NIP-5D
PR #2303 `020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7` source binding. NAP-UPLOAD
defines correlated responses/progress for live requesters but no window ID syntax
or host teardown API. Exact owner isolation and suppression after destruction are
explicit host lifecycle policy, without changing wire fields or live replies.

## Current focus

Use exact window maps, invalidate the window before backend cancellation, and
guard asynchronous replies/progress by window and upload generation. Recreated
windows must not receive stale work. Test both reports, late errors, ID reuse,
cancel callbacks/errors, and other asynchronous upload operations. GSD debug runs inline.

## Verification

Build/type/docs, all 2,162 unit tests and AI-slop 100/100 pass. The upload suites
contain 20 passing tests, including six new lifetime regressions. An unrelated
wall-clock resolver test exceeded its 150ms bound under load on the first full
run; the complete rerun passes without changing that test. Test fixtures use the
real SHA-256 vector for the reported payload. No shell wiring or new wire fields
changed; unit tests exercise the full service lifecycle.
