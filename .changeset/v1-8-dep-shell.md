---
'@kehto/shell': minor
---

Phase 44 (DEP-01..06 / v1.8): bump `@napplet/core` and `@napplet/nub` peer deps `^0.2.1` → `^0.3.0`. Internal file paths renamed: `packages/shell/src/types/provisional-{class,connect,resource}.ts` → `internal-{class,connect,resource}.ts`. Per PROJECT.md Decisions #31 + #32, the three files are kehto-internal shell-side models, not staging-ground duplicates of upstream `@napplet/nub/{class,connect,resource}` — upstream's surfaces describe napplet-side accessor types (class/connect) or diverging wire shapes (resource: different field names + 5- vs 8-code error vocabularies). Public re-exports from `packages/shell/src/index.ts` keep the same names + shapes; no consumer break.
