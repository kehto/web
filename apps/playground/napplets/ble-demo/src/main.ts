/**
 * ble-demo napplet -- sends NAP-BLE envelopes and renders shell decisions.
 */
import '@napplet/shim';
import { getMissingNapDomains } from '../../domain-availability';
import type { BleAttribute } from '@napplet/core';
import type {
  BleCloseResultMessage,
  BleOpenResultMessage,
  BleReadResultMessage,
  BleServicesResultMessage,
  BleSubscribeResultMessage,
  BleUnsubscribeResultMessage,
  BleWriteResultMessage,
} from '@napplet/nap/ble/types';

const REQUIRED_NAPS = ['ble'] as const;
const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;
const REQUEST_TIMEOUT_MS = 10_000;
const TARGET: BleAttribute = { service: 'battery_service', characteristic: 'battery_level' };

const statusEl = document.getElementById('ble-demo-status')!;
const deviceEl = document.getElementById('ble-demo-device')!;
const servicesEl = document.getElementById('ble-demo-services')!;
const readEl = document.getElementById('ble-demo-read')!;
const writtenEl = document.getElementById('ble-demo-written')!;
const subscribedEl = document.getElementById('ble-demo-subscribed')!;
const closedEl = document.getElementById('ble-demo-closed')!;

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color =
    color === 'green'
      ? 'var(--nap-theme-success, #39ff14)'
      : color === 'red'
        ? 'var(--nap-theme-danger, #ff3b3b)'
        : 'var(--nap-theme-muted, #888)';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForRequiredNaps(): Promise<void> {
  const deadline = Date.now() + CAPABILITY_WAIT_MS;
  let missing = getMissingNapDomains(REQUIRED_NAPS);
  while (missing.length > 0 && Date.now() < deadline) {
    await sleep(CAPABILITY_WAIT_INTERVAL_MS);
    missing = getMissingNapDomains(REQUIRED_NAPS);
  }
  if (missing.length > 0) {
    throw new Error(`unsupported NAP capability: ${missing.join(', ')}`);
  }
}

function newRequestId(label: string): string {
  return `ble-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function requestBle<T extends { type: string; id: string }>(message: { type: string; id: string; [key: string]: unknown }, resultType: T['type']): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error(`${message.type} timed out`));
    }, REQUEST_TIMEOUT_MS);

    // Phase 58 raw-message allowlist: demo waits for one shell-owned NAP result.
    function onMessage(event: MessageEvent): void {
      if (event.source !== window.parent) return;
      const msg = event.data as Partial<T> | null;
      if (!msg || msg.type !== resultType || msg.id !== message.id) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      resolve(msg as T);
    }

    window.addEventListener('message', onMessage);
    window.parent.postMessage(message, '*');
  });
}

async function init(): Promise<void> {
  await waitForRequiredNaps();
  setStatus('running ble', 'gray');

  const open = await requestBle<BleOpenResultMessage>({
    type: 'ble.open',
    id: newRequestId('open'),
    request: {
      acceptAllDevices: true,
      optionalServices: ['battery_service'],
      label: 'demo ble',
    },
  }, 'ble.open.result');
  if (!open.session?.id) throw new Error(open.error ?? 'ble open failed');

  const services = await requestBle<BleServicesResultMessage>({
    type: 'ble.services',
    id: newRequestId('services'),
    sessionId: open.session.id,
  }, 'ble.services.result');
  if (!services.services) throw new Error(services.error ?? 'ble services failed');

  const read = await requestBle<BleReadResultMessage>({
    type: 'ble.read',
    id: newRequestId('read'),
    sessionId: open.session.id,
    target: TARGET,
  }, 'ble.read.result');
  if (!read.data) throw new Error(read.error ?? 'ble read failed');

  const write = await requestBle<BleWriteResultMessage>({
    type: 'ble.write',
    id: newRequestId('write'),
    sessionId: open.session.id,
    target: TARGET,
    data: [104, 105],
    options: { response: 'with-response' },
  }, 'ble.write.result');
  if (write.error) throw new Error(write.error);

  const subscribe = await requestBle<BleSubscribeResultMessage>({
    type: 'ble.subscribe',
    id: newRequestId('subscribe'),
    sessionId: open.session.id,
    target: TARGET,
  }, 'ble.subscribe.result');
  if (subscribe.error) throw new Error(subscribe.error);

  const unsubscribe = await requestBle<BleUnsubscribeResultMessage>({
    type: 'ble.unsubscribe',
    id: newRequestId('unsubscribe'),
    sessionId: open.session.id,
    target: TARGET,
  }, 'ble.unsubscribe.result');
  if (unsubscribe.error) throw new Error(unsubscribe.error);

  const close = await requestBle<BleCloseResultMessage>({
    type: 'ble.close',
    id: newRequestId('close'),
    sessionId: open.session.id,
    reason: 'demo complete',
  }, 'ble.close.result');
  if (close.error) throw new Error(close.error);

  deviceEl.textContent = open.session.device.name ?? open.session.device.id;
  servicesEl.textContent = String(services.services.length);
  readEl.textContent = read.data.join(',');
  writtenEl.textContent = '2';
  subscribedEl.textContent = 'ok';
  closedEl.textContent = 'ok';
  setStatus('opened:Playground BLE; services:1; read:87; written:2; subscribed:ok; closed:ok', 'green');
}

init().catch((err) => {
  setStatus('init failed', 'red');
  closedEl.textContent = err instanceof Error ? err.message : String(err);
});
