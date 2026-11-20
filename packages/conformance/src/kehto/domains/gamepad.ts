import { createGamepadService, type GamepadPadSample } from '@kehto/services';
import type { DomainBackendModule } from './types.js';

type Button = { value: number; pressed: boolean; touched: boolean };

/** Live values of the simulated controller in slot 1 (the NAP's example pad). */
export const FIXTURE_PAD_AXES = Object.freeze([0, -1, 0, 0]);

function pad(index: number, id: string, axes: readonly number[], buttons: readonly Button[], timestamp: number): GamepadPadSample {
  return { index, id, mapping: 'standard', connected: true, timestamp, axes: [...axes], buttons: buttons.map((button) => ({ ...button })) };
}

const released = (): Button => ({ value: 0, pressed: false, touched: false });

function payloadNumber(payload: unknown, key: string, fallback: number): number {
  const value = (payload as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * NAP-GAMEPAD backend: the reference gamepad service over simulated controllers.
 *
 * Slot 0 is empty and slot 1 holds a standard controller with live values. No
 * polling loop runs; every control changes the simulated hardware or focus and
 * calls `refresh()`, so each control yields at most one snapshot per probe.
 * Controls: `gamepad.poll` (refresh, nothing changed), `gamepad.focusProbe`
 * (focus the probe under test), `gamepad.blur` (focus nobody),
 * `gamepad.press` (`{ button, value }`), `gamepad.connect` (next free slot),
 * `gamepad.disconnect` (`{ index }`).
 */
export const GAMEPAD_BACKEND: DomainBackendModule = {
  domain: 'gamepad',
  create({ focus }) {
    let clock = 1000;
    const tick = (): number => { clock += 16; return clock; };
    const slots: (GamepadPadSample | null)[] = [null, pad(1, 'Conformance Standard Controller', FIXTURE_PAD_AXES, [{ value: 1, pressed: true, touched: true }, released()], tick())];
    const service = createGamepadService({
      readGamepads: () => slots.map((slot) => (slot ? pad(slot.index, slot.id, slot.axes, slot.buttons.map((b) => ({ value: b.value, pressed: b.pressed, touched: b.touched ?? b.pressed })), slot.timestamp) : null)),
      getFocusedWindow: () => focus.windowId,
      isHostActive: () => true,
      now: () => clock,
    });
    const change = (): void => { service.refresh(); };
    return {
      services: { gamepad: service },
      controls: {
        'gamepad.poll': change,
        'gamepad.focusProbe': (_payload, { endpoints }) => { focus.windowId = endpoints().at(-1) ?? null; change(); },
        'gamepad.blur': () => { focus.windowId = null; change(); },
        'gamepad.press': (payload) => {
          const target = slots[1];
          if (!target) return;
          const index = payloadNumber(payload, 'button', 1);
          const value = payloadNumber(payload, 'value', 1);
          const buttons = target.buttons.map((button, position) => (position === index ? { value, pressed: value > 0, touched: value > 0 } : { value: button.value, pressed: button.pressed, touched: button.touched ?? button.pressed }));
          slots[1] = pad(1, target.id, target.axes, buttons, tick());
          change();
        },
        'gamepad.connect': () => {
          let index = slots.findIndex((slot) => slot === null);
          if (index < 0) index = slots.length;
          slots[index] = pad(index, `Conformance Controller ${index}`, [0.5, 0], [{ value: 1, pressed: true, touched: true }], tick());
          change();
        },
        'gamepad.disconnect': (payload) => {
          const index = payloadNumber(payload, 'index', 1);
          if (index >= 0 && index < slots.length) slots[index] = null;
          change();
        },
      },
    };
  },
};
