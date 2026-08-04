import { describe, expect, it, vi } from 'vitest';
import type { BleEvent, SerialEvent } from '@napplet/core';

import {
  createBrowserBleController,
  createBrowserSerialController,
  type PajaUserActivationHandler,
} from './browser-device-services.js';
import type { PajaConfirmationRequest } from './browser-adapter.js';

function activationLog(): {
  activation: PajaUserActivationHandler;
  requests: PajaConfirmationRequest[];
} {
  const requests: PajaConfirmationRequest[] = [];
  return {
    requests,
    activation: {
      run(request, operation) {
        requests.push(request);
        return Promise.resolve(operation());
      },
    },
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createBrowserSerialController', () => {
  it('uses the Web Serial chooser, streams reads, orders writes, and closes the real port', async () => {
    const { activation, requests } = activationLog();
    const written: number[][] = [];
    let readController!: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        readController = controller;
      },
    });
    const writable = new WritableStream<Uint8Array>({
      write(chunk) {
        written.push(Array.from(chunk));
      },
    });
    class FakePort extends EventTarget {
      readonly readable = readable;
      readonly writable = writable;
      readonly open = vi.fn(async () => {});
      readonly close = vi.fn(async () => {});
      getInfo() {
        return { usbVendorId: 1, usbProductId: 2 };
      }
    }
    const port = new FakePort();
    const requestPort = vi.fn(async () => port);
    const controller = createBrowserSerialController(activation, { requestPort });
    const events: SerialEvent[] = [];
    expect(controller).not.toBeNull();

    const result = await controller!.open!(
      { filters: [{ usbVendorId: 1 }], options: { baudRate: 115_200 }, label: 'console' },
      { windowId: 'window-a', emit: (event) => events.push(event) },
    );
    readController.enqueue(Uint8Array.from([7, 8, 9]));
    await flush();
    await controller!.write!(result.session.id, [1, 2], { windowId: 'window-a', emit: () => {} });
    await controller!.write!(result.session.id, [3, 4], { windowId: 'window-a', emit: () => {} });
    await controller!.close!(result.session.id, 'done', { windowId: 'window-a', emit: () => {} });

    expect(requests).toEqual([{
      action: 'serial',
      windowId: 'window-a',
      label: 'console',
      details: 'Baud rate: 115200',
    }]);
    expect(requestPort).toHaveBeenCalledWith({ filters: [{ usbVendorId: 1 }] });
    expect(port.open).toHaveBeenCalledWith({ baudRate: 115_200 });
    expect(written).toEqual([[1, 2], [3, 4]]);
    expect(events).toContainEqual({ type: 'data', sessionId: result.session.id, data: [7, 8, 9] });
    expect(events.slice(-2)).toEqual([
      { type: 'state', sessionId: result.session.id, state: 'closed' },
      { type: 'closed', sessionId: result.session.id, reason: 'done' },
    ]);
    expect(port.close).toHaveBeenCalledOnce();
  });

  it('continues ordered writes after an earlier writer rejects', async () => {
    const { activation } = activationLog();
    const rejected = new Error('write failed');
    const firstWriter = {
      write: vi.fn(async () => { throw rejected; }),
      releaseLock: vi.fn(),
    };
    const secondWriter = {
      write: vi.fn(async () => {}),
      releaseLock: vi.fn(),
    };
    const writable = {
      getWriter: vi.fn()
        .mockReturnValueOnce(firstWriter)
        .mockReturnValueOnce(secondWriter),
    } as unknown as WritableStream<Uint8Array>;
    class FakePort extends EventTarget {
      readonly readable = null;
      readonly writable = writable;
      readonly open = vi.fn(async () => {});
      readonly close = vi.fn(async () => {});
      getInfo() {
        return {};
      }
    }
    const controller = createBrowserSerialController(activation, {
      requestPort: vi.fn(async () => new FakePort()),
    });
    const { session } = await controller!.open!(
      { options: { baudRate: 9_600 } },
      { windowId: 'window-a', emit: () => {} },
    );

    await expect(controller!.write!(session.id, [1], { windowId: 'window-a', emit: () => {} }))
      .rejects.toBe(rejected);
    await expect(controller!.write!(session.id, [2], { windowId: 'window-a', emit: () => {} }))
      .resolves.toBeUndefined();

    expect(firstWriter.write).toHaveBeenCalledWith(Uint8Array.from([1]));
    expect(secondWriter.write).toHaveBeenCalledWith(Uint8Array.from([2]));
    expect(firstWriter.releaseLock).toHaveBeenCalledOnce();
    expect(secondWriter.releaseLock).toHaveBeenCalledOnce();
  });
});

