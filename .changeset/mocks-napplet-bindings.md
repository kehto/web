---
"@kehto/mocks": minor
---

Add `MOCK_NAPPLET_BINDINGS`, a napplet-facing binding table for every
`extension` mock (`MockNappletBinding`, `MockNappletBindingMethod`). Each table
is generated from the NAP's API Surface and Wire Protocol tables at the ref the
mock records (`bindings:generate`, `bindings:check`), so a host can expose
mocked draft domains as callable `window.napplet.<domain>` methods.
