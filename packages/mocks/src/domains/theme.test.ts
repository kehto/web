import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, ServiceRuntimeContext } from '@kehto/runtime';

import { MOCK_THEMES, THEME_MOCK_ENTRY, THEME_SPEC_REF, createMockThemeService } from './theme.js';

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

describe('createMockThemeService', () => {
  it('describes itself and records the spec ref', () => {
    const service = createMockThemeService();
    expect(service.descriptor).toMatchObject({ name: 'theme', version: '1.0.0' });
    expect(service.mock.routes).toEqual(['theme.get']);
    expect(THEME_SPEC_REF).toEqual({ nap: 'NAP-THEME', status: 'merged', source: 'master', sha: '43cb3a4e8555', path: 'naps/NAP-THEME.md' });
    expect(THEME_MOCK_ENTRY.kind).toBe('service');
    expect(THEME_MOCK_ENTRY.create?.({}).descriptor.name).toBe('theme');
  });

  it('answers theme.get with the full dark fixture by default', () => {
    const service = createMockThemeService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'theme.get', id: 't1' } as NappletMessage, send);
    expect(sent).toEqual([{
      type: 'theme.get.result',
      id: 't1',
      theme: {
        colors: { background: '#0d1117', text: '#c9d1d9', primary: '#58a6ff' },
        fonts: {
          body: { name: 'Inter', url: 'https://fonts.example.org/inter.woff2' },
          title: { name: 'Playfair Display', url: 'https://fonts.example.org/playfair.woff2' },
        },
        background: { url: 'https://media.example.org/bg.jpg', mode: 'cover', mime: 'image/jpeg' },
        title: 'Mock Dark',
      },
    }]);
  });

  it('answers with the minimal light fixture when selected', () => {
    const service = createMockThemeService({ initialTheme: 'light' });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'theme.get', id: 't2' } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'theme.get.result', id: 't2', theme: { colors: { background: '#ffffff', text: '#333333', primary: '#0066cc' }, title: 'Mock Light' } }]);
  });

  it('reports an error when no theme is active', () => {
    const service = createMockThemeService({ initialTheme: null });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'theme.get', id: 't3' } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'theme.get.result', id: 't3', error: 'no active theme' }]);
  });

  it('pushes theme.changed to known windows and runtime windows on setTheme', () => {
    const service = createMockThemeService();
    const w1 = sink();
    service.handleMessage('w1', { type: 'theme.get', id: 't1' } as NappletMessage, w1.send);
    const envelope = service.setTheme('light');
    expect(envelope).toEqual({ type: 'theme.changed', theme: MOCK_THEMES.light });
    expect(w1.sent.at(-1)).toEqual(envelope);
    expect(service.mock.state().changes).toBe(1);

    const runtime: ServiceRuntimeContext = {
      resolveDTag: () => 'dtag',
      listWindowIds: () => ['w1', 'w2'],
      hasCapability: () => true,
      sendToEligibleNapplet: vi.fn(() => true),
    };
    service.onRegistered?.(runtime);
    const custom = { colors: { background: '#000000', text: '#ffffff', primary: '#ff00ff' } };
    service.setTheme(custom);
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledWith('w1', { type: 'theme.changed', theme: custom });
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledWith('w2', { type: 'theme.changed', theme: custom });
    w1.sent.length = 0;
    service.handleMessage('w1', { type: 'theme.get', id: 't4' } as NappletMessage, w1.send);
    expect(w1.sent).toEqual([{ type: 'theme.get.result', id: 't4', theme: custom }]);
  });

  it('forgets destroyed windows and resets to the initial theme', () => {
    const service = createMockThemeService({ initialTheme: 'light' });
    service.handleMessage('w1', { type: 'theme.get', id: 't1' } as NappletMessage, () => {});
    service.onWindowDestroyed?.('w1');
    expect(service.mock.state().windows.has('w1')).toBe(false);
    service.setTheme('dark');
    expect(service.mock.sent.filter((entry) => entry.message.type === 'theme.changed')).toEqual([]);
    service.mock.reset();
    expect(service.mock.state()).toEqual({ current: MOCK_THEMES.light, windows: new Set(), changes: 0 });
  });
});
