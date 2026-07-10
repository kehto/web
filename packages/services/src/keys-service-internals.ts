import type { NappletMessage } from '@napplet/core';
import type {
  KeysBindingsMessage,
  KeysForwardMessage,
  KeyBinding,
} from '@napplet/nap/keys/types';

/**
 * Parsed chord struct. The napplet-facing API uses strings like
 * `"Ctrl+Shift+K"`; the service lowers them into this shape for matching.
 */
export interface ChordSpec {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}
/** Registry entry mapping a registered actionId to its owning window + chord. */
export interface ActionEntry {
  chord: ChordSpec;
  chordString: string;
  windowId: string;
}

const MODIFIER_ALIASES: Record<string, keyof Pick<ChordSpec, 'ctrl' | 'alt' | 'shift' | 'meta'>> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  win: 'meta',
  super: 'meta',
};

export function parseChord(chord: string): ChordSpec {
  if (chord.length === 0) throw new Error('empty chord');
  const parts = chord.split('+');
  const out: ChordSpec = { ctrl: false, alt: false, shift: false, meta: false, key: '' };
  for (let i = 0; i < parts.length - 1; i++) {
    const tok = parts[i].trim().toLowerCase();
    if (tok.length === 0) continue;
    const slot = MODIFIER_ALIASES[tok];
    if (!slot) throw new Error(`unknown modifier: ${parts[i]}`);
    out[slot] = true;
  }
  const keyTok = parts[parts.length - 1].trim();
  if (keyTok.length === 0) throw new Error(`empty key in chord: ${chord}`);
  out.key = keyTok.length === 1 ? keyTok.toUpperCase() : keyTok;
  return out;
}

/**
 * Format a parsed chord in the canonical NAP-KEYS wire order:
 * Alt+Ctrl+Shift+Meta+Key.
 */
export function formatChord(spec: ChordSpec): string {
  const parts: string[] = [];
  if (spec.alt) parts.push('Alt');
  if (spec.ctrl) parts.push('Ctrl');
  if (spec.shift) parts.push('Shift');
  if (spec.meta) parts.push('Meta');
  parts.push(spec.key);
  return parts.join('+');
}

const BROWSER_RESERVED_CTRL_KEYS = new Set(['L', 'N', 'R', 'T', 'W']);

/**
 * NAP-KEYS reserved keys must never be bound or added to a napplet suppress
 * list. The browser-reserved set is intentionally conservative and covers the
 * shortcuts named by the draft plus the common tab/window variants.
 */
export function isReservedKeyChord(spec: ChordSpec): boolean {
  if (spec.key === 'Tab' || spec.key === 'Escape') return true;
  if ((spec.ctrl || spec.meta) && !spec.alt && BROWSER_RESERVED_CTRL_KEYS.has(spec.key)) return true;
  if (spec.alt && !spec.ctrl && !spec.meta && (spec.key === 'ArrowLeft' || spec.key === 'ArrowRight')) {
    return true;
  }
  return false;
}

export function chordSpecKey(spec: {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}): string {
  return `${spec.ctrl}|${spec.alt}|${spec.shift}|${spec.meta}|${spec.key}`;
}

export function forwardPayload(m: KeysForwardMessage): {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
} {
  return {
    key: m.key,
    code: m.code,
    ctrlKey: m.ctrl,
    altKey: m.alt,
    shiftKey: m.shift,
    metaKey: m.meta,
  };
}

export function eventKey(ev: KeyboardEvent): string {
  const k = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
  return `${ev.ctrlKey}|${ev.altKey}|${ev.shiftKey}|${ev.metaKey}|${k}`;
}

export function bindingsForWindow(
  windowId: string,
  registry: ReadonlyMap<string, ActionEntry>,
  windowIndex: ReadonlyMap<string, ReadonlySet<string>>,
): KeyBinding[] {
  const actionIds = windowIndex.get(windowId);
  if (!actionIds) return [];
  const bindings: KeyBinding[] = [];
  for (const actionId of actionIds) {
    const entry = registry.get(actionId);
    if (!entry || entry.windowId !== windowId) continue;
    bindings.push({ actionId, key: entry.chordString });
  }
  return bindings;
}

export function pushBindings(
  windowId: string,
  registry: ReadonlyMap<string, ActionEntry>,
  windowIndex: ReadonlyMap<string, ReadonlySet<string>>,
  send: (msg: NappletMessage) => void,
): void {
  const payload: KeysBindingsMessage = {
    type: 'keys.bindings',
    bindings: bindingsForWindow(windowId, registry, windowIndex),
  };
  send(payload as NappletMessage);
}

export function removeActionFromWindowIndex(
  actionId: string,
  windowIndex: Map<string, Set<string>>,
): void {
  for (const [wid, set] of windowIndex.entries()) {
    if (set.delete(actionId) && set.size === 0) windowIndex.delete(wid);
  }
}
