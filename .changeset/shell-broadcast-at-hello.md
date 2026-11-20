---
'@kehto/shell': patch
---

A napplet is now a push target from its first valid `napplet.hello`, not from its first NAP message. The bridge binds the verified identity and frozen grants to the session as soon as the port is bound, so `publishTheme()`, `publishIdentityChanged()` and runtime service broadcasts (`theme.changed` from the theme service, `intent.changed` from the intent service) reach a napplet that only listens, with or without NAP-SHELL. Domain, ACL and live-port checks are unchanged, and revoking or replacing the binding still removes the target.
