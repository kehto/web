// @ts-check
/**
 * x-echo — a toy experimental NAP hosted on kehto without changing any kehto
 * package. One module serves every host: Paja loads it from its config
 * `extensions` list, and any ShellAdapter host calls `createEchoExtension()`.
 *
 * Wire contract (experimental, not a registry NAP):
 *   napplet → shell  x-echo.say          { id, text }            needs x-echo:send
 *   shell → napplet  x-echo.say.result   { id, text } | { id, error: { code, message } }
 *   shell → napplet  x-echo.heard        { text }                needs x-echo:listen (push)
 *
 * The domain is advertised but `unconfigured` until a prefix setting exists;
 * `say` then answers `{ error: { code: 'not-configured' } }`.
 *
 * Only type imports from public @kehto/* entry points are used, so this file
 * runs unbundled in a browser.
 */

/** @typedef {import('@kehto/shell').ShellExtension} ShellExtension */
/** @typedef {import('@kehto/shell').ServiceHandler} ServiceHandler */
/** @typedef {import('@kehto/shell').ServiceRuntimeContext} ServiceRuntimeContext */
/** @typedef {import('@kehto/shell').ShellExtensionBindingKit} ShellExtensionBindingKit */
/** @typedef {import('@kehto/paja').PajaExtensionContext} PajaExtensionContext */
/** @typedef {import('@kehto/paja').PajaExtensionSetting} PajaExtensionSetting */

export const ECHO_DOMAIN = 'x-echo';

/** Settings a host UI can render; Paja shows them under "Extensions". */
/** @type {readonly PajaExtensionSetting[]} */
export const settings = [
  { key: 'prefix', label: 'Echo prefix', placeholder: 'echo: ' },
];

/**
 * Create the x-echo shell extension.
 *
 * @param {{ getPrefix: () => string | undefined }} options
 * @returns {ShellExtension}
 */
export function createEchoExtension({ getPrefix }) {
  /** @type {ServiceRuntimeContext | null} */
  let context = null;

  /** @type {ServiceHandler} */
  const service = {
    descriptor: { name: ECHO_DOMAIN, version: '0.1.0', description: 'Toy experimental echo NAP' },
    messageCapabilities: { 'x-echo.say': 'x-echo:send' },
    pushCapabilities: { 'x-echo.heard': 'x-echo:listen' },
    onRegistered(runtimeContext) { context = runtimeContext; },
    onUnregistered() { context = null; },
    handleMessage(_windowId, message, send) {
      const { id, text } = /** @type {{ id?: unknown, text?: unknown }} */ (message);
      if (message.type !== 'x-echo.say' || typeof id !== 'string') return;
      const prefix = getPrefix();
      if (!prefix) {
        send(/** @type {any} */ ({ type: 'x-echo.say.result', id, error: { code: 'not-configured', message: 'Set an echo prefix first.' } }));
        return;
      }
      if (typeof text !== 'string') {
        send(/** @type {any} */ ({ type: 'x-echo.say.result', id, error: { code: 'invalid-request', message: 'text must be a string' } }));
        return;
      }
      const echoed = `${prefix}${text}`;
      send(/** @type {any} */ ({ type: 'x-echo.say.result', id, text: echoed }));
      // Host-initiated push: every eligible window hears it. The runtime drops
      // it for windows without the domain grant, x-echo:listen, or firewall pass.
      for (const windowId of context?.listWindowIds() ?? []) {
        context?.sendToEligibleNapplet(windowId, /** @type {any} */ ({ type: 'x-echo.heard', text: echoed }));
      }
    },
  };

  return {
    domain: ECHO_DOMAIN,
    service,
    capabilities: [
      { capability: 'x-echo:send', label: 'Echo send', description: 'ask the shell to echo text' },
      { capability: 'x-echo:listen', label: 'Echo listen', description: 'receive x-echo.heard pushes' },
    ],
    // Serialized into the iframe prelude: it must stay self-contained.
    binding: /** @param {ShellExtensionBindingKit} kit */ (kit) => ({
      say(/** @type {string} */ text) {
        return kit.request('say', { text }).then((result) => {
          const error = /** @type {{ code?: string, message?: string } | undefined} */ (result.error);
          if (error) throw Object.assign(new Error(error.message ?? 'x-echo failed'), { code: error.code });
          return /** @type {string} */ (result.text);
        });
      },
      onHeard(/** @type {(text: string) => void} */ callback) {
        return kit.on('heard', (message) => callback(/** @type {string} */ (message.text)));
      },
    }),
    state: () => (getPrefix() ? 'supported' : 'unconfigured'),
  };
}

/**
 * Paja entry point: `"extensions": ["./x-echo.js"]` in paja.config.json.
 *
 * @param {PajaExtensionContext} paja
 * @returns {ShellExtension}
 */
export default function createPajaEchoExtension(paja) {
  return createEchoExtension({ getPrefix: () => paja.settings.get('prefix') || undefined });
}
