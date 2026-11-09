/**
 * domains/keys.ts — Mock NAP-KEYS service.
 *
 * Spec: naps/NAP-KEYS.md @ napplet/naps PR #9 head 8869a4cf (draft)
 * Routes: keys.forward, keys.registerAction, keys.unregisterAction;
 *   pushes keys.bindings, keys.action
 * Spec gaps / decisions:
 *   - Combos are normalized to the NAP's stated `Alt+Ctrl+Shift+Meta+Key`
 *     order (the text calls it "alphabetical" but lists Shift before Meta; the
 *     listed sequence wins). Single-character keys are upper-cased.
 *   - The shell binds `defaultKey` immediately unless it is reserved
 *     (`Tab`, `Shift+Tab`, `Escape`, browser `Ctrl+W/T/L/N`) or already bound
 *     by another action of the same window; the action then stays unbound.
 *   - Re-registering an existing action id in the same window is
 *     `error: 'duplicate action ID'`; a non-object action or malformed combo
 *     is `error: 'invalid action'`.
 *   - `keys.bindings` (complete list) is pushed after every register and
 *     unregister, and after `rebind()`.
 *   - `keys.forward` is recorded in `state.forwarded` (last 256 entries).
 */
import type { NappletMessage } from '@kehto/runtime';
import type { Action, KeyBinding, KeysForwardMessage } from '@napplet/nap/keys/types';
import { defineMockService, pushToWindow, type MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/** Spec document read when this mock was written. */
export const KEYS_SPEC_REF: NapSpecRef = {
  nap: 'NAP-KEYS',
  status: 'draft',
  source: 'pr',
  pr: 9,
  sha: '8869a4cf',
  path: 'naps/NAP-KEYS.md',
};

/** Combos a shell MUST NOT bind (accessibility and browser-reserved). */
export const KEYS_RESERVED_COMBOS: readonly string[] = Object.freeze([
  'Tab', 'Shift+Tab', 'Escape', 'Ctrl+W', 'Ctrl+T', 'Ctrl+L', 'Ctrl+N',
]);

const MODIFIER_ORDER: readonly string[] = Object.freeze(['Alt', 'Ctrl', 'Shift', 'Meta']);
const MODIFIER_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  alt: 'Alt', option: 'Alt', ctrl: 'Ctrl', control: 'Ctrl', shift: 'Shift',
  meta: 'Meta', cmd: 'Meta', command: 'Meta', super: 'Meta', win: 'Meta',
});
const FORWARD_LIMIT = 256;

/**
 * One registered action and its binding.
 *
 * @example
 * ```ts
 * const entry: MockKeysAction = { action: { id: 'editor.save', label: 'Save', defaultKey: 'Ctrl+S' }, binding: 'Ctrl+S' };
 * ```
 */
export interface MockKeysAction {
  /** Action as registered. */
  action: Action;
  /** Normalized combo the mock shell bound, or `undefined` when unbound. */
  binding?: string;
}

/**
 * One forwarded keystroke with its source window.
 *
 * @example
 * ```ts
 * const last = service.mock.state().forwarded.at(-1);
 * last?.key === 'j';
 * ```
 */
export interface MockForwardedKey extends Omit<KeysForwardMessage, 'type'> {
  /** Window that forwarded the keystroke. */
  windowId: string;
}

/**
 * In-memory state of the keys mock.
 *
 * @example
 * ```ts
 * service.mock.state().actions.get('w1')?.get('editor.save')?.binding; // 'Ctrl+S'
 * ```
 */
export interface MockKeysState {
  /** Window → action id → registration. */
  actions: Map<string, Map<string, MockKeysAction>>;
  /** Forwarded keystrokes, oldest first (bounded). */
  forwarded: MockForwardedKey[];
}

/**
 * Options for `createMockKeysService`.
 *
 * @example
 * ```ts
 * const options: MockKeysOptions = { reservedCombos: ['Ctrl+Alt+T'] };
 * ```
 */
export interface MockKeysOptions extends MockServiceOptions {
  /** Extra shell-reserved combos that are never bound. */
  reservedCombos?: readonly string[];
}

