/**
 * kehto/domains/index.ts — Every full-profile backend module, in boot order.
 */
import { BLE_BACKEND } from './ble.js';
import { DM_BACKEND } from './dm.js';
import { FS_BACKEND } from './fs.js';
import { GAMEPAD_BACKEND } from './gamepad.js';
import { IDENTITY_BACKEND } from './identity.js';
import { KEYS_BACKEND } from './keys.js';
import { LLM_BACKEND } from './llm.js';
import { MEDIA_BACKEND } from './media.js';
import { NOTIFY_BACKEND } from './notify.js';
import { OUTBOX_BACKEND } from './outbox.js';
import { RELAY_BACKEND } from './relay.js';
import { SERIAL_BACKEND } from './serial.js';
import { THEME_BACKEND } from './theme.js';
import { WEBRTC_BACKEND } from './webrtc.js';
import type { DomainBackendModule } from './types.js';

/** Backends the full profile installs. The minimal profile installs none. */
export const DOMAIN_BACKENDS: readonly DomainBackendModule[] = [
  IDENTITY_BACKEND,
  THEME_BACKEND,
  BLE_BACKEND,
  DM_BACKEND,
  FS_BACKEND,
  GAMEPAD_BACKEND,
  KEYS_BACKEND,
  LLM_BACKEND,
  MEDIA_BACKEND,
  NOTIFY_BACKEND,
  OUTBOX_BACKEND,
  RELAY_BACKEND,
  SERIAL_BACKEND,
  WEBRTC_BACKEND,
];
