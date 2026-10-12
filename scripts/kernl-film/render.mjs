import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const encoder = spawn(
  'ffmpeg',
  [
    '-y',
    '-f',
    'image2pipe',
    '-vcodec',
    'png',
    '-framerate',
    '24',
    '-i',
    '-',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    'web/assets/runtime-film.mp4',
  ],
  { stdio: ['pipe', 'ignore', 'inherit'] }
);
const encoded = once(encoder, 'close');
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(resolve('scripts/kernl-film/scene.html')).href);
  await page.evaluate(() => window.assetsReady);
  await page.evaluate(() => window.renderFrame(4));
  await page.screenshot({
    path: 'web/assets/runtime-poster.jpg',
    type: 'jpeg',
    quality: 90,
  });
  for (let frame = 0; frame < 24 * 24; frame++) {
    await page.evaluate((t) => window.renderFrame(t), frame / 24);
    const bytes = await page.screenshot({ type: 'png' });
    if (!encoder.stdin.write(bytes)) await once(encoder.stdin, 'drain');
    if (frame % 120 === 0) console.log(`Rendered ${frame}/576 frames`);
  }
  encoder.stdin.end();
  const [code] = await encoded;
  if (code !== 0) throw new Error(`ffmpeg exited ${code}`);
  await writeFile(
    'web/assets/runtime-film.vtt',
    `WEBVTT\n\n00:00.000 --> 00:06.000\nStart with a kernl. Compose runtime, permissions, services, and your shell.\n\n00:06.000 --> 00:11.000\nConnect your host with createShellBridge(adapter).\n\n00:11.000 --> 00:16.000\nRegister a theme service. App requests pass through capability checks.\n\n00:16.000 --> 00:21.000\nA real Paja runtime connects the sandboxed app and returns its host theme.\n\n00:21.000 --> 00:24.000\nYour runtime. Your rules. Build with kernl.\n`
  );
} finally {
  encoder.stdin.destroy();
  if (encoder.exitCode === null) encoder.kill();
  await browser.close();
}
