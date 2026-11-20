/**
 * fixtures/index.ts — Every domain fixture, keyed by domain.
 */
import { BLE_FIXTURE } from './ble.js';
import { DM_FIXTURE } from './dm.js';
import { FS_FIXTURE } from './fs.js';
import { GAMEPAD_FIXTURE } from './gamepad.js';
import { IDENTITY_FIXTURE } from './identity.js';
import { INC_FIXTURE } from './inc.js';
import { KEYS_FIXTURE } from './keys.js';
import { LLM_FIXTURE } from './llm.js';
import { MEDIA_FIXTURE } from './media.js';
import { NOTIFY_FIXTURE } from './notify.js';
import { OUTBOX_FIXTURE } from './outbox.js';
import { RELAY_FIXTURE } from './relay.js';
import { SERIAL_FIXTURE } from './serial.js';
import { STORAGE_FIXTURE } from './storage.js';
import { THEME_FIXTURE } from './theme.js';
import { WEBRTC_FIXTURE } from './webrtc.js';
import type { DomainFixture } from './types.js';

/** Fixtures the generic domain scenario runs. */
export const FIXTURES: Readonly<Record<string, DomainFixture>> = Object.freeze(Object.fromEntries([
  BLE_FIXTURE,
  DM_FIXTURE,
  FS_FIXTURE,
  GAMEPAD_FIXTURE,
  IDENTITY_FIXTURE,
  INC_FIXTURE,
  KEYS_FIXTURE,
  LLM_FIXTURE,
  MEDIA_FIXTURE,
  NOTIFY_FIXTURE,
  OUTBOX_FIXTURE,
  RELAY_FIXTURE,
  SERIAL_FIXTURE,
  STORAGE_FIXTURE,
  THEME_FIXTURE,
  WEBRTC_FIXTURE,
].map((fixture) => [fixture.domain, fixture])));
