import { createSerialService, type SerialServiceContext } from '@kehto/services';
import { createSessionTable } from './sessions.js';
import type { DomainBackendModule } from './types.js';

type SerialEvent = Parameters<SerialServiceContext['emit']>[0];

/** Bytes `serial.receive` delivers when its payload names none. */
const DEFAULT_BYTES = [79, 75, 10];

function bytesOf(payload: unknown): number[] {
  const data = (payload as { data?: unknown } | undefined)?.data;
  return Array.isArray(data) ? data.map(Number) : DEFAULT_BYTES;
}

/**
 * NAP-SERIAL backend: the reference serial service over a simulated port.
 *
 * Every open is approved for the one simulated device and gets the lowest free
 * `serial-<n>` id. `serial.receive` makes the device send bytes on every session it
 * ever opened (the runtime must drop closed ones); `serial.writes` reads back what was written, in order.
 */
export const SERIAL_BACKEND: DomainBackendModule = {
  domain: 'serial',
  create() {
    const sessions = createSessionTable<SerialEvent>('serial');
    const written: { sessionId: string; data: number[] }[] = [];
    const service = createSerialService({
      open(_request, context) {
        const open = () => ({ session: { id: sessions.open(context.windowId, (event) => context.emit(event)), state: 'open' as const, info: { usbVendorId: 9025, displayName: 'Conformance serial' } } });
        return context.authorizeDevice ? context.authorizeDevice('serial:device:conformance', open) : open();
      },
      write(sessionId, data) { written.push({ sessionId, data: [...data] }); },
      close(sessionId) { sessions.close(sessionId); },
      destroyWindow(windowId) { sessions.dropWindow(windowId); },
    });
    return {
      services: { serial: service },
      adapter: { serial: { isAvailable: () => true } },
      controls: {
        'serial.receive': (payload) => {
          for (const session of sessions.everOpened()) session.emit({ type: 'data', sessionId: session.id, data: bytesOf(payload) });
        },
        'serial.writes': () => written.map((item) => ({ ...item, data: [...item.data] })),
      },
    };
  },
};
