import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const loaderPath = 'apps/playground/src/playground-frame-loader.ts';
const srcdocPath = 'packages/shell/src/browser-admission.ts';

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
  it('accepts verified srcdoc through shared admission and approved CSP', () => {
    const result = runSourceAudit();
    expect(result.output).toContain('[audit:gateway-artifacts] OK');
    expect(result.status).toBe(0);
  });

  it.each([
    {
      name: 'raw srcdoc without admission output', path: loaderPath,
      before: 'iframe.srcdoc = srcdoc;',
      after: 'iframe.srcdoc = resolved.indexHtml;',
    },
    {
      name: 'unverified admission input', path: loaderPath,
      before: 'verifiedHtml: resolved.indexHtml,',
      after: 'verifiedHtml: unverifiedHtml,',
    },
    {
      name: 'missing CSP rendering', path: srcdocPath,
      before: 'buildApprovedNappletCsp({ mode, remoteSources: remote.sources, baseOrigin: request.baseOrigin })', after: "''",
    },
    {
      name: 'missing namespace injection', path: srcdocPath,
      before: 'cspMeta(csp) + renderNappletNamespacePrelude({ domains })', after: 'cspMeta(csp)',
    },
  ])('rejects $name', (mutation) => {
    const result = runSourceAudit(mutation);
    expect(result.status).toBe(1);
    expect(result.output).toContain('audit:gateway-artifacts FAILED');
  });
});
