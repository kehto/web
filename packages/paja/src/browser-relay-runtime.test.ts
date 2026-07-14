import { describe, expect, it } from 'vitest';

import { getPajaRelayUrls } from './browser-relay-runtime.js';
import { normalizePajaSimulation } from './simulation.js';

describe('@kehto/paja effective relay URLs', () => {
  it('returns configured live relay URLs in their configured order', () => {
    const simulation = normalizePajaSimulation({
      relay: {
        mode: 'live',
        urls: ['wss://first.example', 'wss://second.example'],
      },
    });

    expect(getPajaRelayUrls(simulation)).toEqual([
      'wss://first.example',
      'wss://second.example',
    ]);
  });

  it('returns no fallback relay URLs when relay simulation is disabled', () => {
    const simulation = normalizePajaSimulation({
      relay: { mode: 'disabled', urls: ['wss://must-not-connect.example'] },
    });

    expect(getPajaRelayUrls(simulation)).toEqual([]);
  });
});
