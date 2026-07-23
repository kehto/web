import { describe, expect, it } from 'vitest';
import {
  PAJA_TARGET_CORS_HINT,
  classifyTargetCors,
  probeTargetCors,
  type PajaTargetCorsFetch,
} from './target-cors.js';

const TARGET = 'http://127.0.0.1:5173/';

describe('classifyTargetCors', () => {
  it('accepts a wildcard allow-origin', () => {
    const diagnostic = classifyTargetCors(TARGET, '*');

    expect(diagnostic.status).toBe('allowed');
    expect(diagnostic.allowOrigin).toBe('*');
    expect(diagnostic.hint).toBeNull();
  });

  it('accepts an explicit null allow-origin', () => {
    expect(classifyTargetCors(TARGET, 'null').status).toBe('allowed');
  });

  it('blocks a missing allow-origin', () => {
    const diagnostic = classifyTargetCors(TARGET, null);

    expect(diagnostic.status).toBe('blocked');
    expect(diagnostic.allowOrigin).toBeNull();
    expect(diagnostic.hint).toBe(PAJA_TARGET_CORS_HINT);
  });

  it('blocks an empty allow-origin', () => {
    expect(classifyTargetCors(TARGET, '').status).toBe('blocked');
  });

  // Vite's default server.cors allowlist echoes localhost origins but rejects
  // the sandboxed frame's opaque `Origin: null`, which is the exact failure
  // this diagnostic exists to catch.
  it('blocks an echoed localhost allow-origin', () => {
    const diagnostic = classifyTargetCors(TARGET, 'http://127.0.0.1:5198');

    expect(diagnostic.status).toBe('blocked');
    expect(diagnostic.allowOrigin).toBe('http://127.0.0.1:5198');
    expect(diagnostic.detail).toContain('http://127.0.0.1:5198');
    expect(diagnostic.hint).toBe(PAJA_TARGET_CORS_HINT);
  });

  it('ignores surrounding whitespace', () => {
    expect(classifyTargetCors(TARGET, ' * ').status).toBe('allowed');
  });
});

describe('probeTargetCors', () => {
  it('sends Origin: null and classifies the response header', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl: PajaTargetCorsFetch = async (url, init) => {
      seen.push({ url, headers: init.headers });
      return { headers: { get: (name) => (name === 'access-control-allow-origin' ? '*' : null) } };
    };

    const diagnostic = await probeTargetCors(TARGET, fetchImpl);

    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe(TARGET);
    expect(seen[0]?.headers.origin).toBe('null');
    expect(diagnostic.status).toBe('allowed');
  });

  it('reports an unreachable target instead of throwing', async () => {
    const fetchImpl: PajaTargetCorsFetch = async () => {
      throw new Error('connect ECONNREFUSED');
    };

    const diagnostic = await probeTargetCors(TARGET, fetchImpl);

    expect(diagnostic.status).toBe('unreachable');
    expect(diagnostic.detail).toContain('connect ECONNREFUSED');
    expect(diagnostic.hint).toContain('--target-url');
  });
});
