/**
 * fixtures/index.ts — Every domain fixture, keyed by domain.
 */
import { BLE_FIXTURE } from './ble.js';
import { COMMON_FIXTURE } from './common.js';
import { CONFIG_FIXTURE } from './config.js';
import { COUNT_FIXTURE } from './count.js';
import { CVM_FIXTURE } from './cvm.js';
import { DM_FIXTURE } from './dm.js';
import { FS_FIXTURE } from './fs.js';
import { GAMEPAD_FIXTURE } from './gamepad.js';
import { IDENTITY_FIXTURE } from './identity.js';
import { INC_FIXTURE } from './inc.js';
import { INTENT_FIXTURE } from './intent.js';
import { KEYS_FIXTURE } from './keys.js';
import { LINK_FIXTURE } from './link.js';
import { LISTS_FIXTURE } from './lists.js';
import { LLM_FIXTURE } from './llm.js';
import { MEDIA_FIXTURE } from './media.js';
import { NOTIFY_FIXTURE } from './notify.js';
import { OUTBOX_FIXTURE } from './outbox.js';
import { RELAY_FIXTURE } from './relay.js';
import { RESOURCE_FIXTURE } from './resource.js';
import { SERIAL_FIXTURE } from './serial.js';
import { STORAGE_FIXTURE } from './storage.js';
import { THEME_FIXTURE } from './theme.js';
import { UPLOAD_FIXTURE } from './upload.js';
import { WEBRTC_FIXTURE } from './webrtc.js';
import type { DomainFixture } from './types.js';

/** Fixtures the generic domain scenario runs. */
export const FIXTURES: Readonly<Record<string, DomainFixture>> = Object.freeze(Object.fromEntries([
  BLE_FIXTURE,
  COMMON_FIXTURE,
  CONFIG_FIXTURE,
  COUNT_FIXTURE,
  CVM_FIXTURE,
  DM_FIXTURE,
  FS_FIXTURE,
  GAMEPAD_FIXTURE,
  IDENTITY_FIXTURE,
  INC_FIXTURE,
  INTENT_FIXTURE,
  KEYS_FIXTURE,
  LINK_FIXTURE,
  LISTS_FIXTURE,
  LLM_FIXTURE,
  MEDIA_FIXTURE,
  NOTIFY_FIXTURE,
  OUTBOX_FIXTURE,
  RELAY_FIXTURE,
  RESOURCE_FIXTURE,
  SERIAL_FIXTURE,
  STORAGE_FIXTURE,
  THEME_FIXTURE,
  UPLOAD_FIXTURE,
  WEBRTC_FIXTURE,
].map((fixture) => [fixture.domain, fixture])));