describe('createBrowserBleController', () => {
  it('uses the Web Bluetooth chooser and performs GATT reads, writes, notifications, and cleanup', async () => {
    const { activation, requests } = activationLog();
    const writes: Array<{ mode: string; data: number[] }> = [];
    class FakeCharacteristic extends EventTarget {
      readonly uuid = 'characteristic-a';
      readonly properties = { read: true, write: true, notify: true };
      value: DataView | null = null;
      readonly startNotifications = vi.fn(async () => this);
      readonly stopNotifications = vi.fn(async () => this);
      async readValue() {
        return new DataView(Uint8Array.from([10, 11]).buffer);
      }
      async writeValueWithResponse(value: BufferSource) {
        writes.push({ mode: 'response', data: Array.from(new Uint8Array(value as ArrayBufferView as Uint8Array)) });
      }
      async writeValueWithoutResponse(value: BufferSource) {
        writes.push({ mode: 'without-response', data: Array.from(new Uint8Array(value as ArrayBufferView as Uint8Array)) });
      }
      async getDescriptor(): Promise<never> {
        throw new Error('descriptor not configured');
      }
    }
    const characteristic = new FakeCharacteristic();
    const service = {
      uuid: 'service-a',
      getCharacteristics: vi.fn(async () => [characteristic]),
      getCharacteristic: vi.fn(async () => characteristic),
    };
    const server = {
      connected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getPrimaryServices: vi.fn(async () => [service]),
      getPrimaryService: vi.fn(async () => service),
    };
    server.connect.mockImplementation(async () => server);
    class FakeDevice extends EventTarget {
      readonly id = 'browser-stable-id';
      readonly name = 'Sensor';
      readonly gatt = server;
    }
    const device = new FakeDevice();
    const requestDevice = vi.fn(async () => device);
    const controller = createBrowserBleController(activation, { requestDevice });
    const events: BleEvent[] = [];

    const result = await controller!.open!(
      { filters: [{ services: ['service-a'] }], optionalServices: ['service-b'], label: 'sensor' },
      { windowId: 'window-b', emit: (event) => events.push(event) },
    );
    const sessionId = result.session.id;
    expect(result.session.device.id).toBe(sessionId);
    expect(result.session.device.id).not.toBe(device.id);
    expect(await controller!.services!(sessionId, { windowId: 'window-b', emit: () => {} })).toEqual([{
      uuid: 'service-a',
      characteristics: [{
        uuid: 'characteristic-a',
        properties: { read: true, write: true, notify: true },
      }],
    }]);
    const target = { service: 'service-a', characteristic: 'characteristic-a' };
    expect(await controller!.read!(sessionId, target, { windowId: 'window-b', emit: () => {} })).toEqual([10, 11]);
    await controller!.write!(sessionId, target, [12], { response: 'with-response' }, { windowId: 'window-b', emit: () => {} });
    await controller!.subscribe!(sessionId, target, { windowId: 'window-b', emit: () => {} });
    characteristic.value = new DataView(Uint8Array.from([13, 14]).buffer);
    characteristic.dispatchEvent(new Event('characteristicvaluechanged'));
    await controller!.unsubscribe!(sessionId, target, { windowId: 'window-b', emit: () => {} });
    await controller!.close!(sessionId, 'done', { windowId: 'window-b', emit: () => {} });

    expect(requests[0]).toMatchObject({ action: 'ble', windowId: 'window-b', label: 'sensor' });
    expect(requestDevice).toHaveBeenCalledWith({
      filters: [{ services: ['service-a'] }],
      optionalServices: ['service-b'],
    });
    expect(writes).toEqual([{ mode: 'response', data: [12] }]);
    expect(events).toContainEqual({ type: 'notification', sessionId, target, data: [13, 14] });
    expect(events.slice(-2)).toEqual([
      { type: 'state', sessionId, state: 'closed' },
      { type: 'closed', sessionId, reason: 'done' },
    ]);
    expect(server.disconnect).toHaveBeenCalledOnce();
  });
});
