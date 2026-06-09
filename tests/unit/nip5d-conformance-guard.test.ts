import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
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
  feed: ['relay', 'theme'],
  'hotkey-chord': ['keys', 'theme'],
  'media-controller': ['media', 'theme'],
  preferences: ['storage', 'theme'],
  'profile-viewer': ['identity', 'theme'],
  'resource-demo': ['resource', 'connect', 'theme'],
  'theme-switcher': ['theme'],
  toaster: ['notify', 'theme'],
};

const rawListenerFiles = [
  'apps/playground/napplets/shared-theme.ts',
  'apps/playground/napplets/decrypt-demo/src/main.ts',
  'apps/playground/napplets/resource-demo/src/main.ts',
  'apps/playground/napplets/toaster/src/main.ts',
] as const;

const rawPostMessageTypes: Record<string, readonly string[]> = {
  'apps/playground/napplets/resource-demo/src/main.ts': ['resource.bytes'],
  'apps/playground/napplets/theme-switcher/src/main.ts': ['demo.publishTheme'],
  'apps/playground/napplets/toaster/src/main.ts': ['notify.create', 'notify.list'],
};

const policyAllowlistTypes = [
  'demo.publishTheme',
  'demo.decrypt.fixtures',
  'notify.create',
  'notify.list',
  'resource.bytes',
  'theme.changed',
] as const;

const rawListenerTypeGuards: Record<string, readonly string[]> = {
  'apps/playground/napplets/shared-theme.ts': ["data.type !== 'theme.changed'"],
  'apps/playground/napplets/decrypt-demo/src/main.ts': ["msg.type === 'demo.decrypt.fixtures'"],
  'apps/playground/napplets/resource-demo/src/main.ts': [
    "envelope.type === 'resource.bytes.result'",
    "envelope.type === 'resource.bytes.error'",
  ],
  'apps/playground/napplets/toaster/src/main.ts': [
    "type === 'notify.created'",
    "type === 'notify.listed'",
    "type === 'notify.create.error'",
    "type === 'notify.list.error'",
    "type === 'notify.dismiss.error'",
  ],
};

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
    join(process.cwd(), 'apps/playground/napplets/shared-theme.ts'),
    ...playgroundNapplets.flatMap((name) =>
      listFiles(join(process.cwd(), 'apps/playground/napplets', name, 'src'))
        .filter((file) => /\.[cm]?tsx?$/.test(file)),
    ),
  ];
}

function stringLiteralList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
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

      expect(config, `${name} vite requires`).toContain(
        `definePlaygroundNappletConfig('${name}', { requires: [${requiresLiteral}] })`,
      );
      expect(source, `${name} source requires`).toContain(
        `const REQUIRED_NAPS = [${requiresLiteral}] as const;`,
      );
      expect(source, `${name} source supports preflight`).toContain('.napplet.shell.supports');
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
});
