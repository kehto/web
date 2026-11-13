import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';
import { installPajaApprovalDriver } from './paja-approval-driver.js';
import { LINUX_DISTROS } from '../../packages/mocks/dist/index.js';
import { startPajaServer, type PajaServer } from '../../packages/paja/dist/index.js';

// Paja serves every NAP domain it has no backend for from @kehto/mocks. The
// napplet reaches them through window.napplet.<domain> bindings generated from
// each NAP's wire table at the ref the mock records (napplet/naps draft PRs:
// NAP-TORRENT #72 bc99787e3cf0, NAP-GIT #137 a73bf8de, NAP-SYSTEM #64
// 43a112db9d1c, NAP-CATALOG #95 1020ae53, NAP-LOCATION #125 24d2039cf2d1,
// NAP-CLASS #16 4828279800dc). The Interfaces panel marks each with ◌ + legend.

const MOCKED = ['blossom', 'capture', 'catalog', 'class', 'display', 'git', 'hashtree', 'location', 'mesh',
  'motion', 'navigation', 'nzb', 'pow', 'soulseek', 'system', 'torrent', 'value', 'worker'];

const PROBE = `<!doctype html><html><head><title>Mocked NAP probe</title>
<meta name="napplet-requires" content="shell class git system catalog location">
<meta name="napplet-optional" content="torrent">
<style>body{font:12px/1.4 ui-monospace,monospace;background:#101211;color:#f4f0df;margin:12px}h1{font-size:14px;color:#d8c36a}
li{margin:2px 0}.err{color:#e6a5a5}</style></head><body><h1>Mocked NAP probe</h1><ul id="out"></ul>
<script>
  window.__class = null;
  window.napplet.class.on('assigned', (payload) => { window.__class = payload; });
  window.runProbe = async (magnet) => {
    const out = document.getElementById('out');
    const row = (label, value, error) => {
      const li = document.createElement('li');
      li.textContent = label + ' → ' + value;
      if (error) li.className = 'err';
      out.append(li);
    };
    const report = {};
    const caps = await window.napplet.torrent.capabilities();
    report.transports = caps.transports;
    row('torrent.capabilities()', 'transports ' + caps.transports.join(', '));
    const ack = await window.napplet.torrent.add({ source: { sourceType: 'magnet', magnet }, options: { mode: 'download' } });
    report.ack = ack;
    row('torrent.add(magnet)', 'job ' + ack.jobId + ' (' + ack.state + ')');
    const jobs = await window.napplet.torrent.jobs();
    report.jobs = jobs.length;
    row('torrent.jobs()', jobs.length + ' job(s)');
    const repo = await window.napplet.git.open();
    report.repository = repo.repository;
    row('git.open()', repo.repository + ' (' + repo.objectFormat + ')');
    const naps = await window.napplet.system.naps();
    report.naps = naps.length;
    row('system.naps()', naps.length + ' NAPs reported');
    const snapshot = await window.napplet.catalog.get();
    report.catalog = snapshot.napplets.length;
    row('catalog.get()', snapshot.napplets.map((n) => n.title).join(', '));
    try {
      await window.napplet.location.current();
    } catch (error) {
      report.locationError = error.message;
      row('location.current()', 'rejected: ' + error.message, true);
    }
    report.classAssigned = window.__class;
    row('class.on("assigned")', JSON.stringify(window.__class));
    return report;
  };
</script></body></html>`;

let target: ReturnType<typeof createServer>;
let host: PajaServer;

test.beforeEach(async ({ page }) => {
  await installPajaApprovalDriver(page);
});

test.beforeAll(async () => {
  target = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html', 'access-control-allow-origin': '*' });
    response.end(PROBE);
  });
  await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
  const address = target.address();
  if (!address || typeof address === 'string') throw new Error('Target did not bind');
  host = await startPajaServer({ options: { targetUrl: `http://127.0.0.1:${address.port}`, port: 0 } });
});

test.afterAll(async () => {
  await host?.close();
  await new Promise<void>((resolve, reject) => target.close((error) => error ? reject(error) : resolve()));
});

test('marks every mocked interface with one symbol and a legend', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(host.url);
  const toggles = page.locator('#interface-toggles');
  for (const domain of MOCKED) {
    const toggle = toggles.locator(`[data-interface-domain="${domain}"]`);
    await expect(toggle).toHaveAttribute('data-mocked', 'true');
    await expect(toggle).toHaveText(`◌ ${domain}`);
    await expect(toggle).toHaveAttribute('data-enabled', 'true');
  }
  const relay = toggles.locator('[data-interface-domain="relay"]');
  await expect(relay).toHaveText('relay');
  await expect(relay).not.toHaveAttribute('data-mocked', 'true');
  await expect(page.locator('#paja-interface-legend')).toHaveText('◌ mocked: deterministic fixture data from @kehto/mocks, not a real backend.');

  const section = page.locator('#paja-section-interfaces');
  await section.screenshot({ path: testInfo.outputPath('interfaces-panel.png') });
  await testInfo.attach('interfaces-panel', { path: testInfo.outputPath('interfaces-panel.png'), contentType: 'image/png' });
});

test('a napplet calls mocked NAPs through window.napplet and receives fixture data', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(host.url);
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('h1')).toHaveText('Mocked NAP probe');
  await expect.poll(() => frame.locator('body').evaluate(() => (window as unknown as { __class: unknown }).__class)).not.toBeNull();

  const distro = LINUX_DISTROS[0]!;
  const report = await frame.locator('body').evaluate(
    (_body, magnet) => (window as unknown as { runProbe: (magnet: string) => Promise<Record<string, unknown>> }).runProbe(magnet),
    distro.magnet,
  );
  expect(report).toMatchObject({
    transports: ['webtorrent', 'bittorrent', 'auto'],
    ack: { ok: true, jobId: 'tor-1', state: 'metadata' },
    jobs: 1,
    repository: 'repo-1',
    locationError: 'denied',
    classAssigned: { class: 1 },
  });
  expect(report.naps).toBeGreaterThan(0);
  expect(report.catalog).toBeGreaterThan(0);
  await expect(page.locator('#message-log')).toContainText('torrent.add.result');

  await page.screenshot({ path: testInfo.outputPath('napplet-probe.png') });
  await testInfo.attach('napplet-probe', { path: testInfo.outputPath('napplet-probe.png'), contentType: 'image/png' });
});

test('disabling a mocked interface withdraws it from the napplet', async ({ page }) => {
  await page.goto(host.url);
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('h1')).toHaveText('Mocked NAP probe');
  await page.locator('#interface-toggles [data-interface-domain="torrent"]').click();
  await expect(page.locator('#interface-toggles [data-interface-domain="torrent"]')).toHaveAttribute('data-enabled', 'false');
  await expect(frame.locator('h1')).toHaveText('Mocked NAP probe');
  await expect.poll(() => frame.locator('body').evaluate(() => 'torrent' in ((window as unknown as { napplet: object }).napplet))).toBe(false);
  expect(await frame.locator('body').evaluate(() => typeof (window as unknown as { napplet: { git?: unknown } }).napplet.git)).toBe('object');
});
