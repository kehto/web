---
quick_id: 261102-edn
slug: nip5d-webrtc-egress-neuter
date: 2026-11-02
---
# Neuter direct WebRTC egress in the napplet realm (napplet/evil #1)

No CSP directive covers WebRTC; `connect-src 'none'` does not stop
`RTCPeerConnection` data-channel exfiltration. The `webrtc` CSP directive is
spec-only and not meta-enforceable. NAP-WEBRTC runs the RTCPeerConnection in the
shell realm, so the napplet realm never needs the raw constructor.

Step 1 (this task): remove `RTCPeerConnection`/`webkitRTCPeerConnection` from
the injected prelude (non-writable, non-configurable undefined), before any
napplet script runs. Universal (all engines), zero cost, does not touch
NAP-WEBRTC. Does NOT reach un-CSP'd srcdoc grandchild frames (shared per-process
Chromium pool) — deferred, documented as a bounded gap.

Deferred (Step 2, not built): process-wide pool exhaustion for grandchildren —
conflicts with the shell's own NAP-WEBRTC (same process, non-reclaimable pool).
Real end state: per-napplet process isolation or a shipped `webrtc` CSP directive.
