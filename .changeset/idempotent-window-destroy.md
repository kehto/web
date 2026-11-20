---
'@kehto/runtime': patch
---

Notify services' `onWindowDestroyed` at most once per session registration. One retirement that runs `destroyWindow`, `sessionRegistry.unregister`, and a bridge revoke (as a Paja Firewall retire does) no longer calls services two or three times, and the first registration of a window no longer sends a spurious destroy. A later registration of the same window ID still gets its own destroy. Permission revocation is unchanged.
