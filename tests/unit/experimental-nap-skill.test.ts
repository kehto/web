import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the downstream kehto-experimental-nap agent skill: valid frontmatter,
// resolvable links, real public API references, and templates that cannot
// drift from the x-echo fixture (or the playground's copy of it).
const repoRoot = resolve(__dirname, '../..');
const skillDir = join(repoRoot, 'skills/kehto-experimental-nap');
const fixtureDir = join(repoRoot, 'tests/fixtures/experimental-nap');
const skillFiles = ['SKILL.md', ...readdirSync(join(skillDir, 'reference')).map((name) => `reference/${name}`)];
const read = (path: string) => readFileSync(path, 'utf8');

function exportedNames(indexPath: string): Set<string> {
  const source = read(indexPath);
  const names = new Set<string>();
  for (const block of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const raw of block[1].split(',')) {
      const name = raw.replace(/\/\/.*$/gm, '').trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  for (const match of source.matchAll(/export\s+(?:function|const|class|interface|type)\s+(\w+)/g)) names.add(match[1]);
  return names;
}

function memberDeclared(name: string): boolean {
  const dirs = ['packages/shell/src', 'packages/runtime/src', 'packages/paja/src'].map((dir) => join(repoRoot, dir));
  const pattern = new RegExp(`\\b${name}\\??\\s*[(:]`);
  return dirs.some((dir) => readdirSync(dir)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .some((file) => pattern.test(read(join(dir, file)))));
}

describe('kehto-experimental-nap skill', () => {
  it('has valid Agent Skills frontmatter', () => {
    const text = read(join(skillDir, 'SKILL.md'));
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    expect(match).not.toBeNull();
    const fields = Object.fromEntries(match![1].split('\n').map((line) => {
      const separator = line.indexOf(':');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }));
    expect(Object.keys(fields).sort()).toEqual(['description', 'name']);
    expect(fields.name).toBe('kehto-experimental-nap');
    expect(fields.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(fields.description.length).toBeGreaterThan(80);
    expect(fields.description.length).toBeLessThanOrEqual(1024);
    for (const trigger of ['experimental', 'x-', 'ShellAdapter.extensions', 'Paja', 'napplet/naps']) expect(fields.description).toContain(trigger);
    expect(text).toMatch(/## When NOT to use this/);
  });

  it('links only to files that exist', () => {
    for (const file of skillFiles) {
      const text = read(join(skillDir, file));
      for (const [, target] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (/^https?:/.test(target)) continue;
        expect(existsSync(resolve(dirname(join(skillDir, file)), target)), `${file} → ${target}`).toBe(true);
      }
      for (const [, path] of text.matchAll(/`(templates\/[\w./-]+|reference\/[\w./-]+)`/g)) {
        expect(existsSync(join(skillDir, path)), `${file} mentions ${path}`).toBe(true);
      }
      // Any other backticked relative file path must also resolve inside the
      // skill directory: a kehto repo path (such as a docs page) dangles in a
      // downstream checkout. Leading-slash tokens are routes (/__kehto/...)
      // and @scope/name tokens are package specifiers, so both are skipped.
      for (const [, path] of text.matchAll(/`([^`\s@/][^`\s]*\/[^`\s]*\.(?:md|ts|js|json|mjs))`/g)) {
        expect(existsSync(resolve(skillDir, path)), `${file} names ${path}, which does not exist in the skill`).toBe(true);
      }
    }
  });

  it('the how-to imports only public @kehto/* exports', () => {
    const howTo = read(join(repoRoot, 'docs/how-tos/experimental-nap.md'));
    const imports = [...howTo.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'(@kehto\/[^']+)'/g)];
    expect(imports.length).toBeGreaterThan(0);
    for (const [, names, specifier] of imports) {
      // A bare package specifier only: no src/ or dist/ deep imports.
      expect(specifier, `how-to imports ${specifier}`).toMatch(/^@kehto\/[a-z0-9-]+$/);
      const exported = exportedNames(join(repoRoot, 'packages', specifier.slice('@kehto/'.length), 'src/index.ts'));
      for (const raw of names.split(',')) {
        const name = raw.trim().split(/\s+as\s+/)[0]?.trim();
        if (name) expect(exported.has(name), `${specifier} does not export ${name}`).toBe(true);
      }
    }
  });

  it('references only real public @kehto/* exports or their declared members', () => {
    const exported = new Set([
      ...exportedNames(join(repoRoot, 'packages/shell/src/index.ts')),
      ...exportedNames(join(repoRoot, 'packages/paja/src/index.ts')),
      // Names the skill's own template defines (not kehto APIs).
      ...exportedNames(join(skillDir, 'templates/x-echo.js')),
    ]);
    const checked: string[] = [];
    for (const file of skillFiles) {
      for (const [, code] of read(join(skillDir, file)).matchAll(/`([^`\n]+)`/g)) {
        for (const [, name, member] of code.matchAll(/\b([a-z]+[A-Z]\w*|[A-Z][a-z]+[A-Z]\w*)\b(?:\.(\w+))?/g)) {
          checked.push(name);
          expect(exported.has(name) || memberDeclared(name), `${file}: ${name}`).toBe(true);
          if (member && exported.has(name)) expect(memberDeclared(member), `${file}: ${name}.${member}`).toBe(true);
        }
      }
    }
    for (const required of ['validateExtensionDomain', 'validateExtensionCapability', 'getShellExtensionBindings', 'prepareNappletSrcdoc', 'ShellExtensionError', 'ShellAdapter']) {
      expect(checked).toContain(required);
    }
  });

  it('ships templates byte-identical to the x-echo fixture and the playground copy', () => {
    const templates = readdirSync(join(skillDir, 'templates')).sort();
    expect(templates).toEqual(['paja.config.json', 'x-echo.js', 'x-echo.paja.spec.ts', 'x-echo.test.ts']);
    for (const name of templates) {
      expect(read(join(skillDir, 'templates', name)), name).toBe(read(join(fixtureDir, name)));
    }
    expect(read(join(repoRoot, 'apps/playground/src/extensions/x-echo.js'))).toBe(read(join(fixtureDir, 'x-echo.js')));
  });

  it('is packaged into the published @kehto/shell tarball', () => {
    const pkg = JSON.parse(read(join(repoRoot, 'packages/shell/package.json'))) as { files: string[]; scripts: { build: string } };
    expect(pkg.files).toContain('skills');
    expect(pkg.scripts.build).toContain('copy-agent-skill.mjs');
  });

  it('warns against secrets in Paja config settings (IN-07)', () => {
    const docs = [
      'docs/how-tos/experimental-nap.md',
      'docs/packages/paja.md',
      'packages/paja/README.md',
      'skills/kehto-experimental-nap/reference/security-invariants.md',
      'skills/kehto-experimental-nap/SKILL.md',
    ];
    for (const path of docs) {
      const text = read(join(repoRoot, path));
      expect(text, path).toContain('No secrets in config `settings`');
      expect(text, path).toContain('/__kehto/config.json');
    }
  });
});
