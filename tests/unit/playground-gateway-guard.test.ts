import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const playgroundNapplets = [
  'bot',
  'chat',
  'composer',
  'cvm-relatr',
  'feed',
  'preferences',
  'profile-viewer',
  'resource-demo',
  'toaster',
] as const;

const disabledDemoNapplets = [
  'ble-demo',
  'common-demo',
  'link-demo',
  'lists-demo',
  'serial-demo',
  'webrtc-demo',
] as const;

const expectedRequires: Record<(typeof playgroundNapplets)[number], readonly string[]> = {
  bot: ['inc', 'storage', 'theme'],
  chat: ['inc', 'storage', 'relay', 'theme'],
  composer: ['relay', 'theme'],
  'cvm-relatr': ['cvm', 'theme'],
  feed: ['identity', 'relay', 'inc', 'theme'],
  preferences: ['storage', 'theme'],
  'profile-viewer': ['inc', 'relay', 'theme'],
  'resource-demo': ['resource', 'theme'],
  toaster: ['notify', 'theme'],
};

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('playground gateway artifact guard', () => {
  it('keeps fake demo sources retained but out of the active playground registry', () => {
    const definitions = readRepoFile('apps/playground/src/demo-definitions.ts');

    for (const name of disabledDemoNapplets) {
      expect(existsSync(join(process.cwd(), 'apps/playground/napplets', name)), `${name} source`).toBe(true);
      expect(definitions, `${name} retained list`).toContain(`'${name}'`);
      expect(definitions, `${name} not hosted`).not.toContain(`name: '${name}'`);
      expect(definitions, `${name} no frame container`).not.toContain(`${name}-frame-container`);
    }
  });

  it('keeps every playground napplet on the shared single-file build config', () => {
    for (const name of playgroundNapplets) {
      const config = readRepoFile(`apps/playground/napplets/${name}/vite.config.ts`);
      expect(config, `${name} import`).toContain(
        "import { definePlaygroundNappletConfig } from '../shared-vite-config';",
      );
      const expectedRequiresLiteral = expectedRequires[name]
        .map((capability) => `'${capability}'`)
        .join(', ');
      // profile-viewer also declares the NAAT archetype axis (Phase 87, ARCH-03):
      // it carries an additional `archetypes` option after `requires`.
      const expectedConfig =
        name === 'profile-viewer'
          ? `export default definePlaygroundNappletConfig('${name}', { requires: [${expectedRequiresLiteral}], archetypes: [{ slug: 'profile', nap: 'NAP-1' }] });`
          : `export default definePlaygroundNappletConfig('${name}', { requires: [${expectedRequiresLiteral}] });`;
      expect(config, `${name} d tag/requires`).toContain(expectedConfig);
    }

    const sharedConfig = readRepoFile('apps/playground/napplets/shared-vite-config.ts');
    expect(sharedConfig).toContain('playgroundSingleFileArtifact(archetypes)');
    expect(sharedConfig).toContain("artifactMode: 'external-assets'");
    expect(sharedConfig).toContain('assertSingleFileArtifact(inlinedHtml, distPath)');
    expect(sharedConfig).toContain('recomputeManifest(distPath, inlinedHtml, archetypes)');
    expect(sharedConfig).toContain('requires?: readonly string[]');
    expect(sharedConfig).toContain('manifest requires must use short NAP names');
    expect(sharedConfig).toContain('requires,');
  });

  it('loads napplets by content-addressed resolution into opaque-origin srcdoc iframes', () => {
    const shellHost = readRepoFile('apps/playground/src/shell-host.ts');
    const indexHtml = readRepoFile('apps/playground/index.html');
    const main = readRepoFile('apps/playground/src/main.ts');
    const preferences = readRepoFile('apps/playground/src/main-preferences.ts');

    expect(shellHost).toContain('function playgroundPath(');
    expect(shellHost).toContain('import.meta.env.BASE_URL');
    expect(shellHost).not.toContain('meta.env?.BASE_URL');

    // Loader resolves + verifies content-addressed bytes, then renders via srcdoc.
    expect(shellHost).toContain('resolvePlaygroundNapplet({');
    expect(shellHost).toContain('iframe.srcdoc = injectNappletNamespacePrelude(');
    expect(shellHost).toContain('injectCspMeta(resolved.indexHtml, origins)');
    expect(shellHost).toContain("iframe.sandbox.add('allow-scripts')");
    expect(shellHost).not.toContain('allow-same-origin');

    // The gateway is no longer in the trust path: no gateway metadata fetch and
    // no iframe.src navigation in the loader.
    expect(shellHost).not.toContain('iframe.src = metadata.htmlUrl');
    expect(shellHost).not.toContain('fetchGatewayMetadata');
    expect(shellHost).not.toContain('napplet-gateway');

    expect(indexHtml).toContain('id="static-demo-banner"');
    expect(preferences).toContain("export const STATIC_PAGES_BASE_PATH = '/web/playground/';");
    expect(main).toContain("document.getElementById('static-demo-banner')?.removeAttribute('hidden')");
  });

  it('resolves via the relay + Blossom simulation and checks requires before rendering', () => {
    const viteConfig = readRepoFile('apps/playground/vite.config.ts');
    const shellHost = readRepoFile('apps/playground/src/shell-host.ts');
    const resolver = readRepoFile('apps/playground/src/napplet-resolver.ts');

    // In-repo relay + Blossom simulation endpoints.
    expect(viteConfig).toContain("server.middlewares.use('/napplet-relay'");
    expect(viteConfig).toContain("server.middlewares.use('/napplet-blossom'");
    expect(viteConfig).toContain('serveResolutionSimPlugin()');
    expect(viteConfig).toContain('PLAYGROUND_BASE_PATH');
    expect(viteConfig).toContain('base: playgroundBasePath');

    // Resolver enforces signature/aggregate/blob verification via @kehto/nip.
    expect(resolver).toContain("from '@kehto/nip/5d'");
    expect(resolver).toContain("from '@kehto/nip/65'");
    expect(resolver).toContain('resolveNapplet(');
    expect(resolver).toContain('selectWriteRelays(');
    expect(resolver).toContain('injectCspMeta');
    expect(shellHost).toContain('injectNappletNamespacePrelude');
    expect(shellHost).toContain('getShellCapabilities()?.domains');

    // requires checked against the COMPUTED manifest before the iframe renders.
    expect(shellHost).toContain('getMissingRequiredNaps(resolved.requires)');
    expect(shellHost).toContain('requires unsupported NAP capabilities');
    expect(shellHost.indexOf('getMissingRequiredNaps(resolved.requires)')).toBeLessThan(
      shellHost.indexOf('iframe.srcdoc = injectNappletNamespacePrelude'),
    );
    expect(shellHost.indexOf('getShellCapabilities()?.domains')).toBeLessThan(
      shellHost.indexOf('iframe.srcdoc = injectNappletNamespacePrelude'),
    );
  });

  it('shows relay runtime activity instead of NIP-66 fixture suggestions', () => {
    const indexHtml = readRepoFile('apps/playground/index.html');
    const main = readRepoFile('apps/playground/src/main.ts');
    const notifications = readRepoFile('apps/playground/src/main-notifications.ts');
    const demoHooks = readRepoFile('apps/playground/src/demo-hooks.ts');
    const relayService = readRepoFile('apps/playground/src/playground-relay-service.ts');

    expect(indexHtml).toContain('id="relay-activity-panel"');
    expect(indexHtml).toContain('id="relay-activity-list"');
    expect(indexHtml).toContain('relay activity');
    expect(indexHtml).toContain('no relay activity yet');
    expect(indexHtml).not.toContain('nip-66 relay suggestions');
    expect(indexHtml).not.toContain('id="nip66-suggestions-list"');

    expect(main).toContain('getPlaygroundRelayActivity');
    expect(main).toContain('initRelayActivityPanel(getPlaygroundRelayActivity)');
    expect(main).not.toContain('initNip66Suggestions');
    expect(notifications).toContain("document.getElementById('relay-activity-list')");
    expect(notifications).toContain('formatRelayActivityStats');
    expect(demoHooks).toContain('getPlaygroundRelayActivity');
    expect(relayService).toContain('getRelayActivity(limit?: number): PlaygroundRelayActivityEntry[]');
    expect(relayService).toContain('eventsReceived');
  });

  it('keeps the feed napplet identity-bound, following-scoped, and unseeded', () => {
    const feedSource = readRepoFile('apps/playground/napplets/feed/src/main.ts');
    const feedStore = readRepoFile('apps/playground/napplets/feed/src/feed-store.ts');
    const feedHtml = readRepoFile('apps/playground/napplets/feed/index.html');
    const demoHooks = readRepoFile('apps/playground/src/demo-hooks.ts');
    const workerRelay = readRepoFile('apps/playground/src/playground-worker-relay.ts');

    expect(feedSource).toContain("import { identityGetPublicKey, identityOnChanged } from '@napplet/nap/identity/sdk';");
    expect(feedSource).toContain("import { incEmit } from '@napplet/nap/inc/sdk';");
    expect(feedSource).toContain("import { getMissingNapDomains } from '../../domain-availability';");
    expect(feedSource).toContain("import { createFeedStore, type FeedProfile } from './feed-store.js';");
    expect(feedSource).toContain("import { createFeedIdentityEventController } from './feed-identity-events.js';");
    expect(feedSource).toContain("const REQUIRED_NAPS = ['identity', 'relay', 'inc', 'theme'] as const;");
    expect(feedSource).toContain('getMissingNapDomains(REQUIRED_NAPS)');
    expect(feedSource).not.toContain('shell.supports');
    expect(feedSource).toContain('readPublicKey: identityGetPublicKey');
    expect(feedSource).toContain('subscribeToChanges: identityOnChanged');
    expect(feedSource).toContain('identityController.start();');
    expect(feedSource).toContain("setStatus('not logged in', 'red');");
    expect(existsSync('apps/playground/napplets/feed/src/feed-identity-controller.ts')).toBe(false);
    expect(feedSource).not.toContain('Welcome to the kehto demo');
    expect(feedStore).toContain("import { relaySubscribe } from '@napplet/nap/relay/sdk';");
    expect(feedStore).toContain('[{ kinds: [3], authors: [pubkey] }]');
    expect(feedStore).toContain('return { kinds: [1], authors: pubkeys };');
    expect(feedStore).toContain('[{ ...filter, limit: 50 }]');
    expect(feedStore).toContain('[{ ...filter, since: Math.floor(Date.now() / 1000) }]');
    expect(feedStore).toContain('[{ kinds: [0], authors: [pubkey], limit: 1 }]');
    expect(feedStore).toContain('state.profiles.set(pubkey, profile);');
    expect(feedSource).toContain("img.src = picture;");
    expect(feedSource).toContain("button.className = 'feed-item-author feed-profile-button feed-profile-name-button';");
    expect(feedSource).toContain("timeEl.className = 'feed-item-time';");
    expect(feedSource).toContain('formatPublishedAgo(event.created_at)');
    expect(feedSource).toContain("incEmit('profile:open', [], JSON.stringify({ pubkey: normalized }));");
    expect(feedSource).toContain('renderProfileAvatarButton(event.pubkey, authorName, profile)');
    expect(feedSource).toContain('renderAuthorButton(event.pubkey, authorName)');
    expect(feedSource).not.toContain("pubkeyEl.className = 'feed-item-pubkey';");
    expect(feedHtml).toContain('.feed-item-avatar');
    expect(feedHtml).toContain('.feed-item-author');
    expect(feedHtml).toContain('.feed-item-time');
    expect(feedHtml).toContain('.feed-profile-button');
    expect(feedHtml).not.toContain('.feed-item-pubkey');
    expect(feedStore).not.toContain('authors: [pubkey], limit: 50');
    expect(feedStore).not.toContain('authors: [pubkey], since:');

    expect(demoHooks).toContain('createPlaygroundWorkerRelayBundle()');
    expect(demoHooks).not.toContain('PLAYGROUND_RELAY_SEED_EVENTS');
    expect(workerRelay).toContain("databasePath: 'kehto-playground-relay-live.db'");
    expect(workerRelay).not.toContain('seedEvents');
    expect(existsSync('apps/playground/src/mock-relay-pool.ts')).toBe(false);
  });

  it('keeps profile-viewer on the NAP-01 profile-open flow', () => {
    const profileSource = readRepoFile('apps/playground/napplets/profile-viewer/src/main.ts');
    const profileHtml = readRepoFile('apps/playground/napplets/profile-viewer/index.html');

    expect(profileSource).toContain("import { incOn } from '@napplet/nap/inc/sdk';");
    expect(profileSource).toContain("import { relaySubscribe } from '@napplet/nap/relay/sdk';");
    expect(profileSource).toContain("import { getMissingNapDomains } from '../../domain-availability';");
    expect(profileSource).toContain("const REQUIRED_NAPS = ['inc', 'relay', 'theme'] as const;");
    expect(profileSource).toContain('getMissingNapDomains(REQUIRED_NAPS)');
    expect(profileSource).not.toContain('shell.supports');
    expect(profileSource).toContain('const CAPABILITY_WAIT_MS = 5_000;');
    expect(profileSource).toContain("formatError(err, 'inc or relay unavailable')");
    expect(profileSource).toContain("incOn('profile:open'");
    expect(profileSource).toContain('[{ kinds: [0], authors: [pubkey], limit: 1 }]');
    expect(profileSource).toContain('normalizePubkey');
    expect(profileSource).not.toContain('identityGetProfile');
    expect(profileSource).not.toContain('identityGetPublicKey');
    expect(profileHtml).toContain('id="profile-picture"');
    expect(profileHtml).toContain('id="profile-details"');
    expect(profileSource).toContain('Select a profile from the feed.');
  });

  it('keeps host theme-switcher controls in theme-switcher-host.ts with no sandbox postMessage seam', () => {
    const themeHost = readRepoFile('apps/playground/src/theme-switcher-host.ts');
    const main = readRepoFile('apps/playground/src/main.ts');

    // Core DOM element IDs expected by e2e specs
    expect(themeHost).toContain("'theme-light-btn'");
    expect(themeHost).toContain("'theme-dark-btn'");
    expect(themeHost).toContain("'theme-discover-btn'");
    expect(themeHost).toContain("'theme-show-wot'");
    expect(themeHost).toContain("'theme-show-global'");
    expect(themeHost).toContain("'playground-host-theme-status'");
    expect(themeHost).toContain("'playground-host-theme-catalog'");

    // Discovery row must declare discovery-row class for layout
    expect(themeHost).toContain('theme-row theme-row-wrap theme-discovery-row');

    // Status element must support tooltip via title attribute
    expect(themeHost).toContain('statusEl.title = text;');

    // No debug toggle / log artifacts
    expect(themeHost).not.toContain('theme-debug-toggle');
    expect(themeHost).not.toContain('theme-log');

    // Theme application must route through applyTheme (host path) — no raw postMessage
    expect(themeHost).toContain('options.applyTheme(');
    expect(themeHost).not.toContain("postMessage({ type: 'theme.set'");
    expect(themeHost).not.toContain("window.parent.postMessage");

    // main.ts must wire initThemeSwitcherHost and drop the theme.set listener
    expect(main).toContain('initThemeSwitcherHost(');
    expect(main).toContain('buildHostRelaySubscribe(');
    expect(main).not.toContain("data.type !== 'theme.set'");
    expect(main).not.toContain("data.type === 'theme.set'");
  });

  it('keeps the GitHub Pages publisher aligned with the static gateway artifact contract', () => {
    const workflow = readRepoFile('.github/workflows/playground-pages.yml');
    const script = readRepoFile('scripts/build-playground-pages.mjs');
    const pajaScript = readRepoFile('scripts/build-paja-pages.mjs');
    const pagesScript = readRepoFile('scripts/build-pages.mjs');
    const pagesServeScript = readRepoFile('scripts/serve-pages.mjs');
    const pagesAudit = readRepoFile('scripts/audit-pages-artifact.mjs');
    const siteDevConfig = readRepoFile('web/vite.config.mjs');
    const turbo = readRepoFile('turbo.json');
    const packageJson = JSON.parse(readRepoFile('package.json')) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const gitignore = readRepoFile('.gitignore');
    const resourceDemo = readRepoFile('apps/playground/napplets/resource-demo/src/main.ts');

    expect(packageJson.scripts?.['build:playground-pages']).toBe('pnpm site:build:playground-pages');
    expect(packageJson.scripts?.['build:pages']).toBe('pnpm site:build:pages');
    expect(packageJson.scripts?.['audit:pages']).toBe('pnpm site:audit');
    expect(packageJson.scripts?.dev).toBeUndefined();
    expect(packageJson.scripts?.preview).toBeUndefined();
    expect(packageJson.scripts?.['site:audit']).toBe('node scripts/audit-pages-artifact.mjs');
    expect(packageJson.scripts?.['site:build']).toBe('pnpm site:build:playground && pnpm site:build:paja && pnpm site:build:docs && pnpm site:build:pages');
    expect(packageJson.scripts?.['site:build:docs']).toBe('VITEPRESS_BASE=/web/docs/ pnpm docs:check');
    expect(packageJson.scripts?.['site:build:paja']).toBe('pnpm --filter @kehto/paja build');
    expect(packageJson.scripts?.['site:build:pages']).toBe('node scripts/build-pages.mjs');
    expect(packageJson.scripts?.['site:build:playground']).toBe('PLAYGROUND_BASE_PATH=/web/playground/ pnpm --filter @kehto/playground build');
    expect(packageJson.scripts?.['site:build:playground-pages']).toBe('node scripts/build-playground-pages.mjs');
    expect(packageJson.scripts?.['site:dev']).toBe(
      'pnpm --filter @kehto/playground exec vite ../../web --host 127.0.0.1 --port 5175 --base /web/',
    );
    expect(packageJson.scripts?.['site:preview']).toBe('pnpm site:build && pnpm site:serve');
    expect(packageJson.scripts?.['site:serve']).toBe('node scripts/serve-pages.mjs');
    expect(packageJson.scripts?.['web:build']).toBeUndefined();
    expect(packageJson.scripts?.['web:dev']).toBeUndefined();
    expect(packageJson.scripts?.['web:preview']).toBeUndefined();
    expect(packageJson.scripts?.['web:serve']).toBeUndefined();
    expect(packageJson.dependencies?.gsap).toMatch(/^\^3\./);
    expect(gitignore).toContain('.pages/');

    expect(workflow).toContain('actions/configure-pages@v5');
    expect(workflow).toContain('actions/upload-pages-artifact@v4');
    expect(workflow).toContain('actions/deploy-pages@v4');
    expect(workflow).toContain('PLAYGROUND_BASE_PATH: /web/playground/');
    expect(workflow).toContain('VITEPRESS_BASE: /web/docs/');
    expect(workflow).toContain('pnpm --filter @kehto/playground build');
    expect(workflow).toContain('pnpm --filter @kehto/paja build');
    expect(workflow).toContain('pnpm docs:check');
    expect(workflow).toContain('pnpm build:pages');
    expect(workflow).toContain('pnpm audit:pages');
    expect(workflow).toContain('path: .pages');
    expect(workflow).not.toContain('github.event.repository.name');

    expect(script).toContain('/web/playground/napplet-gateway/<dTag>/manifest.json');
    expect(script).toContain('/web/playground/napplet-gateway/<dTag>/<aggregateHash>/index.html');
    expect(script).toContain('PLAYGROUND_BASE_PATH');
    expect(script).toContain("'.pages/playground'");
    expect(script).toContain("'/web/playground/'");
    expect(script).toContain('htmlUrl: withPagesBasePath(');
    expect(script).toContain('cpSync(sourceHtmlPath, htmlRoute)');

    // Clean break: the static export also materializes the content-addressed
    // resolution routes (relays -> Blossom) the srcdoc loader uses.
    expect(script).toContain('materializeResolutionRoutes(');
    expect(script).toContain("join(outputDir, 'napplet-relay', 'event')");
    expect(script).toContain("join(outputDir, 'napplet-blossom')");
    expect(script).toContain('materializeRelayList(');

    expect(pajaScript).toContain('.pages/paja');
    expect(pajaScript).toContain('createPajaRuntimeHostConfig');
    expect(pajaScript).toContain("join(outputDir, '__kehto', 'browser-host.js')");
    expect(pajaScript).toContain('renderPajaHtml(hostConfig)');

    expect(pagesScript).toContain("'docs', '.vitepress', 'dist'");
    expect(pagesScript).toContain("join(repoRoot, 'web', 'assets')");
    expect(pagesScript).toContain("join(repoRoot, 'node_modules', 'gsap', 'dist', 'gsap.min.js')");
    expect(pagesScript).toContain("join(outputRoot, 'assets')");
    expect(pagesScript).toContain("join(portalAssetsOutput, 'vendor')");
    expect(pagesScript).toContain("join(outputRoot, 'docs')");
    expect(pagesScript).toContain("join(outputRoot, 'paja')");
    expect(pagesScript).toContain('build-paja-pages.mjs');
    expect(pagesScript).toContain("join(docsOutput, 'api')");
    expect(pagesServeScript).toContain("const publicBase = '/web/';");
    expect(pagesServeScript).toContain('artifactPathFromRequest');
    expect(pagesServeScript).toContain('Run pnpm site:build first.');
    expect(pagesServeScript).toContain('Kehto web preview:');
    expect(siteDevConfig).toContain('/web/assets/vendor/gsap.min.js');
    expect(siteDevConfig).toContain("join(repoRoot, 'node_modules', 'gsap', 'dist', 'gsap.min.js')");
    expect(siteDevConfig).toContain("name: 'kehto-site-dev-vendor'");
    expect(pagesAudit).toContain("const PORTAL_GSAP_VENDOR = 'assets/vendor/gsap.min.js';");
    expect(pagesAudit).toContain("const PORTAL_LANDING_CSS = 'assets/landing.css';");
    expect(pagesAudit).toContain("const PORTAL_LANDING_JS = 'assets/landing.js';");
    expect(pagesAudit).toContain("join(outputRoot, 'assets', 'landing.css')");
    expect(pagesAudit).toContain("join(outputRoot, 'assets', 'landing.js')");
    expect(pagesAudit).toContain("join(outputRoot, 'assets', 'vendor', 'gsap.min.js')");
    expect(pagesAudit).toContain("const PLAYGROUND_BASE = '/web/playground/';");
    expect(pagesAudit).toContain("const PAJA_BASE = '/web/paja/';");
    expect(pagesAudit).toContain("const DOCS_BASE = '/web/docs/';");
    expect(pagesAudit).toContain('artifactPathFromPublicPath(PAJA_BASE)');
    expect(pagesAudit).toContain("join(pajaRoot, 'index.html')");
    expect(pagesAudit).toContain("join(pajaRoot, '__kehto', 'browser-host.js')");
    expect(pagesAudit).toContain('artifactPathFromPublicPath(htmlUrl)');
    expect(pagesAudit).toContain("join(outputRoot, 'index.html')");
    expect(pagesAudit).toContain("join(outputRoot, 'docs', 'api', 'modules', '_kehto_shell.html')");
    expect(turbo).toContain('"VITEPRESS_BASE"');

    expect(resourceDemo).toContain('REMOTE_IMAGE_URL');
    expect(resourceDemo).toContain('resource.bytesMany');
    expect(resourceDemo).toContain('loaded remote images');
    expect(resourceDemo).toContain('bulk loaded');
    expect(resourceDemo).toContain('currentObjectUrl');
    expect(resourceDemo).not.toContain('resource-demo-granted');
    expect(resourceDemo).not.toContain('resource-demo-denied');
  });

  it('keeps the public portal on the branded static asset contract', () => {
    const portal = readRepoFile('web/index.html');
    const stylesheet = readRepoFile('web/assets/landing.css');
    const script = readRepoFile('web/assets/landing.js');

    expect(portal).toContain('href="assets/landing.css"');
    expect(portal).toContain('src="assets/vendor/gsap.min.js"');
    expect(portal).toContain('src="assets/landing.js"');
    expect(portal).toContain('id="hairline-accent"');
    expect(portal).toContain('<title>Kehto Web Runtime</title>');
    expect(portal).toContain('aria-label="Kehto Web Runtime"');
    expect(portal).toContain('<span class="wordmark-role">Web Runtime</span>');
    expect(portal).toContain('href="playground/"');
    expect(portal).toContain('href="paja/"');
    expect(portal).toContain('href="docs/"');
    expect(portal).toContain('Paja Runtime');
    expect(portal).toContain('data-route-link');
    expect(portal).toContain('class="wordmark"');
    expect(portal).toContain('NIP-5D is under development and may be subject to change.');
    expect(portal).toContain('Contained runtime for experimental Nostr apps');
    expect(portal).toContain('A contained home for experimental Nostr apps.');

    expect(stylesheet).toContain('--bg: #020201');
    expect(stylesheet).toContain('--accent: #f4c539');
    expect(stylesheet).toContain('--font-brand: Optima');
    expect(stylesheet).toContain('--font-copy: "Avenir Next"');
    expect(stylesheet).toContain('--font-mono: Iosevka');
    expect(stylesheet).toContain('.hairline-accent');
    expect(stylesheet).toContain('.wordmark-name::after');
    expect(stylesheet).toContain('font-family: var(--font-brand)');
    expect(stylesheet).not.toContain('font-family: "Baskerville"');
    expect(stylesheet).toContain('@media (max-width: 780px)');
    expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)');
    expect(script).toContain('window.gsap');
    expect(script).toContain('setupContourAccent');
    expect(script).toContain('createContourBodies');
    expect(script).toContain('createPointerState');
    expect(script).toContain('drawContourFrame');
    expect(script).toContain('drawContourLines');
    expect(script).toContain('drawContourLevel');
    expect(script).toContain('sampleContourField');
    expect(script).toContain('samplePointerWake');
    expect(script).toContain('samplePassivePulse');
    expect(script).toContain('sampleActivePulse');
    expect(script).toContain('triggerContourPulse');
    expect(script).toContain('lineSpacing');
    expect(script).toContain('sampleStep');
    expect(script).toContain('quadraticCurveTo');
    expect(script).not.toContain('interpolateContourPoint');
    expect(script).not.toContain('contourSegments');
    expect(script).not.toContain('createRadialGradient');
    expect(script).not.toContain("globalCompositeOperation = 'lighter'");
    expect(script).not.toContain('context.filter');
    expect(script).toContain('phaseTween');
    expect(script).toContain('function updatePointerInertia');
    expect(script).toContain('pointer.targetPressure');
    expect(script).toContain('pointer.targetVelocityX');
    expect(script).toContain('pointer.targetVelocityY');
    expect(script).toContain('event.timeStamp');
    expect(script).toContain("root.dataset.motion === 'ready'");
    expect(script).toContain("link.addEventListener('pointerenter', onRoutePulse");
    expect(script).toContain("link.addEventListener('focus', onRoutePulse");
    expect(script).toContain('while (y < height * 1.18)');
    expect(script).toContain('duration: 46');
    expect(script).toContain('requestAnimationFrame(tickContours)');
    expect(script).toContain('cancelAnimationFrame(animationFrameId)');
    expect(script).toContain("canvas.getContext('2d'");
    expect(script).toContain('gsapApi.ticker.add');
    expect(script).toContain('function isHistoryRestore');
    expect(script).toContain("entry.type === 'back_forward'");
    expect(script).toContain("document.body.classList.remove('is-leaving')");
    expect(script).toContain("window.addEventListener('pageshow', onPageShow)");
    expect(script).toContain('gsapInstance.matchMedia()');
    expect(script).toContain("'(prefers-reduced-motion: reduce)'");
    expect(script).toContain("'(prefers-reduced-motion: no-preference)'");
    expect(script).toContain('data-route-link');
    expect(script).toContain('window.location.href = anchor.href');
  });
});
