import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sdkTargetDirs = [
  'apps/playground/napplets/bot',
  'apps/playground/napplets/chat',
  'apps/playground/napplets/composer',
  'apps/playground/napplets/feed',
  'apps/playground/napplets/preferences',
  'apps/playground/napplets/profile-viewer',
  'apps/playground/napplets/resource-demo',
  'apps/playground/napplets/toaster',
  'tests/fixtures/napplets/nap-identity',
  'tests/fixtures/napplets/nap-inc',
  'tests/fixtures/napplets/nap-notify',
  'tests/fixtures/napplets/nap-relay',
  'tests/fixtures/napplets/nap-storage',
  'tests/fixtures/napplets/nap-theme',
] as const;

const helperTargetDirs = [
  ...sdkTargetDirs,
  'apps/playground/napplets/link-demo',
] as const;

const publicPackageDirs = [
  'packages/acl',
  'packages/cli',
  'packages/firewall',
  'packages/paja',
  'packages/runtime',
  'packages/services',
  'packages/shell',
] as const;

const publishedManifestDirs = [
  ...publicPackageDirs,
  'packages/nip',
] as const;

const protocolPackageNames = [
  '@napplet/core',
  '@napplet/nap',
  '@napplet/sdk',
  '@napplet/shim',
  '@napplet/vite-plugin',
] as const;

const protocolPackageVersions: Record<(typeof protocolPackageNames)[number], string> = {
  '@napplet/core': '0.32.0',
  '@napplet/nap': '0.32.0',
  '@napplet/sdk': '0.28.0',
  '@napplet/shim': '0.30.0',
  '@napplet/vite-plugin': '0.14.1',
};

const protocolAuthorities = Object.freeze({
  napIntent: '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
  napIdentityTheme: '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
  publishedSource: '3037200c932488f14f7f369b8583c39c9c16510a',
  publishedSourceMerge: 'b3f0007867eac109fa4917fac9c285d3b7cc6155',
  publishedRelease: 'a79e7f4638f70f4557d4183faee9348847bb8cc7',
  publishedReleaseMerge: 'dc1d24153c759152b6ba31a6ec9bea967798f2df',
  napResource: '9511232f69313aa7953d110e35d32cc28d506f66',
  resourceSource: 'bfaa2428503d1e9d7fa4677998500e6a0b188b28',
  resourceMerge: '19e0029b228127769a0ebdcf0b6b2f30293bd284',
  resourceRelease: 'de1cb7ebb94c4acb76e5671babcf077247170af1',
  resourcePublish: 'b007587afbefb0ce5592825d6ec1fc5b026c7b08',
});

// Only these executable product paths are migration evidence. Archived plans,
// release records, and intentional fixture inputs remain classified exclusions.
const activeMigrationSourceDirs = [
  ...sdkTargetDirs.filter((dir) => dir.startsWith('apps/playground/')),
  ...publicPackageDirs.map((dir) => `${dir}/src`),
  'packages/nip/src',
] as const;

const historicalMigrationExclusions = [
  '.planning/',
  '.changeset/',
  'CHANGELOG.md',
  'tests/fixtures/napplets/',
] as const;

// Current user-facing guidance is audited independently from executable source.
// The dated design remains listed so its authoritative warning cannot regress;
// its dated body is historical material and is intentionally not vocabulary-scanned.
const activeMigrationTextFiles = [
  'README.md',
  'apps/playground/README.md',
  'docs/reference/api.md',
  'docs/policies/NIP-5D-CONFORMANCE.md',
  'docs/superpowers/specs/2026-06-15-nap-intent-design.md',
  'packages/acl/README.md',
  'packages/cli/README.md',
  'packages/firewall/README.md',
  'packages/nip/README.md',
  'packages/paja/README.md',
  'packages/runtime/README.md',
  'packages/services/README.md',
  'packages/shell/README.md',
] as const;

