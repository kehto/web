import type { Server, Socket } from 'node:net';
import type { OutboundQueue } from './outbound-queue.js';
import type { SocketDirectory } from './socket-directory.js';
import { IpcTransportError, type IpcEndpoint, type IpcEndpointRegistration } from './types.js';

/** Lifecycle state kept privately for one host-owned endpoint generation. */
export type EndpointGenerationState = 'creating' | 'active' | 'closing';

/** Private record held only by the IPC transport lifecycle. */
export interface EndpointGenerationRecord {
  readonly windowId: string;
  readonly generation: number;
  readonly registration: IpcEndpointRegistration;
  readonly state: EndpointGenerationState;
  readonly directory?: SocketDirectory;
  readonly server?: Server;
  readonly endpoint?: IpcEndpoint;
  readonly peers?: Map<Socket, OutboundQueue>;
}

/** Private resource handles populated only after the synchronous reservation is made. */
export interface EndpointRegistryResources {
  readonly directory: SocketDirectory;
  readonly server: Server;
  readonly endpoint: IpcEndpoint;
  readonly peers: Map<Socket, OutboundQueue>;
}

/** Private monotonic endpoint lifecycle registry. It is intentionally not exported from the package root. */
export interface EndpointRegistry {
  reserveRegistration(registration: IpcEndpointRegistration): EndpointGenerationRecord;
  get(windowId: string): EndpointGenerationRecord | undefined;
  activateRegistration(reservation: EndpointGenerationRecord, resources: EndpointRegistryResources): EndpointGenerationRecord;
  rollbackRegistration(windowId: string, generation: number): EndpointGenerationRecord | undefined;
  beginClosing(windowId: string, generation: number): EndpointGenerationRecord | undefined;
  removeIfCurrentGeneration(windowId: string, generation: number): EndpointGenerationRecord | undefined;
  values(): readonly EndpointGenerationRecord[];
}

/** Create private, generation-guarded storage for one transport instance. */
export function createEndpointRegistry(): EndpointRegistry {
  const records = new Map<string, EndpointGenerationRecord>();
  let nextGeneration = 0;

  const isCurrent = (record: EndpointGenerationRecord | undefined, generation: number): record is EndpointGenerationRecord =>
    record !== undefined && record.generation === generation;

  return {
    reserveRegistration(registration) {
      if (records.has(registration.windowId)) {
        throw new IpcTransportError('ENDPOINT_EXISTS', `IPC endpoint ${registration.windowId} is already registered.`);
      }
      if (nextGeneration >= Number.MAX_SAFE_INTEGER) {
        throw new RangeError('IPC endpoint generation exceeds the safe integer range.');
      }
      const record: EndpointGenerationRecord = {
        windowId: registration.windowId,
        generation: ++nextGeneration,
        registration,
        state: 'creating',
      };
      records.set(record.windowId, record);
      return record;
    },
    get(windowId) {
      return records.get(windowId);
    },
    activateRegistration(reservation, resources) {
      const current = records.get(reservation.windowId);
      if (!isCurrent(current, reservation.generation) || current !== reservation || current.state !== 'creating') {
        throw new IpcTransportError('STALE_GENERATION', 'IPC endpoint reservation is no longer current.');
      }
      const active: EndpointGenerationRecord = { ...reservation, ...resources, state: 'active' };
      records.set(active.windowId, active);
      return active;
    },
    rollbackRegistration(windowId, generation) {
      const current = records.get(windowId);
      if (!isCurrent(current, generation) || current.state === 'closing') return undefined;
      records.delete(windowId);
      return current;
    },
    beginClosing(windowId, generation) {
      const current = records.get(windowId);
      if (!isCurrent(current, generation) || current.state === 'closing') return undefined;
      records.set(windowId, { ...current, state: 'closing' });
      return current;
    },
    removeIfCurrentGeneration(windowId, generation) {
      const current = records.get(windowId);
      if (!isCurrent(current, generation)) return undefined;
      records.delete(windowId);
      return current;
    },
    values() {
      return [...records.values()];
    },
  };
}
