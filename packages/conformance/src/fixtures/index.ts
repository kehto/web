/**
 * fixtures/index.ts — Every domain fixture, keyed by domain.
 */
import { GAMEPAD_FIXTURE } from './gamepad.js';
import { IDENTITY_FIXTURE } from './identity.js';
import { SERIAL_FIXTURE } from './serial.js';
import { STORAGE_FIXTURE } from './storage.js';
import { THEME_FIXTURE } from './theme.js';
import type { DomainFixture } from './types.js';

/** Fixtures the generic domain scenario runs. */
export const FIXTURES: Readonly<Record<string, DomainFixture>> = Object.freeze(Object.fromEntries(
  [
    GAMEPAD_FIXTURE,
    IDENTITY_FIXTURE,
    SERIAL_FIXTURE,
    STORAGE_FIXTURE,
    THEME_FIXTURE,
  ].map((fixture) => [fixture.domain, fixture]),
));
