---
"@kehto/mocks": minor
---

Add `MOCK_NAPPLET_BINDINGS`, a napplet-facing binding table for every
`extension` mock (`MockNappletBinding`, `MockNappletBindingMethod`). Each table
is generated from the NAP's API Surface and Wire Protocol tables at the ref the
mock records (`bindings:generate`, `bindings:check`), so a host can expose
mocked draft domains as callable `window.napplet.<domain>` methods.

Add `installMockServices(target, mocks, { onCollision })`, which adds mocks to a
host service map without replacing domains the host already defines. Each
skipped domain logs one `KEHTO_MOCK_DOMAIN_ALREADY_DEFINED` warning.
`createMockNapServices` now keeps the first entry when a registry lists a domain
twice and warns with `KEHTO_MOCK_REGISTRY_DUPLICATE_DOMAIN` instead of
overwriting it.
