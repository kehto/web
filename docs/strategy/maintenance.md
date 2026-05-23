# Documentation Maintenance

Kehto has three documentation truth surfaces: package READMEs, authored docs-site pages, and generated API reference. The milestone goal is to make those surfaces reinforce each other without duplicating facts that will drift.

## Source-of-Truth Rules

| Fact type | Source of truth | Mirrors and links |
|-----------|-----------------|-------------------|
| Package install command | Package README and package manifest | Package reference page may repeat it after checking the manifest. |
| Public exports | Source barrel and package manifest | Package reference and TypeDoc must agree. |
| API signatures | Generated TypeDoc from source | Prose links to API docs; do not hand-copy full signatures unless needed for explanation. |
| Runtime behavior | Current source, tests, and policy docs | Concepts/tutorials summarize only verified behavior. |
| Historical migration behavior | `docs/migrations/` and `.planning/milestones/` | Archive pages label it as historical. |
| Site navigation | VitePress config plus this IA document | Add package pages and tutorials to navigation when created. |

## Update Rules

1. When a public export changes, update the relevant package page and run API docs generation.
2. When a package README changes a behavioral claim, check the docs-site page for the same package.
3. When a migration document is promoted into current guidance, rewrite it as a current concept/tutorial/how-to page instead of linking readers to the archive.
4. When a new public package is added, add a package reference page, API reference link, and navigation entry in the same milestone or quick task.
5. When a docs build or link check fails, fix docs before closing the phase unless the failure is a documented generated-output limitation.

## Verification Expectations

The finished docs system should support these checks:

- VitePress site builds.
- TypeDoc API reference generates.
- Every public package has a package page.
- Navigation includes every public package.
- Package pages link to generated API reference targets.
- Migration archive pages include historical warnings.

## Non-Goals

- Do not hand-edit `docs/api/`.
- Do not treat `.planning/` as public documentation.
- Do not use migration archives as current instructions.
- Do not add runtime behavior changes while writing docs unless a later phase explicitly expands scope.
