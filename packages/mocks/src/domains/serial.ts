/**
 * domains/serial.ts — Mock NAP-SERIAL service.
 *
 * Spec: naps/NAP-SERIAL.md @ napplet/naps PR #61 head 0c6e88ab8003 (draft)
 * Routes: serial.open, serial.write, serial.close
 * Spec gaps / decisions:
 * - The NAP names no error for a malformed `serial.open` request (missing
 *   `options.baudRate`); the mock answers `open failed`. A filter that matches
 *   no seeded port answers `port unavailable`.
 * - `serial.close` on a session the mock already closed is idempotent (plain
 *   result, no second `closed` event); an unknown id answers `session not found`.
 * - Every accepted write is echoed back as one `data` event with ASCII letters
 *   upper-cased (`mockSerialEcho`), so a shell can prove inbound plumbing
 *   without a device. Override or disable with `MockSerialOptions.echo`.
 * - No ACL capability maps to `serial`, so `onCapabilityRevoked` closes a
 *   window's sessions (reason `permission denied`) only on a block (`null`).
 * - `@napplet/nap@0.32.0` serial types match the PR #61 wire tables.
 */
import type { NappletMessage } from '@kehto/runtime';
import type {
  SerialEvent,
  SerialOpenOptions,
  SerialOpenRequest,
  SerialPortFilter,
  SerialSession,
  SerialState,
} from '@napplet/core';
import type { SerialCloseMessage, SerialOpenMessage, SerialWriteMessage } from '@napplet/nap/serial/types';

import { defineMockService, inheritMockPush, pushToWindow } from '../core/handler.js';
import { asRequest } from './nostr-store.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/**
 * NAP-SERIAL document checked when this mock was written.
 *
 * @example
 * ```ts
 * SERIAL_SPEC_REF.pr === 61;
 * ```
 */
export const SERIAL_SPEC_REF: NapSpecRef = {
  nap: 'NAP-SERIAL',
  status: 'draft',
  source: 'pr',
  pr: 61,
  sha: '0c6e88ab8003',
  path: 'naps/NAP-SERIAL.md',
};

/**
 * One seeded serial port the mock chooser can pick.
 *
 * @example
 * ```ts
 * const port: MockSerialPort = { usbVendorId: 0x2341, usbProductId: 0x0043, displayName: 'Arduino Uno' };
 * ```
 */
export interface MockSerialPort {
  /** USB vendor id (unsigned). */
  usbVendorId: number;
  /** USB product id (unsigned). */
  usbProductId: number;
  /** Human-readable name reported in `SerialPortInfo.displayName`. */
  displayName: string;
}

/**
 * Two deterministic USB serial ports: an Arduino Uno and a CP2102 bridge.
 *
 * @example
 * ```ts
 * MOCK_SERIAL_PORTS[0].displayName === 'Arduino Uno';
 * ```
 */
export const MOCK_SERIAL_PORTS: readonly MockSerialPort[] = Object.freeze([
  { usbVendorId: 0x2341, usbProductId: 0x0043, displayName: 'Arduino Uno' },
  { usbVendorId: 0x10c4, usbProductId: 0xea60, displayName: 'CP2102 USB to UART Bridge' },
]);

/**
 * Default echo transform: ASCII lowercase letters become uppercase; every
 * other byte passes through unchanged.
 *
 * @param bytes - Bytes the napplet wrote.
 * @returns Bytes the mock device sends back.
 * @example
 * ```ts
 * mockSerialEcho([112, 105, 110, 103, 10]); // [80, 73, 78, 71, 10] — "PING\n"
 * ```
 */
export function mockSerialEcho(bytes: readonly number[]): number[] {
  return bytes.map((byte) => (byte >= 0x61 && byte <= 0x7a ? byte - 0x20 : byte));
}

/**
 * One serial session the mock holds for a window.
 *
 * @example
 * ```ts
 * const session = service.mock.state().sessions.get('serial-1');
 * session?.writes.length;
 * ```
 */
