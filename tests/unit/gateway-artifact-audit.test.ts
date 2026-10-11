import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const loaderPath = 'apps/playground/src/playground-frame-loader.ts';
const srcdocPath = 'packages/shell/src/napplet-srcdoc.ts';

function runSourceAudit(mutate?: { path: string; before: string; after: string }) {
  const root = mkdtempSync(join(tmpdir(), 'kehto-gateway-audit-'));
  try {
    // Exercise the executable source guard using the real loader and helper.
    // Artifact checks run separately against built napplets in the Pages gate.
    for (const path of [
      'scripts/audit-gateway-artifacts.mjs',
      loaderPath,
      srcdocPath,
      'apps/playground/src/shell-host.ts',
    ]) {
      let source = readFileSync(join(process.cwd(), path), 'utf8');
      if (mutate?.path === path) {
        expect(source).toContain(mutate.before);
        source = source.replace(mutate.before, mutate.after);
      }
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), source);
    }
    mkdirSync(join(root, 'apps/playground/napplets'));
    const result = spawnSync(process.execPath, [join(root, 'scripts/audit-gateway-artifacts.mjs')], {
      encoding: 'utf8',
    });
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('executable gateway source audit', () => {
  it('accepts verified srcdoc through the shared CSP and namespace helper', () => {
    const result = runSourceAudit();
    expect(result.output).toContain('[audit:gateway-artifacts] OK');
    expect(result.status).toBe(0);
  });

  it.each([
    {
      name: 'raw srcdoc without the shared helper', path: loaderPath,
      before: 'iframe.srcdoc = prepareNappletSrcdoc(resolved.indexHtml, {',
      after: 'iframe.srcdoc = resolved.indexHtml; prepareNappletSrcdoc(resolved.indexHtml, {',
    },
    {
      name: 'unverified helper input', path: loaderPath,
      before: 'prepareNappletSrcdoc(resolved.indexHtml, {',
      after: 'prepareNappletSrcdoc(unverifiedHtml, {',
    },
    {
      name: 'missing CSP rendering', path: srcdocPath,
      before: 'renderNappletCspMeta(options.csp)', after: "''",
    },
    {
      name: 'missing namespace injection', path: srcdocPath,
      before: 'meta + renderNappletNamespacePrelude(options)', after: 'meta',
    },
  ])('rejects $name', (mutation) => {
    const result = runSourceAudit(mutation);
    expect(result.status).toBe(1);
    expect(result.output).toContain('audit:gateway-artifacts FAILED');
  });
});
