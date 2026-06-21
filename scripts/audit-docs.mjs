#!/usr/bin/env node
/**
 * scripts/audit-docs.mjs -- documentation coverage and link drift guard.
 *
 * Run after `pnpm docs:api`. The script checks repo-authored docs metadata,
 * VitePress route coverage, package docs coverage, and generated TypeDoc API
 * targets without depending on a running playground server.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const docsDir = join(repoRoot, 'docs');
const packagesDir = join(repoRoot, 'packages');

/** @type {string[]} */
const violations = [];

const rel = relative.bind(null, repoRoot);

function typedocModuleFileName(slug) {
  return `_kehto_${slug}.html`;
}

function fail(message) {
  violations.push(message);
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
}

function assertFile(path, context) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    fail(`${context}: missing file ${rel(path)}`);
    return false;
  }
  return true;
}

function assertContains(path, content, needle, context) {
  if (!content.includes(needle)) {
    fail(`${context}: ${rel(path)} missing ${needle}`);
  }
}

function assertTypeDocAnchor(path, content, href, context) {
  assertContains(path, content, `href="${href}" target="_self"`, context);
}

function publicPackages() {
  return readdirSync(packagesDir)
    .filter((name) => {
      const pkgPath = join(packagesDir, name, 'package.json');
      return existsSync(pkgPath) && statSync(pkgPath).isFile();
    })
    .map((slug) => {
      const packageJsonPath = join(packagesDir, slug, 'package.json');
      const packageJson = readJson(packageJsonPath);
      return {
        slug,
        name: packageJson.name,
        version: packageJson.version,
        packageJsonPath,
        pagePath: join(docsDir, 'packages', `${slug}.md`),
        moduleFile: join(docsDir, 'api', 'modules', typedocModuleFileName(slug)),
        distModuleFile: join(
          docsDir,
          '.vitepress',
          'dist',
          'api',
          'modules',
          typedocModuleFileName(slug),
        ),
      };
    })
    .filter((pkg) => pkg.name?.startsWith('@kehto/'))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function vitepressRoutePath(route) {
  const cleanRoute = route.replace(/[?#].*$/, '');
  if (cleanRoute === '/') return join(docsDir, 'index.md');
  if (cleanRoute.endsWith('/')) return join(docsDir, cleanRoute, 'index.md');
  return join(docsDir, `${cleanRoute}.md`);
}

function checkVitePressRoutes(configPath) {
  const config = read(configPath);
  const requiredSections = [
    'Start',
    'Concepts',
    'Tutorials',
    'How-tos',
    'Package Reference',
    'Reference',
    'Policies',
    'Migration Archive',
  ];
  for (const section of requiredSections) {
    assertContains(configPath, config, `text: '${section}'`, 'VitePress navigation');
  }

  const routePattern = /link:\s*['"]([^'"]+)['"]/g;
  const routes = new Set();
  let match;
  while ((match = routePattern.exec(config)) !== null) {
    if (match[1].startsWith('/')) routes.add(match[1]);
  }

  for (const route of routes) {
    assertFile(vitepressRoutePath(route), `VitePress route ${route}`);
  }
}

function checkPackageDocs(packages) {
  const packageIndexPath = join(docsDir, 'packages', 'index.md');
  const packageIndex = assertFile(packageIndexPath, 'package index') ? read(packageIndexPath) : '';
  const vitepressConfigPath = join(docsDir, '.vitepress', 'config.ts');
  const vitepressConfig = assertFile(vitepressConfigPath, 'VitePress config') ? read(vitepressConfigPath) : '';
  const typedoc = readJson(join(repoRoot, 'typedoc.json'));
  const typedocEntryPoints = new Set(typedoc.entryPoints ?? []);

  for (const pkg of packages) {
    const page = assertFile(pkg.pagePath, `${pkg.name} package page`) ? read(pkg.pagePath) : '';
    assertContains(packageIndexPath, packageIndex, pkg.name, 'package index');
    assertContains(packageIndexPath, packageIndex, `./${pkg.slug}.md`, 'package index');
    assertContains(vitepressConfigPath, vitepressConfig, `link: '/packages/${pkg.slug}'`, 'package sidebar');
    assertContains(pkg.pagePath, page, `# ${pkg.name}`, `${pkg.name} package page`);
    assertContains(pkg.pagePath, page, `| Version | \`${pkg.version}\` |`, `${pkg.name} package page`);
    assertContains(pkg.pagePath, page, '## Scope Boundaries', `${pkg.name} package page`);
    assertContains(pkg.pagePath, page, '## API Reference', `${pkg.name} package page`);
    assertTypeDocAnchor(
      pkg.pagePath,
      page,
      `../api/modules/${typedocModuleFileName(pkg.slug)}`,
      `${pkg.name} package API link`,
    );

    if (!typedocEntryPoints.has(`packages/${pkg.slug}`)) {
      fail(`typedoc.json missing entryPoint packages/${pkg.slug}`);
    }
    assertFile(pkg.moduleFile, `${pkg.name} generated API module`);
    assertFile(pkg.distModuleFile, `${pkg.name} VitePress API artifact`);
  }

  const playgroundPage = join(docsDir, 'packages', 'playground.md');
  const playground = assertFile(playgroundPage, '@kehto/playground package page') ? read(playgroundPage) : '';
  assertContains(packageIndexPath, packageIndex, '@kehto/playground', 'package index');
  assertContains(vitepressConfigPath, vitepressConfig, "link: '/packages/playground'", 'package sidebar');
  assertContains(playgroundPage, playground, '| Private | `true` |', '@kehto/playground package page');
}

function checkReferencePage(packages) {
  const referencePath = join(docsDir, 'reference', 'api.md');
  const reference = assertFile(referencePath, 'API reference page') ? read(referencePath) : '';
  for (const pkg of packages) {
    const moduleHref = `../api/modules/${typedocModuleFileName(pkg.slug)}`;
    assertContains(referencePath, reference, pkg.name, 'API reference page');
    assertTypeDocAnchor(referencePath, reference, moduleHref, 'API reference page');
    assertFile(resolve(dirname(referencePath), moduleHref), `${pkg.name} API reference target`);
  }
}

function checkApiLinkTarget(path, href) {
  const target = resolve(dirname(path), href);
  if (!existsSync(target)) {
    fail(`stale API link in ${rel(path)}: ${href} -> ${rel(target)}`);
  }
}

function checkApiLinksInMarkdown(path) {
  const content = read(path);
  const apiLinkPattern = /\]\(((?:\.\.\/)+docs\/api\/[^)#\s]+|(?:\.\.\/)+api\/[^)#\s]+)\)/g;
  let match;
  while ((match = apiLinkPattern.exec(content)) !== null) {
    checkApiLinkTarget(path, match[1]);
  }

  const apiAnchorPattern =
    /<a\s+[^>]*href=["']((?:\.\.\/)+docs\/api\/[^"'#\s]+|(?:\.\.\/)+api\/[^"'#\s]+)["'][^>]*>/g;
  while ((match = apiAnchorPattern.exec(content)) !== null) {
    checkApiLinkTarget(path, match[1]);
  }
}

function checkAuthoredApiLinks(packages) {
  for (const pkg of packages) {
    checkApiLinksInMarkdown(pkg.pagePath);
    checkApiLinksInMarkdown(join(packagesDir, pkg.slug, 'README.md'));
  }
  checkApiLinksInMarkdown(join(docsDir, 'reference', 'api.md'));
}

function checkDocsCommands() {
  const packageJsonPath = join(repoRoot, 'package.json');
  const packageJson = readJson(packageJsonPath);
  const scripts = packageJson.scripts ?? {};
  if (scripts['docs:api:strict'] !== 'typedoc --treatWarningsAsErrors') {
    fail('package.json scripts.docs:api:strict must run typedoc --treatWarningsAsErrors');
  }
  if (!scripts['docs:check']?.includes('scripts/audit-docs.mjs')) {
    fail('package.json scripts.docs:check must run scripts/audit-docs.mjs');
  }
  if (!scripts['docs:site:build']?.includes('copy-docs-api.mjs')) {
    fail('package.json scripts.docs:site:build must copy TypeDoc output after the VitePress build');
  }

  const docsPackageJsonPath = join(docsDir, 'package.json');
  const docsPackageJson = readJson(docsPackageJsonPath);
  if (!docsPackageJson.scripts?.['docs:build']?.includes('copy-docs-api.mjs')) {
    fail('docs/package.json scripts.docs:build must copy TypeDoc output into the VitePress artifact');
  }

  const workflowPath = join(repoRoot, '.github', 'workflows', 'ci.yml');
  const workflow = assertFile(workflowPath, 'CI workflow') ? read(workflowPath) : '';
  assertContains(workflowPath, workflow, 'pnpm docs:check', 'CI workflow docs gate');

  const maintenancePath = join(docsDir, 'strategy', 'maintenance.md');
  const maintenance = assertFile(maintenancePath, 'docs maintenance guide') ? read(maintenancePath) : '';
  assertContains(maintenancePath, maintenance, 'pnpm docs:check', 'docs maintenance guide');
}

const packages = publicPackages();
checkVitePressRoutes(join(docsDir, '.vitepress', 'config.ts'));
checkPackageDocs(packages);
checkReferencePage(packages);
checkAuthoredApiLinks(packages);
checkDocsCommands();

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`audit:docs FAILED — ${violation}`);
  }
  console.error(`\n[audit:docs] ${violations.length} violation(s)`);
  process.exit(1);
}

console.log(`[audit:docs] OK — checked ${packages.length} public package docs, VitePress routes, TypeDoc targets, and docs gate wiring`);
process.exit(0);
