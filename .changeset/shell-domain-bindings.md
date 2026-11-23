---
"@kehto/shell": minor
---

Add table-driven `window.napplet` bindings for domains the prelude has no
built-in implementation for. `prepareNappletSrcdoc`,
`injectNappletNamespacePrelude`, `renderNappletNamespacePrelude` and
`admitBrowserDocument` accept
`bindings` (`NappletDomainBinding`). Each row becomes a method over the private
NIP-5D port, and pushes reach `on(event, handler)` and named handlers. Tables
are validated host-side (`serializeDomainBindings`) and never replace a domain
in `NAPPLET_PRELUDE_BUILT_IN_DOMAINS`. Such a binding is ignored rather than
rejected and logs one `KEHTO_BINDING_BUILT_IN_DOMAIN` warning per domain per page
(`BINDING_BUILT_IN_DOMAIN`). A napplet's own non-empty `window.napplet.<domain>` wins over a table, with one
`KEHTO_BINDING_DOMAIN_DEFINED_BY_NAPPLET` warning per domain in the frame.
