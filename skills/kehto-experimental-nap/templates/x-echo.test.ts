// Downstream unit test template for an experimental x- NAP.
// Requires: vitest, @kehto/shell. Copy next to x-echo.js and rename for your domain.
import { describe, expect, it, vi } from 'vitest';
import { ShellExtensionError, createShellBridge, getShellDomainState, originRegistry, type ShellAdapter } from '@kehto/shell';
import { createEchoExtension } from './x-echo.js';

const identity = { dTag: 'echo-probe', aggregateHash: 'e'.repeat(64) };

function adapter(extra: Partial<ShellAdapter> = {}): ShellAdapter {
  return {
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'banner' },
    crypto: { verifyEvent: async () => false },
    hotkeys: { executeHotkeyFromForward() {} },
    windowManager: { createWindow: () => null },
    relayConfig: { addRelay() {}, removeRelay() {}, getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }), getNip66Suggestions: () => [] },
    relayPool: {
      getRelayPool: () => null, trackSubscription() {}, untrackSubscription() {},
      openScopedRelay() {}, closeScopedRelay() {}, publishToScopedRelay: () => false, selectRelayTier: () => [],
    },
    workerRelay: { getWorkerRelay: () => null },
    ...extra,
  };
}

function frame(hooks: ShellAdapter) {
  originRegistry.clear();
  const bridge = createShellBridge(hooks);
  bridge.runtime.firewallState.setPolicy(identity.dTag, 'allow');
  const postMessage = vi.fn();
  const win = { postMessage } as unknown as Window;
  originRegistry.register(win, 'echo-window', identity);
  const send = (data: Record<string, unknown>) => bridge.handleMessage({ source: win, origin: 'null', data } as MessageEvent);
  return { bridge, send, replies: () => postMessage.mock.calls.map(([message]) => message) };
}

describe('x-echo', () => {
  it('starts unconfigured and becomes supported once a prefix exists', () => {
    const settings: { prefix?: string } = {};
    const hooks = adapter({ extensions: [createEchoExtension({ getPrefix: () => settings.prefix })] });
    expect(getShellDomainState(hooks, 'x-echo')).toBe('unconfigured');
    settings.prefix = '> ';
    expect(getShellDomainState(hooks, 'x-echo')).toBe('supported');
  });

  it('answers say and pushes heard', () => {
    const { bridge, send, replies } = frame(adapter({ extensions: [createEchoExtension({ getPrefix: () => '> ' })] }));
    send({ type: 'x-echo.say', id: '1', text: 'hi' });
    expect(replies()).toEqual([
      { type: 'x-echo.say.result', id: '1', text: '> hi' },
      { type: 'x-echo.heard', text: '> hi' },
    ]);
    bridge.destroy();
  });

  it('stays silent when the ACL denies x-echo:send', () => {
    const { bridge, send, replies } = frame(adapter({ extensions: [createEchoExtension({ getPrefix: () => '> ' })] }));
    bridge.runtime.aclState.revoke('', identity.dTag, identity.aggregateHash, 'x-echo:send');
    send({ type: 'x-echo.say', id: '1', text: 'hi' });
    expect(replies()).toEqual([]);
    bridge.destroy();
  });

  it('cannot shadow a reserved domain', () => {
    const echo = createEchoExtension({ getPrefix: () => '> ' });
    expect(() => createShellBridge(adapter({ extensions: [{ ...echo, domain: 'llm' }] }))).toThrow(ShellExtensionError);
  });
});
