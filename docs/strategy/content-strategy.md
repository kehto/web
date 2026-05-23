# Content Strategy

The Kehto docs are for readers who need to build or maintain a NIP-5D runtime, not for a generic product landing page. The docs should get readers to a correct integration path quickly and keep current package/runtime truth separate from historical migration records.

## Reader Personas

| Persona | Questions the docs must answer | Success signal |
|---------|--------------------------------|----------------|
| Host-app implementer | How do I create a runtime host, register services, load gateway artifacts, and enforce capabilities? | They can host one sandboxed napplet through `@kehto/runtime` and `@kehto/shell`. |
| Package API consumer | Which package do I need, what does it export, what are its peer dependencies, and what is out of scope? | They can install and use a package without reading source first. |
| Napplet author | What do I declare in `requires`, what can I call, and what browser/protocol primitives are forbidden? | Their napplet degrades cleanly when a host lacks a capability. |
| Maintainer | Where should a fact live, how is API reference generated, and what must be checked before merging docs changes? | Docs build, package docs, API reference, and milestone state stay aligned. |

## Content Jobs

| Job | Content type | Examples |
|-----|--------------|----------|
| Learn the system | Concepts | Architecture, NIP-5D boundaries, package relationship to `@napplet`. |
| Complete a first integration | Tutorials | Minimal host shell, runtime implementation, napplet integration. |
| Solve a specific task | How-tos | Grant a capability, register a service, debug `postMessage`, verify a gateway artifact. |
| Look up an API | Reference | Package pages and generated TypeDoc. |
| Understand policy | Policy docs | Shell class/connect/resource policy and NIP-5D conformance notes. |
| Inspect history | Migration archive | Historical migration snapshots and milestone records. |

## Taxonomy

The site should expose these top-level sections:

1. Start
2. Concepts
3. Tutorials
4. How-tos
5. Package Reference
6. API Reference
7. Policies
8. Migration Archive

This split keeps long conceptual explanations out of task recipes, keeps generated API reference out of prose, and prevents migration archives from becoming accidental current guidance.

## Current Source Inventory

| Source | Current role | Rule |
|--------|--------------|------|
| Root `README.md` | Repository overview and quick orientation | Link to docs site for deep guidance. |
| Package READMEs | npm/GitHub package entry points | Keep install/API/scope basics here. |
| `docs/api/` | Generated TypeDoc output | Do not hand-edit. Regenerate with `pnpm docs:api`. |
| `docs/policies/` | Current policy references | Keep as current guidance when still accurate. |
| `docs/migrations/` | Historical transition archive | Label as archive; do not use as start path. |
| `.planning/` | Internal execution history | Link only when useful for maintainers, not public onboarding. |

## Scope Boundary

Documentation may explain runtime behavior and add verification scripts. It must not change runtime protocol behavior, publish packages, or implement deferred host bridges. If docs reveal behavior drift, capture it as a backlog or follow-up rather than silently changing runtime code inside docs phases.
