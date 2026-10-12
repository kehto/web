import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('type-checks the displayed host excerpt against the shipped toolkit APIs', () => {
  const html = readFileSync(resolve('web/index.html'), 'utf8');
  const snippet = html.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/)?.[1]
    .replace(/<[^>]+>/g, '')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
  expect(snippet).toBeTruthy();
  const filename = resolve('kernl-landing-example.ts');
  const source = `${snippet}
    declare const adapter: Parameters<typeof createShellBridge>[0];
    declare const theme: NonNullable<Parameters<typeof createThemeService>[0]>['initialTheme'];
  `;
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: process.cwd(),
    paths: {
      '@kehto/shell': ['packages/shell/dist/index.d.ts'],
      '@kehto/services': ['packages/services/dist/index.d.ts'],
    },
  };
  const host = ts.createCompilerHost(options);
  const readSource = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, ...rest) => path === filename
    ? ts.createSourceFile(path, source, languageVersion)
    : readSource(path, languageVersion, ...rest);
  const program = ts.createProgram([filename], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  );
  expect(diagnostics).toEqual([]);
});
