/** Browser focus/Permissions-Policy fixture; controller samples are supplied by the test. */
import { createShellBridge, denyNappletControllerAccess, originRegistry, prepareNappletSrcdoc } from '@kehto/shell';
import { browserGamepadOptions, createGamepadService, type GamepadPadSample } from '@kehto/services';
import { createMockHooks } from '@test/helpers';

const pad: GamepadPadSample = { index: 1, id: 'Xbox Wireless Controller', mapping: 'standard', connected: true, timestamp: 18235.4, axes: [0, -1, 0, 0], buttons: [{ value: 1, pressed: true, touched: true }] };
const samples: { pads: readonly (GamepadPadSample | null)[] } = { pads: [null, pad] };
const nativeGetGamepads = navigator.getGamepads;
const service = createGamepadService({ ...browserGamepadOptions(window, target => originRegistry.getWindowId(target)), readGamepads: () => samples.pads });
const hooks = createMockHooks().hooks;
hooks.services = { ...hooks.services, gamepad: service };
hooks.capabilities = { resolveEnvironment: () => ({ domains: ['gamepad'], services: ['gamepad'] }) };
const bridge = createShellBridge(hooks);
window.addEventListener('message', bridge.handleMessage);
const documentHtml = `<!doctype html><html><body><button id="focus">Focus controller</button><script>
window.states = [];
window.napplet.gamepad.onChange(state => window.states.push(state));
try { navigator.getGamepads(); window.nativeResult = 'allowed'; } catch (error) { window.nativeResult = error.name; }
</script></body></html>`;
for (const id of ['one', 'two']) {
  const frame = document.createElement('iframe');
  frame.id = id; frame.sandbox.add('allow-scripts'); denyNappletControllerAccess(frame);
  document.body.appendChild(frame);
  originRegistry.register(frame.contentWindow!, id, { dTag: id, aggregateHash: id });
  frame.srcdoc = prepareNappletSrcdoc(documentHtml, { domains: ['gamepad'] });
}
const target = window as Window & { gamepadFixture?: { disconnect(): void; nativeUnchanged(): boolean } };
target.gamepadFixture = {
  disconnect() { samples.pads = [null, null]; service.refresh(); },
  nativeUnchanged() { return navigator.getGamepads === nativeGetGamepads; },
};
window.addEventListener('pagehide', () => { bridge.destroy(); originRegistry.clear(); }, { once: true });
