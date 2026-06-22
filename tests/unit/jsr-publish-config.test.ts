import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  readonly name?: string;
  readonly private?: boolean;
}

describe('JSR publish configuration', () => {
  it('keeps every public @kehto package publishable by the release workflow', () => {
    const packagesDir = join(process.cwd(), 'packages');
    const missing: string[] = [];

    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const packageJsonPath = join(packagesDir, entry.name, 'package.json');
      if (!existsSync(packageJsonPath)) continue;

      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
      if (pkg.private === true || !pkg.name?.startsWith('@kehto/')) continue;

      const jsrPath = join(packagesDir, entry.name, 'jsr.json');
      if (!existsSync(jsrPath)) missing.push(pkg.name);
    }

    expect(missing).toEqual([]);
  });
});
