# @kehto/wm

Structural window-management contracts for consumer-owned layout strategies.

> **Alpha status:** These shell-owned contracts are experimental. They are not a
> NUB and may change as Kehto and other runtime implementations evolve.

## Install

```bash
pnpm add @kehto/wm
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/wm/package.json`, `packages/wm/src/index.ts` |
| Version | `0.0.0` |
| Runtime entry | `./src/index.ts` |
| Types entry | `./src/index.ts` |
| Files | `src`, `README.md` |
| Side effects | `false` |

## Peer Dependencies

None.

## Primary APIs

| Area | Exports |
|------|---------|
| Base types | `WindowId`, `WorkspaceId`, `Rect` |
| Layout contracts | `WindowState`, `WindowPlacement`, `LayoutStrategy` |
| Host hooks | `WmHostHooks` |
| Service | `WmService`, `createWmService` |

## Scope Boundaries

- Provides contracts and a no-op default strategy so hosts can wire window-management state without choosing an algorithm up front.
- Does not ship BSP, master-stack, floating, or other concrete layout algorithms.
- Does not expose a NUB domain; window management is shell-internal state.

## API Reference

- Generated module: <a href="../api/modules/_kehto_wm.html" target="_self"><code>docs/api/modules/_kehto_wm.html</code></a>
