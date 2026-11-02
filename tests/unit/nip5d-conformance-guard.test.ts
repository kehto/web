import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const installedNapDist = 'packages/paja/node_modules/@napplet/nap/dist';
const installedCoreDist = 'packages/paja/node_modules/@napplet/core/dist/index.d.ts';

const relaySubscribeRoutingSurfaces = [
  {
    file: 'packages/runtime/src/relay-handler.ts',
    markers: ['relay?: string;', 'relayHint'],
  },
  {
    file: 'packages/services/src/relay-pool-service.ts',
    markers: ['relay?: unknown;', 'relayHint'],
  },
  {
    file: 'packages/services/src/coordinated-relay.ts',
    markers: ['relay?: unknown;', 'relayHint'],
  },
  {
    file: 'packages/services/src/relay-pool-service.test.ts',
    markers: ['relay: \'wss://explicit.test\'', 'expect(selectRelayTier).not.toHaveBeenCalled()'],
  },
  {
    file: 'packages/services/src/coordinated-relay.test.ts',
    markers: ['relay: \'wss://explicit.test\'', 'expect(selectRelayTier).not.toHaveBeenCalled()'],
  },
] as const;

const resourceServerHintRoutingSurfaces = [
  {
    file: 'packages/shell/src/napplet-namespace.ts',
    markers: ['servers: Array.from(options.servers)', "type: 'resource.bytesMany'", 'requests: Array.from(requests || []'],
  },
  {
    file: 'packages/shell/src/types/internal-resource.ts',
    markers: [
      "from '@napplet/nap/resource/types'",
      'ResourceBytesItem as CanonicalResourceBytesItem',
      'requests: readonly CanonicalResourceBytesRequest[]',
    ],
  },
  {
    file: 'packages/services/src/resource-service.ts',
    markers: [
      "from '@napplet/nap/resource/types'",
      'windowId?: string;',
      'servers?: readonly string[];',
      'm.requests ?? []',
      "parsedUrl.protocol === 'blossom:'",
    ],
  },
  {
    file: 'packages/paja/src/browser-resource.ts',
    markers: [
      'PAJA_RESOURCE_MAX_SERVERS = 8',
      'init.servers ?? []',
      'options.getBlossomServers?.({ url: value, windowId })',
      'resolveBlossomServers(',
      'normalizePublicBlossomServer(',
    ],
  },
  {
    file: 'packages/paja/src/browser-blossom-events.ts',
    markers: [
      'BLOSSOM_SERVER_LIST_KIND = 10_063',
      '[{ kinds: [BLOSSOM_SERVER_LIST_KIND], authors: [pubkey], limit: 1 }]',
      'for (const context of contexts) appendUnique(servers, context.servers);',
      'for (const context of contexts) appendUnique(authors, [context.publisher]);',
      'if (target.length >= PAJA_RESOURCE_MAX_SERVERS) return;',
      'for (const author of options.getDefaultAuthors?.() ?? [])',
      'authors.map((author) => discoverServerList(author))',
    ],
  },
  {
    file: 'packages/paja/src/browser-adapter.ts',
    markers: [
      'createPajaBlossomEventResolver({',
      'getDefaultAuthors: () => [getRuntimePubkey(getSimulation, signerProvider)]',
      'getBlossomServers: ({ url, windowId }) => blossomEventResolver.getServers(url, windowId)',
      'getReadRouter: (windowId) => blossomEventResolver.decorate(baseOutboxRouter, windowId)',
      'getQueryRouter: (windowId, context) => blossomEventResolver.decorate(',
      'uploadRuntime?.getServers() ?? getSimulation().upload.servers',
      'blossomEventResolver.clearWindow(windowId);',
    ],
  },
  {
    file: 'packages/services/src/outbox-service.ts',
    markers: [
      'getReadRouter?(windowId: string, context: ServiceRuntimeContext | undefined): OutboxRouter;',
      'handleGetEvent(getReadRouter?.(windowId, runtimeContext) ?? router, message, send);',
      'const readRouter = getReadRouter?.(windowId, runtimeContext) ?? router;',
    ],
  },
  {
    file: 'packages/paja/src/browser-resource.test.ts',
    markers: ['accepted request hints before configured defaults', 'reports an inconclusive fallback as network-error'],
  },
  {
    file: 'packages/paja/src/browser-blossom-events.test.ts',
    markers: [
      'prioritizes ROM-event hints and publisher lists before the shell signer fallback',
      'uses the active shell user list without event context or Blossom upload mode',
      'uses a canonical resource event publisher when no event-local hint exists',
      'observes single-event and subscription results for the authenticated window',
      'keeps event-derived locations window-scoped and clears them on teardown',
    ],
  },
  {
    file: 'packages/paja/src/browser-blossom-integration.test.ts',
    markers: [
      'uses event hints before the event publisher list with upload disabled',
      'falls through request, ROM, publisher, user, and runtime candidates in order',
      'expect(adapter.upload).toBeUndefined()',
    ],
  },
] as const;

