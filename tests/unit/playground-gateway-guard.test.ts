import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyEvent } from 'nostr-tools/pure';
import {
  definePlaygroundNappletConfig,
  recomputeManifest,
  type PlaygroundNappletConfigOptions,
} from '../../apps/playground/napplets/shared-vite-config.js';

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
  feed: ['identity', 'intent', 'relay', 'resource', 'theme'],
  preferences: ['storage', 'theme'],
  'profile-viewer': ['inc', 'relay', 'resource', 'theme'],
  'resource-demo': ['resource', 'theme'],
  toaster: ['notify', 'theme'],
};

const activeHostFlowSources = Object.freeze({
  pajaCatalog: 'packages/paja/src/installed-napplet-catalog.ts',
  pajaController: 'packages/paja/src/browser-intent-controller.ts',
  playgroundCatalog: 'apps/playground/src/installed-napplet-catalog.ts',
  playgroundController: 'apps/playground/src/playground-intent-controller.ts',
  playgroundHost: 'apps/playground/src/shell-host.ts',
  intentService: 'packages/services/src/intent-service.ts',
  feed: 'apps/playground/napplets/feed/src/main.ts',
  profile: 'apps/playground/napplets/profile-viewer/src/main.ts',
  feedMedia: 'apps/playground/napplets/feed/src/profile-media.ts',
  profileMedia: 'apps/playground/napplets/profile-viewer/src/profile-media.ts',
  resourceDemo: 'apps/playground/napplets/resource-demo/src/main.ts',
  profileOpen: 'tests/e2e/profile-open.spec.ts',
  identityFlow: 'tests/e2e/identity-flow.spec.ts',
  themeBroadcast: 'tests/e2e/theme-broadcast.spec.ts',
});

