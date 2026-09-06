import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRuntime, type Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';

// Host policy under NAP-SHELL at napplet/naps@a040914b4bbd3a5cd8a14b0f316a723c968ebfb2:
// only trusted registration establishes a lifecycle; request fields cannot renew it.
describe('firewall registration lifecycle', () => {
  let runtime: Runtime;
  const dispatched = vi.fn();
  const audit = vi.fn();

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    dispatched.mockClear();
    audit.mockClear();
    const { hooks } = createMockRuntimeAdapter({
      onFirewallEvent: audit,
      services: {
        theme: {
          descriptor: { name: 'theme', version: '1.0.0' },
          handleMessage: dispatched,
        },
      },
    });
    runtime = createRuntime(hooks);
  });

  afterEach(() => {
    runtime.destroy();
    vi.restoreAllMocks();
  });

  function readTheme(count: number, windowId = 'same-window'): void {
    for (let i = 0; i < count; i++) {
      runtime.handleMessage(windowId, { type: 'theme.get', id: `theme-${i}` });
    }
  }

  it.each(['replace', 'unregister', 'destroy and unregister', 'clear'])(
    'gives same-ID registration a fresh budget after %s',
    (teardown) => {
      const entry = createNip5dSessionEntry('same-window', 'demo', 'a'.repeat(64));
      runtime.sessionRegistry.register('same-window', entry);
      readTheme(15);
      expect(dispatched).toHaveBeenCalledTimes(15);
      expect(audit).not.toHaveBeenCalled();

      if (teardown === 'destroy and unregister') runtime.destroyWindow('same-window');
      if (teardown.includes('unregister')) runtime.sessionRegistry.unregister('same-window');
      if (teardown === 'clear') runtime.sessionRegistry.clear();
      if (teardown !== 'replace') {
        readTheme(1);
        expect(dispatched).toHaveBeenCalledTimes(15);
      }
      // Deliberately reuse the object, timestamp, instanceId and all identity fields.
      runtime.sessionRegistry.register('same-window', entry);
      readTheme(15);
      expect(dispatched).toHaveBeenCalledTimes(30);
      expect(audit).not.toHaveBeenCalled();

      readTheme(6);
      expect(dispatched).toHaveBeenCalledTimes(35);
      expect(audit).toHaveBeenCalledTimes(1);
      expect(audit.mock.calls[0][0]).toMatchObject({ ruleId: 'burst', decision: 'reject' });
    },
  );

  it('does not reset a live source budget for cleanup or forged lifecycle fields', () => {
    runtime.sessionRegistry.register('same-window', createNip5dSessionEntry('same-window', 'demo', 'a'.repeat(64)));
    readTheme(20);
    runtime.destroyWindow('same-window');
    runtime.handleMessage('same-window', {
      type: 'theme.get', id: 'forged', windowId: 'different', initKey: 'new',
      instanceId: 'new', registeredAt: 1_000_001,
    });
    expect(dispatched).toHaveBeenCalledTimes(20);
    expect(audit.mock.calls[0][0]).toMatchObject({ ruleId: 'burst', decision: 'reject' });
  });

  it.each(['same-window', 'different-window'])(
    'preserves the napplet rate budget across registration of %s',
    (windowId) => {
      runtime.firewallState.setRateLimit('demo', 'theme:read', {
        capacity: 2, windowMs: 60_000, action: 'block',
      });
      runtime.sessionRegistry.register('same-window', createNip5dSessionEntry('same-window', 'demo', 'a'.repeat(64)));
      readTheme(2);
      runtime.destroyWindow('same-window');
      runtime.sessionRegistry.unregister('same-window');
      runtime.sessionRegistry.register(windowId, createNip5dSessionEntry(windowId, 'demo', 'b'.repeat(64)));
      readTheme(1, windowId);
      expect(dispatched).toHaveBeenCalledTimes(2);
      expect(audit).toHaveBeenCalledTimes(1);
      expect(audit.mock.calls[0][0]).toMatchObject({ ruleId: 'rate:opclass', decision: 'reject' });
    },
  );
});
