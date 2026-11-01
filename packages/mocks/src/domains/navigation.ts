/**
 * domains/navigation.ts — Mock NAP-NAVIGATION service.
 *
 * Spec: naps/NAP-NAVIGATION.md @ napplet/naps PR #126 head 9a4b179ea5fe (draft)
 * Routes: navigation.report, navigation.get
 * Spec gaps / decisions:
 * - No `@napplet/nap/navigation/types` in nap 0.32.0; shapes are local.
 * - Eligible intent contracts come from `conventions` (default
 *   `MOCK_NAVIGATION_CONVENTIONS`) and apply to every window; the real runtime
 *   reads them from the endpoint's verified manifest.
 * - History revisits (`back`/`forward`/`revisit`) record the pending target
 *   and return the invocation to replay; intent delivery itself belongs to the
 *   `intent` domain and is not pushed from here. `timeoutRevisit` ends a
 *   pending revisit and marks the view `uncertain`.
 * - Stale reports preserve status; any other rejection of a newer revision (or
 *   changed content at the accepted revision) ends a pending revisit and marks
 *   an existing view `uncertain`.
 */
import { defineMockService } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/** NAP-NAVIGATION document checked for this mock. */
export const NAVIGATION_SPEC_REF: NapSpecRef = { nap: 'NAP-NAVIGATION', status: 'draft', source: 'pr', pr: 126, sha: '9a4b179ea5fe', path: 'naps/NAP-NAVIGATION.md' };

/** `NavigationLocation` from the NAP. */
export interface MockNavigationLocation {
  /** Advertised convention identity. */
  convention: string;
  /** Advertised parameter names → JSON values. */
  payload?: Record<string, unknown>;
  /** Display label. */
  title?: string;
}

/** `NavigationReport` from the NAP. */
export interface MockNavigationReport {
  /** Positive, increasing per instance. */
  revision: number;
  /** Committed view, or null. */
  location: MockNavigationLocation | null;
  /** `push` (default) or `replace`; absent with a null location. */
  mode?: 'push' | 'replace';
}

/** `NavigationEntry` from the NAP. */
export interface MockNavigationEntry {
  /** Runtime visit id. */
  id: string;
  /** Validated location. */
  location: MockNavigationLocation;
}

/** `NavigationView` from the NAP. */
export interface MockNavigationView {
  /** Oldest to newest. */
  entries: MockNavigationEntry[];
  /** Current entry index or null. */
  index: number | null;
  /** Last accepted report revision. */
  reportRevision: number | null;
  /** Runtime knowledge of the current location. */
  status: 'unreported' | 'current' | 'pending' | 'uncertain';
}

/** `NavigationError` from the NAP. */
export interface MockNavigationError {
  /** Error code. */
  code: 'invalid' | 'unsupported' | 'stale' | 'denied' | 'limit';
  /** Diagnostic. */
  message?: string;
}

/** `NavigationResult` from the NAP. */
export interface MockNavigationResult {
  /** Accepted / completed. */
  ok: boolean;
  /** View after processing. */
  view: MockNavigationView;
  /** Present exactly when `ok` is false. */
  error?: MockNavigationError;
}

/** One advertised intent contract (convention + parameter allowlist). */
export interface MockNavigationConvention {
  /** Convention identity. */
  convention: string;
  /** Advertised parameter names. */
  parameters: readonly string[];
}

/** Per-window (instance) history. */
export interface MockNavigationInstance {
  /** Retained visits. */
  entries: MockNavigationEntry[];
  /** Current index. */
  index: number | null;
  /** Last accepted revision. */
  reportRevision: number | null;
  /** Status. */
  status: MockNavigationView['status'];
  /** Highest usable revision observed, including rejected reports. */
  observedRevision: number;
  /** Canonical JSON of the last accepted report. */
  lastAccepted?: string;
  /** Pending revisit. */
  pending?: { entryId: string; revision: number };
  /** Visit id counter. */
  visits: number;
}

