---
"@kehto/shell": minor
"@kehto/paja": minor
---

Lock nested-browsing-context creation in the napplet realm. A napplet is
untrusted and has no legitimate use for a child frame, but `about:srcdoc` and
`about:blank` children involve no navigation request, so `child-src`/`frame-src`
never reach them, and such a child is a fresh realm the capability sweep never
touched (it has a live `RTCPeerConnection`; see the WebRTC-egress gap in
napplet/evil #1 / kehto/web#381).

`@kehto/shell` closes the only two ways an iframe element can be minted, enforced
by the browser and the shell rather than napplet cooperation:

- Every verified napplet srcdoc CSP now carries
  `require-trusted-types-for 'script'; trusted-types default` (added by
  `prepareNappletSrcdoc`, not the trusted host page), and the injected prelude
  registers the single admitted `default` Trusted Types policy before any
  napplet script. It passes canonical HTML through untouched and rejects any
  string carrying a frame tag, so `innerHTML`, `DOMParser`, `document.write`
  and the other string sinks are closed.
- The prelude pins `Document.prototype.createElement` / `createElementNS` (and
  `DOMImplementation.createDocument`), non-configurable, to reject frame tag
  names — the only element factories on the platform.
- New `assertNappletHasNoFrame` / `nappletMarkupHasFrame` reject a napplet whose
  own static markup declares a frame, scanned in the trusted shell realm before
  the bytes become a document.

`@kehto/paja` runs that byte scan on the verified runtime-pointer load path and
fails closed. Compatibility: requiring Trusted Types changes the napplet
execution contract (tracked as `NIP5D_TRUSTED_TYPES_REQUIRED` in
docs/compatibility.md); canonical string-sink use is unaffected because the
default policy passes non-frame HTML through.
