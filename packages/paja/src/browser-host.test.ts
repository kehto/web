import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('@kehto/paja browser host runtime source guards', () => {
  it('preserves resolved pointer identity when the runtime iframe finishes loading', () => {
    const source = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const tabsSource = readFileSync(new URL('./browser-runtime-tabs.ts', import.meta.url), 'utf8');

    expect(source).toContain(
      'runtime.currentWindowId = registerFrameForGeneration(bridge, frame, config, state.generation, state.resolvedTarget);',
    );
    expect(tabsSource).toContain('`${config.window.id}:${tab.id}:${tab.generation}`');
  });

  it('injects the runtime-owned napplet namespace in pointer and URL target srcdoc paths', () => {
    const source = readFileSync(new URL('./browser-target-frame.ts', import.meta.url), 'utf8');

    expect(source).toContain('injectNappletNamespacePrelude(');
    expect(source).toContain("fetch(new URL('./__kehto/target.html', window.location.href)");
    expect(source).toContain('frame.removeAttribute(\'src\');');
    expect(source).toContain('frame.srcdoc = injectNappletNamespacePrelude(');
  });

  it('keeps runtime pointers in closeable tabs with duplicate-load choices', () => {
    const source = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const tabsSource = readFileSync(new URL('./browser-runtime-tabs.ts', import.meta.url), 'utf8');

    expect(source).toContain('tabs: PajaRuntimeTab[];');
    expect(tabsSource).toContain('function renderRuntimeTabs(state: PajaRuntimeTabState): void');
    expect(tabsSource).toContain('function closeRuntimeTab(');
    expect(tabsSource).toContain('function showDuplicatePointerDialog()');
    expect(tabsSource).toContain("type PajaDuplicateChoice = 'load-again' | 'open-tab' | 'cancel';");
    expect(source).toContain("const duplicate = state.tabs.find((tab) => tab.key === resolvedTargetKey(resolvedTarget));");
  });

  it('keeps external target asset resolution anchored to the authored target URL', () => {
    const source = readFileSync(new URL('./browser-target-frame.ts', import.meta.url), 'utf8');

    expect(source).toContain('function injectBaseHref(html: string, targetUrl: string): string');
    expect(source).toContain('`<base href="${escapeAttribute(targetUrl)}">`');
  });
});
