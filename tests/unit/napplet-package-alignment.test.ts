import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

// Two deliberately separate lines. Fixture napplets stay on the exact published
// 0.32.0 matrix that the real shim/sdk/vite-plugin pins resolve against. Host
// packages (`packages/*`) develop and build on the line that carries the
// packaged NAP-LLM types.
const FIXTURE_VERSIONS = {
  '@napplet/core': '0.32.0',
  '@napplet/nap': '0.32.0',
  '@napplet/shim': '0.30.0',
  '@napplet/sdk': '0.28.0',
  '@napplet/vite-plugin': '0.16.2',
} as const;

const HOST_VERSIONS = {
  '@napplet/core': '0.41.0',
  '@napplet/nap': '0.40.0',
} as const;

const HOST_DEV_RANGES = {
  '@napplet/core': '>=0.41.0 <0.42.0',
  '@napplet/nap': '>=0.40.0 <0.41.0',
} as const;

const EXACT_ANYWHERE = ['@napplet/shim', '@napplet/sdk', '@napplet/vite-plugin'] as const;

type NappletName = keyof typeof FIXTURE_VERSIONS;

const SUPERSEDED_EXACT_MATRIX = {
  '@napplet/core': '0.31.1',
  '@napplet/nap': '0.31.2',
  '@napplet/shim': '0.29.2',
  '@napplet/sdk': '0.27.2',
  '@napplet/vite-plugin': '0.15.0',
} as const;

// Per-package peer windows. Packages whose declarations import the packaged
// NAP-LLM types (services, paja) need core 0.38 / nap 0.37, and cli follows its
// paja dependency so consumers never see a transitive peer conflict; the rest do not
// consume those types and keep the older floor. Upper bounds admit the host line.
const PEER_WINDOWS: Record<string, Partial<Record<NappletName, string>>> = {
  'packages/acl': { '@napplet/core': '>=0.32.0 <0.42.0', '@napplet/nap': '>=0.32.0 <0.41.0' },
  'packages/cli': { '@napplet/core': '>=0.41.0 <0.42.0', '@napplet/nap': '>=0.37.0 <0.41.0' },
  'packages/firewall': { '@napplet/core': '>=0.32.0 <0.42.0' },
  'packages/mocks': { '@napplet/core': '>=0.32.0 <0.42.0', '@napplet/nap': '>=0.32.0 <0.41.0' },
  'packages/paja': { '@napplet/core': '>=0.41.0 <0.42.0', '@napplet/nap': '>=0.37.0 <0.41.0' },
  'packages/runtime': { '@napplet/core': '>=0.32.0 <0.42.0', '@napplet/nap': '>=0.32.0 <0.41.0' },
  'packages/services': { '@napplet/core': '>=0.41.0 <0.42.0', '@napplet/nap': '>=0.37.0 <0.41.0' },
  'packages/shell': { '@napplet/core': '>=0.32.0 <0.42.0', '@napplet/nap': '>=0.32.0 <0.41.0' },
};

const JSR_HOST_RANGES = {
  '@napplet/core': 'jsr:@napplet/core@^0.41.0',
  '@napplet/nap': 'jsr:@napplet/nap@^0.40.0',
} as const;

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

function walk(root: string, fileName: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.planning') continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(path, fileName));
    else if (entry.name === fileName) files.push(path);
  }
  return files;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function isFixture(path: string): boolean {
  return path.startsWith('tests/fixtures/napplets/');
}

function isNapplet(name: string): name is NappletName {
  return name in FIXTURE_VERSIONS;
}

function groupEntries(group: Record<string, string> | undefined): Array<[NappletName, string]> {
  return Object.entries(group ?? {}).filter((entry): entry is [NappletName, string] => isNapplet(entry[0]));
}

function napplets(manifest: PackageJson): Array<[NappletName, string]> {
  return [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies].flatMap(groupEntries);
}

