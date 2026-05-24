# Phase 74: Playground Shell Decomposition - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove the playground shell structural scanner warnings from `apps/playground/src/main.ts` and `apps/playground/src/shell-host.ts` while preserving the visible playground boot, topology, signer, notification, napplet load, ACL, config, resource, and decrypt-demo flows.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
- This is infrastructure-only refactor work; implementation choices are at the agent's discretion.
- Prefer moving cohesive existing sections into playground-local modules over redesigning UI or changing demo behavior.
- Preserve existing imports from `./shell-host.js` for downstream modules through re-exports where useful.
- Do not change public Pages paths, gateway manifest behavior, demo napplet manifests, or `.aislop` thresholds.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shell-host.ts` already has separable areas: decrypt fixtures, demo definitions, message tap parsing, service hooks, boot wiring, napplet loading, and ACL adapter.
- `main.ts` already has separable areas: notification UI, signer UI, topology rendering, connect grants, napplet loading, node summaries, ACL refresh, and test hooks.
- Existing UI helpers live beside `main.ts` as focused modules such as `node-inspector.ts`, `topology.ts`, `notification-demo.ts`, and `signer-modal.ts`.

### Established Patterns
- Playground modules use local `.js` imports.
- Public helper functions are imported from `shell-host.ts`; compatibility can be preserved by re-exporting moved constants/types.
- DOM code uses explicit `document.createElement` and `textContent` rather than raw HTML sinks.

### Integration Points
- `bootShell()` remains the playground shell startup entry point.
- `main.ts` remains the app entrypoint imported by Vite.
- `npx --no-install aislop scan -d` is the source of truth for clearing Phase 74 warnings.

</code_context>

<specifics>
## Specific Ideas

- Move static demo definitions to `demo-definitions.ts`.
- Move decrypt fixture bridge code to `demo-decrypt.ts`.
- Move message tap parsing to `message-tap.ts`.
- Shorten `createDemoHooks` by extracting service construction and ACL-check wiring.
- Shorten `bootShell` by extracting origin proxy, relay tap wrapping, grant hooks, and reserved sentinel setup.
- Move `main.ts` notification and signer UI wiring into focused modules.

</specifics>

<deferred>
## Deferred Ideas

- Service factory warnings remain Phase 75.
- Final all-gate proof remains Phase 76.

</deferred>
