/**
 * domains/location.ts — Mock NAP-LOCATION service.
 *
 * Spec: naps/NAP-LOCATION.md @ napplet/naps PR #125 head 24d2039cf2d1 (draft)
 * Routes: location.subscribe, location.unsubscribe, location.permission,
 *         location.current
 * Spec gaps / decisions:
 * - No `@napplet/nap/location/types` in nap 0.32.0; shapes are local.
 * - The user's decision is simulated by `grant` (`granted` | `coarse-only`
 *   | `denied`); an existing decision is returned without re-prompting.
 * - The device walks a seeded loop around a generic city park (`MOCK_ROUTE`);
 *   `advance()` moves to the next fix and pushes it to every active window.
 * - Coarsening snaps to a 0.02° × 0.02° grid cell (≥ 1 km on each side at the
 *   route's latitude) and sets `accuracy` to the centre-to-corner distance.
 * - Visibility is per window (`setVisible`), default visible; `active` needs a
 *   grant, a subscription, and (visible or background grant).
 * - `timeout` fires when it is below `fixLatencyMs` (default 0, never).
 */
import type { NappletMessage } from '@kehto/runtime';
import { DEFAULT_CLOCK, DEFAULT_SCHEDULER, defineMockService, pushToWindow } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/** NAP-LOCATION document checked for this mock. */
export const LOCATION_SPEC_REF: NapSpecRef = { nap: 'NAP-LOCATION', status: 'draft', source: 'pr', pr: 125, sha: '24d2039cf2d1', path: 'naps/NAP-LOCATION.md' };

/** `LocationPermission` from the NAP. */
export type MockLocationPermission = 'prompt' | 'granted' | 'denied';

/** `LocationError` from the NAP. */
export type MockLocationError = 'denied' | 'unavailable' | 'timeout' | 'inactive';

/** `Position` from the NAP. */
export interface MockPosition {
  /** WGS 84 degrees. */
  latitude: number;
  /** WGS 84 degrees. */
  longitude: number;
  /** Radius in metres. */
  accuracy: number;
  /** Metres above the ellipsoid. */
  altitude: number | null;
  /** Metres. */
  altitudeAccuracy: number | null;
  /** Degrees clockwise from true north. */
  heading: number | null;
  /** Metres per second. */
  speed: number | null;
  /** Milliseconds since the Unix epoch. */
  timestamp: number;
  /** `false` when coarsened. */
  precise: boolean;
}

/** `LocationState` pushed as `location.state`. */
export interface MockLocationSnapshot {
  /** Runtime can read position. */
  available: boolean;
  /** Unavailability reason. */
  reason?: 'blocked' | 'unavailable';
  /** This napplet's grant. */
  permission: MockLocationPermission;
  /** Precise grant. */
  precise: boolean;
  /** Background grant. */
  background: boolean;
  /** Positions currently flow. */
  active: boolean;
}

/** Per-window grant, subscription and visibility. */
export interface MockLocationWindow {
  /** Subscribed to state/positions. */
  subscribed: boolean;
  /** Grant. */
  permission: MockLocationPermission;
  /** Precise grant. */
  precise: boolean;
  /** Background grant. */
  background: boolean;
  /** Window is visible on a visible host surface. */
  visible: boolean;
  /** Last delivered `location.state` signature. */
  previous?: string;
}

/** In-memory state of the location mock. */
export interface MockLocationState {
  /** Runtime can read position. */
  available: boolean;
  /** Unavailability reason. */
  reason?: 'blocked' | 'unavailable';
  /** Per-window state. */
  windows: Map<string, MockLocationWindow>;
  /** Index of the current route point. */
  routeIndex: number;
  /** Last precise fix taken from the route. */
  latestFix?: MockPosition;
  /** Cancel function of the autoplay loop. */
  timer?: () => void;
}

/**
 * Factory options for the location mock.
 *
 * @example
 * ```ts
 * const location = createMockLocationService({ grant: 'coarse-only', autoplay: true, tickMs: 1000 });
 * ```
 */
export interface MockLocationOptions extends MockServiceOptions {
  /** Simulated user decision for `location.permission`. Default `granted`. */
  grant?: 'granted' | 'coarse-only' | 'denied';
  /** Report `available: false` with this reason. */
  unavailable?: 'blocked' | 'unavailable';
  /** Simulated time to obtain a fresh fix; `location.current` with a smaller `timeout` fails with `timeout`. Default 0. */
  fixLatencyMs?: number;
  /** Advance the route automatically through the scheduler. */
  autoplay?: boolean;
  /** Interval for `autoplay`. Default 1000. */
  tickMs?: number;
}

