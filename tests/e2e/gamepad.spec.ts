import { expect, test } from '@playwright/test';

test('real sandbox denies native controller access and isolates focused snapshots', async ({ page }) => {
  // Headless Chrome otherwise emulates focus for every tab simultaneously.
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  await page.bringToFront();
  await page.goto('/gamepad.html');
  const one = page.frameLocator('#one'); const two = page.frameLocator('#two');
  await expect(one.locator('#focus')).toBeVisible(); await expect(two.locator('#focus')).toBeVisible();
  const frames = page.frames().filter(frame => frame.parentFrame());
  for (const frame of frames) {
    expect(await frame.evaluate(() => (window as Window & { nativeResult?: string }).nativeResult)).toBe('SecurityError');
    expect(await frame.evaluate(() => Object.keys((window as Window & { napplet?: object }).napplet ?? {}))).toEqual(['gamepad']);
  }
  const snapshots = () => page.evaluate(() => {
    // The parent cannot inspect opaque frames: state is read with frame.evaluate below.
    return (window as Window & { gamepadFixture?: { nativeUnchanged(): boolean } }).gamepadFixture!.nativeUnchanged();
  });
  expect(await snapshots()).toBe(true);
  const state = async (index: number) => frames[index].evaluate(() => {
    const api = (window as Window & { napplet: { gamepad: { focused: boolean; getGamepads(): unknown[] } } }).napplet.gamepad;
    return { focused: api.focused, pads: api.getGamepads() };
  });
  await one.locator('#focus').click();
  await expect.poll(async () => (await state(0)).focused).toBe(true);
  await expect.poll(async () => (await state(1)).focused).toBe(false);
  expect((await state(0)).pads[1]).toMatchObject({ timestamp: 18235.4, axes: [0, -1, 0, 0] });
  expect((await state(1)).pads[1]).toMatchObject({ timestamp: 0, axes: [0, 0, 0, 0], buttons: [{ value: 0, pressed: false, touched: false }] });
  await two.locator('#focus').click();
  await expect.poll(async () => (await state(0)).focused).toBe(false);
  await expect.poll(async () => (await state(1)).focused).toBe(true);
  const otherTab = await page.context().newPage();
  await otherTab.goto('about:blank'); await otherTab.bringToFront();
  await expect.poll(async () => (await state(1)).focused).toBe(false);
  expect((await state(1)).pads[1]).toMatchObject({ timestamp: 0, axes: [0, 0, 0, 0] });
  await otherTab.close(); await page.bringToFront();
  await page.locator('#host-focus').click();
  await expect.poll(async () => (await state(1)).focused).toBe(false);
  expect((await state(1)).pads[1]).toMatchObject({ timestamp: 0, axes: [0, 0, 0, 0] });
  await page.evaluate(() => (window as Window & { gamepadFixture: { disconnect(): void } }).gamepadFixture.disconnect());
  for (const index of [0, 1]) await expect.poll(async () => (await state(index)).pads).toEqual([null, null]);
});
