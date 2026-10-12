import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('scripts/kernl-film/captures');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto(
    process.env.KERNL_CAPTURE_URL || 'http://127.0.0.1:4175/web/paja/'
  );
  await page.locator('#runtime-local-file').setInputFiles({
    name: 'little-space.html',
    mimeType: 'text/html',
    buffer: await readFile('scripts/kernl-film/napplet.html'),
  });
  const app = page.frameLocator('iframe').first();
  await app.locator('#state').filter({ hasText: 'Connected' }).waitFor();
  await page.screenshot({ path: resolve(output, 'runtime.png') });
  await app.locator('#theme').click();
  await app.locator('#state').filter({ hasText: 'Theme received' }).waitFor();
  await page.screenshot({ path: resolve(output, 'theme.png') });
  const proof = await page.evaluate(() => {
    const state = window.__KEHTO_PAJA__.getState();
    return {
      status: state.status,
      tabs: state.tabs,
      messages: state.messageLog.map((entry) => entry.type),
    };
  });
  if (
    !proof.messages.includes('shell.init') ||
    !proof.messages.includes('theme.get.result')
  )
    throw new Error('Missing real runtime proof');
  await writeFile(
    resolve(output, 'proof.json'),
    `${JSON.stringify(proof, null, 2)}\n`
  );
  console.log('Captured real Paja runtime and theme response.');
} finally {
  await browser.close();
}
