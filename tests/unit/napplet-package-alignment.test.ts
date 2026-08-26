import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const PACKAGE_VERSIONS = {
  '@napplet/core': '0.32.0',
  '@napplet/nap': '0.32.0',
  '@napplet/shim': '0.30.0',
  '@napplet/sdk': '0.28.0',
  '@napplet/vite-plugin': '0.14.1',
} as const;

const SUPERSEDED_EXACT_MATRIX = {
  '@napplet/core': '0.31.1',
  '@napplet/nap': '0.31.2',
  '@napplet/shim': '0.29.2',
  '@napplet/sdk': '0.27.2',
  '@napplet/vite-plugin': '0.14.0',
} as const;

const PUBLIC_CORE_RANGE = '>=0.32.0 <0.33.0';
const JSR_CORE_RANGE = 'jsr:@napplet/core@^0.32.0';
const JSR_NAP_RANGE = 'jsr:@napplet/nap@^0.32.0';

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

function activeNappletPackages(manifest: PackageJson): Array<[string, string]> {
  return [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies]
    .flatMap((group) => Object.entries(group ?? {}))
    .filter(([name]) => name in PACKAGE_VERSIONS);
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

describe('published Napplet package alignment', () => {
  it('discovers every active npm consumer and accepts only the published public range or exact app pin', () => {
    const manifests = walk(ROOT, 'package.json');
    const consumers = manifests
      .map((path) => ({ path: relative(ROOT, path), manifest: readJson<PackageJson>(path) }))
      .filter(({ manifest }) => activeNappletPackages(manifest).length > 0);

    expect(consumers.length).toBeGreaterThan(0);
    for (const { path, manifest } of consumers) {
      const isExactConsumer = path.startsWith('apps/playground/') || path.startsWith('tests/fixtures/napplets/');
      for (const [name, version] of activeNappletPackages(manifest)) {
        const expected = PACKAGE_VERSIONS[name as keyof typeof PACKAGE_VERSIONS];
        if (isExactConsumer || name === '@napplet/shim' || name === '@napplet/sdk' || name === '@napplet/vite-plugin') {
          expect(version, `${path} ${name} exact published pin`).toBe(expected);
        } else {
          expect(version, `${path} ${name} public declaration range`).toBe(PUBLIC_CORE_RANGE);
        }
      }
    }
  });

  it('discovers every JSR map and keeps core and nap on their matching published release line', () => {
    const jsrMaps = walk(ROOT, 'jsr.json')
      .map((path) => ({ path: relative(ROOT, path), imports: readJson<{ imports?: Record<string, string> }>(path).imports ?? {} }))
      .filter(({ imports }) => '@napplet/core' in imports || '@napplet/nap' in imports);

    expect(jsrMaps.length).toBeGreaterThan(0);
    for (const { path, imports } of jsrMaps) {
      if ('@napplet/core' in imports) expect(imports['@napplet/core'], `${path} core JSR map`).toBe(JSR_CORE_RANGE);
      if ('@napplet/nap' in imports) expect(imports['@napplet/nap'], `${path} nap JSR map`).toBe(JSR_NAP_RANGE);
    }
  });

  it('proves every active importer and final package snapshot resolves the exact official matrix', () => {
    const lock = readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8');
    const manifests = walk(ROOT, 'package.json');

    for (const path of manifests) {
      const relativePath = relative(ROOT, path);
      const dependencies = activeNappletPackages(readJson<PackageJson>(path));
      if (dependencies.length === 0) continue;
      const importer = lockImporterBlock(lock, relativePath.replace(/\/package\.json$/, '') || '.');
      for (const [name, version] of dependencies) {
        expect(importer, `${relativePath} locks ${name}`).toContain(`'${name}':`);
        expect(importer, `${relativePath} retains ${name} manifest specifier`).toMatch(
          new RegExp(`specifier: ['"]?${escapeRegExp(version)}['"]?`),
        );
        expect(importer, `${relativePath} resolves ${name} to its exact published release`).toContain(
          `version: ${PACKAGE_VERSIONS[name as keyof typeof PACKAGE_VERSIONS]}`,
        );
      }
    }

    for (const [name, version] of Object.entries(PACKAGE_VERSIONS)) {
      expect(lock, `final package snapshot for ${name}`).toContain(`'${name}@${version}':`);
    }

    for (const [name, version] of Object.entries(SUPERSEDED_EXACT_MATRIX)) {
      expect(lock, `superseded ${name}@${version} snapshot`).not.toContain(`'${name}@${version}':`);
    }
  });

  it('resolves the installed published package metadata from the frozen lock materialization', () => {
    for (const [name, version] of Object.entries(PACKAGE_VERSIONS)) {
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
