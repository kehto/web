import { themeGet, themeOnChanged, type Subscription, type Theme } from '@napplet/sdk';
import { runtimeHasDomain } from './domain-availability.js';
import { observe, initialEvidence, stateLabel, type ControllerState } from './state.js';
import { renderPads } from './render.js';
import './styles.css';

// Kehto Paja 0.21 ships this API. The published SDK 0.28 lacks its wrapper.
// Draft authority: napplet/naps#108 @ 0b28f77e3dfa0f07dd7c0f9d61a7090ee99f3a5e.
// This type describes the injected surface; no transport or native reader lives here.
interface ControllerApi {
  readonly available: boolean;
  readonly focused: boolean;
  getGamepads(): ControllerState['pads'];
  onChange(handler: (state: ControllerState) => void): Subscription;
}

const host = window as Window & { napplet?: { gamepad?: ControllerApi } };
const status = document.querySelector<HTMLOutputElement>('#status')!;
const hint = document.querySelector<HTMLElement>('#hint')!;
const pads = document.querySelector<HTMLElement>('#pads')!;
const counter = document.querySelector<HTMLElement>('#snapshots')!;
const raw = document.querySelector<HTMLElement>('#raw')!;
const checks = document.querySelector<HTMLElement>('#checks')!;
let evidence = initialEvidence();
let previous: ControllerState | undefined;
let controllerSubscription: Subscription | undefined;
let themeSubscription: Subscription | undefined;
let disposed = false;

function renderEvidence(): void {
  counter.textContent = `${evidence.snapshots} snapshots`;
  checks.textContent = [
    `${evidence.snapshots ? '✓' : '○'} Received state`,
    `${evidence.liveInput ? '✓' : '○'} Live input`,
    `${evidence.neutralAfterBlur ? '✓' : '○'} Neutral on blur`,
  ].join(' · ');
}

function receive(state: ControllerState, record = true): void {
  if (record) evidence = observe(evidence, previous, state);
  previous = state;
  status.textContent = stateLabel(state);
  status.dataset.state = !state.available ? 'off' : state.focused ? 'live' : 'idle';
  hint.textContent = evidence.leakedInput
    ? 'Isolation failure: input values arrived while this frame was unfocused.'
    : !state.available
      ? 'Check controller permissions in the host and browser.'
      : !state.pads.some(Boolean)
        ? 'Connect a controller, then press a button to let the browser detect it.'
        : state.focused
          ? 'Move sticks and press buttons. Click another window to check neutral input.'
          : 'Click Focus to receive input. Connected controllers should stay neutral here.';
  hint.dataset.error = String(evidence.leakedInput);
  renderPads(pads, state.pads);
  raw.textContent = JSON.stringify(state, null, 2);
  renderEvidence();
}

function applyTheme(theme: Theme): void {
  if (disposed) return;
  const colors = { '--bg': theme.colors.background, '--fg': theme.colors.text, '--primary': theme.colors.primary };
  for (const [property, value] of Object.entries(colors)) {
    if (/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) document.documentElement.style.setProperty(property, value);
  }
}

document.querySelector('#focus')!.addEventListener('click', () => {
  // The gesture focuses this iframe. The host alone decides input ownership.
  if (!previous && host.napplet?.gamepad) hint.textContent = 'Waiting for the host to deliver a controller snapshot.';
});
document.querySelector('#reset')!.addEventListener('click', () => {
  evidence = initialEvidence();
  previous = undefined;
  renderEvidence();
});

if (runtimeHasDomain('theme')) {
  try {
    themeSubscription = themeOnChanged(applyTheme);
    themeGet().then(applyTheme).catch(() => { /* Local palette remains usable. */ });
  } catch {
    // An optional theme service failure must not prevent controller inspection.
    themeSubscription?.close();
  }
}
const api = host.napplet?.gamepad;
if (api) {
  controllerSubscription = api.onChange(receive);
  // Cached reads are not counted as received snapshots or proof of live input.
  if (!previous) receive({ available: api.available, focused: api.focused, pads: api.getGamepads() }, false);
} else {
  status.textContent = 'Controller API absent';
  hint.textContent = 'Open this napplet in Paja 0.21 or another host with controller support enabled.';
}
renderEvidence();
window.addEventListener('pagehide', () => {
  disposed = true;
  controllerSubscription?.close();
  themeSubscription?.close();
}, { once: true });
