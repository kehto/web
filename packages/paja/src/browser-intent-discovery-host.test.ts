import { describe, expect, it } from 'vitest';
import { pajaAllowedIntentHint } from './browser-intent-discovery-host.js';

// NAP-INTENT napplet/naps master 377bf939: relay hints are untrusted and MUST NOT
// bypass the shell's network policy (kehto/web#523).
describe('pajaAllowedIntentHint', () => {
  const address = `35129:${'a'.repeat(64)}:note-viewer`;

  it('keeps public wss relays and configured development relays', () => {
    expect(pajaAllowedIntentHint({ address, relays: ['wss://relay.example', 'ws://127.0.0.1:7777'] }, ['ws://127.0.0.1:7777']))
      .toEqual({ address, relays: ['wss://relay.example', 'ws://127.0.0.1:7777'] });
  });

  it('drops plaintext, local, and private relays the napplet supplied', () => {
    expect(pajaAllowedIntentHint({
      address,
      relays: ['ws://relay.example', 'wss://localhost', 'wss://192.168.1.4', 'wss://10.0.0.2', 'wss://printer.local', 'not a url'],
    }, ['wss://configured.example'])).toEqual({ address });
  });
});
