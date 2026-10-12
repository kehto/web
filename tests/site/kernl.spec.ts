import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`explains kernl above the fold at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./');
    await expect(page).toHaveTitle('kernl — Build your own app runtime.');
    await expect(page.locator('.hero-copy')).not.toContainText(/nostr/i);
    await expect(page.locator('.build-note')).toContainText(
      'Nostr is the underlying protocol'
    );
    for (const selector of ['h1', '.hero-summary', '.hero-actions']) {
      const box = await page.locator(selector).boundingBox();
      expect(box!.y + box!.height).toBeLessThan(viewport.height);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBe(viewport.width);
    await expect(
      page.getByRole('link', { name: 'Build with kernl' })
    ).toHaveAttribute('href', 'docs/tutorials/minimal-host-shell.html');
    await expect(page.locator('video')).toHaveJSProperty('paused', true);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `test-results/kernl-${viewport.width}.png`,
      fullPage: true,
    });
  });
}

test('film plays, pauses, respects user pause, and responds to visibility', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./');
  const video = page.locator('video');
  await expect(video).toHaveJSProperty('paused', false);
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime)
    )
    .toBeGreaterThan(0);
  await expect(video).toHaveJSProperty('duration', 38);
  await page.getByRole('button', { name: 'Pause runtime film' }).click();
  const pausedAt = await video.evaluate(
    (element: HTMLVideoElement) => element.currentTime
  );
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.locator('.hero').scrollIntoViewIfNeeded();
  await expect(video).toHaveJSProperty('paused', true);
  expect(
    await video.evaluate((element: HTMLVideoElement) => element.currentTime)
  ).toBe(pausedAt);
  await page.getByRole('button', { name: 'Play runtime film' }).click();
  await expect(video).toHaveJSProperty('paused', false);
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect(video).toHaveJSProperty('paused', true);
  await page.locator('.hero').scrollIntoViewIfNeeded();
  await expect(video).toHaveJSProperty('paused', false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(video).toHaveJSProperty('paused', true);
  await page.getByRole('button', { name: 'Play runtime film' }).click();
  await expect(video).toHaveJSProperty('paused', false);
});

test('all local destinations and media resolve in the shipped artifact', async ({
  page,
  request,
}) => {
  await page.goto('./');
  await expect(
    page.getByRole('link', { name: 'Meet bench' })
  ).toHaveAttribute('href', 'paja/');
  for (const href of [
    'https://github.com/kernlize/web',
    'https://npmjs.com/org/kernlize/',
    'https://jsr.io/@kernl',
  ]) {
    await expect(
      page.locator(`.project-identities a[href="${href}"]`)
    ).toBeVisible();
  }
  const host = await request.get('paja/');
  expect(await host.text()).toContain(
    '<title>bench — developer runtime</title>'
  );
  const captions = await request.get('assets/runtime-film.vtt');
  expect(await captions.text()).toContain('00:32.000 --> 00:38.000');
  expect(await captions.text()).toContain('Build bench from kernl');
  const urls = await page
    .locator('a[href], video source, video track, link[rel="icon"]')
    .evaluateAll((elements) =>
      [
        ...new Set(
          elements.map(
            (element) =>
              element.getAttribute('href') ?? element.getAttribute('src')
          )
        ),
      ].filter(
        (value): value is string =>
          !!value && !value.startsWith('#') && !value.startsWith('https:')
      )
    );
  for (const url of urls) {
    const response = await request.get(url);
    expect(response.ok(), url).toBe(true);
    if (url.endsWith('.mp4'))
      expect(response.headers()['content-type']).toBe('video/mp4');
    if (url.endsWith('.vtt'))
      expect(response.headers()['content-type']).toContain('text/vtt');
  }
});

test('no JavaScript retains content, destinations, poster and native video controls', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4177/web/');
  await expect(page.locator('h1')).toContainText('Your runtime.');
  await expect(page.locator('video')).toHaveAttribute('controls', '');
  await expect(page.locator('video source')).toHaveAttribute(
    'src',
    'assets/runtime-film.mp4'
  );
  await expect(page.locator('video')).toHaveAttribute(
    'poster',
    'assets/runtime-poster.jpg'
  );
  await expect(page.locator('.film-toggle')).toBeHidden();
  await context.close();
});

test('keyboard access and expanded player retain native controls and captions', async ({
  page,
}) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' })
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Expand runtime film' }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.tagName))
    .toBe('VIDEO');
  await expect(page.locator('video')).toHaveJSProperty('controls', true);
  await expect(page.locator('track')).toHaveAttribute('srclang', 'en');
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator('video')).toHaveJSProperty('controls', false);
});
