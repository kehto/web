/**
 * kehto/domains/index.ts — Every full-profile backend module, in boot order.
 */
import { IDENTITY_BACKEND } from './identity.js';
import { SERIAL_BACKEND } from './serial.js';
import { THEME_BACKEND } from './theme.js';
import type { DomainBackendModule } from './types.js';

/** Backends the full profile installs. The minimal profile installs none. */
export const DOMAIN_BACKENDS: readonly DomainBackendModule[] = [
  IDENTITY_BACKEND,
  SERIAL_BACKEND,
  THEME_BACKEND,
];
