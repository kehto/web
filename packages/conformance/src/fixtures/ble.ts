import type { DomainFixture, OperationCase, SemanticVerdict } from './types.js';

type Envelope = Readonly<Record<string, unknown>> | null;

/**
 * Session ids the fixture addresses. NAP-BLE session ids are runtime-assigned
 * and the probe cannot feed a reply value into a later request, so a target
 * must assign `ble-1` and `ble-2` to the first two open sessions.
 */
const FIRST = 'ble-1';
const SECOND = 'ble-2';
const HEART_RATE = { service: '0000180d-0000-1000-8000-00805f9b34fb', characteristic: '00002a37-0000-1000-8000-00805f9b34fb' };
const BATTERY = { service: '0000180f-0000-1000-8000-00805f9b34fb', characteristic: '00002a19-0000-1000-8000-00805f9b34fb' };
const NOTIFIED = [0, 72];
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

const isBytes = (value: unknown): boolean => Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255);

function opened(reply: Envelope): SemanticVerdict {
  const session = reply?.session as { id?: unknown; state?: unknown; device?: { id?: unknown } } | undefined;
  if (typeof session?.id !== 'string' || !session.id) return `session.id was ${JSON.stringify(session?.id)}`;
  if (session.state !== 'open') return `session.state was ${JSON.stringify(session.state)}`;
  return typeof session.device?.id === 'string' ? null : `session.device.id was ${JSON.stringify(session.device?.id)}`;
}

const open = (id: string): OperationCase => ({
  id, type: 'ble.open', payload: { request: { acceptAllDevices: true, optionalServices: [HEART_RATE.service, BATTERY.service], label: 'heart rate' } },
  semantics: { rule: 'ble.open returns a BleSession with an id, state "open" and runtime-scoped device id', verify: opened },
});

const errorString = (reply: Envelope): SemanticVerdict => (typeof reply?.error === 'string' && reply.error ? null : `error was ${JSON.stringify(reply?.error)}`);

function canonicalServices(reply: Envelope): SemanticVerdict {
  const services = reply?.services as { uuid?: unknown; characteristics?: { uuid?: unknown }[] }[] | undefined;
  if (!Array.isArray(services) || !services.length) return `services was ${JSON.stringify(services)}`;
  const uuids = services.flatMap((item) => [item.uuid, ...(Array.isArray(item.characteristics) ? item.characteristics.map((c) => c.uuid) : [null])]);
  const bad = uuids.filter((uuid) => typeof uuid !== 'string' || !CANONICAL_UUID.test(uuid));
  return bad.length ? `non-canonical UUIDs ${JSON.stringify(bad)}` : null;
}

/** NAP-BLE at napplet/naps#62 head: every request, open/subscribe validation, and notifications as ble.event. */
export const BLE_FIXTURE: DomainFixture = {
  domain: 'ble',
  cases: [
    open('ble/open'),
    open('ble/open-second'),
    {
      id: 'ble/open-accept-all-with-filters', type: 'ble.open', payload: { request: { acceptAllDevices: true, filters: [{ services: [HEART_RATE.service] }] } }, allowError: true,
      semantics: {
        rule: '"acceptAllDevices excludes filters and exclusionFilters"; the error result "MUST NOT include session"',
        verify: (reply) => errorString(reply) ?? (reply?.session === undefined ? null : 'an error result carried session'),
      },
    },
    {
      id: 'ble/services', type: 'ble.services', payload: { sessionId: FIRST },
      semantics: { rule: '"Results MUST use canonical lowercase UUID strings" for services and characteristics', verify: canonicalServices },
    },
    {
      id: 'ble/read', type: 'ble.read', payload: { sessionId: FIRST, target: BATTERY },
      semantics: { rule: 'ble.read returns the value as bytes: "Byte arrays are integers in 0..255"', verify: (reply) => (isBytes(reply?.data) && (reply?.data as unknown[]).length ? null : `data was ${JSON.stringify(reply?.data)}`) },
    },
    // "BleUuid requests MAY use assigned names, 16-bit or 32-bit numbers": 0x180f / 0x2a19 address the same characteristic.
    { id: 'ble/read-numeric-uuid', type: 'ble.read', payload: { sessionId: FIRST, target: { service: 0x180f, characteristic: 0x2a19 } } },
    { id: 'ble/write', type: 'ble.write', payload: { sessionId: FIRST, target: BATTERY, data: [90], options: { response: 'with-response' } } },
    {
      id: 'ble/read-after-write', type: 'ble.read', payload: { sessionId: FIRST, target: BATTERY },
      semantics: { rule: 'write "Writes bytes to a characteristic"; reading it back returns the written bytes', verify: (reply) => (JSON.stringify(reply?.data) === '[90]' ? null : `data was ${JSON.stringify(reply?.data)}, expected [90]`) },
    },
    {
      id: 'ble/subscribe-with-descriptor', type: 'ble.subscribe', payload: { sessionId: FIRST, target: { ...HEART_RATE, descriptor: '00002902-0000-1000-8000-00805f9b34fb' } }, allowError: true,
      semantics: { rule: 'subscribe: "target.descriptor MUST be omitted"; a request carrying one is answered with an error', verify: errorString },
    },
    { id: 'ble/close', type: 'ble.close', payload: { sessionId: SECOND, reason: 'done' } },
  ],
  pushes: [
    {
      id: 'ble/event-notification', type: 'ble.event',
      subscribe: { id: 'ble/subscribe', type: 'ble.subscribe', payload: { sessionId: FIRST, target: HEART_RATE } },
      trigger: { control: 'ble.notify', payload: { data: NOTIFIED } },
      // The session id the subscribe names is assigned by the target at open.
      isolation: false,
      unsubscribe: { id: 'ble/unsubscribe', type: 'ble.unsubscribe', payload: { sessionId: FIRST, target: HEART_RATE } },
      semantics: {
        rule: 'The runtime "MUST deliver notifications through ble.event" as a notification for the subscribed session and target with byte data',
        verify(push) {
          const event = push?.event as { type?: unknown; sessionId?: unknown; target?: unknown; data?: unknown } | undefined;
          if (event?.type !== 'notification') return `event.type was ${JSON.stringify(event?.type)}`;
          if (event.sessionId !== FIRST) return `event.sessionId was ${JSON.stringify(event.sessionId)}`;
          const target = event.target as { service?: unknown; characteristic?: unknown } | undefined;
          if (target?.service !== HEART_RATE.service || target.characteristic !== HEART_RATE.characteristic) return `event.target was ${JSON.stringify(event.target)}`;
          return JSON.stringify(event.data) === JSON.stringify(NOTIFIED) ? null : `event.data was ${JSON.stringify(event.data)}`;
        },
      },
    },
  ],
};
