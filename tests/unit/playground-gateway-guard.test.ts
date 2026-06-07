import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const playgroundNapplets = [
  'bot',
  'chat',
  'composer',
  'config-demo',
  'decrypt-demo',
  'feed',
  'hotkey-chord',
  'media-controller',
  'preferences',
  'profile-viewer',
  'resource-demo',
  'theme-switcher',
  'toaster',
] as const;

const expectedRequires: Record<(typeof playgroundNapplets)[number], readonly string[]> = {
  bot: ['ifc', 'storage'],
  chat: ['ifc', 'storage', 'relay'],
  composer: ['relay'],
  'config-demo': ['config'],
  'decrypt-demo': ['identity'],
  feed: ['relay'],
  'hotkey-chord': ['keys'],
  'media-controller': ['media'],
  preferences: ['storage', 'theme'],
  'profile-viewer': ['identity'],
  'resource-demo': ['resource', 'connect'],
  'theme-switcher': ['theme'],
  toaster: ['notify'],
};

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('playground gateway artifact guard', () => {
  it('keeps every playground napplet on the shared single-file build config', () => {
    for (const name of playgroundNapplets) {
      const config = readRepoFile(`apps/playground/napplets/${name}/vite.config.ts`);
      expect(config, `${name} import`).toContain(
        "import { definePlaygroundNappletConfig } from '../shared-vite-config';",
      );
      const expectedRequiresLiteral = expectedRequires[name]
        .map((capability) => `'${capability}'`)
        .join(', ');
      expect(config, `${name} d tag/requires`).toContain(
        `export default definePlaygroundNappletConfig('${name}', { requires: [${expectedRequiresLiteral}] });`,
      );
    }

    const sharedConfig = readRepoFile('apps/playground/napplets/shared-vite-config.ts');
    expect(sharedConfig).toContain("artifactMode: 'single-file'");
    expect(sharedConfig).toContain('requires?: readonly string[]');
    expect(sharedConfig).toContain('manifest requires must use short NUB names');
    expect(sharedConfig).toContain('requires,');
  });

  it('keeps the active loader on the gateway route with opaque-origin iframes', () => {
    const shellHost = readRepoFile('apps/playground/src/shell-host.ts');
    const indexHtml = readRepoFile('apps/playground/index.html');
    const main = readRepoFile('apps/playground/src/main.ts');

    expect(shellHost).toContain('function playgroundPath(');
    expect(shellHost).toContain('import.meta.env.BASE_URL');
    expect(shellHost).not.toContain('meta.env?.BASE_URL');
    expect(shellHost).toContain('playgroundPath(`/napplet-gateway/${encodeURIComponent(name)}/manifest.json`)');
    expect(shellHost).toContain('iframe.src = metadata.htmlUrl');
    expect(shellHost).toContain("iframe.sandbox.add('allow-scripts')");
    expect(shellHost).not.toContain('allow-same-origin');
    expect(shellHost).not.toContain('`/napplets/${name}/index.html`');

    expect(indexHtml).toContain('id="static-demo-banner"');
    expect(main).toContain("const STATIC_PAGES_BASE_PATH = '/web/playground/';");
    expect(main).toContain("document.getElementById('static-demo-banner')?.removeAttribute('hidden')");
    expect(main).toContain('if (isStaticPagesDemo) return;');
  });

  it('exposes manifest requires through gateway metadata and checks it before navigation', () => {
    const viteConfig = readRepoFile('apps/playground/vite.config.ts');
    const shellHost = readRepoFile('apps/playground/src/shell-host.ts');

    expect(viteConfig).toContain('requires: string[]');
    expect(viteConfig).toContain("tag[0] === 'requires'");
    expect(viteConfig).toContain('requires,');
    expect(viteConfig).toContain('PLAYGROUND_BASE_PATH');
    expect(viteConfig).toContain('base: playgroundBasePath');
    expect(viteConfig).toContain('withPlaygroundBasePath(');

    expect(shellHost).toContain('requires: string[]');
    expect(shellHost).toContain('getMissingRequiredNubs(metadata.requires)');
    expect(shellHost).toContain('requires unsupported NUB capabilities');
    expect(shellHost.indexOf('getMissingRequiredNubs(metadata.requires)')).toBeLessThan(
      shellHost.indexOf('iframe.src = metadata.htmlUrl'),
    );
  });

  it('keeps the GitHub Pages publisher aligned with the static gateway artifact contract', () => {
    const workflow = readRepoFile('.github/workflows/playground-pages.yml');
    const script = readRepoFile('scripts/build-playground-pages.mjs');
    const pagesScript = readRepoFile('scripts/build-pages.mjs');
    const pagesAudit = readRepoFile('scripts/audit-pages-artifact.mjs');
    const turbo = readRepoFile('turbo.json');
    const packageJson = JSON.parse(readRepoFile('package.json')) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const gitignore = readRepoFile('.gitignore');
    const resourceDemo = readRepoFile('apps/playground/napplets/resource-demo/src/main.ts');

    expect(packageJson.scripts?.['build:playground-pages']).toBe('node scripts/build-playground-pages.mjs');
    expect(packageJson.scripts?.['build:pages']).toBe('node scripts/build-pages.mjs');
    expect(packageJson.scripts?.['audit:pages']).toBe('node scripts/audit-pages-artifact.mjs');
    expect(packageJson.dependencies?.gsap).toMatch(/^\^3\./);
    expect(gitignore).toContain('.pages/');

    expect(workflow).toContain('actions/configure-pages@v5');
    expect(workflow).toContain('actions/upload-pages-artifact@v4');
    expect(workflow).toContain('actions/deploy-pages@v4');
    expect(workflow).toContain('PLAYGROUND_BASE_PATH: /web/playground/');
    expect(workflow).toContain('VITEPRESS_BASE: /web/docs/');
    expect(workflow).toContain('pnpm --filter @kehto/playground build');
    expect(workflow).toContain('pnpm docs:check');
    expect(workflow).toContain('pnpm build:pages');
    expect(workflow).toContain('pnpm audit:pages');
    expect(workflow).toContain('path: .pages');
    expect(workflow).not.toContain('github.event.repository.name');

    expect(script).toContain('/web/playground/napplet-gateway/<dTag>/manifest.json');
    expect(script).toContain('/web/playground/napplet-gateway/<dTag>/<aggregateHash>/index.html');
    expect(script).toContain('PLAYGROUND_BASE_PATH');
    expect(script).toContain("'.pages/playground'");
    expect(script).toContain("'/web/playground/'");
    expect(script).toContain('htmlUrl: withPagesBasePath(');
    expect(script).toContain('cpSync(sourceHtmlPath, htmlRoute)');

    expect(pagesScript).toContain("'docs', '.vitepress', 'dist'");
    expect(pagesScript).toContain("join(repoRoot, 'web', 'assets')");
    expect(pagesScript).toContain("join(repoRoot, 'node_modules', 'gsap', 'dist', 'gsap.min.js')");
    expect(pagesScript).toContain("join(outputRoot, 'assets')");
    expect(pagesScript).toContain("join(portalAssetsOutput, 'vendor')");
    expect(pagesScript).toContain("join(outputRoot, 'docs')");
    expect(pagesScript).toContain("join(docsOutput, 'api')");
    expect(pagesAudit).toContain("const GSAP_VENDOR = `${PUBLIC_SITE_BASE}assets/vendor/gsap.min.js`;");
    expect(pagesAudit).toContain("const LANDING_CSS = `${PUBLIC_SITE_BASE}assets/landing.css`;");
    expect(pagesAudit).toContain("const LANDING_JS = `${PUBLIC_SITE_BASE}assets/landing.js`;");
    expect(pagesAudit).toContain("join(outputRoot, 'assets', 'landing.css')");
    expect(pagesAudit).toContain("join(outputRoot, 'assets', 'landing.js')");
    expect(pagesAudit).toContain("join(outputRoot, 'assets', 'vendor', 'gsap.min.js')");
    expect(pagesAudit).toContain("const PLAYGROUND_BASE = '/web/playground/';");
    expect(pagesAudit).toContain("const DOCS_BASE = '/web/docs/';");
    expect(pagesAudit).toContain('artifactPathFromPublicPath(htmlUrl)');
    expect(pagesAudit).toContain("join(outputRoot, 'index.html')");
    expect(pagesAudit).toContain("join(outputRoot, 'docs', 'api', 'modules', '_kehto_shell.html')");
    expect(turbo).toContain('"VITEPRESS_BASE"');

    expect(resourceDemo).toContain('function getPlaygroundBaseUrl()');
    expect(resourceDemo).toContain("new URL('demo-data.json', getPlaygroundBaseUrl()).href");
    expect(resourceDemo).not.toContain("const GRANTED_URL = 'http://localhost:4174/demo-data.json'");
  });

  it('keeps the public portal on the branded static asset contract', () => {
    const portal = readRepoFile('web/index.html');
    const stylesheet = readRepoFile('web/assets/landing.css');
    const script = readRepoFile('web/assets/landing.js');

    expect(portal).toContain('href="/web/assets/landing.css"');
    expect(portal).toContain('src="/web/assets/vendor/gsap.min.js"');
    expect(portal).toContain('src="/web/assets/landing.js"');
    expect(portal).toContain('id="liquid-accent"');
    expect(portal).toContain('href="/web/playground/"');
    expect(portal).toContain('href="/web/docs/"');
    expect(portal).toContain('data-route-link');
    expect(portal).toContain('class="wordmark"');
    expect(portal).toContain('Alpha notice:');
    expect(portal).toContain('Shell-side runtime for sandboxed napplets');

    expect(stylesheet).toContain('--bg: #020201');
    expect(stylesheet).toContain('--accent: #f4c539');
    expect(stylesheet).toContain('.liquid-accent');
    expect(stylesheet).toContain('.wordmark-name::after');
    expect(stylesheet).toContain('@media (max-width: 780px)');
    expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)');
    expect(script).toContain('window.gsap');
    expect(script).toContain('setupLiquidAccent');
    expect(script).toContain('createFluidNodes');
    expect(script).toContain('drawFluidFrame');
    expect(script).toContain('drawFluidWake');
    expect(script).toContain('driverTween');
    expect(script).toContain("gsapApi.quickTo(pointer, 'pressure'");
    expect(script).toContain("canvas.getContext('2d'");
    expect(script).toContain('gsapApi.ticker.add');
    expect(script).toContain('function isHistoryRestore');
    expect(script).toContain("entry.type === 'back_forward'");
    expect(script).toContain("document.body.classList.remove('is-leaving')");
    expect(script).toContain("window.addEventListener('pageshow', onPageShow)");
    expect(script).toContain('gsapInstance.matchMedia()');
    expect(script).toContain("'(prefers-reduced-motion: reduce)'");
    expect(script).toContain("'(prefers-reduced-motion: no-preference)'");
    expect(script).toContain('data-route-link');
    expect(script).toContain('window.location.href = anchor.href');
  });
});
