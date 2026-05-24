# Phase 69: Safe DOM Rendering and Scanner Cleanup - Context

## Scope

Remove the fatal Security findings from the supplied `aislop 0.9.3` report while preserving playground and napplet UI behavior.

## Baseline

Phase 68 left the fatal DOM/security class intentionally open. Current source grep finds direct `innerHTML` assignments in:

- `apps/playground/src/node-inspector.ts`
- `apps/playground/src/signer-modal.ts`
- `apps/playground/src/debugger.ts`
- `apps/playground/src/acl-modal.ts`
- `apps/playground/src/flow-animator.ts`
- `apps/playground/src/acl-panel.ts`
- `apps/playground/src/main.ts`
- `apps/playground/napplets/bot/src/main.ts`
- `apps/playground/napplets/feed/src/main.ts`
- `apps/playground/napplets/toaster/src/main.ts`
- `apps/playground/napplets/chat/src/main.ts`

The scanner also flags `apps/playground/src/nip46-client.ts` for an option/example named `secret`.

## Constraints

- No new dependencies.
- Prefer native DOM construction, `textContent`, and `replaceChildren`.
- Preserve existing UI text and status semantics where practical.
- Do not rewrite broad playground modules only to satisfy warning-only complexity thresholds.
- Keep any HTML-string-producing pure render helpers only if their output is consumed safely or converted in a later phase; Phase 69 targets direct assignment sinks.

## Existing Coverage

- Unit render/model tests already cover topology and node-inspector output shape.
- E2E smoke tests cover playground boot, debugger, node inspector, notification service, shell UI state surfaces, and gateway artifacts.
- Phase 69 should add a focused unit/static guard that fails if direct `innerHTML` assignments return to playground source or napplet source.
