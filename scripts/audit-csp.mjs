#!/usr/bin/env node
/**
 * scripts/audit-csp.mjs -- meta-CSP residual-tag audit for napplet dist/ outputs.
 *
 * Enforces NAP-CONNECT C-03 invariant: shell is the sole CSP authority.
 * Any meta tag with http-equiv="Content-Security-Policy" in a built napplet
 * HTML file is a build-breaker -- napplet developers must not set CSP via
 * meta tags (canonical NAP-CONNECT forbids it; shell emits HTTP headers).
 *
 * Scope (D14): apps/playground/napplets/{name}/dist/index.html for each napplet
 * directory -- napplet build outputs only, not the demo-app's own dist.
 *
 * Whitelist (D15): none. ANY matching tag fails the build.
 *
 * Wiring (D13, D16): root "pnpm audit:csp" + GitHub Actions Build workflow
 * step after "pnpm build" (Plan 39-03 adds the workflow step).
 *
 * @see docs/policies/SHELL-CONNECT-POLICY.md (Plan 39-05) for the policy.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const nappletsDir = join(repoRoot, 'apps', 'playground', 'napplets');

// Case-insensitive meta-CSP tag matcher. Matches:
//   <meta http-equiv="Content-Security-Policy" ...>
//   <META HTTP-EQUIV='content-security-policy' ...>
// The http-equiv attr value may be single-quoted, double-quoted, or unquoted.
const META_CSP_REGEX = /<meta\s+[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/i;

/** @type {Array<{ file: string; line: number; text: string }>} */
const violations = [];

if (!existsSync(nappletsDir)) {
  console.error(`[audit:csp] napplet directory not found: ${nappletsDir}`);
  process.exit(1);
}

const nappletNames = readdirSync(nappletsDir).filter((name) => {
  const p = join(nappletsDir, name);
  return statSync(p).isDirectory();
});

let filesScanned = 0;

for (const name of nappletNames) {
  const htmlPath = join(nappletsDir, name, 'dist', 'index.html');
  if (!existsSync(htmlPath)) {
    // Not an error -- not every napplet directory has a built dist/ (e.g.,
    // during partial builds). Skip silently. The GitHub Actions workflow
    // runs this after "pnpm build", which builds every napplet.
    continue;
  }
  filesScanned++;
  const content = readFileSync(htmlPath, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (META_CSP_REGEX.test(lines[i])) {
      violations.push({ file: htmlPath, line: i + 1, text: lines[i].trim() });
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) {
    console.error(
      `audit:csp FAILED — meta-CSP tag found in ${v.file}:${v.line}. Remove it — shell is CSP authority.`,
    );
    console.error(`  > ${v.text}`);
  }
  console.error(`\n[audit:csp] ${violations.length} violation(s) across ${filesScanned} file(s)`);
  process.exit(1);
}

console.log(`[audit:csp] OK — scanned ${filesScanned} napplet dist/index.html file(s), no meta-CSP found`);
process.exit(0);
