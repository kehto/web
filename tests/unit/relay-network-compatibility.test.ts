import { describe, expect, it, vi } from 'vitest';
import { authorizeRelay } from '../../packages/runtime/src/relay-authorization.js';
import type { ServiceRuntimeContext } from '../../packages/runtime/src/types.js';

const plan = { operation: 'subscribe' as const, relayUrls: ['wss://relay.example'], localOnly: false };

describe('FW-RELAY-NETWORK-LEGACY-001', () => {
  it('preserves unhinted host routing and warns once per runtime without request data', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const context = {};
      const execute = vi.fn();
      await authorizeRelay(context, 'window', 'relay.subscribe', plan, execute);
      await authorizeRelay(context, 'window', 'relay.query', plan, execute);
      expect(execute).toHaveBeenCalledTimes(2);
      expect(warning).toHaveBeenCalledExactlyOnceWith('[FW-RELAY-NETWORK-LEGACY-001] Configure RuntimeAdapter.permissions for destination approval; unhinted legacy host routing is deprecated. Warning once per runtime instance.');
      expect(warning.mock.calls[0][0]).not.toContain('relay.example');
      await authorizeRelay({}, 'window', 'relay.subscribe', plan, execute);
      expect(warning).toHaveBeenCalledTimes(2);
    } finally { warning.mockRestore(); }
  });

  it('keeps authorized and local-only operations quiet, and blocks unauthorised hints', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
      const authorizeOperation: NonNullable<ServiceRuntimeContext['authorizeOperation']> = async (_window, _operation, _requirements, execute) => ({
        status: 'executed', value: await execute(signal),
      });
      const execute = vi.fn();
      await authorizeRelay({ authorizeOperation }, 'window', 'relay.subscribe', plan, execute, plan.relayUrls[0]);
      await authorizeRelay({}, 'window', 'relay.subscribe', { ...plan, relayUrls: [], localOnly: true }, execute);
      await expect(authorizeRelay({}, 'window', 'relay.subscribe', plan, execute, plan.relayUrls[0]))
        .rejects.toThrow('RuntimeAdapter.permissions');
      expect(execute).toHaveBeenCalledTimes(2);
      expect(warning).not.toHaveBeenCalled();
    } finally { warning.mockRestore(); }
  });
});
