import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PAJA_LLM_VAULT_STORAGE_KEY, createPajaLlmVault, validatePajaLlmVaultPassword } from './browser-llm-vault.js';

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.get(key) ?? null; }
  key(index: number): string | null { return [...this.map.keys()][index] ?? null; }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void { this.map.set(key, value); }
}

const PASSWORD = 'correct horse battery staple';
const KEY = 'sk-live-very-secret-key';
const crypto = webcrypto as unknown as Crypto;
const fast = { crypto, iterations: 1000 };

describe('Paja LLM credential vault', () => {
  it('rejects weak passwords before deriving a key', () => {
    expect(validatePajaLlmVaultPassword('short')).toMatch(/12 characters/);
    expect(validatePajaLlmVaultPassword('aaaaaaaaaaaaaaaa')).toMatch(/distinct/);
    expect(validatePajaLlmVaultPassword(PASSWORD)).toBeNull();
    const vault = createPajaLlmVault({ storage: new MemoryStorage(), ...fast });
    return expect(vault.create('weak')).rejects.toThrow(/12 characters/);
  });

  it('stores only ciphertext, unlocks with the right password and rejects the wrong one', async () => {
    const storage = new MemoryStorage();
    const vault = createPajaLlmVault({ storage, ...fast });
    expect(vault.hasStoredSecrets()).toBe(false);
    await vault.create(PASSWORD);
    await vault.setCredential('conn-1', KEY, 'vault');
    const raw = storage.getItem(PAJA_LLM_VAULT_STORAGE_KEY)!;
    expect(raw).not.toContain(KEY);
    expect(raw).not.toContain('conn-1');
    expect(raw).not.toContain(PASSWORD);
    expect(JSON.parse(raw)).toMatchObject({ version: 1, kdf: 'PBKDF2-SHA-256', iterations: 1000 });

    const reopened = createPajaLlmVault({ storage, ...fast });
    expect(reopened.hasStoredSecrets()).toBe(true);
    expect(reopened.isUnlocked()).toBe(false);
    expect(reopened.getCredential('conn-1')).toBeUndefined();
    await expect(reopened.unlock('wrong password 12345')).resolves.toBe(false);
    expect(reopened.isUnlocked()).toBe(false);
    await expect(reopened.unlock(PASSWORD)).resolves.toBe(true);
    expect(reopened.getCredential('conn-1')).toBe(KEY);
    reopened.lock();
    expect(reopened.getCredential('conn-1')).toBeUndefined();
    expect(reopened.hasStoredSecrets()).toBe(true);
  });

  it('keeps session-only keys out of storage and clears everything on demand', async () => {
    const storage = new MemoryStorage();
    const vault = createPajaLlmVault({ storage, ...fast });
    const events: string[] = [];
    vault.subscribe(() => events.push(vault.isUnlocked() ? 'unlocked' : 'locked'));
    await vault.setCredential('temp', KEY, 'session');
    expect(vault.getCredential('temp')).toBe(KEY);
    expect(storage.length).toBe(0);
    await expect(vault.setCredential('temp', KEY, 'vault')).rejects.toThrow(/Unlock/);
    await vault.create(PASSWORD);
    await vault.setCredential('temp', KEY, 'vault');
    expect(storage.getItem(PAJA_LLM_VAULT_STORAGE_KEY)).not.toContain(KEY);
    await vault.removeCredential('temp');
    expect(vault.getCredential('temp')).toBeUndefined();
    vault.clear();
    expect(storage.length).toBe(0);
    expect(vault.isUnlocked()).toBe(false);
    expect(events).toEqual(['unlocked', 'locked']);
  });

  it('treats corrupt documents as absent and works without storage', async () => {
    const storage = new MemoryStorage();
    storage.setItem(PAJA_LLM_VAULT_STORAGE_KEY, '{"version":9}');
    const vault = createPajaLlmVault({ storage, ...fast });
    expect(vault.hasStoredSecrets()).toBe(false);
    await expect(vault.unlock(PASSWORD)).resolves.toBe(false);
    const memory = createPajaLlmVault({ storage: null, ...fast });
    await memory.create(PASSWORD);
    await memory.setCredential('c', KEY, 'vault');
    expect(memory.getCredential('c')).toBe(KEY);
    expect(memory.hasStoredSecrets()).toBe(false);
  });
});
