import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from './random-uuid.js';

afterEach(() => vi.unstubAllGlobals());

describe('shell UUID generation', () => {
  it('calls the native method with its Crypto receiver', () => {
    const provider = {
      randomUUID: vi.fn(function (this: unknown) {
        expect(this).toBe(provider);
        return 'f81d4fae-7dec-4a6a-8765-00a0c91e6bf6';
      }),
      getRandomValues: vi.fn(),
    };
    vi.stubGlobal('crypto', provider);
    expect(randomUUID()).toBe('f81d4fae-7dec-4a6a-8765-00a0c91e6bf6');
    expect(provider.randomUUID).toHaveBeenCalledOnce();
    expect(provider.getRandomValues).not.toHaveBeenCalled();
  });

  it('uses 16 secure random bytes with UUID v4 version and variant bits', () => {
    let value = 0;
    const provider = {
      getRandomValues: vi.fn(function (this: unknown, bytes: Uint8Array) {
        expect(this).toBe(provider);
        expect(bytes.byteLength).toBe(16);
        return bytes.fill(value++ === 0 ? 0 : 255);
      }),
    };
    vi.stubGlobal('crypto', provider);
    expect(randomUUID()).toBe('00000000-0000-4000-8000-000000000000');
    expect(randomUUID()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(provider.getRandomValues).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, {}])('fails explicitly when secure randomness is unavailable: %s', (provider) => {
    vi.stubGlobal('crypto', provider);
    expect(randomUUID).toThrow('@kehto/shell requires crypto.randomUUID or crypto.getRandomValues');
  });

  it('propagates entropy failures without using a weak random source', () => {
    vi.stubGlobal('crypto', { getRandomValues() { throw new Error('entropy unavailable'); } });
    expect(randomUUID).toThrow('entropy unavailable');
  });
});