/**
 * The keys mock service with its `pressKey` and `rebind` controls.
 *
 * @example
 * ```ts
 * const keys = createMockKeysService();
 * keys.pressKey('w1', 'Ctrl+S'); // pushes keys.action for the bound action
 * ```
 */
export type MockKeysService = MockService<MockKeysState> & {
  /**
   * Simulate the shell matching a combo for a window and push `keys.action`
   * for every action bound to it.
   *
   * @param windowId - Target window.
   * @param combo - Combo such as `Ctrl+S` (normalized before matching).
   * @returns Action ids that were triggered.
   */
  pressKey(windowId: string, combo: string): string[];
  /**
   * Simulate the user rebinding (or unbinding with `null`) an action, then
   * push the window's complete `keys.bindings`.
   *
   * @param windowId - Owning window.
   * @param actionId - Registered action id.
   * @param combo - New combo, or `null` to unbind.
   * @returns `false` when the action is unknown or the combo is invalid/reserved.
   */
  rebind(windowId: string, actionId: string, combo: string | null): boolean;
};

/**
 * Normalize a combo to `Alt+Ctrl+Shift+Meta+Key`.
 *
 * @param combo - Raw combo text, e.g. `ctrl+shift+p`.
 * @returns The normalized combo, or `undefined` when malformed.
 * @example
 * ```ts
 * normalizeKeyCombo('shift+ctrl+s') === 'Ctrl+Shift+S';
 * ```
 */
export function normalizeKeyCombo(combo: string): string | undefined {
  const parts = combo.split('+').map((part) => part.trim());
  if (parts.length === 0 || parts.some((part) => part.length === 0)) return undefined;
  const key = parts[parts.length - 1] as string;
  const modifiers = new Set<string>();
  for (const part of parts.slice(0, -1)) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (!modifier) return undefined;
    modifiers.add(modifier);
  }
  const normalizedKey = key.length === 1 ? key.toUpperCase() : key;
  if (MODIFIER_ALIASES[normalizedKey.toLowerCase()]) return undefined;
  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), normalizedKey].join('+');
}

function bindingsFor(windowId: string, state: MockKeysState): KeyBinding[] {
  const bindings: KeyBinding[] = [];
  for (const [actionId, entry] of state.actions.get(windowId) ?? []) {
    if (entry.binding) bindings.push({ actionId, key: entry.binding });
  }
  return bindings;
}

function parseAction(raw: unknown): Action | undefined {
  const action = raw as Partial<Action> | null | undefined;
  if (!action || typeof action !== 'object' || typeof action.id !== 'string' || action.id.length === 0 || typeof action.label !== 'string') return undefined;
  if (action.defaultKey !== undefined && typeof action.defaultKey !== 'string') return undefined;
  return { id: action.id, label: action.label, ...(action.defaultKey !== undefined ? { defaultKey: action.defaultKey } : {}) };
}

function handleRegister(context: MockRouteContext<MockKeysState>, reserved: ReadonlySet<string>): void {
  const { message, windowId, state, reply, push } = context;
  const action = parseAction(message.action);
  const rawId = (message.action as { id?: unknown } | undefined)?.id;
  if (!action) return reply({ actionId: typeof rawId === 'string' ? rawId : '', error: 'invalid action' });
  const windowActions = state.actions.get(windowId) ?? new Map<string, MockKeysAction>();
  if (windowActions.has(action.id)) return reply({ actionId: action.id, error: 'duplicate action ID' });
  let binding: string | undefined;
  if (action.defaultKey !== undefined) {
    binding = normalizeKeyCombo(action.defaultKey);
    if (!binding) return reply({ actionId: action.id, error: 'invalid action' });
    const taken = [...windowActions.values()].some((entry) => entry.binding === binding);
    if (reserved.has(binding) || taken) binding = undefined;
  }
  windowActions.set(action.id, { action, ...(binding ? { binding } : {}) });
  state.actions.set(windowId, windowActions);
  reply({ actionId: action.id, ...(binding ? { binding } : {}) });
  push({ type: 'keys.bindings', bindings: bindingsFor(windowId, state) } as NappletMessage);
}

