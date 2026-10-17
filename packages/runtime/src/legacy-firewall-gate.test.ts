import { expect, it, vi } from 'vitest';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { ApprovalCancellation } from './approval-coordinator.js';

declare const console: { warn(message: string): void };
declare const AbortController: { new(): ApprovalCancellation };
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(timer: unknown): void;

it('warns once when the legacy gate is used and keeps configured ingress quiet', () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const legacy = createRuntime(createMockRuntimeAdapter().hooks);
    legacy.sessionRegistry.register('legacy', createNip5dSessionEntry('legacy', 'app', 'a'.repeat(64)));
    legacy.handleMessage('legacy', { type: 'theme.get', id: 'one' });
    legacy.handleMessage('legacy', { type: 'theme.get', id: 'two' });
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('FW-RUNTIME-LEGACY-GATE-001'));
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('RuntimeAdapter.permissions'));
    legacy.destroy();

    warning.mockClear();
    const configured = createRuntime(createMockRuntimeAdapter({ permissions: {
      prompt: async () => ({ effect: 'deny', lifetime: 'once' }),
      now: () => 0,
      createCancellation: () => new AbortController(),
      schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    } }).hooks);
    configured.sessionRegistry.register('configured', createNip5dSessionEntry('configured', 'app', 'a'.repeat(64)));
    configured.handleMessage('configured', { type: 'theme.get', id: 'three' });
    expect(warning).not.toHaveBeenCalled();
    configured.destroy();
  } finally {
    warning.mockRestore();
  }
});