export interface MockSerialSession {
  /** Runtime-assigned session id (`serial-N`). */
  id: string;
  /** Owning napplet window. */
  windowId: string;
  /** Lifecycle state. */
  state: SerialState;
  /** Port the chooser selected. */
  port: MockSerialPort;
  /** Options the napplet opened with. */
  options: SerialOpenOptions;
  /** Optional chooser label from the request. */
  label?: string;
  /** Every accepted write, oldest first. */
  writes: number[][];
}

/**
 * In-memory state of the serial mock.
 *
 * @example
 * ```ts
 * const state: MockSerialState = service.mock.state();
 * state.ports.length === 2;
 * ```
 */
export interface MockSerialState {
  /** Ports the chooser can select. */
  ports: MockSerialPort[];
  /** Sessions by id, including closed ones. */
  sessions: Map<string, MockSerialSession>;
  /** Next session counter. */
  nextSession: number;
}

/**
 * Factory options for the serial mock.
 *
 * @example
 * ```ts
 * const service = createMockSerialService({ echo: false });
 * ```
 */
export interface MockSerialOptions extends MockServiceOptions {
  /** Ports to seed. Default `MOCK_SERIAL_PORTS`. */
  ports?: readonly MockSerialPort[];
  /** Echo transform applied to each write, or `false` to disable. Default `mockSerialEcho`. */
  echo?: false | ((bytes: readonly number[]) => number[]);
}

/**
 * Serial mock with device-side controls.
 *
 * @example
 * ```ts
 * const service = createMockSerialService();
 * service.receive('serial-1', [79, 75, 10]);
 * service.disconnect('serial-1');
 * ```
 */
export type MockSerialService = MockService<MockSerialState> & {
  /**
   * Push inbound bytes from the device to the session's window.
   *
   * @param sessionId - Open session.
   * @param bytes - Byte values 0..255.
   * @returns `false` when the session is unknown/closed, the bytes are invalid,
   * or no delivery path to the window exists yet.
   */
  receive(sessionId: string, bytes: readonly number[]): boolean;
  /**
   * Close a session from the device side and push a `closed` event.
   *
   * @param sessionId - Open session.
   * @param reason - Close reason. Default `device disconnected`.
   * @returns `false` when the session is unknown or already closed.
   */
  disconnect(sessionId: string, reason?: string): boolean;
};

const isUnsigned = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isByteArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((byte) => isUnsigned(byte) && byte <= 255);

function isOpenRequest(value: unknown): value is SerialOpenRequest {
  if (typeof value !== 'object' || value === null) return false;
  const { options, filters } = value as { options?: unknown; filters?: unknown };
  if (typeof options !== 'object' || options === null) return false;
  if (!isUnsigned((options as { baudRate?: unknown }).baudRate)) return false;
  return filters === undefined || Array.isArray(filters);
}

function matchesFilter(port: MockSerialPort, filter: SerialPortFilter): boolean {
  if (filter.bluetoothServiceClassId !== undefined) return false;
  if (filter.usbVendorId !== undefined && filter.usbVendorId !== port.usbVendorId) return false;
  return filter.usbProductId === undefined || filter.usbProductId === port.usbProductId;
}

function selectPort(ports: readonly MockSerialPort[], filters: readonly SerialPortFilter[] | undefined): MockSerialPort | undefined {
  if (!filters || filters.length === 0) return ports[0];
  return ports.find((port) => filters.some((filter) => matchesFilter(port, filter)));
}

function toWireSession(session: MockSerialSession): SerialSession {
  const { usbVendorId, usbProductId, displayName } = session.port;
  return { id: session.id, state: session.state, info: { usbVendorId, usbProductId, displayName } };
}

function openSession(state: MockSerialState, sessionId: unknown): MockSerialSession | undefined {
  const session = typeof sessionId === 'string' ? state.sessions.get(sessionId) : undefined;
  return session?.state === 'open' ? session : undefined;
}

const eventMessage = (event: SerialEvent): NappletMessage => ({ type: 'serial.event', event }) as NappletMessage;

/**
 * Create the NAP-SERIAL mock.
 *
 * @param options - Seeds, echo transform, and shared mock options.
 * @returns A `serial` service handler with `mock`, `receive`, and `disconnect`.
 * @example
 * ```ts
 * const service = createMockSerialService();
 * service.handleMessage('w1', { type: 'serial.open', id: 's1', request: { options: { baudRate: 115200 } } }, send);
 * ```
 */
