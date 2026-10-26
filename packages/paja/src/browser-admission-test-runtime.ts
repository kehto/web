import { createShellBridge, type ShellAdapter } from '@kehto/shell';
import type { ApprovalAnswer, ApprovalPrompt, Runtime } from '@kehto/runtime';

/** A real permission-enabled runtime for Paja loader tests. */
export function createPajaAdmissionTestRuntime(
  prompt: (request: ApprovalPrompt) => Promise<ApprovalAnswer> = async () => ({ effect: 'allow', lifetime: 'session' }),
): Runtime {
  const hooks: ShellAdapter = {
    services: {},
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    crypto: { verifyEvent: async () => false },
    hotkeys: { executeHotkeyFromForward() {} },
    windowManager: { createWindow: () => null },
    relayConfig: {
      addRelay() {}, removeRelay() {},
      getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
      getNip66Suggestions: () => [],
    },
    relayPool: {
      getRelayPool: () => null, trackSubscription() {}, untrackSubscription() {},
      openScopedRelay() {}, closeScopedRelay() {}, publishToScopedRelay: () => false,
      selectRelayTier: () => [],
    },
    workerRelay: { getWorkerRelay: () => null },
    permissions: {
      now: Date.now,
      prompt,
      createCancellation: () => new AbortController(),
      schedule(callback, delayMs) {
        const timer = setTimeout(callback, delayMs);
        return () => clearTimeout(timer);
      },
    },
  };
  return createShellBridge(hooks).runtime;
}
