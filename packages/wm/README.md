# @kehto/wm

Structural primitives for consumer-implemented layout strategies.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. Window-management contracts are shell-owned and experimental; they
> are not a NAP and may change as runtime implementations evolve.

## What this package is

`@kehto/wm` provides the type contracts that shell consumers implement against:

- **`LayoutStrategy` (D1)** — a pure `arrange()` function interface. No side effects.
  Consumers implement their own layout algorithm (BSP, master-stack, floating, etc.)
  in their shell repo using this contract.
- **`WindowState` (D2)** — minimal universal window descriptor: `id`, `focused`,
  `minimized`, `rect`. Passed to `arrange()` on every layout pass.
- **`WindowPlacement` (D3)** — `id + rect` only. Output of an `arrange()` pass.
  Consumers track focus and stacking externally.
- **`createWmService({ hooks, strategy? })` (D4)** — factory with a no-op default
  strategy. Consumers can ship a working shell before implementing a real layout.

`@kehto/wm` is shell-internal state — it is not a NAP domain and there is no
`@napplet/nap/wm` subpath.

## What this package is not

- **Not a layout engine** — no BSP, master-stack, floating, or other concrete algorithms
  ship here. Consumers build those in their own repos.
- **Not a strategy registry** — `createWmService` accepts exactly one strategy.
  Switching algorithms at runtime is a consumer-side concern.
- **Not a NAP domain** — window management is shell-internal state. There is no
  `@napplet/nap/wm` subpath. Do not expose WM state to napplets via the napplet protocol.
- **Not algorithm-prescriptive** — `@kehto/wm` deliberately exports no string-literal
  union of algorithm names (H-04 anti-feature). Consumers choose their own names.

## Consumer-integration example

The `LayoutStrategy` implementation lives in your shell repo — `@kehto/wm` ships
only the contract.

```typescript
// This LayoutStrategy implementation lives in your shell repo — @kehto/wm ships only the contract.
import type { LayoutStrategy, WindowState, WindowPlacement, Rect } from '@kehto/wm';
import { createWmService } from '@kehto/wm';

// Define your own layout algorithm in your shell repo:
const masterStackStrategy: LayoutStrategy = {
  arrange(windows: ReadonlyArray<WindowState>, containerRect: Rect): ReadonlyArray<WindowPlacement> {
    const visible = windows.filter(w => !w.minimized);
    if (visible.length === 0) return [];
    const [main, ...rest] = visible;
    const mainW = rest.length > 0 ? Math.floor(containerRect.w * 0.6) : containerRect.w;
    const sideW = containerRect.w - mainW;
    const sideH = rest.length > 0 ? Math.floor(containerRect.h / rest.length) : 0;
    return [
      { id: main.id, rect: { x: containerRect.x, y: containerRect.y, w: mainW, h: containerRect.h } },
      ...rest.map((win, i) => ({
        id: win.id,
        rect: { x: containerRect.x + mainW, y: containerRect.y + i * sideH, w: sideW, h: sideH },
      })),
    ];
  },
};

// Wire it into the service:
const wm = createWmService({ hooks: myHooks, strategy: masterStackStrategy });
```

## Default no-op strategy

Omitting `strategy` from `createWmService` yields a no-op identity strategy: it
returns windows unchanged (each `WindowPlacement` mirrors the `WindowState` rect).
This is useful for bootstrapping a shell — the factory no longer throws, so consumers
can get end-to-end wiring in place and add a real layout algorithm incrementally.
The strategy is closure-scoped; consumers call `strategy.arrange(windows, containerRect)`
from their own event handlers using state snapshots from `wm.state.get()`.
