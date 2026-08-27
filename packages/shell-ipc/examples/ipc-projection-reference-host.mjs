/**
 * Proof-only configuration for `kehto-ipc-shell`.
 * Process ownership belongs to the production executable, not this module.
 */
export function createIpcShellHostConfig() {
  let serviceContext;
  const intentService = {
    descriptor: { name: 'intent', version: '1.0.0', description: 'IPC proof service' },
    onRegistered(context) { serviceContext = context; },
    handleMessage(windowId, message, send) {
      if (message.type !== 'intent.available' || message.id !== 'ipc-proof-available') return;
      send({
        type: 'intent.available.result', id: message.id,
        availability: { archetype: 'note', available: false, candidates: [], hasDefault: false },
      });
      serviceContext?.sendToEligibleNapplet(windowId, {
        type: 'intent.changed',
        availability: { archetype: 'note', available: false, candidates: [], hasDefault: false },
      });
    },
  };
  return {
    registration: {
      windowId: 'ipc-proof-window', dTag: 'ipc-proof-napplet', aggregateHash: 'ipc-proof-hash',
      environment: { capabilities: { domains: ['intent'] }, services: ['intent'] },
    },
    runtimeAdapter: {
      auth: { getUserPubkey: () => null, getSigner: () => null },
      config: { getNappUpdateBehavior: () => 'auto-grant' },
      hotkeys: { executeHotkeyFromForward() {} },
      crypto: { verifyEvent: async () => true, randomUUID: () => 'ipc-proof-runtime-id', randomBytes: (length) => new Uint8Array(length) },
      aclPersistence: { persist() {}, load: () => null },
      manifestPersistence: { persist() {}, load: () => null },
      statePersistence: { get: () => null, set: () => true, remove() {}, clear() {}, keys: () => [], calculateBytes: () => 0 },
      windowManager: { createWindow: () => null },
      relayConfig: { addRelay() {}, removeRelay() {}, getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }), getNip66Suggestions: () => [] },
      services: { intent: intentService },
    },
  };
}
