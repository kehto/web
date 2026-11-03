import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Script, createContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const REDIRECT_SOURCE = join(ROOT, 'web/playground/index.html');
const WARNING_ID = 'KEHTO_PLAYGROUND_RETIRED';

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? '');
}

function runRedirectScripts(html: string): string[] {
  const warnings: string[] = [];
  const context = createContext({ console: { warn: (message: string) => warnings.push(message) } });
  for (const source of inlineScripts(html)) new Script(source).runInContext(context);
  return warnings;
}

function writeMinimalPagesArtifact(root: string, retiredPlaygroundHtml: string | null): void {
  writeFileSync(join(root, '.nojekyll'), '');
  writeFileSync(
    join(root, 'index.html'),
    '<a href="paja/"></a><a href="docs/"></a><link href="assets/landing.css"><script src="assets/vendor/gsap.min.js"></script><script src="assets/landing.js"></script><i id="hairline-accent"></i><i class="wordmark"></i><i class="notice"></i>',
  );
  mkdirSync(join(root, 'assets', 'vendor'), { recursive: true });
  for (const asset of ['landing.css', 'landing.js', 'vendor/gsap.min.js']) writeFileSync(join(root, 'assets', asset), '');
  mkdirSync(join(root, 'paja', '__kehto'), { recursive: true });
  writeFileSync(
    join(root, 'paja', 'index.html'),
    'id="runtime-pointer-form" hmr: <code>none</code> src="./__kehto/browser-host.js"',
  );
  writeFileSync(join(root, 'paja', '__kehto', 'browser-host.js'), '');
  writeFileSync(join(root, 'paja', '__kehto', 'config.json'), '{}');
  for (const page of ['packages/shell.html', 'policies/NIP-5D-CONFORMANCE.html', 'migrations/index.html', 'reference/api.html', 'api/modules/_kehto_shell.html']) {
    mkdirSync(join(root, 'docs', page, '..'), { recursive: true });
    writeFileSync(join(root, 'docs', page), '');
  }
  writeFileSync(join(root, 'docs', 'index.html'), '/web/docs/assets/');
  if (retiredPlaygroundHtml !== null) {
    mkdirSync(join(root, 'playground'), { recursive: true });
    writeFileSync(join(root, 'playground', 'index.html'), retiredPlaygroundHtml);
  }
}

function auditPages(root: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, ['scripts/audit-pages-artifact.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PAGES_OUT_DIR: root },
    encoding: 'utf8',
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('retired playground compatibility redirect (KEHTO_PLAYGROUND_RETIRED)', () => {
  it('removes the playground app and keeps only the tracked redirect source', () => {
    expect(existsSync(join(ROOT, 'apps/playground'))).toBe(false);
    expect(existsSync(REDIRECT_SOURCE)).toBe(true);
    expect(read('pnpm-workspace.yaml')).not.toContain('apps/playground');
    expect(read('playwright.config.ts')).not.toContain('@kehto/playground');
    expect(read('package.json')).not.toContain('@kehto/playground');
  });

  it('warns once per visit with a stable identifier and names the replacement', () => {
    const html = read('web/playground/index.html');
    const warnings = runRedirectScripts(html);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(`[${WARNING_ID}]`);
    expect(warnings[0]).toContain('/web/paja/');
    expect(warnings[0]).toMatch(/deprecated/);
    expect(warnings[0]).toMatch(/once per visit/);
  });

  it('redirects old links to Paja without loading napplets or the retired shell', () => {
    const html = read('web/playground/index.html');

    expect(html).toContain('<meta http-equiv="refresh" content="5; url=/web/paja/" />');
    expect(html).toContain('<link rel="canonical" href="/web/paja/" />');
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).not.toMatch(/<iframe|<script\s+[^>]*src=|napplet-gateway/);
  });

  it('keeps the portal on canonical destinations without linking the retired route', () => {
    const portal = read('web/index.html');

    expect(portal).not.toContain('href="playground/"');
    expect(portal).toContain('<a class="destination destination-primary" href="paja/" data-route-link>');
  });

  it('is tracked in the compatibility register', () => {
    const register = read('docs/compatibility.md');

    expect(register).toContain(WARNING_ID);
    expect(register).toContain('web/playground/index.html');
    expect(register).toContain('tests/unit/retired-playground-redirect.test.ts');
  });

  it('fails the Pages audit when the redirect is missing and passes when it is shipped', () => {
    const missing = mkdtempSync(join(tmpdir(), 'kehto-pages-no-redirect-'));
    const shipped = mkdtempSync(join(tmpdir(), 'kehto-pages-redirect-'));
    try {
      writeMinimalPagesArtifact(missing, null);
      const failed = auditPages(missing);
      expect(failed.status).toBe(1);
      expect(failed.output).toContain('retired playground redirect');

      writeMinimalPagesArtifact(shipped, read('web/playground/index.html'));
      const passed = auditPages(shipped);
      expect(passed.output).toContain('[audit:pages] OK');
      expect(passed.status).toBe(0);
    } finally {
      rmSync(missing, { recursive: true, force: true });
      rmSync(shipped, { recursive: true, force: true });
    }
  });
});
