#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages');

/**
 * Read the public package versions expected from this checkout.
 * @param {string} [packagesDir] Workspace package directory.
 * @returns {Array<{name: string, version: string}>} Registry targets.
 * @example publicPackageTargets('/checkout/packages');
 */
export function publicPackageTargets(packagesDir = PACKAGES_DIR) {
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => JSON.parse(readFileSync(join(packagesDir, entry.name, 'package.json'), 'utf8')))
    .filter((pkg) => !pkg.private && pkg.name?.startsWith('@kehto/'))
    .map(({ name, version }) => ({ name, version }));
}

/**
 * Check public registry metadata; a successful staging upload is insufficient.
 * @param {Array<{name: string, version: string}>} targets Expected versions.
 * @param {object} [options] Fetch, retry and wait overrides for verification.
 * @returns {Promise<void>} Resolves when every target is public.
 * @example await checkNpmPublication(publicPackageTargets());
 */
export async function checkNpmPublication(targets, options = {}) {
  const { attempts = 6, delayMs = 5_000, fetchImpl = fetch, wait = setTimeout } = options;
  let pending = targets;
  let failures = [];

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const results = await Promise.all(pending.map(async (target) => {
      try {
        const response = await fetchImpl(`https://registry.npmjs.org/${target.name}/${target.version}`, {
          headers: { 'cache-control': 'no-cache' },
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) return { target, reason: `HTTP ${response.status}` };
        const manifest = await response.json();
        if (manifest.name !== target.name || manifest.version !== target.version) {
          return { target, reason: 'registry returned a different package/version' };
        }
        return null;
      } catch (error) {
        return { target, reason: error.message };
      }
    }));
    failures = results.filter(Boolean);
    if (failures.length === 0) return;
    pending = failures.map(({ target }) => target);
    if (attempt + 1 < attempts) await wait(delayMs);
  }

  const missing = failures.map(({ target, reason }) => `${target.name}@${target.version} (${reason})`);
  throw new Error(
    `npm versions are not publicly available: ${missing.join(', ')}. `
    + 'A successful upload may still be staged. Check npm Staged Packages and approve pending versions with 2FA; '
    + 'for automatic releases, allow direct publishing in the Trusted Publisher settings. '
    + 'Do not bump versions or retry an existing staged upload. See docs/guides/releases.md.',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const targets = publicPackageTargets();
  checkNpmPublication(targets).then(() => {
    console.log(`Verified ${targets.length} public npm package versions.`);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
