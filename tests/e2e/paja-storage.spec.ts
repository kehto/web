/**
 * Paja NAP-STORAGE browser flows: persistence across reload, instance scope
 * isolation, and live state:write revocation.
 *
 * Spec check: NAP-STORAGE napplet/naps#3@4f4cf0c (Shell Behavior: storage MUST
 * survive page reloads; `scope: "instance"` MUST be isolated from the shared
 * namespace; every request gets a result with the same id and an `error` on
 * failure).
 */
import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import type { PajaServer } from '../../packages/paja/dist/index.js';
import {
  openFlowTarget,
  readTracked,
  startFlowRuntime,
  startFlowTarget,
  type FlowTarget,
  type FlowWindow,
  type TrackedResult,
} from './helpers/paja-flows.js';

const RELAY_URL = 'wss://paja-storage-flows.example';

let target: FlowTarget;
let runtime: PajaServer;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  target = await startFlowTarget();
  runtime = await startFlowRuntime(target, RELAY_URL);
});

test.afterAll(async () => {
  await runtime.close();
  await target.close();
});

type StorageCall =
  | { op: 'setItem'; key: string; value: string; scope?: 'instance' }
  | { op: 'getItem'; key: string; scope?: 'instance' }
  | { op: 'removeItem'; key: string; scope?: 'instance' }
  | { op: 'keys'; scope?: 'instance' };

let callCounter = 0;

async function storage(frame: FrameLocator, call: StorageCall): Promise<TrackedResult> {
  callCounter += 1;
  const key = `storage-${callCounter}`;
  await frame.locator('body').evaluate((_body, input) => {
    const flow = window as unknown as FlowWindow;
    const area = input.call.scope === 'instance' ? flow.napplet.storage.instance : flow.napplet.storage;
    const { call } = input;
    const promise = call.op === 'setItem'
      ? area.setItem(call.key, call.value)
      : call.op === 'getItem'
        ? area.getItem(call.key)
        : call.op === 'removeItem'
          ? area.removeItem(call.key)
          : area.keys();
    flow.__track(input.key, promise);
  }, { key, call });
  await expect.poll(() => readTracked(frame, key)).not.toBeNull();
  return (await readTracked(frame, key))!;
}

async function reloadHost(page: Page): Promise<FrameLocator> {
  await page.reload();
  return openFlowTarget(page, runtime);
}

test('storage writes survive a host reload and removals stay removed', async ({ page }) => {
  test.setTimeout(60_000);
  let frame = await openFlowTarget(page, runtime);

  expect(await storage(frame, { op: 'setItem', key: 'display-name', value: 'alice-test-01' })).toEqual({ ok: true, value: null });
  expect(await storage(frame, { op: 'setItem', key: 'theme-preference', value: 'dark-test-01' })).toEqual({ ok: true, value: null });
  expect(await storage(frame, { op: 'setItem', key: 'scratch', value: 'temporary' })).toEqual({ ok: true, value: null });
  await expect(page.locator('#message-log [data-message-type="storage.set"]')).not.toHaveCount(0);

  frame = await reloadHost(page);
  expect(await storage(frame, { op: 'getItem', key: 'display-name' })).toEqual({ ok: true, value: 'alice-test-01' });
  expect(await storage(frame, { op: 'getItem', key: 'theme-preference' })).toEqual({ ok: true, value: 'dark-test-01' });
  const keys = await storage(frame, { op: 'keys' });
  expect(keys.ok).toBe(true);
  expect((keys as { value: string[] }).value).toEqual(expect.arrayContaining(['display-name', 'theme-preference', 'scratch']));

  expect(await storage(frame, { op: 'removeItem', key: 'scratch' })).toEqual({ ok: true, value: null });
  frame = await reloadHost(page);
  expect(await storage(frame, { op: 'getItem', key: 'scratch' })).toEqual({ ok: true, value: null });
  expect(await storage(frame, { op: 'getItem', key: 'display-name' })).toEqual({ ok: true, value: 'alice-test-01' });
});

test('instance-scoped storage is isolated from the shared namespace', async ({ page }) => {
  test.setTimeout(60_000);
  const frame = await openFlowTarget(page, runtime);

  expect(await storage(frame, { op: 'setItem', key: 'slot', value: 'shared-value' })).toEqual({ ok: true, value: null });
  expect(await storage(frame, { op: 'setItem', key: 'slot', value: 'instance-value', scope: 'instance' })).toEqual({ ok: true, value: null });

  expect(await storage(frame, { op: 'getItem', key: 'slot' })).toEqual({ ok: true, value: 'shared-value' });
  expect(await storage(frame, { op: 'getItem', key: 'slot', scope: 'instance' })).toEqual({ ok: true, value: 'instance-value' });
  expect(await storage(frame, { op: 'removeItem', key: 'slot', scope: 'instance' })).toEqual({ ok: true, value: null });
  expect(await storage(frame, { op: 'getItem', key: 'slot' })).toEqual({ ok: true, value: 'shared-value' });
});

test('revoking state:write denies the next write without losing readable data, and re-granting restores writes', async ({ page }) => {
  test.setTimeout(60_000);
  const frame = await openFlowTarget(page, runtime);
  const stateWrite = page.locator('#acl-controls [data-acl-capability="state:write"]');

  expect(await storage(frame, { op: 'setItem', key: 'acl-probe', value: 'before-revoke' })).toEqual({ ok: true, value: null });
  await expect(stateWrite).toHaveAttribute('data-enabled', 'true');

  await stateWrite.click();
  await expect(stateWrite).toHaveAttribute('data-enabled', 'false');
  const denied = await storage(frame, { op: 'setItem', key: 'acl-probe', value: 'while-revoked' });
  expect(denied).toMatchObject({ ok: false, error: expect.stringContaining('state:write') });
  expect(await storage(frame, { op: 'getItem', key: 'acl-probe' })).toEqual({ ok: true, value: 'before-revoke' });

  await stateWrite.click();
  await expect(stateWrite).toHaveAttribute('data-enabled', 'true');
  expect(await storage(frame, { op: 'setItem', key: 'acl-probe', value: 'after-regrant' })).toEqual({ ok: true, value: null });
  expect(await storage(frame, { op: 'getItem', key: 'acl-probe' })).toEqual({ ok: true, value: 'after-regrant' });
});
