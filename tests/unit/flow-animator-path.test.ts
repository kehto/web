import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('document', { getElementById: () => null });

vi.mock('../../apps/playground/src/topology.js', () => ({
  getAclRuntimeEdgeId: () => 'topology-edge-acl-runtime',
  getNappletEdgeId: (name: string) => `topology-edge-napplet-${name}-shell`,
  getNappletNodeId: (name: string) => `topology-node-napplet-${name}`,
  getRuntimeServiceEdgeId: (name: string) => `topology-edge-runtime-service-${name}`,
  getShellAclEdgeId: () => 'topology-edge-shell-acl',
  getShellNodeId: () => 'topology-node-shell',
}));

vi.mock('../../apps/playground/src/color-state.js', () => ({
  recordEdgeColor: vi.fn(),
  getEdgeColor: vi.fn(),
  onColorStateChange: vi.fn(),
  getPersistenceMode: () => 'flash',
  setNodeOverlayColor: vi.fn(),
}));

vi.mock('../../apps/playground/src/trace-animator.js', () => ({
  animateTrace: vi.fn(),
}));

vi.mock('../../apps/playground/src/demo-config.js', () => ({
  demoConfig: { get: () => 1 },
}));

import { buildHighlightPath } from '../../apps/playground/src/flow-animator.js';

const topology = {
  nodes: [],
  edges: [],
  hostPubkey: '',
  napplets: [],
  services: ['notifications'],
};

function hostNotification(direction: 'napplet->shell' | 'shell->napplet') {
  return {
    index: 0,
    timestamp: 0,
    direction,
    verb: 'notify.create',
    windowId: 'demo-host',
    raw: { type: 'notify.create' },
    envelopeType: 'notify.create',
    parsed: { domain: 'notify' },
  };
}

describe('flow animator host notification path', () => {
  it('retains the direct notification route without a napplet frame identity', () => {
    expect(buildHighlightPath(topology as never, hostNotification('napplet->shell') as never)).toEqual({
      nodes: [
        'topology-node-acl',
        'topology-node-runtime',
        'topology-node-service-notifications',
      ],
      edges: [
        'topology-edge-acl-runtime',
        'topology-edge-runtime-service-notifications',
      ],
    });

    expect(buildHighlightPath(topology as never, hostNotification('shell->napplet') as never)).toEqual({
      nodes: [
        'topology-node-service-notifications',
        'topology-node-runtime',
        'topology-node-acl',
      ],
      edges: [
        'topology-edge-runtime-service-notifications',
        'topology-edge-acl-runtime',
      ],
    });
  });

  it('still ignores unrelated host messages without a napplet frame identity', () => {
    expect(buildHighlightPath(topology as never, {
      ...hostNotification('napplet->shell'),
      verb: 'theme.get',
      raw: { type: 'theme.get' },
      envelopeType: 'theme.get',
      parsed: { domain: 'theme' },
    } as never)).toBeNull();
  });
});
