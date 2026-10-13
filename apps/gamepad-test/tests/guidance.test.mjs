import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const textExtensions = new Set(['.css', '.html', '.json', '.md', '.mjs', '.ts']);
const skippedDirectories = new Set(['.git', 'dist', 'node_modules']);

async function collectTextFiles(directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTextFiles(path));
    else if (entry.isFile() && textExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = await collectTextFiles();
const sources = new Map(
  await Promise.all(files.map(async (path) => [relative(root, path), await readFile(path, 'utf8')])),
);

test('rejects retired app-owned bootstrap and probing APIs', () => {
  const joined = (...parts) => parts.join('');
  const shimSpecifier = ['@napplet', 'shim'].join('/');
  const patterns = [
    new RegExp(`import\\s+(?:[^'\"]+\\s+from\\s+)?['\"]${shimSpecifier}['\"]`),
    new RegExp(`shell(?:\\.|\\?\\.)${joined('rea', 'dy')}\\s*\\(`),
    new RegExp(`shell(?:\\.|\\?\\.)${joined('in', 'it')}\\s*\\(`),
    new RegExp(`shell(?:\\.|\\?\\.)${joined('supp', 'orts')}\\s*\\(`),
    new RegExp(`window(?:\\.|\\?\\.)napplet(?:\\.|\\?\\.)${joined('sh', 'ell')}`),
    new RegExp(`window\\s*\\[\\s*['\"]napplet['\"]\\s*\\]\\s*(?:\\.|\\?\\.)${joined('sh', 'ell')}`),
    new RegExp(`window\\s*\\[\\s*['\"]napplet['\"]\\s*\\]\\s*\\[\\s*['\"]${joined('sh', 'ell')}['\"]\\s*\\]`),
    new RegExp(`${joined('discover', 'Services')}\\s*\\(`),
    new RegExp(`${joined('has', 'Service')}(?:Version)?\\s*\\(`),
  ];
  const retiredExamples = [
    `import { install } from '${shimSpecifier}';`,
    `shell?.${joined('rea', 'dy')}()`,
    `shell.${joined('in', 'it')}()`,
    `shell.${joined('supp', 'orts')}('storage')`,
    `window?.napplet?.${joined('sh', 'ell')}`,
    `window['napplet']?.${joined('sh', 'ell')}`,
    `window['napplet']['${joined('sh', 'ell')}']`,
    `${joined('discover', 'Services')}()`,
    `${joined('has', 'Service', 'Version')}('relay', '1')`,
  ];

  for (const [index, example] of retiredExamples.entries()) {
    assert.match(example, patterns[index]);
  }

  for (const [path, source] of sources) {
    for (const pattern of patterns) assert.doesNotMatch(source, pattern, path);
  }
});

test('keeps normal Nostr examples OUTBOX-first', () => {
  const main = sources.get('src/main.ts');
  const patterns = ['query', 'subscribe', 'publish'].map(
    (operation) => new RegExp(['relay', operation].join('\\.') + '\\s*\\('),
  );
  for (const pattern of patterns) assert.doesNotMatch(main, pattern);

  const joined = (...parts) => parts.join('');
  const directCallPatterns = [
    new RegExp(`window(?:\\.|\\?\\.)napplet(?:\\.|\\?\\.)[A-Za-z_$][\\w$]*(?:\\.|\\?\\.)[A-Za-z_$][\\w$]*\\s*\\(`),
    new RegExp(`window\\s*\\[\\s*['\"]napplet['\"]\\s*\\]\\s*\\[\\s*['\"][^'\"]+['\"]\\s*\\]\\s*(?:\\.|\\?\\.)[A-Za-z_$][\\w$]*\\s*\\(`),
  ];
  const directCallExamples = [
    `window?.napplet?.storage.${joined('get', 'Item')}('key')`,
    `window['napplet']['outbox'].${joined('qu', 'ery')}([])`,
  ];
  for (const [index, example] of directCallExamples.entries()) {
    assert.match(example, directCallPatterns[index]);
  }
  for (const [path, source] of sources) {
    if (!path.startsWith('src/')) continue;
    for (const pattern of directCallPatterns) assert.doesNotMatch(source, pattern, path);
  }

  const designPatterns = sources.get('docs/design-patterns.md');
  assert.match(designPatterns, /OUTBOX-first/i);
  assert.match(designPatterns, /relay-local escape hatch/i);
});

test('ships no forked skill body, points agents at skills.sh, and keeps manifest config on documented surface', () => {
  const skillBodies = [...sources.keys()].filter((path) => /(?:^|\/)SKILL\.md$/.test(path));
  assert.deepEqual(skillBodies, []);
  for (const path of ['AGENTS.md', 'README.md']) {
    assert.match(sources.get(path), /npx skills add napplet\/napplet/, path);
  }
  const retiredInstallers = new RegExp(
    [['@napplet', 'skills'].join('/'), ['napplet skills', 'install'].join(' '), ['.codex', 'skills'].join('/')]
      .map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|'),
  );
  for (const [path, source] of sources) {
    assert.doesNotMatch(source, retiredInstallers, path);
  }

  const viteConfig = sources.get('vite.config.ts');
  assert.match(viteConfig, /artifactMode:\s*'single-file'/);
  // `requires` is allowed once a product has a core task that cannot run
  // without a domain, but it must stay a list of bare domain names.
  const requires = viteConfig.match(/\brequires\s*:\s*\[([^\]]*)\]/);
  if (requires) {
    const entries = requires[1].split(',').map((entry) => entry.trim()).filter(Boolean);
    assert.ok(entries.length > 0, 'requires must not be an empty list; omit it instead');
    for (const entry of entries) {
      assert.match(entry, /^['"][a-z][a-z0-9-]*['"]$/, `requires entry ${entry} must be a bare domain name`);
    }
  }
  assert.doesNotMatch(viteConfig, /\bconfigSchema\b/);
  assert.equal(sources.has('config.schema.json'), false);
  const retiredSingleFilePlugin = new RegExp(['vite-plugin', 'singlefile'].join('-'));
  for (const source of sources.values()) assert.doesNotMatch(source, retiredSingleFilePlugin);
});

test('keeps deferred domains out of active package surfaces', () => {
  const joined = (...parts) => parts.join('');
  const domains = [joined('con', 'nect'), joined('cl', 'ass')];

  for (const domain of domains) {
    const patterns = [
      new RegExp(`@napplet/nap/${domain}\\b`),
      new RegExp(`window(?:\\.|\\?\\.)napplet(?:\\.|\\?\\.)${domain}\\b`),
      new RegExp(`window\\s*\\[\\s*['\"]napplet['\"]\\s*\\]\\s*\\[\\s*['\"]${domain}['\"]\\s*\\]`),
      new RegExp(`import\\s*\\{[^}]*\\b${domain}\\b[^}]*\\}\\s*from\\s*['\"]@napplet/sdk['\"]`),
      new RegExp(`\\b${domain.toUpperCase()}_DOMAIN\\b`),
      new RegExp(`\\b${domain}\\s*(?:\\.|\\?\\.)[A-Za-z]\\w*\\s*\\(`),
      new RegExp(`\\brequires\\s*:\\s*\\[[^\\]]*['\"]${domain}['\"]`),
    ];
    const examples = [
      `@napplet/nap/${domain}`,
      `window?.napplet?.${domain}`,
      `window['napplet']['${domain}']`,
      `import { ${domain} } from '@napplet/sdk'`,
      `${domain.toUpperCase()}_DOMAIN`,
      `${domain}.request()`,
      `requires: ['${domain}']`,
    ];

    for (const [index, example] of examples.entries()) {
      assert.match(example, patterns[index]);
    }
    for (const [path, source] of sources) {
      for (const pattern of patterns) assert.doesNotMatch(source, pattern, path);
    }
  }

  for (const label of [joined('NAP-', 'CON', 'NECT'), joined('NAP-', 'CLASS')]) {
    for (const [path, source] of sources) {
      if (source.includes(label)) assert.match(source, /deferred|retired/i, path);
    }
  }
});

test('treats injected optional-domain absence as a normal state', async () => {
  const helperSource = await readFile(join(root, 'src/domain-availability.ts'), 'utf8');
  const compiled = ts.transpileModule(helperSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports });
  const { hasDomain } = module.exports;

  assert.equal(hasDomain(undefined, 'outbox'), false);
  assert.equal(hasDomain({}, 'outbox'), false);
  assert.equal(hasDomain({ outbox: null }, 'outbox'), false);
  assert.equal(hasDomain({ outbox: {} }, 'outbox'), true);
  assert.equal(hasDomain(Object.create({ outbox: {} }), 'outbox'), true);

  // Product code may replace every demo control; it must keep gating optional
  // domains through the injected-namespace check instead of a probe API.
  const main = sources.get('src/main.ts');
  assert.match(main, /from '\.\/domain-availability\.js'/);
  assert.match(main, /runtimeHasDomain\(/);
});

test('keeps the applet layout contract: no title header, frame-filling root', () => {
  const html = sources.get('index.html');
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim();
  assert.ok(title, 'index.html keeps a <title> for metadata');
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The runtime shows the napplet's name; do not repeat it as a heading.
  assert.doesNotMatch(html, new RegExp(`<h[1-6][^>]*>\\s*${escaped}\\s*<`));
  assert.doesNotMatch(html, /class="[^"]*\b(?:masthead|eyebrow|hero)\b/);

  const css = sources.get('src/styles.css');
  assert.doesNotMatch(css, /\bbody\s*\{[^}]*min-width/);
  assert.match(css, /html,\s*body,\s*#app\s*\{[^}]*height:\s*100%/);
});

test('controller inspector has no device reader or app-owned transport', () => {
  const forbidden = /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|sessionStorage|indexedDB)\b|navigator\s*\.|postMessage\s*\(|document\.cookie/;
  for (const [path, source] of sources) {
    if (path.startsWith('src/') && path.endsWith('.ts')) assert.doesNotMatch(source, forbidden, path);
  }
  assert.match(sources.get('vite.config.ts'), /requires:\s*\['gamepad'\]/);
});
