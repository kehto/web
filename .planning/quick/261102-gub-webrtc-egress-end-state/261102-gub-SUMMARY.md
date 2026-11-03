---
quick_id: 261102-gub
status: complete
date: 2026-11-02
---
# Summary — WebRTC-egress end state corrected

`docs/policies/NIP-5D-CONFORMANCE.md` → "Direct WebRTC egress" no longer
names per-napplet process isolation as a portable end state. It records the
measured nested-context behaviour (Chromium 147, napplet CSP with
`child-src 'none'; frame-src 'none'`: `data:` grandchild blocked, `srcdoc`
grandchild loads with a working `RTCPeerConnection`, because `about:srcdoc`
and `about:blank` involve no navigation request), names a shipped `webrtc`
CSP directive as the upstream fix (inherited CSP reaches every descendant
realm), rules out process isolation (a page cannot request placement; a
per-napplet origin would make the server the identity authority again) and
the process-wide connection cap, and records nested-browsing-context
revocation via `contentWindow.length > 0` as the Kehto-side mitigation to
build (detection, not prevention). kehto/web#381's open item and TODOs were
updated to match.

Verification: NIP-5D conformance guard 15/15, `pnpm build` + `pnpm docs:check`
green (first docs:check run failed only on a stale `@kehto/shell` dist
predating #382), aislop 95/100 (= main). Commit 0d26bf89. Follow-ups tracked
in #381: build the revocation in `@kehto/shell` with a Paja e2e; propose
nested contexts as NIP-5D replacement evidence.
