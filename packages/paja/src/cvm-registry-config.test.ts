import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizePajaSimulation, PajaSimulationError } from './simulation.js';
import { PAJA_MULTIPLAYER_REGISTRY, resetPajaCvmRegistryWarningForTests, resolvePajaCvmRegistry } from './cvm-registry-config.js';

const pin = (family: string, pubkey: string, schemaHash: string) => ({
  family, server: { pubkey, relays: ['wss://provider.example'] }, tools: [{ name: 'join', schemaHash }],
});
const SIGNALING = { profile: 'soy-rtc/1' as const, relays: ['wss://signal.example'] };
const A = 'a'.repeat(64), B = 'b'.repeat(64), C = 'c'.repeat(64), D = 'd'.repeat(64);

afterEach(() => resetPajaCvmRegistryWarningForTests());

describe('simulation.cvm.registry', () => {
  it('pins CVM families without a multiplayer signaling profile', () => {
    const simulation = normalizePajaSimulation({ cvm: { registry: [pin('rooms', A, B)] } });
    expect(simulation.multiplayer).toBeUndefined();
    expect(simulation.cvm.registry).toEqual([pin('rooms', A, B)]);
    const warn = vi.fn();
    expect(resolvePajaCvmRegistry(simulation, [], warn)).toEqual([pin('rooms', A, B)]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('omits an empty registry and rejects malformed families as simulation errors', () => {
    expect(normalizePajaSimulation({ cvm: { registry: [] } }).cvm.registry).toBeUndefined();
    expect(() => normalizePajaSimulation({ cvm: { registry: [{ ...pin('rooms', A, B), tools: [{ name: 'join' }] }] as never } }))
      .toThrow(PajaSimulationError);
    expect(() => normalizePajaSimulation({ cvm: { registry: 'rooms' as never } })).toThrow('cvm.registry');
  });
});

describe(`${PAJA_MULTIPLAYER_REGISTRY} legacy multiplayer.registry`, () => {
  it('still serves legacy families and warns once per page with the replacement', () => {
    const simulation = normalizePajaSimulation({ multiplayer: { ...SIGNALING, registry: [pin('legacy', A, B)] } });
    const warn = vi.fn();
    expect(resolvePajaCvmRegistry(simulation, [], warn)).toEqual([pin('legacy', A, B)]);
    expect(resolvePajaCvmRegistry(simulation, [], warn)).toEqual([pin('legacy', A, B)]);
    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0]!;
    expect(message).toMatch(/^\[PAJA_MULTIPLAYER_REGISTRY\] /u);
    expect(message).toContain('simulation.cvm.registry');
    expect(message).toContain('ContextVM providers panel');
    expect(message).toContain('once per page load');
    expect(message).not.toContain(A);
  });

  it('stays quiet for an empty legacy registry, which earlier saved settings always carry', () => {
    const simulation = normalizePajaSimulation({ multiplayer: { ...SIGNALING, registry: [] } });
    expect(simulation.multiplayer).toEqual(SIGNALING);
    const warn = vi.fn();
    expect(resolvePajaCvmRegistry(simulation, [], warn)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('lets cvm.registry and then saved families win for the same label and provider', () => {
    const simulation = normalizePajaSimulation({
      multiplayer: { ...SIGNALING, registry: [pin('rooms', A, B), pin('other', A, B)] },
      cvm: { registry: [pin('rooms', A, C)] },
    });
    const warn = vi.fn();
    expect(resolvePajaCvmRegistry(simulation, [], warn)).toEqual([pin('rooms', A, C), pin('other', A, B)]);
    expect(resolvePajaCvmRegistry(simulation, [{ config: pin('rooms', A, D), source: 'manual JSON', manual: true }], warn))
      .toEqual([pin('rooms', A, D), pin('other', A, B)]);
  });
});
