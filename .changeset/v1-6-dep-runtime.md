---
'@kehto/runtime': minor
---

Consolidate NUB peer dependencies from 8 split `@napplet/nub-{identity,ifc,keys,media,notify,relay,storage,theme}@^0.2.1` packages onto the single `@napplet/nub@^0.2.1` package. All in-repo imports now read from the `@napplet/nub/<domain>/types` subpath (type-only consumers) or the root `@napplet/nub/<domain>` subpath.

Addresses kehto#4 (hyprgate v2.0 Kehto Migration gap analysis). Eliminates the dual-instance pitfall where downstream shells consuming both the split-package and consolidated NUB shapes ended up with two copies of every NUB module on disk.

Downstream consumers note: `@napplet/nub@0.2.1` was published with an unresolved `workspace:*` specifier for its `@napplet/core` dependency. Until upstream re-publishes, workspace consumers should add the following `pnpm.overrides` entry at their workspace root to pin the transitive resolution:

```json
"pnpm": {
  "overrides": {
    "@napplet/nub>@napplet/core": "^0.2.1"
  }
}
```

Public peer-dep surface changed — minor bump (not patch).

REQ-IDs: DEP-01, DEP-02, DEP-03, DEP-04, DEP-05.
