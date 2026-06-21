/**
 * @kehto/paja — Single-window development runtime for local napplet authoring.
 *
 * The development runtime loads an app-provided target URL in a Kehto-owned
 * iframe so the app keeps its own framework HMR. The CLI may spawn a command,
 * but the target URL remains explicit to avoid framework-specific URL guessing.
 *
 * @example
 * ```ts
 * import { normalizePajaOptions, createPajaHostConfig } from '@kehto/paja';
 *
 * const options = normalizePajaOptions({
 *   targetUrl: 'http://127.0.0.1:5173',
 *   command: { mode: 'argv', argv: ['pnpm', 'vite', '--host', '127.0.0.1'] },
 * });
 *
 * const hostConfig = createPajaHostConfig(options);
 * // hostConfig.chrome.topBar === true
 * // hostConfig.target.hmrStrategy === 'iframe-target-url'
 * ```
 *
 * @packageDocumentation
 */

export {
  loadPajaConfigFile,
  mergePajaRawOptions,
  resolvePajaRawOptions,
} from './config-file.js';
export {
  PAJA_SIMULATION_DOMAINS,
  PajaSimulationError,
  normalizePajaSimulation,
  summarizePajaSimulation,
} from './simulation.js';
export {
  DEFAULT_PAJA_HOST,
  DEFAULT_PAJA_PORT,
  DEFAULT_PAJA_WINDOW_ID,
  DEFAULT_PAJA_DTAG,
  DEFAULT_PAJA_AGGREGATE_HASH,
  DEFAULT_READY_TIMEOUT_MS,
  PajaOptionsError,
  createPajaHostConfig,
  formatPajaUrl,
  normalizePajaOptions,
} from './options.js';
export { renderPajaHtml } from './host-page.js';
export {
  PAJA_ADVERTISED_DOMAINS,
  PAJA_COMPATIBILITY_ALIASES,
  PAJA_HANDSHAKE_DOMAINS,
  PAJA_REQUIRED_SERVICES,
  PAJA_UPSTREAM_WEB_DOMAINS,
  getMissingAdvertisedDomains,
  getMissingServices,
} from './parity.js';
export { ReadinessError, waitForTargetUrl } from './readiness.js';
export { startPajaServer } from './server.js';

export type {
  PajaCommand,
  PajaHostConfig,
  PajaOptions,
  PajaRawOptions,
} from './options.js';
export type {
  PajaCapabilityDomain,
  PajaSimulation,
  PajaSimulationRawOptions,
  JsonPrimitive,
  JsonRecord,
  JsonValue,
} from './simulation.js';
export type {
  PajaServer,
  PajaServerOptions,
} from './server.js';
export type {
  ReadinessFetch,
  WaitForTargetUrlOptions,
} from './readiness.js';
