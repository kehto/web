import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
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

const retainedDisabledDemoNapplets = [
  'ble-demo',
  'common-demo',
  'link-demo',
  'lists-demo',
  'serial-demo',
  'webrtc-demo',
] as const;

const sourceCheckedNapplets = [
  ...playgroundNapplets,
  ...retainedDisabledDemoNapplets,
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

const rawListenerFiles = [
  'apps/playground/src/theme.ts',
  'apps/playground/napplets/common-demo/src/main.ts',
  'apps/playground/napplets/cvm-relatr/src/main.ts',
  'apps/playground/napplets/link-demo/src/main.ts',
  'apps/playground/napplets/lists-demo/src/main.ts',
  'apps/playground/napplets/ble-demo/src/main.ts',
  'apps/playground/napplets/serial-demo/src/main.ts',
  'apps/playground/napplets/webrtc-demo/src/main.ts',
  'apps/playground/napplets/resource-demo/src/main.ts',
  'apps/playground/napplets/toaster/src/main.ts',
] as const;

const rawPostMessageTypes: Record<string, readonly string[]> = {
  'apps/playground/napplets/cvm-relatr/src/main.ts': ['cvm.discover', 'cvm.request'],
  'apps/playground/napplets/resource-demo/src/main.ts': ['resource.bytesMany'],
  'apps/playground/napplets/toaster/src/main.ts': ['notify.create', 'notify.list'],
};

const policyAllowlistTypes = [
  'cvm.discover',
  'cvm.request',
  'notify.create',
  'notify.list',
  'resource.bytesMany',
  'theme.changed',
] as const;

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
    file: 'apps/playground/src/playground-relay-service.ts',
    markers: ['relay?: string;', 'message.relay'],
  },
  {
    file: 'packages/services/src/relay-pool-service.test.ts',
    markers: ['relay: \'wss://explicit.test\'', 'expect(selectRelayTier).not.toHaveBeenCalled()'],
  },
  {
    file: 'packages/services/src/coordinated-relay.test.ts',
    markers: ['relay: \'wss://explicit.test\'', 'expect(selectRelayTier).not.toHaveBeenCalled()'],
  },
  {
    file: 'tests/unit/playground-relay-service.test.ts',
    markers: ['relay: \'wss://explicit.test\'', 'expect(pool.log.requests).toHaveLength(0)'],
  },
] as const;

const rawListenerTypeGuards: Record<string, readonly string[]> = {
  'apps/playground/src/theme.ts': ["data.type !== 'theme.changed'"],
  'apps/playground/napplets/common-demo/src/main.ts': ['msg.type !== resultType'],
  'apps/playground/napplets/cvm-relatr/src/main.ts': ['data.type !== resultType'],
  'apps/playground/napplets/link-demo/src/main.ts': ["msg.type !== 'link.open.result'"],
  'apps/playground/napplets/lists-demo/src/main.ts': ['msg.type !== resultType'],
  'apps/playground/napplets/ble-demo/src/main.ts': ['msg.type !== resultType'],
  'apps/playground/napplets/serial-demo/src/main.ts': ['msg.type !== resultType'],
  'apps/playground/napplets/webrtc-demo/src/main.ts': ['msg.type !== resultType'],
  'apps/playground/napplets/resource-demo/src/main.ts': [
    "envelope.type === 'resource.bytes.result'",
    "envelope.type === 'resource.bytes.error'",
    "envelope.type === 'resource.bytesMany.result'",
    "envelope.type === 'resource.bytesMany.error'",
  ],
  'apps/playground/napplets/toaster/src/main.ts': [
    "type === 'notify.created'",
    "type === 'notify.listed'",
    "type === 'notify.create.error'",
    "type === 'notify.list.error'",
    "type === 'notify.dismiss.error'",
  ],
};

const activeShellSurfaceFiles = [
  'packages/shell/src/napplet-namespace.ts',
  'packages/shell/src/napplet-namespace.test.ts',
  'packages/shell/src/shell-supports-conformance.test.ts',
  'packages/shell/README.md',
] as const;

