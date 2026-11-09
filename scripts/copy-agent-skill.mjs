#!/usr/bin/env node
/**
 * Copy the repo-level `skills/kehto-experimental-nap` agent skill into
 * `packages/shell/skills/` so the published @kehto/shell tarball ships it.
 * The repo copy is canonical; the package copy is a build artifact (gitignored).
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(repoRoot, 'skills', 'kehto-experimental-nap');
const target = join(repoRoot, 'packages', 'shell', 'skills', 'kehto-experimental-nap');

if (!existsSync(source)) {
  console.error(`[copy-agent-skill] missing ${source}`);
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
