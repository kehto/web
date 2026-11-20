/**
 * fixtures/index.ts — Every domain fixture, keyed by domain.
 */
import { IDENTITY_FIXTURE } from './identity.js';
import { KEYS_FIXTURE } from './keys.js';
import { MEDIA_FIXTURE } from './media.js';
import { NOTIFY_FIXTURE } from './notify.js';
import { OUTBOX_FIXTURE } from './outbox.js';
import { RELAY_FIXTURE } from './relay.js';
import { STORAGE_FIXTURE } from './storage.js';
import { THEME_FIXTURE } from './theme.js';
import type { DomainFixture } from './types.js';

/** Fixtures the generic domain scenario runs. */
export const FIXTURES: Readonly<Record<string, DomainFixture>> = Object.freeze(Object.fromEntries(
  [
    IDENTITY_FIXTURE,
    STORAGE_FIXTURE,
    THEME_FIXTURE,
    RELAY_FIXTURE,
    OUTBOX_FIXTURE,
    KEYS_FIXTURE,
    NOTIFY_FIXTURE,
    MEDIA_FIXTURE,
  ].map((fixture) => [fixture.domain, fixture]),
));
