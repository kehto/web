# Phase 70: Type Safety, Maintainability, and Dependency Triage - Context

## Scope

Reduce warning-only AI-slop/type/dependency findings where the cleanup is local and protected. Document deferrals for broad UI complexity and unsafe dependency overrides.

## Current Inventory

- `pnpm audit --audit-level moderate` reports 6 vulnerabilities: VitePress's Vite/esbuild path, transitive PostCSS, transitive `brace-expansion`, and direct `turbo`.
- `pnpm outdated --recursive` shows low-risk patch upgrades for `turbo`, `vitest`, `@vitest/coverage-v8`, and `nostr-tools`; major upgrades such as TypeScript 6 and Vite 8 are out of scope.
- Production `as any` findings are concentrated in service message routers that can use narrow local envelope types.
- Runtime double assertions remain in `packages/runtime/src/runtime.ts` relay/IFC handlers.
- Thin-wrapper findings include internal helpers that can be inlined and public helpers that should be retained as named API boundaries.
- Complexity/file-size findings are broad playground decomposition work and remain unsafe without a dedicated behavior-lock milestone.

## Constraints

- No new dependencies.
- Patch/minor dev dependency changes only; no major toolchain moves.
- Do not force VitePress onto unsupported dependency ranges solely to silence audit output.
- Keep type cleanup local to message-boundary assertions; do not retune package contracts.

## Deferral Candidates

- VitePress currently depends on Vite `^5.4.14`; latest Vite 5 remains audited by the current advisory range. Forcing Vite 6 through overrides is a transitive major-range violation and should be deferred unless docs migration work explicitly accepts that risk.
- Large function/file complexity warnings should be deferred to a structural refactor milestone with UI/E2E locks.
