import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { Runtime } from '@kehto/runtime';
import { createThemeProxy } from './theme-proxy.js';

function fakeRuntime(): Runtime & { handleMessage: ReturnType<typeof vi.fn> } {
  return { handleMessage: vi.fn() } as unknown as Runtime & {
    handleMessage: ReturnType<typeof vi.fn>;
  };
}

describe('theme-proxy', () => {
  it('dispatches theme requests through the runtime', () => {
    const runtime = fakeRuntime();
    const proxy = createThemeProxy({
      runtime,
      originRegistry: { getIframeWindow: () => null },
    });
    const envelope = { type: 'theme.get', id: 'theme-1' } as NappletMessage;

    proxy.dispatch('window-1', envelope);

    expect(runtime.handleMessage).toHaveBeenCalledWith('window-1', envelope);
  });

  it('fails closed instead of bypassing ShellBridge recipient checks', () => {
    const postMessage = vi.fn();
    const runtime = fakeRuntime();
    const proxy = createThemeProxy({
      runtime,
      originRegistry: {
        getIframeWindow: () => ({ postMessage }) as unknown as Window,
      },
    });
    const envelope = {
      type: 'theme.changed',
      theme: {
        colors: { background: '#000', text: '#fff', primary: '#0af' },
      },
    } as NappletMessage;

    expect(() => proxy.emit('window-1', envelope)).toThrow(
      'use ShellBridge.publishTheme()',
    );
    expect(postMessage).not.toHaveBeenCalled();
  });
});
