/**
 * fixtures/index.ts — Every domain fixture, keyed by domain.
 */
import { COUNT_FIXTURE } from './count.js';
import { IDENTITY_FIXTURE } from './identity.js';
import { STORAGE_FIXTURE } from './storage.js';
import { THEME_FIXTURE } from './theme.js';
import { LINK_FIXTURE } from './link.js';
import { COMMON_FIXTURE } from './common.js';
import { LISTS_FIXTURE } from './lists.js';
import type { DomainFixture } from './types.js';

/** Fixtures the generic domain scenario runs. */
export const FIXTURES: Readonly<Record<string, DomainFixture>> = Object.freeze(Object.fromEntries(
  [
    IDENTITY_FIXTURE,
    STORAGE_FIXTURE,
    THEME_FIXTURE,
    COUNT_FIXTURE,
    LINK_FIXTURE,
    COMMON_FIXTURE,
    LISTS_FIXTURE,
  ].map((fixture) => [fixture.domain, fixture]),
));
