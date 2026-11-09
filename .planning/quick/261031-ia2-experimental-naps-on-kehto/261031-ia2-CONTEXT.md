---
quick_id: 261031-ia2
stage: discuss (assumptions mode, gsd-assumptions-analyzer)
---

# Context: experimental NAPs on kehto

Decisions were locked by GOAL.md. The discuss stage ran non-interactively in assumptions mode
(`gsd-assumptions-analyzer`), so it asked the user nothing, as the goal requires. Each assumption below
was checked against the implementation.

| Area | Locked decision | Confidence | Matches code | Follow-up |
|---|---|---|---|---|
| Naming | `x-<kebab>`, reserved registry + in-tree + retired names and `x-` aliases rejected; invalid `x-` fails closed | confident | yes | reserved list growth now documented (how-to, skill) |
| ACL storage | explicit decisions in `AclEntry.ext`, default-policy fallback, block overrides; bits untouched | confident | yes | default-allow under the permissive runtime is intended |
| Push | own declared `x-` types only, scoped context, one `<type>.result` reply | confident | yes | `.result`-only rule now documented in JSDoc, runtime docs, skill |
| Push firewall | hard policy only (deny/ask drop silently), no rate budget, no prompt | likely | yes (WR-04) | docs/changeset/JSDoc corrected to say exactly this |
| Binding | factory `toString` or `{ source }`, one script per binding, Symbol handoff, frozen protected object | likely | yes | toolchain caveat (minified `toString`) noted |
| setEnvironment | retained, warn once when widening, registered in compatibility.md | confident | yes | removal PR owed per register |
| Paja config | `string \| { module, settings?, enabled?, deniedDTags? }`, served from Paja origin | likely | yes (amendment 4a) | config settings are not secret storage |
| Trust boundary | modules are trusted host code; factory gets only `{ settings }` | confident | yes (amendment 9) | documented |
| Playground | bundled byte-identical x-echo through demo hooks and ACL panel | likely | yes | |
| Skill | repo canonical, copied into the @kehto/shell tarball, not JSR | likely | yes | |
| Services | unchanged, so no changeset; the Version Packages PR auto-patches it via updateInternalDependencies | confident | yes | |
