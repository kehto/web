import type { NappletMessage } from '@napplet/core';

/** Detach bounded JSON data without invoking getters or serialization hooks. */
export function snapshotApprovalEnvelope(message: NappletMessage): NappletMessage | undefined {
  let nodes = 8192;
  let text = 1024 * 1024;
  const ancestors = new Set<object>();
  function clone(value: unknown, depth: number): unknown {
    if (--nodes < 0 || depth > 32) throw new RangeError('Approval envelope exceeds limits');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      text -= value.length;
      if (text < 0) throw new RangeError('Approval envelope exceeds text limit');
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object' || ancestors.has(value)) throw new TypeError('Expected acyclic JSON');
    const array = Array.isArray(value);
    if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new TypeError('Expected plain JSON object');
    }
    const keys = Object.keys(value);
    if (keys.length > nodes || (array && value.length > nodes)) throw new RangeError('Approval envelope exceeds limits');
    if (array && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) {
      throw new TypeError('Expected dense JSON array');
    }
    ancestors.add(value);
    const result: Record<string, unknown> | unknown[] = array ? [] : {};
    for (const key of keys) {
      text -= key.length;
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (text < 0 || !('value' in descriptor)) throw new TypeError('Expected JSON data properties');
      Object.defineProperty(result, key, { value: clone(descriptor.value, depth + 1), enumerable: true });
    }
    if (array && result.length !== value.length) throw new TypeError('Sparse arrays are not JSON');
    ancestors.delete(value);
    return Object.freeze(result);
  }
  try { return clone(message, 0) as NappletMessage; }
  catch { return undefined; }
}
