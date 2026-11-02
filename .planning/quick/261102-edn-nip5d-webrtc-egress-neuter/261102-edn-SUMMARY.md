---
quick_id: 261102-edn
status: complete
date: 2026-11-02
---
# Summary — neuter direct WebRTC egress

Prelude (`packages/shell/src/napplet-namespace.ts`) removes
`RTCPeerConnection`/`webkitRTCPeerConnection` before napplet scripts run.
NAP-WEBRTC (shell realm) unaffected. Spec-gap decision recorded in
docs/policies/NIP-5D-CONFORMANCE.md ("Direct WebRTC egress").

Verification: build, type-check, test:unit (2281), docs:check, shell-csp e2e
(real opaque iframe: rtc=false, constructors undefined), static guard, slop
95/100 (= main baseline). Against napplet/evil@758ce29 in Paja: evil-02 webrtc
flipped armed -> blocked; evil-09 revocation unchanged.

Follow-ups still open (issue #381): grandchild-frame WebRTC, prefetch hints,
storage-API-name mismatch in the suite, manifest kit via signed-pointer path.