function expectedVersion(path: string, name: NappletName): string {
  if (isFixture(path) || !(name in HOST_VERSIONS)) return FIXTURE_VERSIONS[name];
  return HOST_VERSIONS[name as keyof typeof HOST_VERSIONS];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lockImporterBlock(lock: string, importer: string): string {
  const marker = `  ${importer}:\n`;
  const start = lock.indexOf(marker);
  expect(start, `missing lock importer ${importer}`).toBeGreaterThanOrEqual(0);
  const remainder = lock.slice(start + marker.length);
  const boundary = remainder.search(/\n  [^ ]/);
  return lock.slice(start, boundary === -1 ? lock.length : start + marker.length + boundary);
}

function consumers(): Array<{ path: string; manifest: PackageJson }> {
  return walk(ROOT, 'package.json')
    .map((path) => ({ path: relative(ROOT, path), manifest: readJson<PackageJson>(path) }))
    .filter(({ manifest }) => napplets(manifest).length > 0);
}

describe('published Napplet package alignment', () => {
  it('pins fixture napplets to the exact matrix and shim, sdk and vite-plugin exactly everywhere', () => {
    const all = consumers();
    expect(all.length).toBeGreaterThan(0);
    for (const { path, manifest } of all) {
      for (const [name, version] of napplets(manifest)) {
        if (isFixture(path) || (EXACT_ANYWHERE as readonly string[]).includes(name)) {
          expect(version, `${path} ${name} exact published pin`).toBe(FIXTURE_VERSIONS[name]);
        }
      }
    }
    expect(all.some(({ path }) => isFixture(path))).toBe(true);
  });

  it('develops host packages on the host line and gives each its own peer window', () => {
    const hosts = consumers().filter(({ path }) => !isFixture(path));
    expect(hosts.map(({ path }) => path.replace(/\/package\.json$/, '')).sort()).toEqual(Object.keys(PEER_WINDOWS).sort());
    for (const { path, manifest } of hosts) {
      const dir = path.replace(/\/package\.json$/, '');
      const window = PEER_WINDOWS[dir];
      for (const [name, version] of groupEntries(manifest.devDependencies)) {
        if ((EXACT_ANYWHERE as readonly string[]).includes(name)) continue;
        expect(version, `${path} ${name} host development range`).toBe(HOST_DEV_RANGES[name as keyof typeof HOST_DEV_RANGES]);
      }
      const peers = Object.fromEntries(groupEntries(manifest.peerDependencies));
      expect(peers, `${path} peer window`).toEqual(window);
    }
  });

  it('discovers every JSR map and moves core and nap to the host release line', () => {
    const jsrMaps = walk(ROOT, 'jsr.json')
      .map((path) => ({ path: relative(ROOT, path), imports: readJson<{ imports?: Record<string, string> }>(path).imports ?? {} }))
      .filter(({ imports }) => '@napplet/core' in imports || '@napplet/nap' in imports);

    expect(jsrMaps.length).toBeGreaterThan(0);
    for (const { path, imports } of jsrMaps) {
      if ('@napplet/core' in imports) expect(imports['@napplet/core'], `${path} core JSR map`).toBe(JSR_HOST_RANGES['@napplet/core']);
      if ('@napplet/nap' in imports) expect(imports['@napplet/nap'], `${path} nap JSR map`).toBe(JSR_HOST_RANGES['@napplet/nap']);
    }
  });

  it('proves every active importer and both package snapshots resolve the official matrix', () => {
    const lock = readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8');

    for (const { path, manifest } of consumers()) {
      const dependencies = napplets(manifest).filter(
        ([name, version]) => manifest.dependencies?.[name] === version || manifest.devDependencies?.[name] === version,
      );
      if (dependencies.length === 0) continue;
      const importer = lockImporterBlock(lock, path.replace(/\/package\.json$/, ''));
      for (const [name, version] of dependencies) {
        expect(importer, `${path} locks ${name}`).toContain(`'${name}':`);
        expect(importer, `${path} retains ${name} manifest specifier`).toMatch(
          new RegExp(`specifier: ['"]?${escapeRegExp(version)}['"]?`),
        );
        expect(importer, `${path} resolves ${name} to its exact published release`).toContain(
          `version: ${expectedVersion(path, name)}`,
        );
      }
    }

    for (const [name, version] of [...Object.entries(FIXTURE_VERSIONS), ...Object.entries(HOST_VERSIONS)]) {
      expect(lock, `final package snapshot for ${name}`).toContain(`'${name}@${version}':`);
    }

    for (const [name, version] of Object.entries(SUPERSEDED_EXACT_MATRIX)) {
      expect(lock, `superseded ${name}@${version} snapshot`).not.toContain(`'${name}@${version}':`);
    }
  });

  it('resolves the installed published package metadata from the frozen lock materialization', () => {
    for (const [name, version] of [...Object.entries(FIXTURE_VERSIONS), ...Object.entries(HOST_VERSIONS)]) {
      const escaped = name.replace('@', '').replace('/', '+');
      const packageDir = readdirSync(join(ROOT, 'node_modules/.pnpm'))
        .find((entry) => entry.startsWith(`@${escaped}@${version}`));
      expect(packageDir, `installed ${name}@${version}`).toBeTruthy();
      const metadataPath = join(ROOT, 'node_modules/.pnpm', packageDir ?? '', 'node_modules', name, 'package.json');
      expect(existsSync(metadataPath), `installed metadata for ${name}`).toBe(true);
      expect(readJson<{ version: string }>(metadataPath).version).toBe(version);
    }
  });
});
