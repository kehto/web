import type { Server, Socket } from 'node:net';
import type { OutboundQueue } from './outbound-queue.js';
import type { SocketDirectory } from './socket-directory.js';
import type { IpcEndpoint, IpcEndpointRegistration } from './types.js';

/** Private record held only by the IPC transport lifecycle. */
export interface EndpointRegistryRecord {
  readonly windowId: string;
  readonly generation: number;
  readonly registration: IpcEndpointRegistration;
  readonly directory?: SocketDirectory;
  readonly server?: Server;
  readonly endpoint?: IpcEndpoint;
  readonly peers?: Map<Socket, OutboundQueue>;
}

/** Private resource handles populated only after the reservation is made. */
export interface EndpointRegistryResources {
  readonly directory: SocketDirectory;
  readonly server: Server;
  readonly endpoint: IpcEndpoint;
  readonly peers: Map<Socket, OutboundQueue>;
}

/** Private monotonic endpoint lifecycle registry. It is intentionally not exported from the package root. */
export interface EndpointRegistry {
  reserve(registration: IpcEndpointRegistration): EndpointRegistryRecord;
  get(windowId: string): EndpointRegistryRecord | undefined;
  activate(reservation: EndpointRegistryRecord, resources: EndpointRegistryResources): EndpointRegistryRecord;
  compareAndRemove(windowId: string, generation: number): EndpointRegistryRecord | undefined;
  values(): readonly EndpointRegistryRecord[];
}

/** Create private, generation-guarded storage for one transport instance. */
export function createEndpointRegistry(): EndpointRegistry {
  const records = new Map<string, EndpointRegistryRecord>();
  let nextGeneration = 0;

  return {
    reserve(registration) {
      if (records.has(registration.windowId)) {
        throw new Error(`IPC endpoint ${registration.windowId} is already registered.`);
      }
      if (nextGeneration >= Number.MAX_SAFE_INTEGER) {
        throw new RangeError('IPC endpoint generation exceeds the safe integer range.');
      }
      const record: EndpointRegistryRecord = {
        windowId: registration.windowId,
        generation: ++nextGeneration,
        registration,
      };
      records.set(record.windowId, record);
      return record;
    },
    get(windowId) {
      return records.get(windowId);
    },
    activate(reservation, resources) {
      const current = records.get(reservation.windowId);
      if (current !== reservation || current.generation !== reservation.generation) {
        throw new Error('IPC endpoint reservation is no longer current.');
      }
      const active: EndpointRegistryRecord = { ...reservation, ...resources };
      records.set(active.windowId, active);
      return active;
    },
    compareAndRemove(windowId, generation) {
      const current = records.get(windowId);
      if (!current || current.generation !== generation) return undefined;
      records.delete(windowId);
      return current;
    },
    values() {
      return [...records.values()];
    },
  };
}