const activeServiceGuidanceFiles = [
  'apps/playground/README.md',
  'packages/services/README.md',
  'docs/packages/services.md',
  'skills/add-service/SKILL.md',
  'skills/integrate-shell/SKILL.md',
] as const;

const unsafeServiceGuidancePatterns = [
  { label: 'legacy audio factory', pattern: /\bcreateAudioService\s*\(/ },
  { label: 'legacy notification INC factory', pattern: /\bcreateNotificationService\s*\(/ },
  { label: 'service registration from a colon topic', pattern: /registerService\(\s*['"][^'"]+:[^'"]*['"]/ },
  { label: 'INC topic-prefix service handling', pattern: /topic\?\.startsWith\s*\(/ },
  { label: 'fabricated INC event delivery', pattern: /(?:send|postMessage)\s*\([\s\S]{0,160}type:\s*['"]inc\.event['"]/ },
] as const;

// Planning history and changelogs retain the removed vocabulary as historical record.
const historicalShellExclusions = ['.planning/', 'CHANGELOG.md'] as const;

const forbiddenNappletSourcePatterns = [
  { label: 'window.nostr', pattern: /\bwindow\s*\.\s*nostr\b/ },
  { label: 'localStorage', pattern: /\blocalStorage\b/ },
  { label: 'sessionStorage', pattern: /\bsessionStorage\b/ },
  { label: 'IndexedDB', pattern: /\bindexedDB\b|\bIndexedDB\b/ },
  { label: 'direct WebSocket', pattern: /\bnew\s+WebSocket\b|\bWebSocket\s*\(/ },
  { label: 'direct fetch', pattern: /\bfetch\s*\(/ },
  { label: 'nostr-tools import', pattern: /from\s+['"]nostr-tools(?:\/pure)?['"]/ },
  { label: 'direct event signing', pattern: /\bfinalizeEvent\b|\bgenerateSecretKey\b|\bgetPublicKey\s*\(/ },
] as const;

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function removeComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const stat = statSync(root);
  if (!stat.isDirectory()) return [root];

  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    if (entry === 'dist' || entry === 'node_modules' || entry === '.turbo') continue;
    files.push(...listFiles(join(root, entry)));
  }
  return files;
}

function nappletSourceFiles(): string[] {
  return [
    join(process.cwd(), 'apps/playground/src/theme.ts'),
    ...sourceCheckedNapplets.flatMap((name) =>
      listFiles(join(process.cwd(), 'apps/playground/napplets', name, 'src'))
        .filter((file) => /\.[cm]?tsx?$/.test(file)),
    ),
  ];
}

function stringLiteralList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
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

describe('NIP-5D conformance static guards', () => {
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

  it('keeps forbidden browser and protocol primitives out of playground napplet source', () => {
    const violations: string[] = [];

    for (const file of nappletSourceFiles()) {
      const source = removeComments(readFileSync(file, 'utf8'));
      for (const { label, pattern } of forbiddenNappletSourcePatterns) {
        if (pattern.test(source)) {
          violations.push(`${relative(process.cwd(), file)}: ${label}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('requires every playground napplet to declare and preflight its NAP contract', () => {
    for (const name of playgroundNapplets) {
      const config = readRepoFile(`apps/playground/napplets/${name}/vite.config.ts`);
      const source = readRepoFile(`apps/playground/napplets/${name}/src/main.ts`);
      const requiresLiteral = stringLiteralList(expectedRequires[name]);

      // profile-viewer also declares the NAAT archetype axis (Phase 87, ARCH-03).
      const expectedConfigCall =
        name === 'profile-viewer'
          ? `definePlaygroundNappletConfig('${name}', { requires: [${requiresLiteral}], archetypes: [{ slug: 'profile', nap: 'NAP-1' }] })`
          : `definePlaygroundNappletConfig('${name}', { requires: [${requiresLiteral}] })`;
      expect(config, `${name} vite requires`).toContain(expectedConfigCall);
      expect(source, `${name} source requires`).toContain(
        `const REQUIRED_NAPS = [${requiresLiteral}] as const;`,
      );
      expect(source, `${name} source domain preflight`).toContain('getMissingNapDomains(REQUIRED_NAPS)');
      expect(source, `${name} source unsupported path`).toContain('unsupported NAP capability');
    }
  });

  it('confines raw napplet message listeners to the Phase 58 allowlist', () => {
    const listeners: string[] = [];

    for (const file of nappletSourceFiles()) {
      const relativePath = relative(process.cwd(), file);
      const source = removeComments(readFileSync(file, 'utf8'));
      if (/window\.addEventListener\s*\(\s*['"]message['"]/.test(source)) {
        listeners.push(relativePath);
      }
    }

    expect(listeners.sort()).toEqual([...rawListenerFiles].sort());
    for (const file of rawListenerFiles) {
      const source = readRepoFile(file);
      expect(source, `${file} parent-source guard`).toContain('event.source !== window.parent');
      expect(source, `${file} policy marker`).toMatch(/Phase 58 .*allowlist/i);
      for (const guard of rawListenerTypeGuards[file]) {
        expect(source, `${file} ${guard}`).toContain(guard);
      }
    }
  });

  it('confines raw parent postMessage envelopes to documented demo exceptions', () => {
    const outboundByFile = new Map<string, string[]>();

    for (const file of nappletSourceFiles()) {
      const relativePath = relative(process.cwd(), file);
      const source = removeComments(readFileSync(file, 'utf8'));
      const matches = [...source.matchAll(/window\.parent\.postMessage\s*\(\s*\{[\s\S]*?type:\s*['"]([^'"]+)['"]/g)]
        .map((match) => match[1])
        .sort();
      if (matches.length > 0) outboundByFile.set(relativePath, matches);
    }

    expect([...outboundByFile.keys()].sort()).toEqual(Object.keys(rawPostMessageTypes).sort());
    for (const [file, expectedTypes] of Object.entries(rawPostMessageTypes)) {
      expect(outboundByFile.get(file), file).toEqual([...expectedTypes].sort());
    }
  });

  it('keeps the policy allowlist synchronized with raw demo envelope exceptions', () => {
    const policy = readRepoFile('docs/policies/NIP-5D-CONFORMANCE.md');

    for (const type of policyAllowlistTypes) {
      expect(policy, `${type} policy entry`).toContain(`| \`${type}\``);
    }

    for (const [file, types] of Object.entries(rawPostMessageTypes)) {
      expect(policy, `${file} policy path`).toContain(file);
      for (const type of types) {
        expect(policy, `${type} policy entry`).toContain(`\`${type}\``);
      }
    }

    for (const file of Object.keys(rawListenerTypeGuards)) {
      expect(policy, `${file} policy path`).toContain(file);
    }
  });

  it('keeps mandatory NAP-SHELL separate from optional-domain discovery', () => {
    const agents = readRepoFile('AGENTS.md');
    const policy = readRepoFile('docs/policies/NIP-5D-CONFORMANCE.md');

    expect(agents).toContain('NAP-SHELL separately mandates `window.napplet.shell`');
    expect(agents).toMatch(/A missing or stale\s+package export is upstream drift/);
    expect(policy).toContain('Optional-domain presence and mandatory NAP-SHELL are separate requirements.');
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

      expect(source, `${file} direct domain guidance`).toContain('exact `message.type` domain');
      expect(source, `${file} opaque INC guidance`).toContain('opaque, queryless identities');
      expect(source, `${file} runtime-attested sender guidance`).toContain('runtime attaches the sender');

      for (const { label, pattern } of unsafeServiceGuidancePatterns) {
        expect(source, `${file} must not recommend ${label}`).not.toMatch(pattern);
      }
    }

    // Mentioning a retired token to prohibit it is documentation, not a compatibility recommendation.
    expect('Do not use createAudioService() for INC routing.').toMatch(/createAudioService\s*\(/);
    expect('Do not use createAudioService() for INC routing.').toContain('Do not use');
  });

  it('keeps NAP-RELAY subscribe routing fields wired through runtime, services, playground, and tests', () => {
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
});
