import type { DomainFixture, OperationCase, SemanticVerdict } from './types.js';

/**
 * The session id the fixture addresses. NAP-SERIAL session ids are
 * runtime-assigned and the probe cannot feed a reply value into a later
 * request, so the fixture uses the id of the NAP's own example and a target
 * must assign it to the first open session.
 */
const SESSION = 'serial-1';
const BYTES = [79, 75, 10];

const OPEN_REQUEST = { filters: [{ usbVendorId: 9025 }], options: { baudRate: 115200 }, label: 'controller' };

function isByteArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255);
}

function openedSession(reply: Readonly<Record<string, unknown>> | null): SemanticVerdict {
  const session = reply?.session as { id?: unknown; state?: unknown } | undefined;
  if (typeof session?.id !== 'string' || !session.id) return `session.id was ${JSON.stringify(session?.id)}`;
  return session.state === 'open' ? null : `session.state was ${JSON.stringify(session.state)}, expected "open"`;
}

const open = (id: string): OperationCase => ({
  id, type: 'serial.open', payload: { request: OPEN_REQUEST },
  semantics: { rule: 'serial.open "returns a runtime-assigned session id after the port is open": session.id is text and session.state is "open"', verify: openedSession },
});

const close = (id: string): OperationCase => ({ id, type: 'serial.close', payload: { sessionId: SESSION, reason: 'done' } });

/** NAP-SERIAL at napplet/naps#61 head: open, write, close, invalid input, and device bytes as serial.event. */
export const SERIAL_FIXTURE: DomainFixture = {
  domain: 'serial',
  cases: [
    open('serial/open'),
    { id: 'serial/write', type: 'serial.write', payload: { sessionId: SESSION, data: [112, 105, 110, 103, 10] } },
    {
      id: 'serial/write-invalid-data', type: 'serial.write', payload: { sessionId: SESSION, data: [256] }, allowError: true,
      semantics: {
        rule: '"data is a byte array. Values outside 0..255 are invalid": serial.write with 256 gets a result carrying an error string',
        verify: (reply) => (typeof reply?.error === 'string' && reply.error ? null : `error was ${JSON.stringify(reply?.error)}`),
      },
    },
    close('serial/close'),
    {
      id: 'serial/open-without-options', type: 'serial.open', payload: { request: { label: 'no options' } }, allowError: true,
      semantics: {
        rule: 'SerialOpenRequest.options is required; the runtime answers with an error, and "When serial.open.result includes error, it MUST NOT include session"',
        verify(reply) {
          if (typeof reply?.error !== 'string' || !reply.error) return `error was ${JSON.stringify(reply?.error)}`;
          return reply.session === undefined ? null : `an error result also carried session ${JSON.stringify(reply.session)}`;
        },
      },
    },
  ],
  pushes: [
    {
      id: 'serial/event-data', type: 'serial.event',
      subscribe: open('serial/open-for-event'),
      trigger: { control: 'serial.receive', payload: { data: BYTES } },
      unsubscribe: close('serial/close-after-event'),
      semantics: {
        rule: '"The runtime MUST deliver readable bytes through serial.event" as a data event for the open session with byte values 0..255',
        verify(push) {
          const event = push?.event as { type?: unknown; sessionId?: unknown; data?: unknown } | undefined;
          if (event?.type !== 'data') return `event.type was ${JSON.stringify(event?.type)}`;
          if (event.sessionId !== SESSION) return `event.sessionId was ${JSON.stringify(event.sessionId)}`;
          if (!isByteArray(event.data)) return `event.data was ${JSON.stringify(event.data)}`;
          return JSON.stringify(event.data) === JSON.stringify(BYTES) ? null : `event.data was ${JSON.stringify(event.data)}, expected ${JSON.stringify(BYTES)}`;
        },
      },
    },
  ],
};
