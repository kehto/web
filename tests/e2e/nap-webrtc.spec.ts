/**
 * NAP-WEBRTC demo spec -- proves the playground advertises webrtc and handles
 * shell-mediated runtime-owned WebRTC open/send/event/close requests.
 */
import { test, expect } from '@playwright/test';

import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

test('webrtc demo opens, sends, receives an event, and closes a shell-owned session', async ({ page }) => {
  test.setTimeout(30_000);
  await demoBeforeEach(page);
  await expect(page.locator('#webrtc-demo-frame-container iframe')).toHaveCount(1, { timeout: 25_000 });

  const webrtcFrame = page.frameLocator('#webrtc-demo-frame-container iframe');
  await expect(webrtcFrame.locator('#webrtc-demo-status')).toContainText(
    'opened:chat; sent:ok; event:hello-webrtc; closed:demo complete',
    { timeout: 20_000 },
  );
  await expect(webrtcFrame.locator('#webrtc-demo-session')).toHaveText('chat');
  await expect(webrtcFrame.locator('#webrtc-demo-state')).toHaveText('open');
  await expect(webrtcFrame.locator('#webrtc-demo-message')).toHaveText('hello-webrtc');
  await expect(webrtcFrame.locator('#webrtc-demo-closed')).toHaveText('demo complete');
});
