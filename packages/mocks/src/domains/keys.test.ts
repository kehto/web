import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { KEYS_MOCK_ENTRY, KEYS_SPEC_REF, createMockKeysService, normalizeKeyCombo } from './keys.js';

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

const SAVE = { id: 'editor.save', label: 'Save', defaultKey: 'Ctrl+S' };
const UNDO = { id: 'editor.undo', label: 'Undo', defaultKey: 'Ctrl+Z' };

describe('createMockKeysService', () => {
  it('describes itself and records the spec ref', () => {
    const service = createMockKeysService();
    expect(service.descriptor).toMatchObject({ name: 'keys', version: '1.0.0' });
    expect(service.mock.routes).toEqual(['keys.forward', 'keys.registerAction', 'keys.unregisterAction']);
    expect(KEYS_SPEC_REF).toEqual({ nap: 'NAP-KEYS', status: 'draft', source: 'pr', pr: 9, sha: '8869a4cf', path: 'naps/NAP-KEYS.md' });
    expect(KEYS_MOCK_ENTRY.kind).toBe('service');
    expect(KEYS_MOCK_ENTRY.create?.({}).descriptor.name).toBe('keys');
  });

  it('normalizes combos to Alt+Ctrl+Shift+Meta+Key order', () => {
    expect(normalizeKeyCombo('shift+ctrl+s')).toBe('Ctrl+Shift+S');
    expect(normalizeKeyCombo('Cmd+Alt+P')).toBe('Alt+Meta+P');
    expect(normalizeKeyCombo('F5')).toBe('F5');
    expect(normalizeKeyCombo('ArrowDown')).toBe('ArrowDown');
    expect(normalizeKeyCombo('Ctrl+')).toBeUndefined();
    expect(normalizeKeyCombo('Hyper+S')).toBeUndefined();
    expect(normalizeKeyCombo('Ctrl')).toBeUndefined();
  });

  it('registers actions, binds the default key, and pushes the complete bindings list', () => {
    const service = createMockKeysService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'keys.registerAction', id: 'r1', action: SAVE } as NappletMessage, send);
    service.handleMessage('w1', { type: 'keys.registerAction', id: 'r2', action: UNDO } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'keys.registerAction.result', id: 'r1', actionId: 'editor.save', binding: 'Ctrl+S' },
      { type: 'keys.bindings', bindings: [{ actionId: 'editor.save', key: 'Ctrl+S' }] },
      { type: 'keys.registerAction.result', id: 'r2', actionId: 'editor.undo', binding: 'Ctrl+Z' },
      { type: 'keys.bindings', bindings: [{ actionId: 'editor.save', key: 'Ctrl+S' }, { actionId: 'editor.undo', key: 'Ctrl+Z' }] },
    ]);
  });

  it('leaves reserved and conflicting combos unbound and reports registration errors', () => {
    const service = createMockKeysService({ reservedCombos: ['Ctrl+Alt+T'] });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'keys.registerAction', id: 'r1', action: { id: 'nav.escape', label: 'Esc', defaultKey: 'Escape' } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'keys.registerAction', id: 'r2', action: { id: 'term', label: 'Terminal', defaultKey: 'Alt+Ctrl+T' } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'keys.registerAction', id: 'r3', action: SAVE } as NappletMessage, send);
    service.handleMessage('w1', { type: 'keys.registerAction', id: 'r4', action: { id: 'editor.save-as', label: 'Save as', defaultKey: 'ctrl+s' } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'keys.registerAction', id: 'r5', action: SAVE } as NappletMessage, send);
    service.handleMessage('w1', { type: 'keys.registerAction', id: 'r6', action: { id: 'bad', label: 'Bad', defaultKey: 'Hyper+X' } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'keys.registerAction', id: 'r7', action: 'nope' } as NappletMessage, send);
    const results = sent.filter((msg) => msg.type === 'keys.registerAction.result');
    expect(results).toEqual([
      { type: 'keys.registerAction.result', id: 'r1', actionId: 'nav.escape' },
      { type: 'keys.registerAction.result', id: 'r2', actionId: 'term' },
      { type: 'keys.registerAction.result', id: 'r3', actionId: 'editor.save', binding: 'Ctrl+S' },
      { type: 'keys.registerAction.result', id: 'r4', actionId: 'editor.save-as' },
      { type: 'keys.registerAction.result', id: 'r5', actionId: 'editor.save', error: 'duplicate action ID' },
      { type: 'keys.registerAction.result', id: 'r6', actionId: 'bad', error: 'invalid action' },
      { type: 'keys.registerAction.result', id: 'r7', actionId: '', error: 'invalid action' },
    ]);
    expect(sent.at(-1)).toEqual({ type: 'keys.registerAction.result', id: 'r7', actionId: '', error: 'invalid action' });
    expect(service.mock.state().actions.get('w1')?.size).toBe(4);
  });

  it('records forwarded keystrokes', () => {
    const service = createMockKeysService();
    service.handleMessage('w1', { type: 'keys.forward', key: 'j', code: 'KeyJ', ctrl: false, alt: false, shift: false, meta: false } as NappletMessage, () => {});
    service.handleMessage('w1', { type: 'keys.forward', key: 5 } as NappletMessage, () => {});
    expect(service.mock.state().forwarded).toEqual([{ windowId: 'w1', key: 'j', code: 'KeyJ', ctrl: false, alt: false, shift: false, meta: false }]);
    expect(service.mock.sent).toEqual([]);
  });

  it('pressKey pushes keys.action for bound actions and rebind pushes bindings', () => {
    const service = createMockKeysService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'keys.registerAction', id: 'r1', action: SAVE } as NappletMessage, send);
    sent.length = 0;
    expect(service.pressKey('w1', 'ctrl+s')).toEqual(['editor.save']);
    expect(service.pressKey('w1', 'Ctrl+Z')).toEqual([]);
    expect(service.pressKey('w2', 'Ctrl+S')).toEqual([]);
    expect(sent).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);

    expect(service.rebind('w1', 'editor.save', 'Meta+Shift+S')).toBe(true);
    expect(service.rebind('w1', 'editor.save', 'Escape')).toBe(false);
    expect(service.rebind('w1', 'missing', 'Ctrl+Q')).toBe(false);
    expect(sent.at(-1)).toEqual({ type: 'keys.bindings', bindings: [{ actionId: 'editor.save', key: 'Shift+Meta+S' }] });
    expect(service.pressKey('w1', 'Ctrl+S')).toEqual([]);
    expect(service.rebind('w1', 'editor.save', null)).toBe(true);
    expect(sent.at(-1)).toEqual({ type: 'keys.bindings', bindings: [] });
  });

  it('unregisters actions, cleans destroyed windows, and resets', () => {
    const service = createMockKeysService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'keys.registerAction', id: 'r1', action: SAVE } as NappletMessage, send);
    service.handleMessage('w1', { type: 'keys.registerAction', id: 'r2', action: UNDO } as NappletMessage, send);
    sent.length = 0;
    service.handleMessage('w1', { type: 'keys.unregisterAction', actionId: 'editor.save' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'keys.unregisterAction', actionId: 'ghost' } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'keys.bindings', bindings: [{ actionId: 'editor.undo', key: 'Ctrl+Z' }] }]);
    service.handleMessage('w1', { type: 'keys.forward', key: 'x', code: 'KeyX', ctrl: false, alt: false, shift: false, meta: false } as NappletMessage, send);
    service.onWindowDestroyed?.('w1');
    expect(service.mock.state()).toEqual({ actions: new Map(), forwarded: [] });
    service.handleMessage('w2', { type: 'keys.registerAction', id: 'r3', action: SAVE } as NappletMessage, send);
    service.mock.reset();
    expect(service.mock.state()).toEqual({ actions: new Map(), forwarded: [] });
    expect(service.mock.sent).toEqual([]);
  });
});
