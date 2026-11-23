import type { CvmRegistryFamily } from '@kehto/services';
import { mergeCvmFamilies, type SavedCvmFamily } from './cvm-family-store.js';
import type { PajaSimulation } from './simulation.js';

/** Stable id for the deprecated `simulation.multiplayer.registry` path (docs/compatibility.md). */
export const PAJA_MULTIPLAYER_REGISTRY = 'PAJA_MULTIPLAYER_REGISTRY';

let warned = false;

/**
 * Resolve the CVM families a Paja page serves. Later sources win for the same
 * label/provider pair: legacy `multiplayer.registry`, then `cvm.registry`, then
 * families saved in this browser. A non-empty legacy registry warns once per page.
 * @param simulation - Normalized simulation (only `cvm` and `multiplayer` are read).
 * @param saved - Families saved for this host origin.
 * @param warn - Diagnostic sink; defaults to `console.warn`.
 * @returns The merged registry.
 * @example
 * ```ts
 * const registry = resolvePajaCvmRegistry(getSimulation(), readCvmFamilies());
 * ```
 */
export function resolvePajaCvmRegistry(
  simulation: Pick<PajaSimulation, 'cvm' | 'multiplayer'>,
  saved: readonly SavedCvmFamily[],
  warn: (message: string) => void = message => console.warn(message),
): CvmRegistryFamily[] {
  const legacy = simulation.multiplayer?.registry ?? [];
  if (legacy.length && !warned) {
    warned = true;
    warn(`[${PAJA_MULTIPLAYER_REGISTRY}] simulation.multiplayer.registry is deprecated; move these CVM families to simulation.cvm.registry, which needs no signaling profile. Shown once per page load.`);
  }
  return mergeCvmFamilies([...legacy, ...(simulation.cvm.registry ?? [])], saved);
}

/** Test hook: re-arm the once-per-page warning. */
export function resetPajaCvmRegistryWarningForTests(): void {
  warned = false;
}