export function createMockSerialService(options: MockSerialOptions = {}): MockSerialService {
  const echo = options.echo === false ? () => [] : options.echo ?? mockSerialEcho;
  let service: MockSerialService;
  const emit = (session: MockSerialSession, event: SerialEvent): boolean =>
    pushToWindow(service, session.windowId, eventMessage(event));
  const closeWindow = (windowId: string, state: MockSerialState, reason: string | undefined): void => {
    for (const session of state.sessions.values()) {
      if (session.windowId !== windowId || session.state === 'closed') continue;
      session.state = 'closed';
      if (reason) emit(session, { type: 'closed', sessionId: session.id, reason });
    }
  };

  const mock = defineMockService<MockSerialState>({
    domain: 'serial',
    version: '1.0.0',
    description: 'Mock NAP-SERIAL service: seeded USB ports with deterministic echo',
    kind: 'service',
    initialState: () => ({ ports: [...(options.ports ?? MOCK_SERIAL_PORTS)], sessions: new Map(), nextSession: 1 }),
    routes: {
      'serial.open': ({ message, state, windowId, reply, fail }) => {
        const { request } = asRequest<SerialOpenMessage>(message);
        if (!isOpenRequest(request)) return fail('open failed');
        const port = selectPort(state.ports, request.filters);
        if (!port) return fail('port unavailable');
        const id = `serial-${state.nextSession++}`;
        const session: MockSerialSession = {
          id,
          windowId,
          state: 'open',
          port,
          options: { ...request.options },
          ...(request.label !== undefined ? { label: request.label } : {}),
          writes: [],
        };
        state.sessions.set(id, session);
        reply({ session: toWireSession(session) });
      },
      'serial.write': ({ message, state, reply, fail, push }) => {
        const { sessionId, data } = asRequest<SerialWriteMessage>(message);
        const session = openSession(state, sessionId);
        if (!session) return fail('session not found');
        if (!isByteArray(data)) return fail('invalid data');
        session.writes.push([...data]);
        reply();
        const echoed = echo(data);
        if (echoed.length > 0) push(eventMessage({ type: 'data', sessionId: session.id, data: echoed }));
      },
      'serial.close': ({ message, state, reply, fail, push }) => {
        const { sessionId, reason } = asRequest<SerialCloseMessage>(message);
        const session = typeof sessionId === 'string' ? state.sessions.get(sessionId) : undefined;
        if (!session) return fail('session not found');
        if (session.state === 'closed') return reply();
        session.state = 'closed';
        reply();
        push(eventMessage({ type: 'closed', sessionId: session.id, ...(reason !== undefined ? { reason } : {}) }));
      },
    },
    onWindowDestroyed: (windowId, state) => {
      closeWindow(windowId, state, undefined);
      for (const [id, session] of state.sessions) if (session.windowId === windowId) state.sessions.delete(id);
    },
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability === null) closeWindow(windowId, state, 'permission denied');
    },
  }, options);

  service = {
    ...mock,
    receive(sessionId, bytes) {
      const session = openSession(mock.mock.state(), sessionId);
      if (!session || !isByteArray(bytes)) return false;
      return emit(session, { type: 'data', sessionId: session.id, data: [...bytes] });
    },
    disconnect(sessionId, reason = 'device disconnected') {
      const session = openSession(mock.mock.state(), sessionId);
      if (!session) return false;
      session.state = 'closed';
      emit(session, { type: 'closed', sessionId: session.id, reason });
      return true;
    },
  };
  inheritMockPush(service, mock);
  return service;
}

/**
 * Registry row for the serial mock.
 *
 * @example
 * ```ts
 * SERIAL_MOCK_ENTRY.create?.({ seed: 3 });
 * ```
 */
export const SERIAL_MOCK_ENTRY: MockDomainEntry = {
  domain: 'serial',
  kind: 'service',
  spec: SERIAL_SPEC_REF,
  create: (o) => createMockSerialService(o),
};