const obsoleteActivePatterns = {
  'numbered-negotiation': { roots: activeMigrationSourceDirs, pattern: /\bnap-(?:110|117|98)\b/i },
  'query-bearing-stable-identity': { roots: activeMigrationSourceDirs, pattern: /(?:convention|identity|route)\s*(?:=|:)\s*['"`][^'"`\n]*\?/ },
  'prefix-or-query-matching': { roots: activeMigrationSourceDirs, pattern: /\b(?:topic|convention)\.(?:startsWith|includes)\(\s*[^'"`]/ },
  'caller-supplied-sender': { roots: ['packages/runtime/src'], pattern: /(?:m|message)\.sender\b/ },
  'intent-completion-fields': { roots: ['packages/services/src', 'packages/paja/src', 'apps/playground/src'], pattern: /\btype\s*:\s*['"`]intent\.(?:invoke|deliver)(?:\.result)?['"`][\s\S]{0,120}\b(?:handled|windowId|newWindow)\s*:/ },
  'inc-coupled-intent': { roots: ['packages/services/src', 'packages/paja/src', 'apps/playground/src'], pattern: /(?:\btype\s*:\s*['"`]inc\.(?:emit|subscribe)['"`][^}]{0,160}['"`]intent\.|\btype\s*:\s*['"`]intent\.(?:invoke|deliver)(?:\.result)?['"`][^}]{0,160}['"`]inc\.(?:emit|subscribe)['"`])/ },
  'intent-lifecycle-result-fields': { roots: ['packages/services/src', 'packages/paja/src', 'apps/playground/src'], pattern: /intent\.(?:deliver\.result|accepted)\b/ },
  'intent-delivery-identifiers': { roots: ['packages/services/src', 'packages/paja/src', 'apps/playground/src'], pattern: /\b(?:intentId|deliveryId)\b/ },
} as const;

// Documentation has a different grammar from executable TypeScript. Keep its
// narrow forbidden set separate so current prose can explain the active intent
// boundary without being mistaken for a deprecated object literal.
const obsoleteGuidancePatterns = {
  'numbered-negotiation': /\bnap-(?:110|117|98)\b/i,
  'query-bearing-stable-identity': /(?:convention|identity|route)\s*(?:=|:)\s*['"`][^'"`\n]*\?/,
  'intent-completion-fields': /\btype\s*:\s*['"`]intent\.(?:invoke|deliver)(?:\.result)?['"`][\s\S]{0,120}\b(?:handled|windowId|newWindow)\s*:/,
  'intent-lifecycle-result-fields': /intent\.(?:deliver\.result|accepted)\b/,
  'intent-delivery-identifiers': /\b(?:intentId|deliveryId)\b/,
} as const;

const currentGuidanceAuthorities = {
  'docs/policies/NIP-5D-CONFORMANCE.md': [
    'NAP-INTENT:',
    '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
  ],
  'packages/nip/README.md': [
    'merged [NAP-INTENT at',
    '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
  ],
  'packages/runtime/README.md': [
    'merged [NAP-INTENT at',
    '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
  ],
  'packages/services/README.md': [
    'merged [NAP-INTENT at',
    '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
  ],
  'packages/shell/README.md': [
    'merged [NAP-INTENT at',
    '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
  ],
} as const;

const bannedSdkImportPattern = /from\s+['"]@napplet\/sdk['"]/;
const staleNapSegment = [110, 117, 98].map((code) => String.fromCharCode(code)).join('');
const staleNapPackage = ['@napplet', staleNapSegment].join('/');
const removedTransportNamespace = ['i', 'f', 'c'].join('');
const namespaceImportPattern = new RegExp(
  String.raw`import\s+\{[^}]*\b(storage|relay|identity|keys|config|notify)\b[^}]*\}\s+from\s+['"]@napplet/sdk['"]`,
  's',
);
type ManifestDependencies = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function expectExactProtocolLine(
  pkg: ManifestDependencies,
  dir: string,
  packageNames: readonly (typeof protocolPackageNames)[number][],
): void {
  for (const packageName of packageNames) {
    expect(
      pkg.dependencies?.[packageName] ?? pkg.devDependencies?.[packageName],
      `${dir} ${packageName} must use the final exact Napplet release`,
    ).toBe(protocolPackageVersions[packageName]);
  }
}

function sourceFiles(root: string): string[] {
  expect(
    existsSync(root),
    `active migration root is missing: ${relative(process.cwd(), root)}`,
  ).toBe(true);
  const entries = readdirSync(root);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.turbo') continue;
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (/\.[cm]?tsx?$/.test(path) && !/\.test\.[cm]?tsx?$/.test(path)) {
      files.push(path);
    }
  }
  return files;
}

function activeSourceFiles(root: string): string[] {
  const files = sourceFiles(root);
  expect(
    files,
    `active migration root has no source files: ${relative(process.cwd(), root)}`,
  ).not.toEqual([]);
  return files;
}

function matchingLines(text: string, pattern: RegExp): number[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  return Array.from(text.matchAll(globalPattern), (match) =>
    text.slice(0, match.index).split(/\r?\n/).length,
  );
}

function patternViolations(
  file: string,
  text: string,
  patterns: Record<string, RegExp>,
): string[] {
  const violations: string[] = [];
  for (const [patternId, pattern] of Object.entries(patterns)) {
    for (const line of matchingLines(text, pattern)) {
      violations.push(`${patternId}:${file}:${line}`);
    }
  }
  return violations;
}

describe('current @napplet package graph guard', () => {
  it('keeps this guard scoped to classified live migration sources rather than repository history', () => {
    const guard = readFileSync(
      join(process.cwd(), 'tests/unit/sdk-migration-guard.test.ts'),
      'utf8',
    );
    const activeSources = ['const', 'activeMigrationSourceDirs'].join(' ');
    const exclusions = ['const', 'historicalMigrationExclusions'].join(' ');

    expect(guard).toContain(activeSources);
    expect(guard).toContain(exclusions);
    const broadHistoryScan = ['execFileSync', "('git', ['ls-files', '-z'])"].join('');
    expect(guard).not.toContain(broadHistoryScan);
    expect(historicalMigrationExclusions).toEqual([
      '.planning/',
      '.changeset/',
      'CHANGELOG.md',
      'tests/fixtures/napplets/',
    ]);
  });

  it('classifies current guidance and a superseded design without scanning historical material as live behavior', () => {
    expect(activeMigrationTextFiles).toContain('README.md');
    expect(activeMigrationTextFiles).toContain('docs/reference/api.md');
    expect(activeMigrationTextFiles).toContain('docs/superpowers/specs/2026-06-15-nap-intent-design.md');
    expect(Object.keys(obsoleteActivePatterns)).not.toEqual([]);

    for (const file of activeMigrationTextFiles) {
      expect(existsSync(join(process.cwd(), file)), `current guidance ${file}`).toBe(true);
      const text = readFileSync(join(process.cwd(), file), 'utf8');
      if (file === 'docs/superpowers/specs/2026-06-15-nap-intent-design.md') {
        expect(text.startsWith('> **Superseded historical design')).toBe(true);
        expect(text).toContain('NIP-5D-CONFORMANCE.md');
        expect(text).toContain('106-AUTHORITY-REVALIDATION.md');
        continue;
      }

      expect(patternViolations(file, text, obsoleteGuidancePatterns)).toEqual([]);
    }

    for (const [file, requiredAuthorityText] of Object.entries(currentGuidanceAuthorities)) {
      const text = readFileSync(join(process.cwd(), file), 'utf8');
      for (const authorityText of requiredAuthorityText) {
        expect(text, `${file} current authority ${authorityText}`).toContain(authorityText);
      }
    }
  });

  it('records the exact released convention and package authorities in active evidence', () => {
    expect(protocolAuthorities).toEqual({
      napIntent: '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
      napIdentityTheme: '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
      publishedSource: '3037200c932488f14f7f369b8583c39c9c16510a',
      publishedSourceMerge: 'b3f0007867eac109fa4917fac9c285d3b7cc6155',
      publishedRelease: 'a79e7f4638f70f4557d4183faee9348847bb8cc7',
      publishedReleaseMerge: 'dc1d24153c759152b6ba31a6ec9bea967798f2df',
      napResource: '9511232f69313aa7953d110e35d32cc28d506f66',
      resourceSource: 'bfaa2428503d1e9d7fa4677998500e6a0b188b28',
      resourceMerge: '19e0029b228127769a0ebdcf0b6b2f30293bd284',
      resourceRelease: 'de1cb7ebb94c4acb76e5671babcf077247170af1',
      resourcePublish: 'b007587afbefb0ce5592825d6ec1fc5b026c7b08',
    });

    const publishedContract = readFileSync(
      join(process.cwd(), 'tests/unit/published-napplet-contract.test.ts'),
      'utf8',
    );
    for (const authority of Object.values(protocolAuthorities)) {
      expect(publishedContract, `published contract authority ${authority}`).toContain(authority);
    }
  });

  it('resolves active protocol packages from published registry artifacts', () => {
    const rootPackageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    const workspace = readFileSync(join(process.cwd(), 'pnpm-workspace.yaml'), 'utf8');
    const lockfile = readFileSync(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8');

    expect(workspace).not.toContain('napplet/packages/*');
    expect(lockfile).not.toMatch(/link:.*napplet/);
    expect(lockfile).not.toContain('napplet/packages');
    for (const pkg of protocolPackageNames) {
      expect(rootPackageJson.pnpm?.overrides ?? {}).not.toHaveProperty(pkg);
      expect(lockfile).toContain(`'${pkg}@${protocolPackageVersions[pkg]}':`);
    }
  });

  it('keeps SDK-migrated manifests on the final exact NAP package graph', () => {
    for (const dir of sdkTargetDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expectExactProtocolLine(pkg, dir, ['@napplet/sdk', '@napplet/shim', '@napplet/nap', '@napplet/vite-plugin']);
      expect(pkg.dependencies?.[staleNapPackage], `${dir} ${staleNapPackage}`).toBeUndefined();
    }
  });

  it('keeps helper-migrated manifests on the final exact NAP helper graph', () => {
    for (const dir of helperTargetDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expectExactProtocolLine(pkg, dir, ['@napplet/shim', '@napplet/nap', '@napplet/vite-plugin']);
      expect(pkg.dependencies?.[staleNapPackage], `${dir} ${staleNapPackage}`).toBeUndefined();
    }
  });

  it('admits only the current @napplet 0.32 line on published kehto packages', () => {
    // Kehto runtime packages track the current NAP contract so new canonical
    // fields are wired through runtime, services, shell, Paja, docs, and tests.
    const PEER_RANGE = '>=0.32.0 <0.33.0';
    const DEV_RANGE = '>=0.32.0 <0.33.0';
    for (const dir of publicPackageDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        peerDependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      if (pkg.peerDependencies?.['@napplet/nap'] || pkg.devDependencies?.['@napplet/nap']) {
        expect(pkg.peerDependencies?.['@napplet/nap'], `${dir} @napplet/nap peer`).toBe(PEER_RANGE);
        expect(pkg.devDependencies?.['@napplet/nap'], `${dir} @napplet/nap dev`).toBe(DEV_RANGE);
      }
      expect(pkg.peerDependencies?.['@napplet/core'], `${dir} @napplet/core peer`).toBe(PEER_RANGE);
      expect(pkg.devDependencies?.['@napplet/core'], `${dir} @napplet/core dev`).toBe(DEV_RANGE);
      expect(pkg.peerDependencies?.[staleNapPackage], `${dir} ${staleNapPackage} peer`).toBeUndefined();
      expect(pkg.devDependencies?.[staleNapPackage], `${dir} ${staleNapPackage} dev`).toBeUndefined();
    }
  });

  it('uses inclusive upper bounds in published dependency ranges', () => {
    for (const dir of publishedManifestDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const content = readFileSync(packageJsonPath, 'utf8');
      const pkg = JSON.parse(content) as {
        peerDependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const ranges = [
        ...Object.values(pkg.peerDependencies ?? {}),
        ...Object.values(pkg.devDependencies ?? {}),
      ];

      expect(content, dir).not.toContain(' <0.26.0');
      expect(content, dir).not.toContain(' <3.0.0');
      expect(content, dir).not.toContain('<=0.25.x');
      expect(ranges, `${dir} dependency ranges`).not.toContain('>=0.23.0 <0.26.0');
      expect(ranges, `${dir} dependency ranges`).not.toContain('>=2.23.3 <3.0.0');
      if (pkg.peerDependencies?.['nostr-tools']) {
        expect(pkg.peerDependencies['nostr-tools'], `${dir} nostr-tools peer`).toBe('>=2.23.3 <=2.x');
      }
    }
  });

  it('uses the renamed NAP relay union type at the runtime boundary', () => {
    const file = join(process.cwd(), 'packages/runtime/src/relay-handler.ts');
    const content = readFileSync(file, 'utf8');

    expect(content).toContain("import type { RelayMessage } from '@napplet/nap/relay/types';");
    expect(content).not.toContain('RelayNapMessage');
    // Also reject the pre-rename relay union alias (assembled to avoid a literal).
    expect(content).not.toContain(`Relay${staleNapSegment[0].toUpperCase()}${staleNapSegment.slice(1)}Message`);
  });

  it('rejects old napplet helper package resolutions from the active lockfile graph', () => {
    const lockfile = readFileSync(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8');

    expect(lockfile).not.toMatch(/@napplet\/(?:core|shim|vite-plugin)@0\.2\.1/);
    const oldNapHelperPattern = new RegExp(
      String.raw`@napplet\/${staleNapSegment}-(?:identity|inc|keys|media|notify|relay|storage|theme)@0\.2\.1`,
    );
    expect(lockfile).not.toMatch(oldNapHelperPattern);
  });

  it('rejects legacy namespace imports from @napplet/sdk in migrated source', () => {
    const violations: string[] = [];
    for (const dir of sdkTargetDirs) {
      for (const file of activeSourceFiles(join(process.cwd(), dir, 'src'))) {
        const content = readFileSync(file, 'utf8');
        if (bannedSdkImportPattern.test(content) || namespaceImportPattern.test(content)) {
          violations.push(relative(process.cwd(), file));
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('rejects the removed transport vocabulary only in classified live migration sources', () => {
    const violations: string[] = [];
    const pattern = new RegExp(removedTransportNamespace, 'i');

    for (const dir of activeMigrationSourceDirs) {
      for (const abs of activeSourceFiles(join(process.cwd(), dir))) {
        const file = relative(process.cwd(), abs);
        const content = readFileSync(abs, 'utf8');
        const lines = content.split(/\r?\n/);
        for (const [index, line] of lines.entries()) {
          if (pattern.test(line)) violations.push(`${file}:${index + 1}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('fails closed when a configured active source root is missing', () => {
    expect(() => sourceFiles(join(process.cwd(), '.missing-active-migration-root'))).toThrow(
      'active migration root is missing',
    );
  });

  it('fails closed when a configured active source root has no qualifying source files', () => {
    const root = mkdtempSync(join(tmpdir(), 'kehto-empty-active-root-'));
    try {
      expect(() => activeSourceFiles(root)).toThrow('active migration root has no source files');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('matches multiline obsolete intent object shapes before reporting the match line', () => {
    const completion = [
      "type: 'intent.invoke.result',",
      'handled: true,',
    ].join('\n');
    const incCoupling = [
      "type: 'intent.invoke',",
      "transport: 'inc.emit',",
    ].join('\n');

    expect(matchingLines(completion, obsoleteActivePatterns['intent-completion-fields'].pattern)).toEqual([1]);
    expect(matchingLines(incCoupling, obsoleteActivePatterns['inc-coupled-intent'].pattern)).toEqual([1]);
  });

  it('rejects each scoped obsolete negotiation and intent shape with exact active file and line evidence', () => {
    expect(activeMigrationSourceDirs.length).toBeGreaterThan(0);
    expect(activeMigrationTextFiles.length).toBeGreaterThan(0);
    expect(Object.keys(obsoleteActivePatterns).length).toBeGreaterThan(0);
    const violations: string[] = [];

    for (const [patternId, { roots, pattern }] of Object.entries(obsoleteActivePatterns)) {
      for (const root of roots) {
        for (const abs of activeSourceFiles(join(process.cwd(), root))) {
          const file = relative(process.cwd(), abs);
          const text = readFileSync(abs, 'utf8');
          for (const line of matchingLines(text, pattern)) {
            violations.push(`${patternId}:${file}:${line}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

});