const intentionalHostFlowExclusions = [
  '.planning/',
  'CHANGELOG.md',
  'tests/fixtures/napplets/',
] as const;

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('playground gateway artifact guard', () => {
  it('classifies active host-flow evidence separately from archived and deliberate invalid inputs', () => {
    const guard = readRepoFile('tests/unit/playground-gateway-guard.test.ts');
    const activeSources = ['const', 'activeHostFlowSources'].join(' ');
    const exclusions = ['const', 'intentionalHostFlowExclusions'].join(' ');

    expect(guard).toContain(activeSources);
    expect(guard).toContain(exclusions);
    expect(intentionalHostFlowExclusions).toEqual([
      '.planning/',
      'CHANGELOG.md',
      'tests/fixtures/napplets/',
    ]);
  });

  it('keeps verified catalogs separate from live frames and dispatches on the target-only path', () => {
    const source = Object.fromEntries(
      Object.entries(activeHostFlowSources).map(([name, path]) => [name, readRepoFile(path)]),
    );

    for (const [name, catalog] of [
      ['Paja', source.pajaCatalog],
      ['playground', source.playgroundCatalog],
    ] as const) {
      expect(catalog, `${name} catalog derives handlers from verified manifests`).toContain(
        'manifestToIntentCatalogEntry',
      );
      expect(catalog, `${name} catalog stores immutable records`).toContain('Object.freeze');
      expect(catalog, `${name} catalog must not store live frame authority`).not.toMatch(
        /\b(?:Window|HTMLIFrameElement|MessagePort|contentWindow)\b/,
      );
      expect(catalog, `${name} catalog must not own a simulator`).not.toContain('DEV_INTENT');
    }
    expect(source.playgroundHost).toContain('const installedNapplets = new InstalledNappletCatalog();');
    expect(source.playgroundHost).toContain('installedNapplets.install(resolved,');

    for (const controller of [source.pajaController, source.playgroundController]) {
      const ready = controller.indexOf('await this.options.waitForReady(generation);');
      const current = controller.indexOf('await this.options.isCurrent(generation)');
      const send = controller.indexOf('await this.options.send(generation, dispatch);');
      const windowId = controller.indexOf('const windowId = this.options.getWindowId(generation);');
      expect(ready).toBeGreaterThanOrEqual(0);
      expect(current).toBeGreaterThan(ready);
      expect(send).toBeGreaterThan(current);
      expect(windowId).toBeGreaterThan(send);
    }
    expect(source.intentService).toContain("type: 'intent.invoke.result'");
    expect(source.playgroundHost).toContain("type: 'inc.event'");
    expect(source.playgroundHost).not.toContain("type: 'intent.deliver'");
  });

  it('keeps published profile delivery, resource cleanup, and current theme proof in active sources', () => {
    const source = Object.fromEntries(
      Object.entries(activeHostFlowSources).map(([name, path]) => [name, readRepoFile(path)]),
    );

    expect(source.feed).toContain("archetype: 'profile'");
    expect(source.feed).toContain("convention: 'napplet:profile/open'");
    expect(source.profile).toContain("incOn('napplet:profile/open', (event: IncEvent) => {");
    expect(source.profileOpen).toContain("convention: 'napplet:profile/open'");
    expect(source.identityFlow).toContain('published NAP-INTENT target');

    for (const media of [source.feedMedia, source.profileMedia]) {
      expect(media).toContain('resourceBytes');
      expect(media).toContain('URL.createObjectURL(blob)');
      expect(media).toContain('URL.revokeObjectURL(url)');
    }
    expect(source.resourceDemo).toContain('@napplet/core@0.31.1');
    expect(source.resourceDemo).toContain('URL.createObjectURL(blob)');
    expect(source.resourceDemo).toContain('URL.revokeObjectURL(currentObjectUrl)');
    expect(source.themeBroadcast).toContain('theme.napplet?.theme?.get()');
    expect(source.themeBroadcast).toContain('changes: target.__profileThemeChanges ?? []');
    expect(source.themeBroadcast).toContain("title: 'Dark'");
  });

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
      // profile-viewer also declares one exact queryless archetype convention.
      const expectedConfig =
        name === 'profile-viewer'
          ? `export default definePlaygroundNappletConfig('${name}', { requires: [${expectedRequiresLiteral}], archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }] });`
          : `export default definePlaygroundNappletConfig('${name}', { requires: [${expectedRequiresLiteral}] });`;
      expect(config, `${name} d tag/requires`).toContain(expectedConfig);
      expect(config, `${name} no numbered archetype metadata`).not.toMatch(
        /\bnap\s*:\s*['"]NAP-[0-9]+/,
      );
    }

    const sharedConfig = readRepoFile('apps/playground/napplets/shared-vite-config.ts');
    expect(sharedConfig).toContain('playgroundSingleFileArtifact(archetypes)');
    expect(sharedConfig).toContain('modulePreload: false');
    expect(sharedConfig).toContain("artifactMode: 'external-assets'");
    expect(sharedConfig).toContain('assertSingleFileArtifact(inlinedHtml, distPath)');
    expect(sharedConfig).toContain('recomputeManifest(distPath, inlinedHtml, archetypes)');
    expect(sharedConfig).toContain('requires?: readonly string[]');
    expect(sharedConfig).toContain('manifest requires must use short NAP names');
    expect(sharedConfig).toContain('requires,');
    expect(sharedConfig).not.toContain("window.parent.postMessage({ type: 'shell.ready' }, '*');");
  });

  it('validates exact convention-bearing archetype build metadata', () => {
    expect(() => definePlaygroundNappletConfig('profile-viewer', {
      archetypes: [
        {
          slug: 'profile',
          convention: 'napplet:profile/open',
        },
        {
          slug: 'profile',
          convention: 'napplet:profile/edit',
        },
      ],
    })).not.toThrow();

    const invalid: unknown[] = [
      { slug: '', convention: 'napplet:profile/open' },
      { slug: 'Profile', convention: 'napplet:Profile/open' },
      { slug: ' profile', convention: 'napplet:profile/open' },
      { slug: 'profile ', convention: 'napplet:profile/open' },
      { slug: 'profile' },
      { slug: 'profile', convention: '' },
      { slug: 'profile', convention: ' napplet:profile/open' },
      { slug: 'profile', convention: 'napplet:profile/open ' },
      { slug: 'profile', convention: 'NAP-1' },
      { slug: 'profile', convention: 'napplet:profile/open?x=1' },
      { slug: 'profile', convention: 'napplet:profile/open#section' },
      { slug: 'profile', convention: 'napplet:note/open' },
      { slug: 'profile', convention: 'napplet:profile/open', eventKinds: [0] },
    ];
    for (const archetype of invalid) {
      const options = {
        archetypes: [archetype],
      } as unknown as PlaygroundNappletConfigOptions;
      expect(() => definePlaygroundNappletConfig('invalid', options)).toThrow();
    }
  });

  it('recomputes a signed final manifest with repeated scoped convention tags and path-only aggregate identity', () => {
    const firstDir = mkdtempSync(join(tmpdir(), 'kehto-profile-manifest-'));
    const secondDir = mkdtempSync(join(tmpdir(), 'kehto-profile-manifest-'));
    const seed = (dir: string): void => {
      writeFileSync(join(dir, '.nip5a-manifest.json'), JSON.stringify({
        created_at: 1_700_000_000,
        content: '',
        tags: [
          ['d', 'profile-viewer'],
          ['requires', 'inc'],
          ['archetype', 'profile', 'NAP-1'],
        ],
      }));
    };
    const archetypes = [
      {
        slug: 'profile',
        convention: 'napplet:profile/open',
      },
      {
        slug: 'profile',
        convention: 'napplet:profile/open',
      },
    ];

    try {
      seed(firstDir);
      seed(secondDir);
      recomputeManifest(firstDir, '<!doctype html><title>Profile</title>', archetypes);
      recomputeManifest(secondDir, '<!doctype html><title>Profile</title>', [
        { slug: 'profile', convention: 'napplet:profile/edit' },
      ]);

      const manifest = JSON.parse(
        readFileSync(join(firstDir, '.nip5a-manifest.json'), 'utf8'),
      ) as {
        aggregateHash: string;
        tags: string[][];
      };
      const secondManifest = JSON.parse(
        readFileSync(join(secondDir, '.nip5a-manifest.json'), 'utf8'),
      ) as {
        aggregateHash: string;
        tags: string[][];
      };
      expect(manifest.tags.filter((tag) => tag[0] === 'archetype')).toEqual([
        ['archetype', 'profile', 'napplet:profile/open'],
        ['archetype', 'profile', 'napplet:profile/open'],
      ]);
      expect(manifest.tags.flat()).not.toContain('NAP-1');
      expect(manifest.aggregateHash).toBe(secondManifest.aggregateHash);
      expect(verifyEvent(manifest as Parameters<typeof verifyEvent>[0])).toBe(true);
    } finally {
      rmSync(firstDir, { recursive: true, force: true });
      rmSync(secondDir, { recursive: true, force: true });
    }
  });

  it('loads napplets by content-addressed resolution into opaque-origin srcdoc iframes', () => {
    const frameLoader = readRepoFile('apps/playground/src/playground-frame-loader.ts');
    const shellHost = readRepoFile('apps/playground/src/shell-host.ts');
    const gatewayAudit = readRepoFile('scripts/audit-gateway-artifacts.mjs');
    const indexHtml = readRepoFile('apps/playground/index.html');
    const main = readRepoFile('apps/playground/src/main.ts');
    const preferences = readRepoFile('apps/playground/src/main-preferences.ts');

    expect(frameLoader).toContain('function playgroundPath(');
    expect(frameLoader).toContain('import.meta.env.BASE_URL');
    expect(frameLoader).not.toContain('meta.env?.BASE_URL');

    // Loader resolves + verifies content-addressed bytes, then renders via srcdoc.
    expect(frameLoader).toContain('resolvePlaygroundNapplet({');
    expect(frameLoader).toContain('iframe.srcdoc = injectNappletNamespacePrelude(');
    expect(frameLoader).toContain('injectCspMeta(resolved.indexHtml, origins)');
    expect(frameLoader).toContain(
      'iframe.srcdoc = injectNappletNamespacePrelude(\n    injectCspMeta(resolved.indexHtml, origins)',
    );
    expect(frameLoader).toContain("iframe.sandbox.add('allow-scripts')");
    expect(frameLoader).not.toContain('allow-same-origin');
    expect(frameLoader).not.toContain('relay.runtime.sessionRegistry.register(windowId');
    expect(frameLoader).toContain(
      'originRegistry.register(iframe.contentWindow, windowId, identity);',
    );
    expect(shellHost).toContain("(event.data as NappletMessage).type === 'shell.ready'");
    expect(shellHost).toContain('markEnvelopeIdentityBinding(windowId);');
    expect(shellHost).toContain('const realToProxy = new WeakMap<Window, Window>();');
    expect(shellHost).toContain('originRegistry.getRegistrationId = (win: Window) =>');
    expect(shellHost).toContain('originRegistry.getIdentity = (win: Window) =>');

    // The gateway is no longer in the trust path: no gateway metadata fetch and
    // no iframe.src navigation in the loader.
    expect(frameLoader).not.toContain('iframe.src = metadata.htmlUrl');
    expect(frameLoader).not.toContain('fetchGatewayMetadata');
    expect(frameLoader).not.toContain('napplet-gateway');

    // The executable Pages gate must follow loader ownership when the host is
    // decomposed, rather than scanning the exported shell-host wrapper.
    expect(gatewayAudit).toContain(
      "const frameLoader = read(join(repoRoot, 'apps', 'playground', 'src', 'playground-frame-loader.ts'));",
    );
    expect(gatewayAudit).toContain("!frameLoader.includes('iframe.srcdoc =')");
    expect(gatewayAudit).toContain(
      "frameLoader.includes('const identity = Object.freeze({ dTag, aggregateHash });')",
    );
    expect(gatewayAudit).toContain(
      "frameLoader.includes('originRegistry.register(iframe.contentWindow, windowId, identity);')",
    );
    expect(gatewayAudit).toContain("!frameLoader.includes(\"iframe.sandbox.add('allow-scripts')\")");
    expect(gatewayAudit).not.toContain("!shellHost.includes('iframe.srcdoc =')");

    expect(indexHtml).toContain('id="static-demo-banner"');
    expect(preferences).toContain("export const STATIC_PAGES_BASE_PATH = '/web/playground/';");
    expect(main).toContain("document.getElementById('static-demo-banner')?.removeAttribute('hidden')");
  });

  it('resolves via the relay + Blossom simulation and checks requires before rendering', () => {
    const frameLoader = readRepoFile('apps/playground/src/playground-frame-loader.ts');
    const viteConfig = readRepoFile('apps/playground/vite.config.ts');
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
    expect(resolver).toContain("default-src 'none'");
    expect(resolver).toContain("frame-ancestors 'self'");
    expect(frameLoader).toContain('injectNappletNamespacePrelude');
    expect(frameLoader).toContain('getPlaygroundShellEnvironment(identity)');
    expect(frameLoader).toContain('environment.capabilities');
    expect(frameLoader).not.toContain("{ domains: ['shell', ...resolved.requires] }");

    // requires checked against the COMPUTED manifest before the iframe renders.
    expect(frameLoader).toContain('getMissingRequiredNaps(');
    expect(frameLoader).toContain('requires unsupported NAP capabilities');
    expect(frameLoader.indexOf('getMissingRequiredNaps(')).toBeLessThan(
      frameLoader.indexOf('iframe.srcdoc = injectNappletNamespacePrelude'),
    );
    expect(frameLoader.indexOf('getPlaygroundShellEnvironment(identity)')).toBeLessThan(
      frameLoader.indexOf('getMissingRequiredNaps('),
    );
  });

  it('derives each frame environment from its trusted creation identity and live host wiring', () => {
    const demoHooks = readRepoFile('apps/playground/src/demo-hooks.ts');
    const frameLoader = readRepoFile('apps/playground/src/playground-frame-loader.ts');

    expect(demoHooks).toContain('resolveShellEnvironment');
    expect(demoHooks).toContain('getPlaygroundShellEnvironment(identity: OriginIdentity)');
    expect(frameLoader).toContain('const identity = Object.freeze({ dTag, aggregateHash });');
    expect(frameLoader).toContain('const environment = getPlaygroundShellEnvironment(identity);');
    expect(frameLoader).toContain('originRegistry.register(iframe.contentWindow, windowId, identity);');
    expect(frameLoader).toContain('environment.capabilities');
    expect(frameLoader).not.toContain("{ domains: ['shell', ...resolved.requires] }");
    expect(demoHooks).not.toContain('shellCapabilities.naps');
    expect(demoHooks).not.toContain('shellCapabilities.protocols');
  });

  it('registers the trusted INC environment before the shared replacement-safe prelude executes', () => {
    const frameLoader = readRepoFile('apps/playground/src/playground-frame-loader.ts');
    const shellHost = readRepoFile('apps/playground/src/shell-host.ts');
    const namespacePrelude = readRepoFile('packages/shell/src/napplet-namespace.ts');

    const identity = frameLoader.indexOf('const identity = Object.freeze({ dTag, aggregateHash });');
    const environment = frameLoader.indexOf('const environment = getPlaygroundShellEnvironment(identity);');
    const registration = frameLoader.indexOf('originRegistry.register(iframe.contentWindow, windowId, identity);');
    const registrationEnvironment = frameLoader.indexOf('originRegistry.setEnvironment(iframe.contentWindow, environment);');
    const srcdoc = frameLoader.indexOf('iframe.srcdoc = injectNappletNamespacePrelude(');

    expect(identity).toBeGreaterThanOrEqual(0);
    expect(environment).toBeGreaterThan(identity);
    expect(registration).toBeGreaterThan(environment);
    expect(registrationEnvironment).toBeGreaterThan(registration);
    expect(srcdoc).toBeGreaterThan(registrationEnvironment);
    expect(frameLoader).toContain('environment.capabilities');

    // INC belongs solely to the shared prelude. The playground must not grow a
    // host-specific convention parser or channel client around the bridge.
    expect(`${shellHost}\n${frameLoader}`).not.toContain('function normalizeConventionUri(');
    expect(`${shellHost}\n${frameLoader}`).not.toContain('function makeInc(');
    expect(`${shellHost}\n${frameLoader}`).not.toContain('function makeChannelHandle(');

    // The real shim can assign window.napplet, but the injected namespace proxy
    // merges extensions and restores the Kehto-owned INC operations.
    expect(namespacePrelude).toContain('function makeProtectedInc(existing: unknown): Record<string, unknown>');
    expect(namespacePrelude).toContain('return { ...extensions, ...inc };');
    expect(namespacePrelude).toContain("if (domain === 'inc') return makeProtectedInc(existing);");
    expect(namespacePrelude).toContain('function guardNappletNamespace(namespace: Record<string, unknown>): Record<string, unknown>');
    expect(namespacePrelude).toContain('set(obj, prop, value)');
    expect(namespacePrelude).toContain('root = buildNappletNamespace(value);');
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

  it('keeps the feed napplet identity-bound, intent-driven, media-safe, and unseeded', () => {
    const feedSource = readRepoFile('apps/playground/napplets/feed/src/main.ts');
    const feedStore = readRepoFile('apps/playground/napplets/feed/src/feed-store.ts');
    const feedHtml = readRepoFile('apps/playground/napplets/feed/index.html');
    const demoHooks = readRepoFile('apps/playground/src/demo-hooks.ts');
    const workerRelay = readRepoFile('apps/playground/src/playground-worker-relay.ts');

    expect(feedSource).toContain("import { identityGetPublicKey, identityOnChanged } from '@napplet/nap/identity/sdk';");
    expect(feedSource).toContain("import { intentInvoke } from '@napplet/nap/intent/sdk';");
    expect(feedSource).toContain("import { resourceBytes } from '@napplet/nap/resource/sdk';");
    expect(feedSource).toContain("import { getMissingNapDomains } from '../../domain-availability';");
    expect(feedSource).toContain("import { createFeedStore, type FeedProfile } from './feed-store.js';");
    expect(feedSource).toContain("import { createFeedIdentityEventController } from './feed-identity-events.js';");
    expect(feedSource).toContain("const REQUIRED_NAPS = ['identity', 'intent', 'relay', 'resource', 'theme'] as const;");
    expect(feedSource).toContain('getMissingNapDomains(REQUIRED_NAPS)');
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
    expect(feedSource).toContain("import { createFeedProfileMediaController } from './profile-media.js';");
    expect(feedSource).toContain('const profileMedia = createFeedProfileMediaController({ loadBytes: resourceBytes });');
    expect(feedSource).toContain("button.className = 'feed-item-author feed-profile-button feed-profile-name-button';");
    expect(feedSource).toContain("timeEl.className = 'feed-item-time';");
    expect(feedSource).toContain('formatPublishedAgo(event.created_at)');
    expect(feedSource).toContain("convention: 'napplet:profile/open'");
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

  it('keeps the profile demo on canonical INC convention delivery with resource-backed media', () => {
    const profileSource = readRepoFile('apps/playground/napplets/profile-viewer/src/main.ts');
    const profileHtml = readRepoFile('apps/playground/napplets/profile-viewer/index.html');

    expect(profileSource).toContain("import { incOn } from '@napplet/nap/inc/sdk';");
    expect(profileSource).toContain("import { relaySubscribe } from '@napplet/nap/relay/sdk';");
    expect(profileSource).toContain("import { resourceBytes } from '@napplet/nap/resource/sdk';");
    expect(profileSource).toContain("import { getMissingNapDomains } from '../../domain-availability';");
    expect(profileSource).toContain("const REQUIRED_NAPS = ['inc', 'relay', 'resource', 'theme'] as const;");
    expect(profileSource).toContain('getMissingNapDomains(REQUIRED_NAPS)');
    expect(profileSource).toContain('const CAPABILITY_WAIT_MS = 5_000;');
    expect(profileSource).toContain("formatError(err, 'inc, relay, or resource unavailable')");
    expect(profileSource).toContain("profileIntentSub = incOn('napplet:profile/open', (event: IncEvent) => {");
    expect(profileSource).toContain("import { createProfileMediaController } from './profile-media.js';");
    expect(profileSource).toContain('const profileMedia = createProfileMediaController({ loadBytes: resourceBytes });');
    expect(profileSource).not.toContain('intentOnDelivery');
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

  it('keeps playground identity and theme delivery on one service-to-bridge path', () => {
    const demoHooks = readRepoFile('apps/playground/src/demo-hooks.ts');
    const shellHost = readRepoFile('apps/playground/src/shell-host.ts');
    const main = readRepoFile('apps/playground/src/main.ts');
    const preferences = readRepoFile('apps/playground/src/main-preferences.ts');
    const mainSigner = readRepoFile('apps/playground/src/main-signer.ts');

    expect(demoHooks).toContain('onThemeBroadcast(envelope: ThemeChangedMessage): void;');
    expect(demoHooks).toContain('initialTheme?: Theme,');
    expect(demoHooks).toContain('createThemeService({ initialTheme, onBroadcast: context.onThemeBroadcast })');
    expect(shellHost).toContain('onThemeBroadcast: (envelope) => relay.publishTheme(envelope.theme),');
    expect(shellHost).toContain('initialTheme?: Theme,');
    expect(main).toContain('getPersistedPlaygroundTheme');
    expect(main).toContain('bootShell((notifications) => {');
    expect(main).toContain('}, initialTheme, intentService);');
    expect(main).not.toContain("data.type === 'shell.ready'");
    expect(main).not.toContain('broadcastCurrentTheme');
    expect(preferences).toContain('initialTheme?: PlaygroundTheme;');
    expect(preferences).toContain('getThemeServiceBundle()?.publishTheme(currentTheme);');
    expect(preferences).not.toContain('broadcastCurrentTheme');
    expect(preferences).not.toContain("postMessage({ type: 'theme.changed'");
    expect(preferences).not.toContain('relay.publishTheme(currentTheme');

    expect(shellHost).not.toContain('scheduleCurrentUserIdentitySync');
    expect(shellHost).not.toContain('publishCurrentUserIdentityToNapplet');
    expect(shellHost).not.toContain("msg.envelopeType === 'identity.getPublicKey'");
    expect(shellHost).not.toContain("type: 'identity.changed'");
    expect(mainSigner).toContain('publishIdentityChanged?.(currentIdentity);');
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
