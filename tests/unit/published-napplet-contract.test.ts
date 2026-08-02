import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  IntentInvokeResultMessage,
  IntentRequest,
  IntentResult,
} from '../../node_modules/.pnpm/@napplet+nap@0.31.2/node_modules/@napplet/nap/dist/intent/index.js';
import type { Nip5aManifestOptions } from '../../node_modules/.pnpm/@napplet+vite-plugin@0.14.1_typescript@5.9.3_vite@6.4.2_jiti@2.6.1_yaml@2.8.3_/node_modules/@napplet/vite-plugin/dist/index.js';

const ROOT = process.cwd();
const NAP_INTENT_REF = '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24';
const NAP_INC_REF = '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24';
const NAP_SHELL_REF = '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24';
const NAP_RELAY_REF = '0be8abce18beb46ca37bd4ddd042f58d30b4eedc';
const SOURCE_REF = '3037200c932488f14f7f369b8583c39c9c16510a';
const SOURCE_MERGE_REF = 'b3f0007867eac109fa4917fac9c285d3b7cc6155';
const RELEASE_REF = 'a79e7f4638f70f4557d4183faee9348847bb8cc7';
const RELEASE_MERGE_REF = 'dc1d24153c759152b6ba31a6ec9bea967798f2df';

const PACKAGE_MATRIX = {
  '@napplet/core': ['0.31.1', 'packages/core'],
  '@napplet/nap': ['0.31.2', 'packages/nap'],
  '@napplet/shim': ['0.29.2', 'packages/shim'],
  '@napplet/sdk': ['0.27.2', 'packages/sdk'],
  '@napplet/vite-plugin': ['0.14.1', 'packages/vite-plugin'],
} as const;

const REQUEST = {
  archetype: 'profile',
  action: 'open',
  convention: 'napplet:profile/open',
  payload: { pubkey: 'abc123' },
} satisfies IntentRequest;

const RESULT = {
  type: 'intent.invoke.result',
  id: 'intent-1',
  result: {
    ok: true,
    archetype: 'profile',
    action: 'open',
    handled: true,
    handler: 'profile-viewer',
    convention: 'napplet:note/open',
  } satisfies IntentResult,
} satisfies IntentInvokeResultMessage;

const MANIFEST_OPTIONS = {
  nappletType: 'profile-viewer',
  archetypes: [{ slug: 'profile', convention: 'napplet:note/open' }],
} satisfies Nip5aManifestOptions;

function installedPackagePath(name: string, version: string): string {
  const escaped = name.replace('@', '').replace('/', '+');
  const packageDir = readdirSync(join(ROOT, 'node_modules/.pnpm'))
    .find((entry) => entry.startsWith(`@${escaped}@${version}`));
  expect(packageDir, `installed ${name}@${version}`).toBeTruthy();
  return join(ROOT, 'node_modules/.pnpm', packageDir ?? '', 'node_modules', name);
}

function packageText(name: string, version: string, path: string): string {
  return readFileSync(join(installedPackagePath(name, version), path), 'utf8');
}

function importInstalled(name: string, version: string, path: string): Promise<Record<string, unknown>> {
  return import(pathToFileURL(join(installedPackagePath(name, version), path)).href) as Promise<Record<string, unknown>>;
}

