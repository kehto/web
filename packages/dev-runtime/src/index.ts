/**
 * @kehto/dev-runtime — Single-window development runtime for local napplet authoring.
 *
 * The development runtime loads an app-provided target URL in a Kehto-owned
 * iframe so the app keeps its own framework HMR. The CLI may spawn a command,
 * but the target URL remains explicit to avoid framework-specific URL guessing.
 *
 * @example
 * ```ts
 * import { normalizeDevRuntimeOptions, createDevRuntimeHostConfig } from '@kehto/dev-runtime';
 *
 * const options = normalizeDevRuntimeOptions({
 *   targetUrl: 'http://127.0.0.1:5173',
 *   command: { mode: 'argv', argv: ['pnpm', 'vite', '--host', '127.0.0.1'] },
 * });
 *
 * const hostConfig = createDevRuntimeHostConfig(options);
 * // hostConfig.chrome.topBar === true
 * // hostConfig.target.hmrStrategy === 'iframe-target-url'
 * ```
 *
 * @packageDocumentation
 */

export {
  loadDevRuntimeConfigFile,
  mergeDevRuntimeRawOptions,
  resolveDevRuntimeRawOptions,
} from './config-file.js';
export {
  DEV_RUNTIME_SIMULATION_DOMAINS,
  DevRuntimeSimulationError,
  normalizeDevRuntimeSimulation,
  summarizeDevRuntimeSimulation,
} from './simulation.js';
export {
  DEFAULT_DEV_RUNTIME_HOST,
  DEFAULT_DEV_RUNTIME_PORT,
  DEFAULT_DEV_RUNTIME_WINDOW_ID,
  DEFAULT_DEV_RUNTIME_DTAG,
  DEFAULT_DEV_RUNTIME_AGGREGATE_HASH,
  DEFAULT_READY_TIMEOUT_MS,
  DevRuntimeOptionsError,
  createDevRuntimeHostConfig,
  formatDevRuntimeUrl,
  normalizeDevRuntimeOptions,
} from './options.js';
export { renderDevRuntimeHtml } from './host-page.js';
export {
  DEV_RUNTIME_ADVERTISED_DOMAINS,
  DEV_RUNTIME_COMPATIBILITY_ALIASES,
  DEV_RUNTIME_HANDSHAKE_DOMAINS,
  DEV_RUNTIME_REQUIRED_SERVICES,
  DEV_RUNTIME_UPSTREAM_WEB_DOMAINS,
  getMissingAdvertisedDomains,
  getMissingServices,
} from './parity.js';
export { ReadinessError, waitForTargetUrl } from './readiness.js';
export { startDevRuntimeServer } from './server.js';

export type {
  DevRuntimeCommand,
  DevRuntimeHostConfig,
  DevRuntimeOptions,
  DevRuntimeRawOptions,
} from './options.js';
export type {
  DevRuntimeCapabilityDomain,
  DevRuntimeSimulation,
  DevRuntimeSimulationRawOptions,
  JsonPrimitive,
  JsonRecord,
  JsonValue,
} from './simulation.js';
export type {
  DevRuntimeServer,
  DevRuntimeServerOptions,
} from './server.js';
export type {
  ReadinessFetch,
  WaitForTargetUrlOptions,
} from './readiness.js';
