import { describe, expect, it } from 'vitest';
import { createEndpointRegistry } from './endpoint-registry.js';

const registration = {
  windowId: 'window-1',
  dTag: 'example',
  aggregateHash: 'abc123',
  environment: {},
} as const;

describe('createEndpointRegistry', () => {
  it('keeps a current reservation when an obsolete generation tries to remove it', () => {
    const registry = createEndpointRegistry();
    const first = registry.reserve(registration);

    expect(registry.compareAndRemove(first.windowId, first.generation)).toBe(first);

    const current = registry.reserve(registration);
    expect(registry.compareAndRemove(first.windowId, first.generation)).toBeUndefined();
    expect(registry.get(current.windowId)).toBe(current);
    expect(registry.compareAndRemove(current.windowId, current.generation)).toBe(current);
  });
});