/** Location mock plus route, visibility and grant controls. */
export type MockLocationService = MockService<MockLocationState> & {
  /** Take the next route fix and push `location.position` to every active window. Returns the precise fix. */
  advance(): MockPosition;
  /** Set a window's visibility; pushes changed states. */
  setVisible(windowId: string, visible: boolean): void;
  /** User revokes a window's grant: new state, positions stop. */
  revoke(windowId: string): void;
};

/** A route point: latitude, longitude. */
export type MockRoutePoint = readonly [latitude: number, longitude: number];

/** A walking loop around a city park (placeholder coordinates). */
export const MOCK_ROUTE: readonly MockRoutePoint[] = Object.freeze([
  [52.5145, 13.3501], [52.5152, 13.3522], [52.5158, 13.3546], [52.5151, 13.3568],
  [52.5139, 13.3571], [52.5128, 13.3553], [52.5126, 13.3528], [52.5134, 13.3506],
]);

const GRID_DEGREES = 0.02;
const METRES_PER_DEGREE = 111_320;
const WALKING_SPEED = 1.4;

function headingBetween(from: MockRoutePoint, to: MockRoutePoint): number {
  const dLon = ((to[1] - from[1]) * Math.PI) / 180;
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return Math.round((((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) * 10) / 10;
}

/**
 * Snap a position to the coarse grid (≥ 1 km cells) as the NAP requires.
 *
 * @param position - Precise position.
 * @returns A coarse position with `precise: false` and null motion fields.
 * @example
 * ```ts
 * coarsenPosition(fix).precise === false;
 * ```
 */
export function coarsenPosition(position: MockPosition): MockPosition {
  const snap = (value: number): number => Math.round((Math.floor(value / GRID_DEGREES) + 0.5) * GRID_DEGREES * 1e6) / 1e6;
  const latitude = snap(position.latitude);
  const longitude = snap(position.longitude);
  const half = (GRID_DEGREES / 2) * METRES_PER_DEGREE;
  const accuracy = Math.ceil(Math.hypot(half, half * Math.cos((latitude * Math.PI) / 180)));
  return { latitude, longitude, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null, timestamp: position.timestamp, precise: false };
}

/**
 * Create the NAP-LOCATION mock.
 *
 * @param options - Grant decision, availability, fix latency, autoplay.
 * @returns A `location` extension with `advance`, `setVisible`, `revoke`.
 * @example
 * ```ts
 * const location = createMockLocationService();
 * location.handleMessage('w1', { type: 'location.permission', id: 'l1', precise: true }, send);
 * location.handleMessage('w1', { type: 'location.current', id: 'l2' }, send); // → position
 * ```
 */
export function createMockLocationService(options: MockLocationOptions = {}): MockLocationService {
  const clock = options.clock ?? DEFAULT_CLOCK;
  const scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  const mock = defineMockService<MockLocationState>({
    domain: 'location',
    version: '0.1.0',
    description: 'Mock NAP-LOCATION shell-mediated geolocation',
    kind: 'extension',
    initialState: () => ({ available: options.unavailable === undefined, ...(options.unavailable ? { reason: options.unavailable } : {}), windows: new Map(), routeIndex: 0 }),
    routes: {
      'location.subscribe': ({ message, state, windowId }) => {
        if (message.id !== undefined || (message.highAccuracy !== undefined && typeof message.highAccuracy !== 'boolean')) return;
        entryFor(state, windowId).subscribed = true;
        deliverState(windowId, true);
        startLoop();
      },
      'location.unsubscribe': ({ message, state, windowId }) => {
        if (message.id !== undefined) return;
        const entry = state.windows.get(windowId);
        if (entry) { entry.subscribed = false; delete entry.previous; }
      },
      'location.permission': ({ message, state, windowId, reply }) => {
        const entry = entryFor(state, windowId);
        const current = { permission: entry.permission, precise: entry.precise, background: entry.background };
        const flags = [message.precise, message.background];
        if (flags.some((flag) => flag !== undefined && typeof flag !== 'boolean')) return reply({ ...current, error: 'invalid request' });
        if (!state.available) return reply({ ...current, error: state.reason ?? 'unavailable' });
        if (entry.permission === 'prompt') {
          entry.permission = options.grant === 'denied' ? 'denied' : 'granted';
          const full = entry.permission === 'granted' && (options.grant ?? 'granted') === 'granted';
          entry.precise = full && message.precise === true;
          entry.background = full && message.background === true;
        }
        reply({ permission: entry.permission, precise: entry.precise, background: entry.background });
        deliverState(windowId);
        startLoop();
      },
      'location.current': ({ message, state, windowId, reply }) => {
        const entry = entryFor(state, windowId);
        if (entry.permission !== 'granted') return reply({ error: 'denied' });
        if (!state.available) return reply({ error: 'unavailable' });
        if (!entry.visible && !entry.background) return reply({ error: 'inactive' });
        const maximumAge = typeof message.maximumAge === 'number' ? message.maximumAge : 0;
        const cached = state.latestFix && clock.now() - state.latestFix.timestamp <= maximumAge ? state.latestFix : undefined;
        if (!cached && typeof message.timeout === 'number' && message.timeout < (options.fixLatencyMs ?? 0)) return reply({ error: 'timeout' });
        const fix = cached ?? takeFix(state);
        reply({ position: entry.precise ? { ...fix } : coarsenPosition(fix) });
      },
    },
    onWindowDestroyed: (windowId, state) => { state.windows.delete(windowId); if (state.windows.size === 0) stopLoop(state); },
    onCapabilityRevoked: (windowId) => revoke(windowId),
  }, options);

  function entryFor(state: MockLocationState, windowId: string): MockLocationWindow {
    let entry = state.windows.get(windowId);
    if (!entry) { entry = { subscribed: false, permission: 'prompt', precise: false, background: false, visible: true }; state.windows.set(windowId, entry); }
    return entry;
  }
  function active(state: MockLocationState, entry: MockLocationWindow): boolean {
    return state.available && entry.subscribed && entry.permission === 'granted' && (entry.visible || entry.background);
  }
  function takeFix(state: MockLocationState): MockPosition {
    const point = MOCK_ROUTE[state.routeIndex % MOCK_ROUTE.length]!;
    const next = MOCK_ROUTE[(state.routeIndex + 1) % MOCK_ROUTE.length]!;
    state.routeIndex = (state.routeIndex + 1) % MOCK_ROUTE.length;
    state.latestFix = {
      latitude: point[0], longitude: point[1], accuracy: 12, altitude: 34, altitudeAccuracy: 8,
      heading: headingBetween(point, next), speed: WALKING_SPEED, timestamp: clock.now(), precise: true,
    };
    return state.latestFix;
  }
  function deliverState(windowId: string, force = false): void {
    const state = mock.mock.state();
    const entry = state.windows.get(windowId);
    if (!entry?.subscribed) return;
    const message = {
      type: 'location.state', available: state.available, ...(state.reason ? { reason: state.reason } : {}),
      permission: entry.permission, precise: entry.precise, background: entry.background, active: active(state, entry),
    } as NappletMessage;
    const signature = JSON.stringify(message);
    if (!force && signature === entry.previous) return;
    if (pushToWindow(mock, windowId, message)) entry.previous = signature;
  }
  function advance(): MockPosition {
    const state = mock.mock.state();
    const fix = takeFix(state);
    for (const [windowId, entry] of state.windows) {
      if (active(state, entry)) pushToWindow(mock, windowId, { type: 'location.position', ...(entry.precise ? fix : coarsenPosition(fix)) } as NappletMessage);
    }
    return fix;
  }
  function revoke(windowId: string): void {
    const entry = mock.mock.state().windows.get(windowId);
    if (!entry) return;
    Object.assign(entry, { permission: 'prompt', precise: false, background: false });
    deliverState(windowId);
  }
  function stopLoop(state: MockLocationState): void { state.timer?.(); delete state.timer; }
  function startLoop(): void {
    const state = mock.mock.state();
    if (!options.autoplay || state.timer || ![...state.windows.values()].some((entry) => active(state, entry))) return;
    state.timer = scheduler.schedule(options.tickMs ?? 1000, () => { delete state.timer; advance(); startLoop(); });
  }

  const baseReset = mock.mock.reset;
  mock.mock.reset = () => { stopLoop(mock.mock.state()); baseReset(); };
  return Object.assign(mock, {
    advance,
    setVisible(windowId: string, visible: boolean) { entryFor(mock.mock.state(), windowId).visible = visible; deliverState(windowId); startLoop(); },
    revoke,
  });
}

/** Registry row for the location mock. */
export const LOCATION_MOCK_ENTRY: MockDomainEntry = { domain: 'location', kind: 'extension', spec: LOCATION_SPEC_REF, create: (o) => createMockLocationService(o) };
