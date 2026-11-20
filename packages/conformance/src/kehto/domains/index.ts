/**
 * kehto/domains/index.ts — Every full-profile backend module, in boot order.
 */
import { GAMEPAD_BACKEND } from './gamepad.js';
import { IDENTITY_BACKEND } from './identity.js';
import { LLM_BACKEND } from './llm.js';
import { SERIAL_BACKEND } from './serial.js';
import { THEME_BACKEND } from './theme.js';
import type { DomainBackendModule } from './types.js';

/** Backends the full profile installs. The minimal profile installs none. */
export const DOMAIN_BACKENDS: readonly DomainBackendModule[] = [
  GAMEPAD_BACKEND,
  IDENTITY_BACKEND,
  LLM_BACKEND,
  SERIAL_BACKEND,
  THEME_BACKEND,
];
