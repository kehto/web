import { afterEach, describe, expect, it, vi } from 'vitest';

const PUBKEY = 'f'.repeat(64);
const BUNKER_PUBKEY = 'a'.repeat(64);
const RELAY_URL = 'wss://relay.example.test';
const BUNKER_SECRET = 'bunker-connection-value';
const LOCAL_KEY = new Uint8Array(Array.from({ length: 32 }, (_, index) => index + 1));
const LOCAL_KEY_HEX = Array.from(LOCAL_KEY).map((byte) => byte.toString(16).padStart(2, '0')).join('');

function installStorage(): Map<string, string> {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  });
  return values;
}

function installNip07Signer(pubkey = PUBKEY): void {
  const signer = {
    getPublicKey: vi.fn(async () => pubkey),
    signEvent: vi.fn(async (event: Record<string, unknown>) => event),
  };
  vi.stubGlobal('nostr', signer);
  vi.stubGlobal('window', { nostr: signer });
}

function createNip46Mock() {
  const capturedOptions: Array<Record<string, unknown>> = [];
  const close = vi.fn();
  const client = {
    connect: vi.fn(async () => PUBKEY),
    getSigner: vi.fn(() => ({
      getPublicKey: vi.fn(async () => PUBKEY),
      signEvent: vi.fn(async (event: Record<string, unknown>) => event),
    })),
    close,
  };
  const factory = {
    createNip46LocalSecretKey: vi.fn(() => LOCAL_KEY),
    createNip46Client: vi.fn((options: Record<string, unknown>) => {
      capturedOptions.push(options);
      return client;
    }),
  };

  vi.doMock('../../apps/playground/src/nip46-client.js', () => factory);
  vi.doMock('../../apps/playground/src/nip46-client.ts', () => factory);
  return { capturedOptions, client, factory };
}

describe('signer connection persistence', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../../apps/playground/src/nip46-client.js');
    vi.doUnmock('../../apps/playground/src/nip46-client.ts');
    vi.unstubAllGlobals();
  });

  it('persists NIP-07 login and restores it on the next module load', async () => {
    const storage = installStorage();
    installNip07Signer();

    let connection = await import('../../apps/playground/src/signer-connection.ts');
    await connection.connectNip07();

    const stored = storage.get(connection.SIGNER_CONNECTION_STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toMatchObject({
      version: 1,
      method: 'nip07',
      pubkey: PUBKEY,
    });

    vi.resetModules();
    installNip07Signer();
    connection = await import('../../apps/playground/src/signer-connection.ts');

    await expect(connection.restorePersistedSignerConnection()).resolves.toBe(true);
    expect(connection.getSignerConnectionState()).toMatchObject({
      method: 'nip07',
      pubkey: PUBKEY,
      relay: null,
      isConnecting: false,
      error: null,
    });
    expect(connection.getSigner()).not.toBeNull();
  });

  it('persists NIP-46 bunker secret and local requester key for restore', async () => {
    const storage = installStorage();
    const nip46Mock = createNip46Mock();
    const connection = await import('../../apps/playground/src/signer-connection.ts');

    await connection.connectNip46({
      relayUrl: RELAY_URL,
      bunkerPubkey: BUNKER_PUBKEY,
      secret: BUNKER_SECRET,
    });

    const stored = storage.get(connection.SIGNER_CONNECTION_STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toMatchObject({
      version: 1,
      method: 'nip46',
      pubkey: PUBKEY,
      relayUrl: RELAY_URL,
      bunkerPubkey: BUNKER_PUBKEY,
      secret: BUNKER_SECRET,
      localSecretKey: LOCAL_KEY_HEX,
    });
    expect(nip46Mock.capturedOptions[0]).toMatchObject({
      relayUrl: RELAY_URL,
      bunkerPubkey: BUNKER_PUBKEY,
      secret: BUNKER_SECRET,
      localSecretKey: LOCAL_KEY,
    });

    vi.resetModules();
    const restoreMock = createNip46Mock();
    const restoredConnection = await import('../../apps/playground/src/signer-connection.ts');

    await expect(restoredConnection.restorePersistedSignerConnection()).resolves.toBe(true);
    const restoredOptions = restoreMock.capturedOptions[0] as {
      secret?: string;
      localSecretKey?: Uint8Array;
    };
    expect(restoredOptions.secret).toBe(BUNKER_SECRET);
    expect(Array.from(restoredOptions.localSecretKey ?? [])).toEqual(Array.from(LOCAL_KEY));
    expect(restoredConnection.getSignerConnectionState()).toMatchObject({
      method: 'nip46',
      pubkey: PUBKEY,
      relay: RELAY_URL,
      isConnecting: false,
      error: null,
    });
  });

  it('clears persisted signer state on disconnect', async () => {
    const storage = installStorage();
    installNip07Signer();
    const connection = await import('../../apps/playground/src/signer-connection.ts');

    await connection.connectNip07();
    expect(storage.has(connection.SIGNER_CONNECTION_STORAGE_KEY)).toBe(true);

    connection.disconnectSigner();

    expect(storage.has(connection.SIGNER_CONNECTION_STORAGE_KEY)).toBe(false);
    expect(connection.getSigner()).toBeNull();
  });
});
