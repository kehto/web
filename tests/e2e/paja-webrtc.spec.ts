/** NAP-WEBRTC #59@fb4dd6f0: advertised open must reach the live handler and return the same ID. */
import { expect, test } from '@playwright/test';
import type { PajaServer } from '../../packages/paja/dist/index.js';
import { installMemoryRelay } from './helpers/memory-relay.js';
import { openFlowTarget, settleApproving, startFlowRuntime, startFlowTarget, type FlowTarget, type FlowWindow } from './helpers/paja-flows.js';
import { installPajaApprovalDriver } from './paja-approval-driver.js';

const RELAY = 'wss://paja-webrtc-flows.example';
let target: FlowTarget;
let runtime: PajaServer;
test.beforeAll(async () => {
  target = await startFlowTarget(['webrtc', 'cvm']);
  runtime = await startFlowRuntime(target, RELAY);
});
test.afterAll(async () => { await runtime.close(); await target.close(); });

test('connecting a signer registers WebRTC before the new frame can open a room', async ({ page }) => {
  await installPajaApprovalDriver(page);
  const relay = await installMemoryRelay(page, RELAY);
  await openFlowTarget(page, runtime);
  expect(await page.evaluate(() => window.__KEHTO_PAJA__!.getState().services)).not.toContain('webrtc');
  await page.evaluate(() => window.__KEHTO_PAJA__!.useDevSigner());
  await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__!.getState().services)).toContain('webrtc');
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('#flow-status')).toHaveText('ready');
  await frame.locator('body').evaluate(() => {
    const w = window as unknown as FlowWindow;
    w.__track('open', w.napplet.webrtc.open({ scope: { type: 'room', room: 'registration-regression' }, channel: 'game', protocol: 'boost-ball/1' }));
  });
  const { result } = await settleApproving(page, frame, 'open');
  expect(result).toMatchObject({ ok: true, value: { session: { state: 'connecting', channel: 'game' } } });
  const log = await page.evaluate(() => window.__KEHTO_PAJA__!.getState().messageLog);
  const request = log.find(entry => entry.type === 'webrtc.open');
  const response = log.find(entry => entry.type === 'webrtc.open.result');
  expect(JSON.parse(response!.preview).id).toBe(JSON.parse(request!.preview).id);
  await page.evaluate(() => window.__KEHTO_PAJA__!.useNoSigner());
  await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__!.getState().services)).not.toContain('webrtc');
  expect(relay.published.some(event => event.kind === 25050)).toBe(true);
});