function interfaceBody(source: string, name: string): string {
  const start = source.indexOf(`interface ${name}`);
  expect(start, `missing ${name}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end + 2);
}

describe('published Napplet convention contract', () => {
  it('keeps services on published intent declarations without a competing local mirror', () => {
    const servicesSource = join(ROOT, 'packages/services/src');
    const activeSources = readdirSync(servicesSource)
      .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
      .map((entry) => readFileSync(join(servicesSource, entry), 'utf8'));

    expect(existsSync(join(servicesSource, 'intent-types.ts'))).toBe(false);
    expect(activeSources.join('\n')).not.toMatch(/from ['\"]\.\/intent-types\.js['\"]/);
  });

  it('compiles and imports the released intent, resource, SDK, and convention-archetype Vite surfaces', async () => {
    const [intent, resourceApi, sdk, vite] = await Promise.all([
      importInstalled('@napplet/nap', '0.31.2', 'dist/intent/index.js'),
      importInstalled('@napplet/nap', '0.31.2', 'dist/resource/index.js'),
      importInstalled('@napplet/sdk', '0.27.2', 'dist/index.js'),
      importInstalled('@napplet/vite-plugin', '0.14.1', 'dist/index.js'),
    ]);

    expect(REQUEST).toMatchObject({ convention: 'napplet:profile/open' });
    expect(typeof intent.intentInvoke).toBe('function');
    expect(intent.intentOnDelivery).toBeUndefined();
    expect(typeof resourceApi.resourceBytes).toBe('function');
    expect(typeof sdk.resource).toBe('object');
    expect(typeof vite.nip5aManifest).toBe('function');
    expect(RESULT).toMatchObject({ id: 'intent-1', result: { ok: true, handled: true } });
    expect(MANIFEST_OPTIONS.archetypes).toEqual([{ slug: 'profile', convention: 'napplet:note/open' }]);
  });

  it('records the exact NAP, source, and release evidence used for the published contract', () => {
    expect([NAP_INTENT_REF, NAP_INC_REF, NAP_SHELL_REF, NAP_RELAY_REF, SOURCE_REF, SOURCE_MERGE_REF, RELEASE_REF, RELEASE_MERGE_REF]).toEqual([
      '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
      '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
      '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
      '0be8abce18beb46ca37bd4ddd042f58d30b4eedc',
      '3037200c932488f14f7f369b8583c39c9c16510a',
      'b3f0007867eac109fa4917fac9c285d3b7cc6155',
      'a79e7f4638f70f4557d4183faee9348847bb8cc7',
      'dc1d24153c759152b6ba31a6ec9bea967798f2df',
    ]);
  });

  it('keeps every audited package on its official repository lineage without postinstall', () => {
    for (const [name, [version, directory]] of Object.entries(PACKAGE_MATRIX)) {
      const metadata = JSON.parse(packageText(name, version, 'package.json')) as {
        name: string;
        version: string;
        repository?: { url?: string; directory?: string };
        scripts?: Record<string, string>;
      };
      expect(metadata.name).toBe(name);
      expect(metadata.version).toBe(version);
      expect(metadata.repository?.url).toContain('github.com/sandwichfarm/napplet');
      expect(metadata.repository?.directory).toBe(directory);
      expect(metadata.scripts?.postinstall, `${name} may not run install-time code`).toBeUndefined();
    }
  });

  it('labels the generic core/shim shell omission as upstream package drift', () => {
    const core = packageText('@napplet/core', '0.31.1', 'dist/index.d.ts');
    const shim = packageText('@napplet/shim', '0.29.2', 'dist/index.d.ts');
    const global = interfaceBody(core, 'NappletGlobal');
    const napDomain = core.slice(core.indexOf('type NapDomain'), core.indexOf('declare const NAP_DOMAINS'));

    expect(global, 'upstream package drift: core NappletGlobal omits mandatory shell').not.toMatch(/\bshell\s*\??:/);
    expect(napDomain, 'upstream package drift: core NapDomain omits mandatory shell').not.toContain("'shell'");
    expect(shim, 'upstream package drift: shim exports no generic shell API').not.toMatch(/\bShell(?:Api|Environment|Capabilities)\b/);
  });

  it('labels the released relay request declaration as upstream drift from the NAP-RELAY draft', () => {
    const relayTypes = packageText('@napplet/nap', '0.31.2', 'dist/relay/types.d.ts');
    const relaySdk = packageText('@napplet/nap', '0.31.2', 'dist/relay/sdk.d.ts');

    expect(
      interfaceBody(relayTypes, 'RelayPublishMessage'),
      `upstream package drift at NAP-RELAY ${NAP_RELAY_REF}: shell receives an EventTemplate`,
    ).toContain('event: NostrEvent;');
    expect(relaySdk).toContain('relayPublish(template: EventTemplate');
  });

  it('confirms the released INC callback matches merged NAP-INC', () => {
    const incSdk = packageText('@napplet/nap', '0.31.2', 'dist/inc/sdk.d.ts');
    const namespace = readFileSync(join(ROOT, 'packages/shell/src/napplet-namespace.ts'), 'utf8');

    expect(
      incSdk,
      `NAP-INC ${NAP_INC_REF}: the callback receives one IncEvent`,
    ).toContain('callback: (event: IncEvent) => void');
    expect(namespace).toContain('on(topic: string, callback: (event: IncEvent) => void)');
  });

  it('requires the released structured invoke result and accepts orthogonal role/convention metadata', () => {
    const intentTypes = packageText('@napplet/nap', '0.31.2', 'dist/intent/types.d.ts');
    const viteDistribution = packageText('@napplet/vite-plugin', '0.14.1', 'dist/index.js');

    expect(interfaceBody(intentTypes, 'IntentInvokeResultMessage')).toContain('result: IntentResult;');
    expect(viteDistribution).toContain('archetype convention must be a queryless napplet:<archetype>/<intent> identity');
    expect(viteDistribution).not.toContain('slug !== conventionMatch[1]');
    expect(viteDistribution).not.toContain('slug !== conventionMatch[1].trim()');
  });
});
