import type { DomainFixture, OperationCase, PushCase, SemanticVerdict } from './types.js';

type Envelope = Readonly<Record<string, unknown>> | null;
type Pad = { index?: unknown; connected?: unknown; timestamp?: unknown; axes?: unknown; buttons?: unknown } | null;

const subscribe: OperationCase = { id: 'gamepad/subscribe', type: 'gamepad.subscribe', reply: null, noId: true };
const unsubscribe: OperationCase = { id: 'gamepad/unsubscribe', type: 'gamepad.unsubscribe', reply: null, noId: true };

const padsOf = (push: Envelope): Pad[] => (Array.isArray(push?.pads) ? push.pads as Pad[] : []);
const connected = (push: Envelope): Exclude<Pad, null>[] => padsOf(push).filter((slot): slot is Exclude<Pad, null> => slot !== null);

/** Shape every snapshot shares: no `id`, the required fields, and slot positions matching `index`. */
function snapshot(push: Envelope, focused: boolean): SemanticVerdict {
  if (!push) return 'no gamepad.state';
  if ('id' in push) return `gamepad.state carried id ${JSON.stringify(push.id)}; "None carries id"`;
  if (push.available !== true) return `available was ${JSON.stringify(push.available)}`;
  if (!Array.isArray(push.pads)) return `pads was ${JSON.stringify(push.pads)}`;
  if (push.focused !== focused) return `focused was ${JSON.stringify(push.focused)}, expected ${focused}`;
  const misplaced = padsOf(push).findIndex((slot, position) => slot !== null && (slot.index !== position || slot.connected !== true));
  return misplaced < 0 ? null : `slot ${misplaced} was ${JSON.stringify(padsOf(push)[misplaced])}`;
}

/** Neutral values: every axis 0, every button value 0 with pressed/touched false, timestamp 0. */
function neutral(push: Envelope): SemanticVerdict {
  for (const slot of connected(push)) {
    const axes = Array.isArray(slot.axes) ? slot.axes : [null];
    const buttons = Array.isArray(slot.buttons) ? slot.buttons as { value?: unknown; pressed?: unknown; touched?: unknown }[] : [{}];
    if (slot.timestamp !== 0) return `slot ${String(slot.index)} timestamp was ${JSON.stringify(slot.timestamp)}, expected 0`;
    if (axes.some((axis) => axis !== 0)) return `slot ${String(slot.index)} axes were ${JSON.stringify(axes)}`;
    if (buttons.some((b) => b.value !== 0 || b.pressed !== false || b.touched !== false)) return `slot ${String(slot.index)} buttons were ${JSON.stringify(buttons)}`;
  }
  return null;
}

const all = (...verdicts: (() => SemanticVerdict)[]): SemanticVerdict => {
  for (const verdict of verdicts) {
    const problem = verdict();
    if (problem) return problem;
  }
  return null;
};

function push(id: string, control: string | null, rule: string, verify: (state: Envelope) => SemanticVerdict, extra: Partial<PushCase> = {}): PushCase {
  return { id, type: 'gamepad.state', ...(control ? { trigger: { control } } : {}), ...extra, semantics: { rule, verify: (state) => verify(state) } };
}

/**
 * NAP-GAMEPAD at napplet/naps#130 head: subscription snapshot, focused live
 * delivery, neutral values on focus loss, connection changes while unfocused,
 * and silence after unsubscribe.
 *
 * Each host-triggered push is judged on the first `gamepad.state` after its
 * trigger, so each trigger changes the napplet's view exactly once. The first
 * push has no trigger: it judges the snapshot `gamepad.subscribe` produced.
 */
export const GAMEPAD_FIXTURE: DomainFixture = {
  domain: 'gamepad',
  cases: [],
  pushes: [
    push('gamepad/subscribe-snapshot', null,
      '"The shell MUST send a gamepad.state snapshot after each gamepad.subscribe"; without focus every connected slot is neutral',
      (state) => all(() => snapshot(state, false), () => (connected(state).length ? null : 'the snapshot listed no connected controller'), () => neutral(state)),
      { subscribe }),
    push('gamepad/focus-live', 'gamepad.focusProbe',
      'A snapshot follows when the napplet gains focus; "live axes, buttons and timestamp values" go to the focused napplet (a live slot has a non-zero timestamp)',
      (state) => all(() => snapshot(state, true), () => (connected(state).some((slot) => typeof slot.timestamp === 'number' && slot.timestamp > 0) ? null : `no slot carried a live timestamp: ${JSON.stringify(state?.pads)}`))),
    {
      ...push('gamepad/press-live', 'gamepad.press',
        'The shell "MUST then send a snapshot whenever that napplet\'s view changes": a press on the focused napplet arrives as a live button value',
        (state) => {
          const problem = snapshot(state, true);
          if (problem) return problem;
          const button = (padsOf(state)[1]?.buttons as { value?: unknown; pressed?: unknown }[] | undefined)?.[1];
          return button?.value === 1 && button.pressed === true ? null : `slot 1 button 1 was ${JSON.stringify(button)}, expected value 1 pressed`;
        }),
      trigger: { control: 'gamepad.press', payload: { button: 1, value: 1 } },
    },
    push('gamepad/blur-neutral', 'gamepad.blur',
      'The shell "MUST send this neutral snapshot as soon as focus leaves a napplet": focused false, axes 0, buttons released, timestamp 0',
      (state) => all(() => snapshot(state, false), () => (connected(state).length ? null : 'the neutral snapshot dropped the connected slot'), () => neutral(state))),
    {
      ...push('gamepad/disconnect-unfocused', 'gamepad.disconnect',
        '"The shell MUST report connection changes to every subscribed napplet, including napplets without focus": slot 1 becomes empty',
        (state) => all(() => snapshot(state, false), () => (padsOf(state)[1] ? `slot 1 was still ${JSON.stringify(padsOf(state)[1])}` : null))),
      trigger: { control: 'gamepad.disconnect', payload: { index: 1 } },
    },
    push('gamepad/connect-unfocused', 'gamepad.connect',
      'A controller connected while unfocused is reported to the subscribed napplet with neutral values, and "The shell MUST stop sending gamepad.state after gamepad.unsubscribe"',
      (state) => all(() => snapshot(state, false), () => (connected(state).length === 1 ? null : `expected one connected slot, got ${JSON.stringify(state?.pads)}`), () => neutral(state)),
      { unsubscribe }),
  ],
};
