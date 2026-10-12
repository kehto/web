---
"@kehto/services": minor
"@kehto/shell": minor
"@kehto/runtime": patch
"@kehto/paja": minor
"@kehto/cli": patch
"@kehto/firewall": patch
"@kehto/acl": patch
---

Add host-owned NAP-GAMEPAD snapshots and browser focus/visibility hooks, deny native controller paths in Paja/playground frames, and expose the cached injected API. Bind trusted iframe sessions independently of optional SHELL readiness. Preserve the empty handshake-domain compatibility export and report unavailable native readers using the proposed NAP reasons. The optional native Gamepad API replacement awaits clarification of NIP-5D's namespace-only injection restriction. Publish CLI 0.5.5 before the coordinated napplet CLI release selects it as the private Paja runner.

Accept both the maintained core/NAP 0.32 baseline and the coordinated 0.34 GAMEPAD package set. Existing package API behavior remains covered against both versions.
