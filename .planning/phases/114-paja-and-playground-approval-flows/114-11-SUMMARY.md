---
phase: 114-paja-and-playground-approval-flows
plan: 11
status: complete-with-scope-correction
---

# Browser approval and isolation evidence

Real Chromium tests now exercise both supported host paths. Paja's explicit
development URL asks for an exact network origin before executing; denial leaves
no frame, optional theme denial narrows the namespace, grant revocation retires
the frame, an approved relative request reaches its origin, and a sibling origin
has zero requests. Existing pointer, local-file, reload, signer, and intent
browser cases keep those launch routes covered. Playground's verified catalog
blocks required denial before execution, retires only the revoked app, and its
opaque frame sends zero direct fetch, script, image, frame, object, or manifest
requests to a controlled server. The playground has no unsigned or live-dev
napplet launcher; those Paja-only cases were corrected in Plan 10.

The 133-test Playwright suite passed with one worker. The harness used
`KEHTO_HARNESS_PORT=43173` because an unrelated local process occupied the
default port. No production behavior depends on that test port.

Protocol authority: NIP-5D PR #2303 at
`5560820fa4f37f45b8ab742a11aeb3001b17dc67`, NAP-SHELL master at
`19de5ce1cea40cd4c76089cdd8126e9f87648049`, NAP-RESOURCE PR #80 at
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`, and NAP-CONNECT PR #19 at
`ec81a3a4a1fc4da1ad2601215353b7f822e44b8f`.