function handleForward({ message, windowId, state }: MockRouteContext<MockKeysState>): void {
  if (typeof message.key !== 'string' || typeof message.code !== 'string') return;
  state.forwarded.push({
    windowId,
    key: message.key,
    code: message.code,
    ctrl: message.ctrl === true,
    alt: message.alt === true,
    shift: message.shift === true,
    meta: message.meta === true,
  });
  if (state.forwarded.length > FORWARD_LIMIT) state.forwarded.splice(0, state.forwarded.length - FORWARD_LIMIT);
}

/**
 * Create the NAP-KEYS mock.
 *
 * @param options - Extra reserved combos and shared mock options.
 * @returns The keys mock service.
 * @example
 * ```ts
 * const keys = createMockKeysService();
 * keys.handleMessage('w1', { type: 'keys.registerAction', id: 'r1', action: { id: 'editor.save', label: 'Save', defaultKey: 'Ctrl+S' } }, send);
 * // → { type: 'keys.registerAction.result', id: 'r1', actionId: 'editor.save', binding: 'Ctrl+S' }
 * // → { type: 'keys.bindings', bindings: [{ actionId: 'editor.save', key: 'Ctrl+S' }] }
 * ```
 */
export function createMockKeysService(options: MockKeysOptions = {}): MockKeysService {
  const reserved = new Set<string>();
  for (const combo of [...KEYS_RESERVED_COMBOS, ...(options.reservedCombos ?? [])]) {
    const normalized = normalizeKeyCombo(combo);
    if (normalized) reserved.add(normalized);
  }
  const base = defineMockService<MockKeysState>({
    domain: 'keys',
    version: '1.0.0',
    description: 'Mock NAP-KEYS keyboard forwarding and action keybindings',
    kind: 'service',
    initialState: () => ({ actions: new Map(), forwarded: [] }),
    routes: {
      'keys.forward': handleForward,
      'keys.registerAction': (context) => handleRegister(context, reserved),
      'keys.unregisterAction': ({ message, windowId, state, push }) => {
        const windowActions = state.actions.get(windowId);
        if (typeof message.actionId !== 'string' || !windowActions?.delete(message.actionId)) return;
        if (windowActions.size === 0) state.actions.delete(windowId);
        push({ type: 'keys.bindings', bindings: bindingsFor(windowId, state) } as NappletMessage);
      },
    },
    onWindowDestroyed: (windowId, state) => {
      state.actions.delete(windowId);
      state.forwarded = state.forwarded.filter((entry) => entry.windowId !== windowId);
    },
  }, options);

  const service: MockKeysService = Object.assign(base, {
    pressKey(windowId: string, combo: string): string[] {
      const normalized = normalizeKeyCombo(combo);
      const triggered: string[] = [];
      if (!normalized) return triggered;
      for (const [actionId, entry] of base.mock.state().actions.get(windowId) ?? []) {
        if (entry.binding !== normalized) continue;
        if (pushToWindow(base, windowId, { type: 'keys.action', actionId } as NappletMessage)) triggered.push(actionId);
      }
      return triggered;
    },
    rebind(windowId: string, actionId: string, combo: string | null): boolean {
      const state = base.mock.state();
      const entry = state.actions.get(windowId)?.get(actionId);
      if (!entry) return false;
      const normalized = combo === null ? undefined : normalizeKeyCombo(combo);
      if (combo !== null && (!normalized || reserved.has(normalized))) return false;
      if (normalized) entry.binding = normalized;
      else delete entry.binding;
      pushToWindow(base, windowId, { type: 'keys.bindings', bindings: bindingsFor(windowId, state) } as NappletMessage);
      return true;
    },
  });
  return service;
}

/** Registry row for the keys mock. */
export const KEYS_MOCK_ENTRY: MockDomainEntry = {
  domain: 'keys',
  kind: 'service',
  spec: KEYS_SPEC_REF,
  create: (options) => createMockKeysService(options),
};