/** In-memory state of the navigation mock. */
export interface MockNavigationState {
  /** Eligible contracts. */
  conventions: MockNavigationConvention[];
  /** Instances by window id. */
  instances: Map<string, MockNavigationInstance>;
}

/**
 * Factory options for the navigation mock.
 *
 * @example
 * ```ts
 * const navigation = createMockNavigationService({ maxEntries: 10 });
 * ```
 */
export interface MockNavigationOptions extends MockServiceOptions {
  /** Eligible conventions. Default `MOCK_NAVIGATION_CONVENTIONS`. */
  conventions?: readonly MockNavigationConvention[];
  /** Retained-visit cap per instance. Default 50. */
  maxEntries?: number;
  /** Location size cap (JSON bytes). Default 4096. */
  maxLocationBytes?: number;
}

/** Navigation mock plus shell traversal controls. */
export type MockNavigationService = MockService<MockNavigationState> & {
  /** Select a retained entry for revisit; returns the invocation to replay through intent, or `undefined` when refused or a no-op. */
  revisit(windowId: string, entryId: string): MockNavigationLocation | undefined;
  /** `revisit` the entry before the current one. */
  back(windowId: string): MockNavigationLocation | undefined;
  /** `revisit` the entry after the current one. */
  forward(windowId: string): MockNavigationLocation | undefined;
  /** End a pending revisit without success and mark the view `uncertain`. */
  timeoutRevisit(windowId: string): void;
  /** The caller's current view. */
  view(windowId: string): MockNavigationView;
};

