/**
 * @kehto/wm — Generic window manager service contract.
 *
 * DRAFT SKELETON — Phase 11 of hyprgate v2.0. Establishes the public API
 * surface for upstream review. Implementation is stubbed (throws).
 *
 * Shells (e.g. hyprgate) consume this package by:
 *   1. Providing a WmHostHooks implementation.
 *   2. Calling createWmService({ hooks }) to get a WmService.
 *   3. Wiring WmService methods to their internal state/action layer.
 *
 * Hyprgate's local implementation lives at apps/shell/src/lib/services/wm.ts
 * (not in this package — shell-specific delegation to the shell's internal state store).
 */

// ─── Generic types ──────────────────────────────────────────────────────────

export type WindowId = string;
export type WorkspaceId = string | number;
export type Rect = { x: number; y: number; w: number; h: number };
export type Layout = 'dwindle' | 'master-stack' | 'floating' | (string & {});

// ─── Host-hooks contract ────────────────────────────────────────────────────

/**
 * Notification-only hooks invoked by the WM service on window/workspace
 * lifecycle events. Shells implement these; the package calls into them.
 *
 * IMPORTANT: these hooks do NOT re-trigger animations. Shells that fire
 * animations imperatively inside their own action code continue to do so.
 * These hooks exist for external observers (instrumentation, layout-selection
 * UI, etc.).
 */
export interface WmHostHooks {
  /** Host selects a layout strategy (by name). No-op is acceptable. */
  selectLayout(strategy: Layout): void;
  /** Fired after a window is created. */
  onWindowCreated(id: WindowId, rect: Rect): void;
  /** Fired after a window is destroyed. */
  onWindowDestroyed(id: WindowId): void;
  /** Fired after a window moves workspaces or is repositioned. */
  onWindowMoved(id: WindowId, from: Rect, to: Rect): void;
}

// ─── Service API ────────────────────────────────────────────────────────────

export interface WmService {
  window: {
    /** Create a new window. Returns its WindowId, or null if creation is blocked. */
    create(opts: { title: string; class: string; iframeSrc?: string }): WindowId | null;
    /** Close the window. */
    close(id: WindowId): void;
    /** Focus the window. */
    focus(id: WindowId): void;
    /** Move the window to a given workspace. */
    move(id: WindowId, toWorkspace: WorkspaceId): void;
  };
  workspace: {
    /** Switch the active workspace. */
    switch(id: WorkspaceId): void;
    /** List all workspaces with their window counts. */
    list(): Array<{ id: WorkspaceId; windowCount: number }>;
  };
  state: {
    /** Snapshot of current focus + active workspace. */
    get(): { focusedWindowId: WindowId | null; activeWorkspace: WorkspaceId };
  };
  /** Clean up listeners / subscriptions. */
  destroy(): void;
}

// ─── Factory (signature stub) ───────────────────────────────────────────────

/**
 * Create a WM service. DRAFT SKELETON — implementation pending upstream merge.
 *
 * Shells that want to use this today should copy the signature into their own
 * shell-internal service (as hyprgate does at apps/shell/src/lib/services/wm.ts)
 * until the skeleton is fleshed out upstream.
 */
export function createWmService(_opts: { hooks: WmHostHooks }): WmService {
  throw new Error(
    '[@kehto/wm] createWmService is a signature-only skeleton (version 0.0.0). ' +
    'See https://github.com/hyprgate/gui/blob/master/specs/wm-package-design.md ' +
    'for the design note and hyprgate\'s reference implementation. Implementation ' +
    'in this package lands after upstream PR merges.'
  );
}
