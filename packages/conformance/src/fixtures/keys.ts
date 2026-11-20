import type { DomainFixture, OperationCase } from './types.js';

/** Chord the bound push action is registered with, in non-canonical order and case. */
const BOUND_HINT = 'shift+ctrl+k';
/** The same chord in the NAP's canonical `Alt+Ctrl+Shift+Meta+Key` form. */
const BOUND_CANONICAL = 'Ctrl+Shift+K';
const BOUND_ACTION = 'conformance.bound';
const RESERVED = ['Tab', 'Shift+Tab', 'Escape', 'Ctrl+W', 'Ctrl+T', 'Ctrl+L'];

/** Keyboard event a target's `keys.press` control dispatches for the bound chord. */
export const KEYS_PRESS = Object.freeze({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false });

const actionIdIs = (actionId: string) => (reply: Readonly<Record<string, unknown>> | null): string | null =>
  (reply?.actionId === actionId ? null : `actionId was ${JSON.stringify(reply?.actionId)}, expected ${actionId}`);

const registerBound: OperationCase = {
  id: 'keys/registerAction-bound', type: 'keys.registerAction',
  payload: { action: { id: BOUND_ACTION, label: 'Conformance bound action', defaultKey: BOUND_HINT } },
  semantics: {
    rule: 'Shells MUST normalize combos to Alt+Ctrl+Shift+Meta+Key order: a binding assigned from the hint "shift+ctrl+k" is "Ctrl+Shift+K" (the shell MAY leave the action unbound)',
    verify(reply) {
      const problem = actionIdIs(BOUND_ACTION)(reply);
      if (problem) return problem;
      return reply?.binding === undefined || reply.binding === BOUND_CANONICAL ? null : `binding was ${JSON.stringify(reply?.binding)}, expected ${BOUND_CANONICAL}`;
    },
  },
};

/** NAP-KEYS at the pinned draft head: registration, the reserved-key rule, forwarding, and keys.action until unregister. */
export const KEYS_FIXTURE: DomainFixture = {
  domain: 'keys',
  cases: [
    {
      id: 'keys/registerAction-unbound', type: 'keys.registerAction', payload: { action: { id: 'conformance.unbound', label: 'Conformance unbound action' } },
      semantics: { rule: 'The shell MUST respond to keys.registerAction with a keys.registerAction.result carrying the same id and the RegisterResult actionId', verify: actionIdIs('conformance.unbound') },
    },
    {
      id: 'keys/registerAction-normalized', type: 'keys.registerAction', payload: { action: { id: 'conformance.normalized', label: 'Conformance normalized hint', defaultKey: 'shift+alt+j' } },
      semantics: {
        rule: 'Shells MUST normalize combos to Alt+Ctrl+Shift+Meta+Key order: a binding assigned from the hint "shift+alt+j" is "Alt+Shift+J" (the shell MAY leave the action unbound)',
        verify(reply) {
          const problem = actionIdIs('conformance.normalized')(reply);
          if (problem) return problem;
          return reply?.binding === undefined || reply.binding === 'Alt+Shift+J' ? null : `binding was ${JSON.stringify(reply?.binding)}, expected Alt+Shift+J`;
        },
      },
    },
    {
      id: 'keys/registerAction-reserved', type: 'keys.registerAction', payload: { action: { id: 'conformance.reserved', label: 'Conformance reserved hint', defaultKey: 'Escape' } },
      semantics: {
        rule: 'The shell MUST NOT bind actions to reserved keys (Tab, Shift+Tab, Escape, browser-reserved shortcuts), even when a defaultKey hint names one',
        verify(reply) {
          const problem = actionIdIs('conformance.reserved')(reply);
          if (problem) return problem;
          return reply?.binding === undefined || !RESERVED.includes(String(reply.binding)) ? null : `reserved key ${JSON.stringify(reply?.binding)} was bound`;
        },
      },
    },
    { id: 'keys/forward', type: 'keys.forward', reply: null, noId: true, payload: { key: 'j', code: 'KeyJ', ctrl: false, alt: false, shift: false, meta: false } },
    { id: 'keys/unregisterAction-unbound', type: 'keys.unregisterAction', reply: null, noId: true, payload: { actionId: 'conformance.unbound' } },
  ],
  pushes: [
    {
      id: 'keys/action', type: 'keys.action',
      subscribe: registerBound,
      trigger: { control: 'keys.press', payload: KEYS_PRESS },
      match: { actionId: BOUND_ACTION },
      unsubscribe: { id: 'keys/unregisterAction-bound', type: 'keys.unregisterAction', reply: null, noId: true, payload: { actionId: BOUND_ACTION } },
    },
  ],
};