const relayPublishRoutingSurfaces = [
  {
    file: 'packages/runtime/src/relay-handler.ts',
    markers: [
      'const signed = await signEvent(eventTemplate);',
      'replayDetector.reserve(signed)',
      'replayDetector.commit(signed.id)',
      'replayDetector.release(signed.id)',
      "{ type: 'relay.publish', id, event: signed }",
      "type: 'relay.publish.result', id, ok: true, event, eventId: event.id",
      'Promise.resolve(publishResult)',
    ],
  },
  {
    file: 'packages/services/src/relay-pool-service.ts',
    markers: ["publishEvent(relayMessage, 'relay.publish.result', send);", 'eventId: event.id'],
  },
  {
    file: 'packages/services/src/coordinated-relay.ts',
    markers: ['publishCoordinatedEvent(options, relayMessage, send);', 'eventId: event.id'],
  },
  {
    file: 'packages/paja/src/browser-relay-runtime.ts',
    markers: [
      'const attempt = await attemptPublish(relayUrls, event, signerContext);',
      'if (attempt.error) throw new Error(attempt.error);',
      'retainPublishedEvent(event, simulation.relay.mode);',
    ],
  },
  {
    file: 'packages/paja/src/browser-relay-policy.ts',
    markers: [
      'publishToScopedRelay: async',
      'await getPublishPool(windowId).publish([active.relayUrl], event);',
      '} catch {',
    ],
  },
  {
    file: 'packages/runtime/src/dispatch.test.ts',
    markers: ['shell-signs the template and returns the full signed event', 'accepted).toBeUndefined()'],
  },
  {
    file: 'packages/services/src/relay-pool-service.test.ts',
    markers: ['returns the canonical signed event after relay.publish succeeds', 'eventId: event.id'],
  },
  {
    file: 'packages/services/src/coordinated-relay.test.ts',
    markers: ['publishes, caches, and returns the canonical signed event result', 'eventId: event.id'],
  },
  {
    file: 'packages/paja/src/browser-relay-runtime.test.ts',
    markers: [
      'returns a canonical failure and retains nothing when confirmation is denied',
      'reports all-live-relay rejection without retaining service or outbox events',
    ],
  },
] as const;

const activeShellSurfaceFiles = [
  'packages/shell/src/napplet-namespace.ts',
  'packages/shell/src/napplet-namespace.test.ts',
  'packages/shell/src/shell-supports-conformance.test.ts',
  'packages/shell/README.md',
] as const;

const activeServiceGuidanceFiles = [
  'packages/services/README.md',
  'docs/packages/services.md',
  'skills/add-service/SKILL.md',
  'skills/integrate-shell/SKILL.md',
] as const;

const activeIntentContractFiles = [
  'packages/services/src/catalog-intent-resolver.ts',
  'packages/services/src/manifest-intent-catalog.ts',
  'packages/services/src/index.ts',
] as const;

const activeArchetypeMetadataFiles = [
  'packages/nip/src/5d/index.ts',
] as const;

