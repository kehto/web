/** Browser focus/Permissions-Policy fixture; controller samples are supplied by the test. */
import { createShellBridge, denyNappletControllerAccess, originRegistry, prepareNappletSrcdoc } from '@kehto/shell';
import { browserGamepadOptions, createGamepadService, type GamepadPadSample } from '@kehto/services';
import demoHtml from '../../../apps/gamepad-test/dist/index.html?raw';
import { createMockHooks } from '@test/helpers';

const demo = new URLSearchParams(location.search).has('demo');
const mode = new URLSearchParams(location.search).get('mode');
const domains = demo ? (mode === 'absent' ? ['theme'] : ['gamepad', 'theme']) : ['gamepad'];
const pad: GamepadPadSample = { index: 1, id: 'Xbox Wireless Controller', mapping: 'standard', connected: true, timestamp: 18235.4, axes: [0, -1, 0, 0], buttons: [{ value: 1, pressed: true, touched: true }] };
const samples: { pads: readonly (GamepadPadSample | null)[] } = { pads: [null, pad] };
const nativeGetGamepads = navigator.getGamepads;
const service = createGamepadService({ ...browserGamepadOptions(window, target => originRegistry.getWindowId(target)), readGamepads: mode === 'unavailable' ? undefined : () => {
  if (mode === 'blocked') throw new DOMException('Denied', 'SecurityError');
  return samples.pads;
} });
const hooks = createMockHooks().hooks;
hooks.services = { ...hooks.services, gamepad: service };
hooks.capabilities = { resolveEnvironment: () => ({ domains, services: ['gamepad'] }) };
const bridge = createShellBridge(hooks);
window.addEventListener('message', bridge.handleMessage);
const documentHtml = demo ? demoHtml : `<!doctype html><html><body><button id="focus">Focus controller</button><script>
window.states = [];
window.napplet.gamepad.onChange(state => window.states.push(state));
try { navigator.getGamepads(); window.nativeResult = 'allowed'; } catch (error) { window.nativeResult = error.name; }
</script></body></html>`;
for (const id of ['one', 'two']) {
  const frame = document.createElement('iframe');
  frame.id = id;
  if (demo) { frame.style.width = '600px'; frame.style.height = '500px'; frame.style.border = '0'; }
  frame.sandbox.add('allow-scripts'); denyNappletControllerAccess(frame);
  document.body.appendChild(frame);
  originRegistry.register(frame.contentWindow!, id, { dTag: id, aggregateHash: id });
  frame.srcdoc = prepareNappletSrcdoc(documentHtml, { domains });
}
const target = window as Window & { gamepadFixture?: { disconnect(): void; nativeUnchanged(): boolean; reconnect(): void; theme(light: boolean): void } };
target.gamepadFixture = {
  disconnect() { samples.pads = [null, null]; service.refresh(); },
  reconnect() { samples.pads = [null, pad]; service.refresh(); },
  theme(light) {
    const colors = light ? { background: '#ffffff', text: '#222222', primary: '#006644' } : { background: '#101719', text: '#e6eff0', primary: '#68dcb7' };
    for (const frame of document.querySelectorAll('iframe')) frame.contentWindow!.postMessage({ type: 'theme.changed', theme: { colors } }, '*');
  },
  nativeUnchanged() { return navigator.getGamepads === nativeGetGamepads; },
};
window.addEventListener('pagehide', () => { bridge.destroy(); originRegistry.clear(); }, { once: true });
