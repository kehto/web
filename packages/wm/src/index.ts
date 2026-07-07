/**
 * Generic window-manager contracts for NIP-5D shells.
 *
 * @module
 */
/** Stable identifier for a managed window. */
export type WindowId = string;
/** Workspace identifier; shells may use numeric or string labels. */
export type WorkspaceId = string | number;
/** Window rectangle in CSS pixels. */
export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Minimal universal window descriptor passed to layout strategies. (D2)
 *
 * @example
 * const ws: WindowState = { id: 'win-1', focused: true, minimized: false,
 *   rect: { x: 0, y: 0, w: 800, h: 600 } };
 */
export interface WindowState {
  /** Window id. */
  id: WindowId;
  /** Whether this window is focused. */
  focused: boolean;
  /** Whether this window is minimized. */
  minimized: boolean;
  /** Current window rectangle. */
  rect: Rect;
}

/**
 * id + rect only — the output of a layout strategy pass.
 * Consumers track focus / stacking externally. (D3)
 */
export interface WindowPlacement {
  /** Window id. */
  id: WindowId;
  /** Placement rectangle assigned by the strategy. */
  rect: Rect;
}

/**
 * Pure function contract for consumer layout strategies. (D1)
 * No side effects. Implement this in your shell repo —
 * @kehto/wm ships only the contract.
 *
 * @example
 * // In your shell repo (not in @kehto/wm):
 * import type { LayoutStrategy, WindowState, Rect } from '@kehto/wm';
 *
 * export const myBspStrategy: LayoutStrategy = {
 *   arrange(windows, containerRect) {
 *     const visible = windows.filter(w => !w.minimized);
 *     if (visible.length === 0) return [];
 *     const w = Math.floor(containerRect.w / visible.length);
 *     return visible.map((win, i) => ({
 *       id: win.id,
 *       rect: { x: containerRect.x + i * w, y: containerRect.y, w, h: containerRect.h },
 *     }));
 *   },
 * };
 */
export interface LayoutStrategy {
  /**
   * Arrange visible windows inside a container rectangle.
   *
   * @param windows - Current window state snapshot.
   * @param containerRect - Available layout rectangle.
   * @returns Window placements for this layout pass.
   */
  arrange(
    windows: ReadonlyArray<WindowState>,
    containerRect: Rect,
  ): ReadonlyArray<WindowPlacement>;
}

/**
 * Notification-only hooks invoked by WmService on window/workspace lifecycle.
 * Shells implement these; no-op implementations are acceptable.
 */
export interface WmHostHooks {
  /** Notified when a layout strategy is selected (consumer-defined name). */
  selectLayout(strategyName: string): void;
  /** Notified after a window is created. */
  onWindowCreated(id: WindowId, rect: Rect): void;
  /** Notified after a window is destroyed. */
  onWindowDestroyed(id: WindowId): void;
  /** Notified when a window is moved. */
  onWindowMoved(id: WindowId, from: Rect, to: Rect): void;
}

/** Minimal shell-facing window-manager service contract. */
export interface WmService {
  /** Window lifecycle and focus operations. */
  window: {
    /** Create a new window and return its id, or null when the host rejects it. */
    create(opts: { title: string; class: string; iframeSrc?: string }): WindowId | null;
    /** Close a window. */
    close(id: WindowId): void;
    /** Focus a window. */
    focus(id: WindowId): void;
    /** Move a window to a workspace. */
    move(id: WindowId, toWorkspace: WorkspaceId): void;
  };
  /** Workspace operations. */
  workspace: {
    /** Switch the active workspace. */
    switch(id: WorkspaceId): void;
    /** List workspaces known to the service. */
    list(): Array<{ id: WorkspaceId; windowCount: number }>;
  };
  /** Read-only service state accessors. */
  state: {
    /** Get focused-window and active-workspace state. */
    get(): { focusedWindowId: WindowId | null; activeWorkspace: WorkspaceId };
  };
  /** Release service state held by this instance. */
  destroy(): void;
}

const noOpStrategy: LayoutStrategy = {
  arrange: (windows) => windows.map(({ id, rect }) => ({ id, rect })),
};

/**
 * Create a WM service. If `strategy` is omitted, a no-op identity strategy
 * is used (returns windows unchanged) — consumers can ship a working shell
 * before implementing a concrete layout.
 *
 * The strategy is closure-scoped. Consumers invoke
 * `strategy.arrange(windows, containerRect)` from their own event handlers
 * using state snapshots. This factory does NOT call arrange() internally;
 * only consumers know when a re-layout is appropriate.
 *
 * @example
 * import { createWmService } from '@kehto/wm';
 * import { masterStackStrategy } from './strategies/master-stack';
 *
 * const wm = createWmService({
 *   hooks: { selectLayout(){}, onWindowCreated(){}, onWindowDestroyed(){}, onWindowMoved(){} },
 *   strategy: masterStackStrategy, // omit to use no-op default
 * });
 */
export function createWmService(opts: {
  hooks: WmHostHooks;
  strategy?: LayoutStrategy;
}): WmService {
  const layoutStrategy = opts.strategy ?? noOpStrategy;
  void layoutStrategy; // consumer calls layoutStrategy.arrange() from their own handlers

  const windows = new Map<WindowId, WindowState>();
  let focusedWindowId: WindowId | null = null;
  let activeWorkspace: WorkspaceId = 0;
  let nextWindowId = 1;

  return {
    window: {
      create(winOpts) {
        const id: WindowId = String(nextWindowId++);
        const rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
        windows.set(id, { id, focused: false, minimized: false, rect });
        opts.hooks.onWindowCreated(id, rect);
        void winOpts;
        return id;
      },
      close(id) {
        windows.delete(id);
        if (focusedWindowId === id) focusedWindowId = null;
        opts.hooks.onWindowDestroyed(id);
      },
      focus(id) { focusedWindowId = id; },
      move(id, toWorkspace) {
        const win = windows.get(id);
        if (!win) return;
        opts.hooks.onWindowMoved(id, win.rect, { ...win.rect });
        void toWorkspace;
      },
    },
    workspace: {
      switch(id) { activeWorkspace = id; },
      list() { return [{ id: activeWorkspace, windowCount: windows.size }]; },
    },
    state: {
      get() { return { focusedWindowId, activeWorkspace }; },
    },
    destroy() { windows.clear(); },
  };
}
