import { expect, test, type Page } from '@playwright/test';

type Fixture = { disconnect(): void; reconnect(): void; theme(light: boolean): void };
async function openDemo(page: Page, mode = '') {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  await page.bringToFront();
  await page.goto(`/gamepad.html?demo=1&mode=${mode}`);
  await expect(page.frameLocator('#one').locator('#focus')).toBeVisible();
}

test('built controller napplet observes live values, neutral focus loss, reconnect and native denial', async ({ page }) => {
  await openDemo(page);
  const one = page.frameLocator('#one');
  const two = page.frameLocator('#two');
  await one.locator('#focus').click();
  await expect(one.locator('#status')).toHaveText('Live · focused');
  await expect(one.locator('[data-axis="1"]')).toHaveText('-1.000');
  await expect(one.locator('[data-button="0"] strong')).toHaveText('1.00');
  await expect(one.locator('#checks')).toContainText('✓ Live input');
  await expect(two.locator('[data-axis="1"]')).toHaveText('0.000');
  await two.locator('#focus').click();
  await expect(one.locator('#status')).toHaveText('Idle · unfocused');
  await expect(one.locator('#checks')).toContainText('✓ Neutral on blur');
  await expect(one.locator('[data-button="0"]')).toHaveAttribute('data-pressed', 'false');
  await expect(one.locator('.metadata')).toContainText('0.0 ms');
  await expect(two.locator('[data-axis="1"]')).toHaveText('-1.000');
  for (const frame of page.frames().filter(frame => frame.parentFrame())) {
    expect(await frame.evaluate(() => {
      try { navigator.getGamepads(); return 'allowed'; } catch (error) { return (error as Error).name; }
    })).toBe('SecurityError');
  }
  await page.locator('#host-focus').click();
  await expect(two.locator('#status')).toHaveText('Idle · unfocused');
  await expect(two.locator('.metadata')).toContainText('0.0 ms');
  await page.evaluate(() => (window as Window & { gamepadFixture: Fixture }).gamepadFixture.disconnect());
  await expect(one.locator('.pad')).toHaveCount(0);
  await expect(two.locator('.empty-slot')).toHaveCount(2);
  await page.evaluate(() => (window as Window & { gamepadFixture: Fixture }).gamepadFixture.reconnect());
  await expect(one.locator('[data-index="1"]')).toBeVisible();
  await expect(two.locator('[data-index="1"]')).toBeVisible();
  await one.locator('#reset').click();
  await expect(one.locator('#checks')).toContainText('○ Neutral on blur');
});

for (const [mode, label] of [
  ['absent', 'Controller API absent'],
  ['blocked', 'Controller access blocked'],
  ['unavailable', 'Controller reader unavailable'],
]) {
  test(`built controller napplet reports ${mode}`, async ({ page }) => {
    await openDemo(page, mode);
    await expect(page.frameLocator('#one').locator('#status')).toHaveText(label);
    await expect(page.frameLocator('#one').locator('#checks')).toContainText('○ Live input');
  });
}

test('four frame sizes remain usable in light and dark runtime themes', async ({ page }) => {
  await page.setViewportSize({ width: 2500, height: 1350 });
  await openDemo(page);
  const frame = page.frames().find(frame => frame.parentFrame())!;
  for (const [width, height] of [[200, 160], [320, 560], [900, 600], [2400, 1200]]) {
    await page.locator('#one').evaluate((node, size) => {
      node.style.width = `${size.width}px`; node.style.height = `${size.height}px`;
    }, { width, height });
    for (const light of [false, true]) {
      await page.evaluate(light => (window as Window & { gamepadFixture: Fixture }).gamepadFixture.theme(light), light);
      await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).backgroundColor))
        .toBe(light ? 'rgb(255, 255, 255)' : 'rgb(16, 23, 25)');
      await expect(page.frameLocator('#one').locator('#focus')).toBeVisible();
      expect(await frame.evaluate(() => {
        const content = document.querySelector('.content')!;
        return { document: document.documentElement.scrollWidth <= innerWidth,
          content: content.scrollWidth <= content.clientWidth, height: document.documentElement.scrollHeight <= innerHeight };
      })).toEqual({ document: true, content: true, height: true });
      await page.locator('#one').screenshot({ path: `test-results/gamepad-${width}x${height}-${light ? 'light' : 'dark'}.png` });
    }
  }
});

test('controller view releases its listener on page teardown', async ({ page }) => {
  await openDemo(page);
  const one = page.frameLocator('#one');
  const frame = page.frames().find(frame => frame.parentFrame())!;
  await one.locator('#focus').click();
  await expect(one.locator('#status')).toHaveText('Live · focused');
  await frame.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await page.locator('#host-focus').click();
  await expect.poll(() => frame.evaluate(() => (window as Window & {
    napplet: { gamepad: { focused: boolean } };
  }).napplet.gamepad.focused)).toBe(false);
  // The binding still updates, but the closed app listener no longer renders.
  await expect(one.locator('#status')).toHaveText('Live · focused');
});
