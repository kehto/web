# Context Map

Read the smallest set that covers the change.

| Need | Read |
| --- | --- |
| Protocol authority and NIP-5D links | `docs/nip-5d.md` |
| Shell vs napplet responsibility | `docs/boundaries.md` |
| Runtime implementation patterns | `docs/design-patterns.md` |
| Which `@napplet` package to import | `docs/package-surfaces.md` |
| Missing NAP interface or wire format | `docs/new-nap-proposals.md` |
| Pre-merge checklist | `docs/authoring-checklist.md` |
| Conformance testing | `pnpm test:conformance` / `:ui` (see README) |
| Agent workflow | `npx skills add napplet/napplet`, then the `napplet-make` skill |
| Layout and visual contract | `napplet-ui` skill; `src/styles.css` header comment |

The upstream napplet SDK is alpha. Treat current package README files and the
living NIP-5D/NAP sources as more authoritative than assumptions copied into
this template.
