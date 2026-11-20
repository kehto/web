/**
 * kehto/domains/index.ts — Every full-profile backend module, in boot order.
 */
import { BLE_BACKEND } from './ble.js';
import { COMMON_BACKEND } from './common.js';
import { CONFIG_BACKEND } from './config.js';
import { COUNT_BACKEND } from './count.js';
import { CVM_BACKEND } from './cvm.js';
import { DM_BACKEND } from './dm.js';
import { FS_BACKEND } from './fs.js';
import { GAMEPAD_BACKEND } from './gamepad.js';
import { IDENTITY_BACKEND } from './identity.js';
import { INTENT_BACKEND } from './intent.js';
import { KEYS_BACKEND } from './keys.js';
import { LINK_BACKEND } from './link.js';
import { LISTS_BACKEND } from './lists.js';
import { LLM_BACKEND } from './llm.js';
import { MEDIA_BACKEND } from './media.js';
import { NOTIFY_BACKEND } from './notify.js';
import { OUTBOX_BACKEND } from './outbox.js';
import { RELAY_BACKEND } from './relay.js';
import { RESOURCE_BACKEND } from './resource.js';
import { SERIAL_BACKEND } from './serial.js';
import { THEME_BACKEND } from './theme.js';
import { UPLOAD_BACKEND } from './upload.js';
import { WEBRTC_BACKEND } from './webrtc.js';
import type { DomainBackendModule } from './types.js';

/** Backends the full profile installs. The minimal profile installs none. */
export const DOMAIN_BACKENDS: readonly DomainBackendModule[] = [
  IDENTITY_BACKEND,
  THEME_BACKEND,
  BLE_BACKEND,
  COMMON_BACKEND,
  CONFIG_BACKEND,
  COUNT_BACKEND,
  CVM_BACKEND,
  DM_BACKEND,
  FS_BACKEND,
  GAMEPAD_BACKEND,
  INTENT_BACKEND,
  KEYS_BACKEND,
  LINK_BACKEND,
  LISTS_BACKEND,
  LLM_BACKEND,
  MEDIA_BACKEND,
  NOTIFY_BACKEND,
  OUTBOX_BACKEND,
  RELAY_BACKEND,
  RESOURCE_BACKEND,
  SERIAL_BACKEND,
  UPLOAD_BACKEND,
  WEBRTC_BACKEND,
];
