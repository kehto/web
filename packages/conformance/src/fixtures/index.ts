/**
 * fixtures/index.ts — Every domain fixture, keyed by domain.
 */
import { COUNT_FIXTURE } from './count.js';
import { IDENTITY_FIXTURE } from './identity.js';
import { STORAGE_FIXTURE } from './storage.js';
import { THEME_FIXTURE } from './theme.js';
import type { DomainFixture } from './types.js';

/** Fixtures the generic domain scenario runs. */
export const FIXTURES: Readonly<Record<string, DomainFixture>> = Object.freeze(Object.fromEntries(
  [
    IDENTITY_FIXTURE,
    STORAGE_FIXTURE,
    THEME_FIXTURE,
    COUNT_FIXTURE,
  ].map((fixture) => [fixture.domain, fixture]),
));
