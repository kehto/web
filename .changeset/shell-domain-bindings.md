---
"@kehto/shell": minor
---

Add table-driven `window.napplet` bindings for domains the prelude has no
built-in implementation for. `prepareNappletSrcdoc`,
`injectNappletNamespacePrelude` and `renderNappletNamespacePrelude` accept
`bindings` (`NappletDomainBinding`). Each row becomes a method over the private
NIP-5D port, and pushes reach `on(event, handler)` and named handlers. Tables
are validated host-side (`serializeDomainBindings`) and never replace a domain
in `NAPPLET_PRELUDE_BUILT_IN_DOMAINS`.