/** Default advertised contracts. */
export const MOCK_NAVIGATION_CONVENTIONS: readonly MockNavigationConvention[] = Object.freeze([
  { convention: 'napplet:home', parameters: [] },
  { convention: 'napplet:profile/open', parameters: ['pubkey'] },
  { convention: 'napplet:note/open', parameters: ['eventId', 'relays'] },
  { convention: 'napplet:search', parameters: ['query', 'kinds'] },
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isPlainObject(value) && Object.values(value).every(isJsonValue);
}

/**
 * Canonical JSON (sorted map keys) used for content and invocation equality.
 *
 * @param value - Any JSON value.
 * @returns Deterministic serialization.
 * @example
 * ```ts
 * canonicalJson({ b: 1, a: 2 }) === '{"a":2,"b":1}';
 * ```
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isPlainObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

const invocationKey = (location: MockNavigationLocation): string => canonicalJson({ convention: location.convention, payload: location.payload ?? {} });

function validateLocation(value: unknown, conventions: readonly MockNavigationConvention[]): MockNavigationLocation | MockNavigationError {
  if (!isPlainObject(value)) return { code: 'invalid', message: 'location must be a map' };
  if (Object.keys(value).some((key) => !['convention', 'payload', 'title'].includes(key))) return { code: 'invalid', message: 'unknown location field' };
  const { convention, payload, title } = value;
  if (typeof convention !== 'string' || convention === '' || /[?#]/.test(convention)) return { code: 'invalid', message: 'convention must be a queryless, fragment-free identity' };
  if (payload !== undefined && (!isPlainObject(payload) || !isJsonValue(payload))) return { code: 'invalid', message: 'payload must be a map of JSON values' };
  if (title !== undefined && typeof title !== 'string') return { code: 'invalid', message: 'title must be text' };
  const keys = Object.keys(payload ?? {});
  const advertised = conventions.filter((item) => item.convention === convention);
  if (advertised.length === 0) return { code: 'unsupported', message: 'unadvertised convention' };
  if (!advertised.some((item) => keys.every((key) => item.parameters.includes(key)))) return { code: 'unsupported', message: 'unadvertised parameter name' };
  return { convention, ...(payload ? { payload: structuredClone(payload) } : {}), ...(title !== undefined ? { title } : {}) };
}

function validateReport(value: unknown, conventions: readonly MockNavigationConvention[]): { report: MockNavigationReport; location: MockNavigationLocation | null } | MockNavigationError {
  if (!isPlainObject(value)) return { code: 'invalid', message: 'report must be a map' };
  if (Object.keys(value).some((key) => !['revision', 'location', 'mode'].includes(key))) return { code: 'invalid', message: 'unknown report field' };
  const { revision, location, mode } = value;
  if (!Number.isInteger(revision) || (revision as number) <= 0) return { code: 'invalid', message: 'revision must be a positive integer' };
  if (mode !== undefined && mode !== 'push' && mode !== 'replace') return { code: 'invalid', message: 'mode must be push or replace' };
  if (location === null) {
    if (mode !== undefined) return { code: 'invalid', message: 'mode with a null location' };
    return { report: { revision: revision as number, location: null }, location: null };
  }
  const validated = validateLocation(location, conventions);
  if ('code' in validated) return validated;
  return { report: { revision: revision as number, location: validated, ...(mode !== undefined ? { mode: mode as 'push' | 'replace' } : {}) }, location: validated };
}

function newInstance(): MockNavigationInstance {
  return { entries: [], index: null, reportRevision: null, status: 'unreported', observedRevision: 0, visits: 0 };
}

function toView(instance: MockNavigationInstance): MockNavigationView {
  return { entries: structuredClone(instance.entries), index: instance.index, reportRevision: instance.reportRevision, status: instance.status };
}

function applyOrdinary(instance: MockNavigationInstance, location: MockNavigationLocation | null, mode: 'push' | 'replace'): void {
  if (location === null) { instance.index = null; return; }
  const selected = instance.index === null ? undefined : instance.entries[instance.index];
  const effective = selected && mode === 'push' && invocationKey(selected.location) === invocationKey(location) ? 'replace' : mode;
  if (effective === 'replace' && selected) { selected.location = location; return; }
  if (effective === 'push' && instance.index !== null) instance.entries.length = instance.index + 1;
  instance.entries.push({ id: `visit-${++instance.visits}`, location });
  instance.index = instance.entries.length - 1;
}

/**
 * Create the NAP-NAVIGATION mock.
 *
 * @param options - Eligible conventions and retention caps.
 * @returns A `navigation` extension with `revisit`, `back`, `forward`, `timeoutRevisit`, `view`.
 * @example
 * ```ts
 * const navigation = createMockNavigationService();
 * navigation.handleMessage('w1', { type: 'navigation.report', id: 'r1', report: { revision: 1, location: { convention: 'napplet:home' } } }, send);
 * navigation.view('w1').entries.length === 1;
 * ```
 */
export function createMockNavigationService(options: MockNavigationOptions = {}): MockNavigationService {
  const maxEntries = options.maxEntries ?? 50;
  const maxLocationBytes = options.maxLocationBytes ?? 4096;
  const mock = defineMockService<MockNavigationState>({
    domain: 'navigation',
    version: '0.1.0',
    description: 'Mock NAP-NAVIGATION runtime-maintained intent history',
    kind: 'extension',
    initialState: () => ({ conventions: (options.conventions ?? MOCK_NAVIGATION_CONVENTIONS).map((item) => ({ convention: item.convention, parameters: [...item.parameters] })), instances: new Map() }),
    routes: {
      'navigation.report': ({ message, state, windowId, reply }) => {
        const instance = instanceOf(state, windowId);
        const reject = (error: MockNavigationError, newer: boolean): void => {
          if (newer) { endPending(instance, true); }
          reply({ result: { ok: false, view: toView(instance), error } });
        };
        const validated = validateReport(message.report, state.conventions);
        const rawRevision = isPlainObject(message.report) ? message.report.revision : undefined;
        const usable = Number.isInteger(rawRevision) && (rawRevision as number) > 0 ? (rawRevision as number) : undefined;
        const canonical = canonicalJson(message.report);
        if (usable !== undefined && usable === instance.reportRevision && canonical === instance.lastAccepted) return reply({ result: { ok: true, view: toView(instance) } });
        if (usable === undefined) return reject('code' in validated ? validated : { code: 'invalid' }, true);
        if (usable === instance.reportRevision) return reject({ code: 'invalid', message: 'changed content at the accepted revision' }, true);
        if (usable <= instance.observedRevision) return reject({ code: 'stale' }, false);
        instance.observedRevision = usable;
        if ('code' in validated) return reject(validated, true);
        const { report, location } = validated;
        if (location && canonicalJson(location).length > maxLocationBytes) return reject({ code: 'limit', message: 'location too large' }, true);
        const pending = instance.pending;
        delete instance.pending;
        const target = pending ? instance.entries.findIndex((entry) => entry.id === pending.entryId) : -1;
        if (location && target >= 0 && invocationKey(instance.entries[target]!.location) === invocationKey(location)) {
          instance.index = target;
          instance.entries[target]!.location = location;
        } else {
          const appends = location !== null && (report.mode ?? 'push') === 'push' && instance.index !== null
            && invocationKey(instance.entries[instance.index]!.location) !== invocationKey(location);
          if ((appends || (location !== null && instance.index === null)) && instance.entries.length >= maxEntries) return reject({ code: 'limit', message: 'history capacity exceeded' }, true);
          applyOrdinary(instance, location, report.mode ?? 'push');
        }
        instance.reportRevision = usable;
        instance.lastAccepted = canonical;
        instance.status = 'current';
        reply({ result: { ok: true, view: toView(instance) } });
      },
      'navigation.get': ({ state, windowId, reply }) => reply({ result: { ok: true, view: toView(instanceOf(state, windowId)) } }),
    },
    onWindowDestroyed: (windowId, state) => { state.instances.delete(windowId); },
  }, options);

  function instanceOf(state: MockNavigationState, windowId: string): MockNavigationInstance {
    let instance = state.instances.get(windowId);
    if (!instance) { instance = newInstance(); state.instances.set(windowId, instance); }
    return instance;
  }
  function endPending(instance: MockNavigationInstance, uncertain: boolean): void {
    delete instance.pending;
    if (uncertain && instance.reportRevision !== null) instance.status = 'uncertain';
    else if (instance.status === 'pending') instance.status = 'current';
  }
  function revisit(windowId: string, entryId: string): MockNavigationLocation | undefined {
    const instance = instanceOf(mock.mock.state(), windowId);
    const target = instance.entries.findIndex((entry) => entry.id === entryId);
    if (instance.status !== 'current' || target < 0 || target === instance.index) return undefined;
    instance.pending = { entryId, revision: instance.observedRevision };
    instance.status = 'pending';
    const { convention, payload } = instance.entries[target]!.location;
    return { convention, ...(payload ? { payload: structuredClone(payload) } : {}) };
  }
  function step(windowId: string, delta: number): MockNavigationLocation | undefined {
    const instance = instanceOf(mock.mock.state(), windowId);
    const entry = instance.index === null ? undefined : instance.entries[instance.index + delta];
    return entry ? revisit(windowId, entry.id) : undefined;
  }

  return Object.assign(mock, {
    revisit,
    back: (windowId: string) => step(windowId, -1),
    forward: (windowId: string) => step(windowId, 1),
    timeoutRevisit(windowId: string) {
      const instance = instanceOf(mock.mock.state(), windowId);
      if (instance.pending) endPending(instance, true);
    },
    view: (windowId: string) => toView(instanceOf(mock.mock.state(), windowId)),
  });
}

/** Registry row for the navigation mock. */
export const NAVIGATION_MOCK_ENTRY: MockDomainEntry = { domain: 'navigation', kind: 'extension', spec: NAVIGATION_SPEC_REF, create: (o) => createMockNavigationService(o) };
