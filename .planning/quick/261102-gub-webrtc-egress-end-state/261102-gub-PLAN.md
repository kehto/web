---
quick_id: 261102-gub
slug: webrtc-egress-end-state
date: 2026-11-02
---
# Policy: correct the WebRTC-egress end state

The "Direct WebRTC egress" section of `docs/policies/NIP-5D-CONFORMANCE.md`
names "per-napplet process isolation or a shipped `webrtc` CSP directive" as
the portable end state for the nested-frame gap, and calls the grandchild
frame "un-CSP'd". Both are wrong for a web shell:

- A page cannot request process placement. Obtaining it via a per-napplet
  origin would make the serving origin the identity authority again, against
  `srcdoc` provenance and content-addressed identity.
- The grandchild inherits the napplet CSP; CSP simply has no WebRTC directive,
  and the prelude sweep never ran in that realm.
- Measured (Chromium 147, napplet CSP with `child-src 'none'; frame-src
  'none'`): a `data:` grandchild is blocked, a `srcdoc` grandchild loads with a
  working `RTCPeerConnection`/`createDataChannel`. `about:srcdoc` and
  `about:blank` involve no navigation request, which is the same behaviour the
  host-page `frame-src` lock (#382) relies on.

Tasks:

1. Rewrite the section: keep the spec-gap decision and the prelude paragraph;
   replace the limitation paragraph with the measured nested-context
   behaviour; name a shipped `webrtc` CSP directive as the upstream fix (an
   inherited CSP reaches every descendant realm); rule out process isolation
   and the process-wide connection cap with reasons; record
   nested-browsing-context revocation (`contentWindow.length > 0` as
   replacement-grade evidence, detection not prevention) as the Kehto-side
   mitigation to build, tracked in kehto/web#381.
2. Update the matching open item in GitHub issue kehto/web#381 to the same
   end state (issue edit via `gh`, not a repo file).

Docs-only. Gates: `pnpm docs:check`, NIP-5D conformance guard unit test,
slop gate unchanged.
