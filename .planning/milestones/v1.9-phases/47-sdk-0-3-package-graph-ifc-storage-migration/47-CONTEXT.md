# Phase 47: SDK 0.3 Package Graph + IFC/Storage Migration - Context

**Gathered:** 2026-05-22
**Status:** Ready for execution
**Mode:** Smart discuss skipped; infrastructure-only migration with published package evidence

<domain>
## Phase Boundary

Move the 18 scoped demo/fixture napplet packages to the `0.3.0` SDK package line, then migrate the first two repeated namespace families:

- IFC: bot, chat, and `nub-ifc` stop using the old `ipc` namespace and call `ifcEmit` / `ifcOn`.
- Storage: bot, chat, preferences, `nub-storage`, and `nub-theme` stop using `storage.*` and call direct storage helpers.

`decrypt-demo` stays out of scope because it does not declare `@napplet/sdk`.
</domain>

<decisions>
## Implementation Decisions

### Exact package line

Use exact `0.3.0` for all declared `@napplet/sdk`, `@napplet/shim`, and `@napplet/vite-plugin` entries in the 18 migrated packages. Add exact `@napplet/nub: 0.3.0` where direct `@napplet/nub/<domain>/sdk` helper imports are used, instead of relying on the SDK package's transitive dependency.

### Helper import path

Import pure SDK helpers from `@napplet/nub/<domain>/sdk` subpaths. The root `@napplet/sdk@0.3.0` re-exports helper functions, but its declaration/import surface also pulls root NUB domain modules. The subpath helper imports are a narrower fit for shim-loaded demo naplets and avoid domain registration side effects.

### Terminology

Replace code comments that teach `ipc` as the current API with `ifc`. Keep wire-envelope assertions such as `ifc.emit` / `ifc.subscribe` unchanged.
</decisions>

<code_context>
## Existing Code Insights

- All 18 target package manifests currently pin `@napplet/sdk`, `@napplet/shim`, and `@napplet/vite-plugin` to `^0.2.1`; `media-controller` already declares `@napplet/nub: ^0.3.0`.
- `@napplet/nub@0.3.0` publishes pure helper subpaths, including `@napplet/nub/ifc/sdk` and `@napplet/nub/storage/sdk`.
- The direct helper signatures match the old namespace calls:
  - `ifcEmit(topic, extraTags?, content?)`
  - `ifcOn(topic, callback)`
  - `storageGetItem(key)`
  - `storageSetItem(key, value)`
</code_context>

<specifics>
## Specific Ideas

- Run `pnpm install` after manifest updates so `pnpm-lock.yaml` records the 0.3 graph.
- Verify package graph with a manifest scan, not a loose grep, because all 18 target packages must be exact.
- Build the affected Phase 47 napplets directly before closing the phase.
</specifics>

<deferred>
## Deferred Ideas

- Relay, identity, keys, notify, config, media, and resource call sites move in Phase 48.
- The static guard and full build/unit/E2E loop belong to Phase 49 after every call site is migrated.
</deferred>
