import { createIpcShellHostConfig as createProofConfig } from '../../examples/ipc-projection-reference-host.mjs';

export function createIpcShellHostConfig() {
  const config = createProofConfig();
  return {
    ...config,
    baseDirectory: process.env.KEHTO_IPC_TEST_BASE,
    registration: {
      ...config.registration,
      windowId: 'registration-window-sentinel',
      dTag: 'registration-dtag-sentinel',
      aggregateHash: 'registration-hash-sentinel',
    },
  };
}
