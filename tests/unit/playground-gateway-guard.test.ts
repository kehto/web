import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const playgroundNapplets = [
  'bot',
  'chat',
  'composer',
  'config-demo',
  'decrypt-demo',
  'feed',
  'hotkey-chord',
  'media-controller',
  'preferences',
  'profile-viewer',
  'resource-demo',
  'theme-switcher',
  'toaster',
] as const;

const expectedRequires: Record<(typeof playgroundNapplets)[number], readonly string[]> = {
  bot: ['ifc', 'storage', 'theme'],
  chat: ['ifc', 'storage', 'relay', 'theme'],
  composer: ['relay', 'theme'],
  'config-demo': ['config', 'theme'],
  'decrypt-demo': ['identity', 'theme'],
  feed: ['identity', 'relay', 'ifc', 'theme'],
  'hotkey-chord': ['keys', 'theme'],
  'media-controller': ['media', 'theme'],
  preferences: ['storage', 'theme'],
  'profile-viewer': ['ifc', 'relay', 'theme'],
  'resource-demo': ['resource', 'connect', 'theme'],
  'theme-switcher': ['identity', 'relay', 'theme'],
  toaster: ['notify', 'theme'],
};

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('playground gateway artifact guard', () => {
  it('keeps every playground napplet on the shared single-file build config', () => {
    for (const name of playgroundNapplets) {
      const config = readRepoFile(`apps/playground/napplets/${name}/vite.config.ts`);
      expect(config, `${name} import`).toContain(
        "import { definePlaygroundNappletConfig } from '../shared-vite-config';",
      );
      const expectedRequiresLiteral = expectedRequires[name]
        .map((capability) => `'${capability}'`)
        .join(', ');
      expect(config, `${name} d tag/requires`).toContain(
        `export default definePlaygroundNappletConfig('${name}', { requires: [${expectedRequiresLiteral}] });`,
      );
    }

    const sharedConfig = readRepoFile('apps/playground/napplets/shared-vite-config.ts');
    expect(sharedConfig).toContain('playgroundSingleFileArtifact()');
    expect(sharedConfig).toContain("artifactMode: 'external-assets'");
    expect(sharedConfig).toContain('assertSingleFileArtifact(inlinedHtml, distPath)');
    expect(sharedConfig).toContain('recomputeManifest(distPath, inlinedHtml)');
    expect(sharedConfig).toContain('requires?: readonly string[]');
    expect(sharedConfig).toContain('manifest requires must use short NAP names');
    expect(sharedConfig).toContain('requires,');
  });

  it('keeps the active loader on the gateway route with opaque-origin iframes', () => {
    const shellHost = readRepoFile('apps/playground/src/shell-host.ts');
    const indexHtml = readRepoFile('apps/playground/index.html');
    const main = readRepoFile('apps/playground/src/main.ts');
    const preferences = readRepoFile('apps/playground/src/main-preferences.ts');

    expect(shellHost).toContain('function playgroundPath(');
    expect(shellHost).toContain('import.meta.env.BASE_URL');
    expect(shellHost).not.toContain('meta.env?.BASE_URL');
    expect(shellHost).toContain('playgroundPath(`/napplet-gateway/${encodeURIComponent(name)}/manifest.json`)');
    expect(shellHost).toContain('iframe.src = metadata.htmlUrl');
    expect(shellHost).toContain("iframe.sandbox.add('allow-scripts')");
    expect(shellHost).not.toContain('allow-same-origin');
    expect(shellHost).not.toContain('`/napplets/${name}/index.html`');

    expect(indexHtml).toContain('id="static-demo-banner"');
    expect(preferences).toContain("export const STATIC_PAGES_BASE_PATH = '/web/playground/';");
    expect(main).toContain("document.getElementById('static-demo-banner')?.removeAttribute('hidden')");
    expect(main).toContain('if (isStaticPagesDemo) return;');
  });

  it('exposes manifest requires through gateway metadata and checks it before navigation', () => {
    const viteConfig = readRepoFile('apps/playground/vite.config.ts');
    const shellHost = readRepoFile('apps/playground/src/shell-host.ts');

    expect(viteConfig).toContain('requires: string[]');
    expect(viteConfig).toContain("tag[0] === 'requires'");
    expect(viteConfig).toContain('requires,');
    expect(viteConfig).toContain('PLAYGROUND_BASE_PATH');
    expect(viteConfig).toContain('base: playgroundBasePath');
    expect(viteConfig).toContain('withPlaygroundBasePath(');

    expect(shellHost).toContain('requires: string[]');
    expect(shellHost).toContain('getMissingRequiredNaps(metadata.requires)');
    expect(shellHost).toContain('requires unsupported NAP capabilities');
    expect(shellHost.indexOf('getMissingRequiredNaps(metadata.requires)')).toBeLessThan(
      shellHost.indexOf('iframe.src = metadata.htmlUrl'),
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

    expect(feedSource).toContain("import { identityGetPublicKey, identityOnChanged } from '@napplet/nub/identity/sdk';");
    expect(feedSource).toContain("import { ifcEmit } from '@napplet/nub/ifc/sdk';");
    expect(feedSource).toContain("import { createFeedStore, type FeedProfile } from './feed-store.js';");
    expect(feedSource).toContain("import { createFeedIdentityEventController } from './feed-identity-events.js';");
    expect(feedSource).toContain("const REQUIRED_NAPS = ['identity', 'relay', 'ifc', 'theme'] as const;");
    expect(feedSource).toContain("const REQUIRED_IFC_PROTOCOL = 'ifc:NAP-01';");
    expect(feedSource).toContain('supports(REQUIRED_IFC_PROTOCOL)');
    expect(feedSource).toContain('readPublicKey: identityGetPublicKey');
    expect(feedSource).toContain('subscribeToChanges: identityOnChanged');
    expect(feedSource).toContain('identityController.start();');
    expect(feedSource).toContain("setStatus('not logged in', 'red');");
    expect(existsSync('apps/playground/napplets/feed/src/feed-identity-controller.ts')).toBe(false);
    expect(feedSource).not.toContain('Welcome to the kehto demo');
    expect(feedStore).toContain("import { relaySubscribe } from '@napplet/nub/relay/sdk';");
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
    expect(feedSource).toContain("ifcEmit('profile:open', [], JSON.stringify({ pubkey: normalized }));");
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

    expect(profileSource).toContain("import { ifcOn } from '@napplet/nub/ifc/sdk';");
    expect(profileSource).toContain("import { relaySubscribe } from '@napplet/nub/relay/sdk';");
    expect(profileSource).toContain("const REQUIRED_NAPS = ['ifc', 'relay', 'theme'] as const;");
    expect(profileSource).toContain("const REQUIRED_IFC_PROTOCOL = 'ifc:NAP-01';");
    expect(profileSource).toContain("ifcOn('profile:open'");
    expect(profileSource).toContain('[{ kinds: [0], authors: [pubkey], limit: 1 }]');
    expect(profileSource).toContain('normalizePubkey');
    expect(profileSource).not.toContain('identityGetProfile');
    expect(profileSource).not.toContain('identityGetPublicKey');
    expect(profileHtml).toContain('id="profile-picture"');
    expect(profileHtml).toContain('id="profile-details"');
    expect(profileSource).toContain('Select a profile from the feed.');
  });

  it('keeps theme discovery controls visible before status text in the clipped card top row', () => {
    const themeHtml = readRepoFile('apps/playground/napplets/theme-switcher/index.html');
    const themeSource = readRepoFile('apps/playground/napplets/theme-switcher/src/main.ts');

    expect(themeHtml).toContain('class="theme-row theme-row-wrap theme-discovery-row"');
    expect(themeHtml.indexOf('id="theme-discover-btn"')).toBeLessThan(themeHtml.indexOf('id="theme-status"'));
    expect(themeHtml.indexOf('id="theme-show-wot"')).toBeLessThan(themeHtml.indexOf('id="theme-status"'));
    expect(themeHtml.indexOf('id="theme-show-global"')).toBeLessThan(themeHtml.indexOf('id="theme-status"'));
    expect(themeHtml).toContain('flex: 1 1 auto;');
    expect(themeHtml).not.toContain('id="theme-debug-toggle"');
    expect(themeHtml).not.toContain('id="theme-log"');
    expect(themeSource).toContain('statusEl.title = text;');
    expect(themeSource).not.toContain('theme-debug-toggle');
    expect(themeSource).not.toContain('theme-log');
  });

  it('keeps the GitHub Pages publisher aligned with the static gateway artifact contract', () => {
    const workflow = readRepoFile('.github/workflows/playground-pages.yml');
    const script = readRepoFile('scripts/build-playground-pages.mjs');
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
    expect(packageJson.scripts?.['site:build']).toBe('pnpm site:build:playground && pnpm site:build:docs && pnpm site:build:pages');
    expect(packageJson.scripts?.['site:build:docs']).toBe('VITEPRESS_BASE=/web/docs/ pnpm docs:check');
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

    expect(pagesScript).toContain("'docs', '.vitepress', 'dist'");
    expect(pagesScript).toContain("join(repoRoot, 'web', 'assets')");
    expect(pagesScript).toContain("join(repoRoot, 'node_modules', 'gsap', 'dist', 'gsap.min.js')");
    expect(pagesScript).toContain("join(outputRoot, 'assets')");
    expect(pagesScript).toContain("join(portalAssetsOutput, 'vendor')");
    expect(pagesScript).toContain("join(outputRoot, 'docs')");
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
    expect(pagesAudit).toContain("const DOCS_BASE = '/web/docs/';");
    expect(pagesAudit).toContain('artifactPathFromPublicPath(htmlUrl)');
    expect(pagesAudit).toContain("join(outputRoot, 'index.html')");
    expect(pagesAudit).toContain("join(outputRoot, 'docs', 'api', 'modules', '_kehto_shell.html')");
    expect(turbo).toContain('"VITEPRESS_BASE"');

    expect(resourceDemo).toContain('REMOTE_IMAGE_URL');
    expect(resourceDemo).toContain('resource.bytes');
    expect(resourceDemo).toContain('loaded remote image');
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
    expect(portal).toContain('href="docs/"');
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