const unsafeServiceGuidancePatterns = [
  { label: 'legacy audio factory', pattern: /\bcreateAudioService\s*\(/ },
  { label: 'legacy notification INC factory', pattern: /\bcreateNotificationService\s*\(/ },
  { label: 'legacy audio topic emission', pattern: /\b(?:emit|subscribe)\s*\(\s*['"]audio:/ },
  { label: 'legacy notification topic emission', pattern: /\b(?:emit|subscribe)\s*\(\s*['"]notifications:/ },
  { label: 'service registration from a colon topic', pattern: /registerService\(\s*['"][^'"]+:[^'"]*['"]/ },
  { label: 'INC topic-prefix service handling', pattern: /topic\?\.startsWith\s*\(/ },
  { label: 'fabricated INC event delivery', pattern: /(?:send|postMessage)\s*\([\s\S]{0,160}type:\s*['"]inc\.event['"]/ },
] as const;

// Planning history and changelogs retain the removed vocabulary as historical record.
const historicalShellExclusions = ['.planning/', 'CHANGELOG.md'] as const;

const publishedConventionAuthorities = Object.freeze({
  napIntent: '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
  napIdentityTheme: '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
  napRelayDraft: '0be8abce18beb46ca37bd4ddd042f58d30b4eedc',
  publishedSource: '3037200c932488f14f7f369b8583c39c9c16510a',
  publishedSourceMerge: 'b3f0007867eac109fa4917fac9c285d3b7cc6155',
  publishedRelease: 'a79e7f4638f70f4557d4183faee9348847bb8cc7',
  publishedReleaseMerge: 'dc1d24153c759152b6ba31a6ec9bea967798f2df',
});

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function removeComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function removeExplicitLegacyProhibitions(source: string): string {
  return source.replace(/(?:do not|never|must not)\b[^.]*\./gi, '');
}

function interfaceBody(source: string, interfaceName: string): string {
  const match = source.match(new RegExp(`interface ${interfaceName}[^\\{]*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`missing interface ${interfaceName}`);
  return match[1] ?? '';
}

function interfaceFieldNames(source: string, interfaceName: string): string[] {
  const body = interfaceBody(source, interfaceName);
  return [...body.matchAll(/^\s{4}([a-zA-Z][a-zA-Z0-9_]*)\??:/gm)]
    .map((match) => match[1])
    .filter((name) => name !== 'type');
}

function localInterfaceFieldNames(source: string, interfaceName: string): string[] {
  const body = interfaceBody(source, interfaceName);
  return [...body.matchAll(/^\s{2}(?:readonly\s+)?([a-zA-Z][a-zA-Z0-9_]*)\??:/gm)]
    .map((match) => match[1]);
}

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`missing source slice: ${start} -> ${end}`);
  }
  return source.slice(startIndex, endIndex);
}

describe('NIP-5D conformance static guards', () => {
  // NIP-5D port-bound identity: nostr-protocol/nips#2303 at
  // 51ef0cd33a5694784306f3260d90b1872545fdee (napplet/web#302).
  it('neuters direct WebRTC egress in the injected napplet realm (napplet/evil #1)', () => {
    const prelude = removeComments(readRepoFile('packages/shell/src/napplet-namespace.ts'));
    const policy = readRepoFile('docs/policies/NIP-5D-CONFORMANCE.md');

    // The prelude removes both PeerConnection constructors as a pinned undefined,
    // before any napplet script runs. NAP-WEBRTC runs in the shell realm.
    expect(prelude).toContain("for (const rtcCtor of ['RTCPeerConnection', 'webkitRTCPeerConnection']) {");
    expect(prelude).toMatch(/Object\.defineProperty\(target as object, rtcCtor, \{[\s\S]*?value: undefined,[\s\S]*?writable: false,[\s\S]*?configurable: false,/);
    expect(policy).toContain('### Direct WebRTC egress');
  });

  it('keeps napplet identity bound to the napplet.hello port across shell and hosts', () => {
    const prelude = removeComments(readRepoFile('packages/shell/src/napplet-namespace.ts'));
    const bridge = readRepoFile('packages/shell/src/nip5d-transport.ts');
    const registry = readRepoFile('packages/shell/src/origin-registry.ts');
    const policy = readRepoFile('docs/policies/NIP-5D-CONFORMANCE.md');
    const pajaNip5d = readRepoFile('packages/paja/src/browser-nip5d-host.ts');

    expect(prelude).toContain("target.parent.postMessage({ type: 'napplet.hello' }, '*', [channel.port2]);");
    expect(prelude).toContain('port.postMessage(message);');
    expect(prelude).toContain('return event.currentTarget === port;');
    expect(prelude).not.toContain('target.parent.postMessage(message');
    expect(prelude).not.toContain("target.addEventListener('message'");

    for (const reason of ['window-message', 'second-hello', 'invalid-hello', 'second-load', 'port-closed']) {
      expect(bridge, `revocation reason ${reason}`).toContain(`'${reason}'`);
    }
    expect(bridge).toContain('if (ports.length !== 1) {');
    expect(registry).toContain("throw new Error('NIP-5D: cannot re-bind a napplet identity to an existing iframe; create a fresh iframe');");

    // No shell, Paja or services source may send NAP through an iframe Window.
    const windowSend = /\b(?:win|iframeWindow|sourceWindow|contentWindow!?|getIframeWindow\([^)]*\)\??)\.postMessage\(/;
    for (const dir of ['packages/shell/src', 'packages/paja/src', 'packages/services/src']) {
      for (const file of readdirSync(join(process.cwd(), dir))) {
        if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file === 'test-utils.ts') continue;
        const source = removeComments(readRepoFile(`${dir}/${file}`));
        if (`${dir}/${file}` === 'packages/paja/src/intent-launcher.ts') continue;
        expect(windowSend.test(source), `${dir}/${file} posts to an iframe Window`).toBe(false);
      }
    }

    // The single window-level exception is the signed Paja launcher's host messages.
    expect(readRepoFile('packages/paja/src/intent-launcher.ts')).toContain("frame.contentWindow.postMessage(message, '*');");
    expect(pajaNip5d).toContain("new Set(['paja.intent.launcher.ready', 'paja.intent.launcher.result'])");
    expect(pajaNip5d).toContain('!originRegistry.getPort(launcher.windowId)');
    expect(policy).toContain('### Window-level host message allowlist');
    expect(policy).toContain('`paja.intent.launcher.ready`, `paja.intent.launcher.result` (launcher → host); `paja.intent.launch` (host → launcher)');
    expect(policy).toContain('51ef0cd33a5694784306f3260d90b1872545fdee');
  });

  it('keeps released intent ownership and the host-owned NAP-SHELL prelude as positive evidence', () => {
    const services = readRepoFile('packages/services/src/index.ts');
    const prelude = readRepoFile('packages/shell/src/napplet-namespace.ts');
    const publishedContract = readRepoFile('tests/unit/published-napplet-contract.test.ts');

    expect(publishedConventionAuthorities).toEqual({
      napIntent: '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
      napIdentityTheme: '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
      napRelayDraft: '0be8abce18beb46ca37bd4ddd042f58d30b4eedc',
      publishedSource: '3037200c932488f14f7f369b8583c39c9c16510a',
      publishedSourceMerge: 'b3f0007867eac109fa4917fac9c285d3b7cc6155',
      publishedRelease: 'a79e7f4638f70f4557d4183faee9348847bb8cc7',
      publishedReleaseMerge: 'dc1d24153c759152b6ba31a6ec9bea967798f2df',
    });
    for (const authority of Object.values(publishedConventionAuthorities)) {
      expect(publishedContract, `published contract authority ${authority}`).toContain(authority);
    }
    // @napplet/nap 0.32 lacks the pinned PR #106 contract. Kehto contains the
    // exact temporary canonical types until that package exports them.
    expect(services).toContain("from './intent-types.js'");
    expect(existsSync(join(process.cwd(), 'packages/services/src/intent-types.ts'))).toBe(true);
    expect(publishedContract).toContain('NAP-INTENT PR #106');

    // Published core/shim omit generic shell, so NAP-SHELL stays a Kehto-owned
    // prelude with a live receiver, one bare ready signal, and local support.
    expect(prelude).toContain("const domains = uniqueBareDomains(options.domains);");
    expect(prelude).toContain("if (message.type !== 'shell.init') return;");
    expect(prelude).toContain('function supports(domain: string): boolean');
    expect(prelude).toContain("post({ type: 'shell.ready' });");
    expect(prelude).toContain('onReady(handler: ReadyHandler)');
  });

  it("keeps Paja's verified catalog separate from frame and controller authority", () => {
    const catalog = readRepoFile('packages/paja/src/installed-napplet-catalog.ts');
    const adapter = readRepoFile('packages/paja/src/browser-adapter.ts');
    const host = readRepoFile('packages/paja/src/browser-host.ts');
    const controller = readRepoFile('packages/paja/src/browser-intent-controller.ts');

    expect(catalog).toContain('manifestToIntentCatalogEntry');
    expect(catalog).toContain('PajaResolvedPointer');
    expect(catalog).not.toMatch(/\b(?:Window|HTMLIFrameElement|MessagePort|contentWindow)\b/);
    expect(catalog).not.toContain('DEV_INTENT');
    expect(adapter).toContain('intentHost?: PajaIntentHost');
    expect(host).toContain('catalog: new InstalledNappletCatalog()');
    expect(host).toContain('const intentController = new BrowserIntentController(');
    expect(controller).toContain('await this.options.waitForReady(generation);');
    expect(controller).toContain('await this.options.isCurrent(generation)');
    expect(controller).toContain('const acceptance = Object.freeze({ completion: this.dispatch(params) });');
    expect(controller).toContain('return acceptance;');
    expect(controller).toContain('onAccepted?(params: IntentDispatchParams, acceptance: IntentTargetAcceptance): void;');
  });

  it('keeps test resolution on published napplet packages', () => {
    const rootPackageJson = JSON.parse(readRepoFile('package.json')) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    const workspace = readRepoFile('pnpm-workspace.yaml');
    const lockfile = readRepoFile('pnpm-lock.yaml');
    const vitestConfig = readRepoFile('vitest.config.ts');
    const e2eViteConfig = readRepoFile('tests/e2e/vite.config.ts');

    expect(rootPackageJson.pnpm?.overrides ?? {}).not.toHaveProperty('@napplet/core');
    expect(workspace).not.toContain('napplet/packages/*');
    expect(lockfile).not.toMatch(/link:.*napplet/);
    expect(lockfile).not.toContain('napplet/packages');
    expect(vitestConfig).not.toContain('napplet/packages');
    expect(vitestConfig).not.toContain('/home/sandwich/Develop/napplet');
    expect(e2eViteConfig).not.toContain('napplet/packages');
    expect(e2eViteConfig).not.toContain('/home/sandwich/Develop/napplet');
  });

  it('keeps active intent and manifest surfaces on exact convention contracts', () => {
    const publishedIntentTypes = readRepoFile(installedCoreDist);
    const resolver = readRepoFile('packages/services/src/catalog-intent-resolver.ts');
    const manifestParser = readRepoFile('packages/nip/src/5d/current-manifest.ts');
    const paja = readRepoFile('packages/paja/src/browser-adapter.ts');
    const pajaHost = readRepoFile('packages/paja/src/browser-host.ts');
    const pajaIntent = [
      readRepoFile('packages/paja/src/browser-catalog-intent-service.ts'),
      sourceBetween(
        paja,
        'if (getSimulation().intent.enabled && intentHost)',
        'return adapter;',
      ),
    ].join('\n');
    const forbiddenCanonicalField = /\b(?:protocol|protocols)\s*(?:\?|):/;

    const localIntentTypes = readRepoFile('packages/services/src/intent-types.ts');
    expect(existsSync(join(process.cwd(), 'packages/services/src/intent-types.ts'))).toBe(true);
    expect(localInterfaceFieldNames(localIntentTypes, 'IntentCandidate')).toEqual([
      'id', 'title', 'actions', 'conventions', 'contracts', 'isDefault',
    ]);
    expect(localIntentTypes).toContain('export type IntentResult =');
    expect(localIntentTypes).not.toContain('handled');
    expect(localIntentTypes).not.toContain('windowId');
    expect(localInterfaceFieldNames(resolver, 'IntentDispatchParams')).toEqual([
      'handler',
      'sender',
      'archetype',
      'action',
      'convention',
      'payload',
      'behavior',
      'sourceWindowId',
    ]);

    for (const file of activeIntentContractFiles) {
      const source = removeComments(readRepoFile(file));
      expect(source, `${file} obsolete canonical intent field`).not.toMatch(
        forbiddenCanonicalField,
      );
    }
    expect(removeComments(pajaIntent), 'Paja development intent simulator').not.toMatch(
      forbiddenCanonicalField,
    );
    expect(pajaIntent).toContain('InstalledNappletCatalog');
    expect(pajaIntent).toContain('BrowserIntentController');
    expect(pajaIntent).toContain('createCatalogIntentResolver');
    expect(paja).toContain('createPajaCatalogIntentService(adapter, intentHost)');
    expect(paja).toContain('intentHost?: PajaIntentHost');
    expect(pajaHost).toContain('catalog: new InstalledNappletCatalog()');
    expect(pajaHost).toContain('const intentController = new BrowserIntentController(');
    expect(paja).not.toContain('DEV_INTENT');

    expect(manifestParser).toContain('eligible only for the same declared role');

    for (const file of activeArchetypeMetadataFiles) {
      const source = removeComments(readRepoFile(file));
      expect(source, `${file} numbered archetype metadata`).not.toMatch(
        /\bnap\s*:|NAP-[0-9]+/,
      );
    }
  });

  it('keeps optional NAP-SHELL independent of other domains', () => {
    const agents = readRepoFile('AGENTS.md');
    const policy = readRepoFile('docs/policies/NIP-5D-CONFORMANCE.md');

    expect(agents).toMatch(/NAP-SHELL.*is optional/);
    expect(agents).toMatch(/A missing or stale\s+package export is upstream drift/);
    expect(policy).toContain('NAP-SHELL is optional and does not gate other domain calls.');
    expect(policy).toContain('napplet artifacts are not required to bundle their own handshake');
  });

  it('keeps active NAP-SHELL support domain-only and host resolution out of injected APIs', () => {
    const namespace = readRepoFile('packages/shell/src/napplet-namespace.ts');
    const readme = readRepoFile('packages/shell/README.md');
    const retiredNegotiationMarkers = [
      'capabilities.' + 'protocols',
      'proto' + 'col?: string',
      'n' + 'aps:',
    ];

    expect(historicalShellExclusions).toEqual(['.planning/', 'CHANGELOG.md']);
    for (const file of activeShellSurfaceFiles) {
      const source = readRepoFile(file);
      expect(source, `${file} must not declare a second supports parameter`).not.toMatch(
        /(?:function\s+)?supports\s*(?::\s*)?\(\s*[^,)]+\s*,/,
      );
      for (const marker of retiredNegotiationMarkers) {
        expect(source, `${file} must not expose ${marker}`).not.toContain(marker);
      }
    }

    expect(namespace).toContain('function supports(domain: string): boolean');
    expect(namespace).not.toContain('resolveShellEnvironment');
    expect(readme).toContain('`window.napplet.shell.supports(domain)`');
    expect(readme).toContain('returns `false` before `shell.init`');
    expect(readme).toContain('resolveShellEnvironment(hooks, identity)');
    expect(readme).not.toContain('numbered protocols');
    expect(readme).not.toContain('`naps`');
  });

  it('keeps active service guidance on direct domains and runtime-attested INC delivery', () => {
    for (const file of activeServiceGuidanceFiles) {
      const source = readRepoFile(file);
      const recommendations = removeExplicitLegacyProhibitions(source);

      expect(source, `${file} direct domain guidance`).toContain('exact `message.type` domain');
      expect(source, `${file} opaque INC guidance`).toMatch(/opaque,?\s+queryless\s+identities/i);
      expect(source, `${file} runtime-attested sender guidance`).toMatch(/runtime\s+attaches the sender/i);

      for (const { label, pattern } of unsafeServiceGuidancePatterns) {
        expect(recommendations, `${file} must not recommend ${label}`).not.toMatch(pattern);
      }
    }

    // Mentioning a retired token to prohibit it is documentation, not a compatibility recommendation.
    expect(removeExplicitLegacyProhibitions('Do not use createAudioService() for INC routing.')).not.toMatch(
      /createAudioService\s*\(/,
    );
  });

  it('keeps NAP-RELAY subscribe routing fields wired through runtime, services, and tests', () => {
    const relayTypes = readRepoFile(`${installedNapDist}/relay/types.d.ts`);
    const fields = interfaceFieldNames(relayTypes, 'RelaySubscribeMessage');

    expect(fields).toEqual(['id', 'subId', 'filters', 'relay']);

    for (const { file, markers } of relaySubscribeRoutingSurfaces) {
      const source = readRepoFile(file);
      for (const marker of markers) {
        expect(source, `${file} missing ${marker}`).toContain(marker);
      }
    }
  });

  it('keeps NAP-RESOURCE server hints wired through shell, services, Paja, and tests', () => {
    for (const { file, markers } of resourceServerHintRoutingSurfaces) {
      const source = readRepoFile(file);
      for (const marker of markers) {
        expect(source, `${file} missing ${marker}`).toContain(marker);
      }
    }
  });

  it('keeps NAP-RELAY publish signing and canonical results wired through every host surface', () => {
    const relayTypes = readRepoFile(`${installedNapDist}/relay/types.d.ts`);

    expect(interfaceFieldNames(relayTypes, 'RelayPublishMessage')).toEqual(['id', 'event']);
    expect(interfaceFieldNames(relayTypes, 'RelayPublishResultMessage')).toEqual([
      'id',
      'ok',
      'event',
      'eventId',
      'error',
    ]);

    for (const { file, markers } of relayPublishRoutingSurfaces) {
      const source = readRepoFile(file);
      for (const marker of markers) {
        expect(source, `${file} missing ${marker}`).toContain(marker);
      }
    }
  });

  it('keeps handleRelayQuery wired to RelayEventResult query results', () => {
    const relayHandlerSrc = readRepoFile('packages/runtime/src/relay-handler.ts');
    const relayTypes = readRepoFile(`${installedNapDist}/relay/types.d.ts`);
    const outboxTypes = readRepoFile(`${installedNapDist}/outbox/types.d.ts`);
    const coreTypes = readRepoFile(installedCoreDist);
    const outboxServiceSrc = readRepoFile('packages/services/src/outbox-service.ts');
    const outboxRouterSrc = readRepoFile('packages/services/src/relay-pool-outbox-router.ts');
    const removedOutboxEose = `outbox.${'eose'}`;
    const removedStrategyType = `Outbox${'Strategy'}`;
    const removedTargetAuthors = `target${'Authors'}`;

    // (a) relay-handler.ts replies with 'relay.query.result'
    expect(relayHandlerSrc, 'relay-handler must emit relay.query.result').toContain(
      "'relay.query.result'",
    );

    // (b) relay-handler.ts produces the canonical events field (not count)
    //     The result object literal must carry `events` (the settled reply).
    expect(relayHandlerSrc, 'relay-handler relay.query.result must carry events field').toContain(
      '{ type: \'relay.query.result\', id, events }',
    );
    expect(relayHandlerSrc, 'relay-handler query events must be RelayEventResult records').toContain(
      'const events: RelayEventResult[] = []',
    );
    expect(relayHandlerSrc, 'relay-handler must wrap raw events in RelayEventResult').toContain(
      'createRelayEventResult',
    );

    // (c) The legacy count-based shape must not appear in the query.result reply
    //     Match the exact old object literal to avoid false positives on unrelated uses of 'count'.
    expect(relayHandlerSrc, 'relay-handler must not emit count in relay.query.result').not.toContain(
      "'relay.query.result', id, count",
    );

    // (d) handleRelayQuery consults relayServiceFrom — delegates to the registered relay service
    expect(relayHandlerSrc, 'relay-handler handleRelayQuery must call relayServiceFrom').toContain(
      'relayServiceFrom(context)',
    );

    // (e) NAP-OUTBOX no longer exposes outbox.eose; relay EOSE remains local to NAP-RELAY.
    expect(outboxServiceSrc, 'outbox service must not emit outbox.eose').not.toContain(
      `'${removedOutboxEose}'`,
    );
    expect(outboxServiceSrc, 'outbox service API must not export OutboxStrategy').not.toContain(
      removedStrategyType,
    );
    expect(outboxServiceSrc, 'outbox service options must not expose strategy').not.toContain(
      'strategy?:',
    );
    expect(outboxServiceSrc, 'outbox subscribe options must not expose live').not.toContain(
      'live?:',
    );
    expect(outboxRouterSrc, 'outbox router must not consume caller strategy').not.toContain(
      removedStrategyType,
    );
    expect(outboxRouterSrc, 'outbox router must not consume subscribe live option').not.toContain(
      'options?.live',
    );
    expect(outboxTypes, 'installed NAP-OUTBOX types must not export OutboxStrategy').not.toContain(
      removedStrategyType,
    );
    expect(outboxTypes, 'installed NAP-OUTBOX types must not expose outbox.eose').not.toContain(
      removedOutboxEose,
    );
    expect(outboxTypes, 'installed NAP-OUTBOX options must not expose strategy').not.toContain(
      'strategy?:',
    );
    expect(outboxTypes, 'installed NAP-OUTBOX subscribe options must not expose live').not.toContain(
      'live?:',
    );
    expect(outboxServiceSrc, 'outbox service publish options must not expose targetAuthors').not.toContain(
      removedTargetAuthors,
    );
    expect(outboxRouterSrc, 'outbox router must not consume targetAuthors').not.toContain(
      removedTargetAuthors,
    );
    expect(outboxTypes, 'installed NAP-OUTBOX publish options must not expose targetAuthors').not.toContain(
      removedTargetAuthors,
    );
    expect(coreTypes, 'installed core publish options must not expose targetAuthors').not.toContain(
      removedTargetAuthors,
    );

    expect(interfaceFieldNames(outboxTypes, 'OutboxEventOptions')).toEqual([
      'author',
      'relays',
      'timeoutMs',
    ]);
    expect(interfaceFieldNames(outboxTypes, 'OutboxQueryOptions')).toEqual([
      'authors',
      'relays',
      'limit',
      'timeoutMs',
    ]);
    expect(outboxTypes, 'installed NAP-OUTBOX subscribe options should alias query options').toContain(
      'OutboxSubscribeOptions = OutboxQueryOptions',
    );
    expect(outboxTypes, 'installed NAP-OUTBOX publish options should use the core contract').toContain(
      'type OutboxPublishOptions =',
    );
    expect(interfaceFieldNames(coreTypes, 'OutboxPublishOptions')).toEqual([
      'relays',
      'toOutbox',
      'toInboxes',
    ]);
    expect(interfaceFieldNames(outboxTypes, 'OutboxTarget')).toEqual([
      'authors',
      'pubkey',
      'direction',
    ]);
    expect(interfaceFieldNames(outboxTypes, 'OutboxEventMessage')).toContain('result');
    expect(interfaceFieldNames(outboxTypes, 'OutboxEventMessage')).not.toContain('event');

    // (f) Installed RelayQueryResultMessage interface carries 'events', not 'count'
    const queryResultFields = interfaceFieldNames(relayTypes, 'RelayQueryResultMessage');
    expect(queryResultFields, 'RelayQueryResultMessage must declare events').toContain('events');
    expect(queryResultFields, 'RelayQueryResultMessage must not declare count').not.toContain('count');
  });

  it('pins active INC guidance to merged authority and the implemented routing boundary', () => {
    const docs = [
      'RUNTIME-SPEC.md',
      'docs/policies/NIP-5D-CONFORMANCE.md',
      'packages/runtime/README.md',
      'packages/shell/README.md',
    ] as const;
    const exactHeads = ['5ac0490461ca6fec2f0d2e45b4835cf9bc08de24'] as const;

    for (const file of docs) {
      const source = readRepoFile(file);
      for (const head of exactHeads) expect(source, `${file} must pin ${head}`).toContain(head);
      expect(source, `${file} must retain exact stable convention identities`)
        .toMatch(/exact\s+stable\s+convention\s+topic\s+identity/i);
      expect(source, `${file} must retain opaque-topic routing`).toMatch(/opaque[\s\S]*`\?`[\s\S]*`#`/i);
      expect(source, `${file} must describe runtime-attested dTags`).toMatch(/runtime-attested dTag/i);
      expect(source, `${file} must not retain the superseded INC authority`).not.toContain(
        '6461e4b37c29dc09a20dff35d9515889c4433874',
      );
    }

    const runtimeSpec = readRepoFile('RUNTIME-SPEC.md');
    const policy = readRepoFile('docs/policies/NIP-5D-CONFORMANCE.md');
    const runtimeReadme = readRepoFile('packages/runtime/README.md');
    const shellReadme = readRepoFile('packages/shell/README.md');
    const incHandler = readRepoFile('packages/runtime/src/inc-handler.ts');
    const namespace = readRepoFile('packages/shell/src/napplet-namespace.ts');

    expect(runtimeSpec).toContain('Published-projection query-to-text-payload transposition');
    expect(policy).toContain('kehto/web#203');
    expect(policy).toContain('https://github.com/kehto/web/issues/203#issuecomment-5060904495');
    expect(policy).toContain('`on(topic, callback)` with one `IncEvent`');
    expect(runtimeReadme).toContain('open-time authorization');
    expect(shellReadme).toContain('target `inc.channel.opened` before the opener result');
    expect(shellReadme).toContain('`channel.list()` is informational only');
    expect(shellReadme).toContain('both deliver one `IncEvent`');

    expect(incHandler).toContain('const subscribers = state.subscriptions.get(topic);');
    expect(incHandler).toContain('sessionRegistry.getEntryByWindowId(windowId)?.dTag');
    expect(incHandler).toContain("type: 'inc.channel.opened'");
    expect(incHandler).not.toMatch(/topic\??\.startsWith\s*\(/);
    expect(namespace).toContain('INC subscriptions require a queryless topic identity');
    expect(namespace).toContain('function isConventionTopic');
    expect(namespace).toContain("return /^napplet:[^/?#]+\\/[^/?#]+$/.test(path);");
    expect(namespace).toContain('if (!isConventionTopic(topic)) return { topic };');
    expect(namespace).toContain("isConventionTopic(topic) && (topic.includes('?') || topic.includes('#'))");
    expect(namespace).toContain('payload: Object.fromEntries(entries)');
    expect(namespace).toContain('function deliverOpened');
    expect(namespace).toContain('function closeChannelState');
    expect(namespace).toContain("reason: 'buffer overflow'");
  });
});

it('bounds the temporary intent delivery binding to the protected host', () => {
  const policy = readFileSync('docs/policies/NIP-5D-CONFORMANCE.md', 'utf8');
  expect(policy).toContain('packages/services/src/intent-types.ts');
  expect(policy).toContain('fc121fc264615482143eda86125863d2e1f741a2');
});
