/** Read-only diagnostic view of the canonical NAP-GAMEPAD draft snapshot. */
export interface ControllerState {
  available: boolean;
  reason?: 'blocked' | 'unavailable';
  focused: boolean;
  pads: Array<Pick<Gamepad, 'index' | 'id' | 'mapping' | 'connected' | 'timestamp' | 'axes' | 'buttons'> | null>;
}

export interface Evidence {
  snapshots: number;
  liveInput: boolean;
  neutralAfterBlur: boolean;
  leakedInput: boolean;
}

export function initialEvidence(): Evidence {
  return { snapshots: 0, liveInput: false, neutralAfterBlur: false, leakedInput: false };
}

export function observe(evidence: Evidence, previous: ControllerState | undefined, state: ControllerState): Evidence {
  const pads = state.pads.filter(pad => pad !== null);
  const active = pads.some(pad => pad.axes.some(value => value !== 0)
    || pad.buttons.some(button => button.value !== 0 || button.pressed || button.touched));
  const neutral = !active && pads.every(pad => pad.timestamp === 0);
  // Empty snapshots cannot prove connected controls were neutralized.
  const retained = pads.some(pad => previous?.pads.some(old => old?.index === pad.index && old.id === pad.id));
  return {
    snapshots: evidence.snapshots + 1,
    liveInput: evidence.liveInput || (state.available && state.focused && active),
    neutralAfterBlur: evidence.neutralAfterBlur || Boolean(previous?.focused && !state.focused && state.available && retained && neutral),
    leakedInput: evidence.leakedInput || (!state.focused && !neutral),
  };
}

export function stateLabel(state: ControllerState): string {
  if (!state.available) return state.reason === 'blocked' ? 'Controller access blocked' : 'Controller reader unavailable';
  return state.focused ? 'Live · focused' : 'Idle · unfocused';
}
