/**
 * domains/index.ts — Barrel of every domain mock and the registry entries.
 *
 * Each domain module exports `createMock<Domain>Service` (wire domains), its
 * state/options/service types, its `<DOMAIN>_SPEC_REF`, and a
 * `<DOMAIN>_MOCK_ENTRY`. To add a domain: create the module, add an
 * `export *` line below, and append its entry to `DOMAIN_ENTRIES`.
 */
import type { MockDomainEntry } from '../core/types.js';
import { BLE_MOCK_ENTRY } from './ble.js';
import { BLOSSOM_MOCK_ENTRY } from './blossom.js';
import { CAPTURE_MOCK_ENTRY } from './capture.js';
import { CATALOG_MOCK_ENTRY } from './catalog.js';
import { CLASS_MOCK_ENTRY, CLASS_1_MOCK_ENTRY, CLASS_2_MOCK_ENTRY } from './class.js';
import { COMMON_MOCK_ENTRY } from './common.js';
import { CONFIG_MOCK_ENTRY } from './config.js';
import { CONNECT_MOCK_ENTRY } from './connect.js';
import { COUNT_MOCK_ENTRY } from './count.js';
import { CVM_MOCK_ENTRY } from './cvm.js';
import { DISPLAY_MOCK_ENTRY } from './display.js';
import { DM_MOCK_ENTRY } from './dm.js';
import { FS_MOCK_ENTRY } from './fs.js';
import { GAMEPAD_MOCK_ENTRY } from './gamepad.js';
import { GIT_MOCK_ENTRY } from './git.js';
import { HASHTREE_MOCK_ENTRY } from './hashtree.js';
import { IDENTITY_MOCK_ENTRY } from './identity.js';
import { INC_MOCK_ENTRY } from './inc.js';
import { INTENT_MOCK_ENTRY } from './intent.js';
import { KEYS_MOCK_ENTRY } from './keys.js';
import { LINK_MOCK_ENTRY } from './link.js';
import { LISTS_MOCK_ENTRY } from './lists.js';
import { LLM_MOCK_ENTRY } from './llm.js';
import { LOCATION_MOCK_ENTRY } from './location.js';
import { MEDIA_MOCK_ENTRY } from './media.js';
import { MESH_MOCK_ENTRY } from './mesh.js';
import { MOTION_MOCK_ENTRY } from './motion.js';
import { NAVIGATION_MOCK_ENTRY } from './navigation.js';
import { NOTIFY_MOCK_ENTRY } from './notify.js';
import { NZB_MOCK_ENTRY } from './nzb.js';
import { OUTBOX_MOCK_ENTRY } from './outbox.js';
import { POW_MOCK_ENTRY } from './pow.js';
import { RELAY_MOCK_ENTRY } from './relay.js';
import { RESOURCE_MOCK_ENTRY } from './resource.js';
import { SERIAL_MOCK_ENTRY } from './serial.js';
import { SHELL_MOCK_ENTRY } from './shell.js';
import { SOULSEEK_MOCK_ENTRY } from './soulseek.js';
import { STORAGE_MOCK_ENTRY } from './storage.js';
import { SYSTEM_MOCK_ENTRY } from './system.js';
import { THEME_MOCK_ENTRY } from './theme.js';
import { TORRENT_MOCK_ENTRY } from './torrent.js';
import { UPLOAD_MOCK_ENTRY } from './upload.js';
import { VALUE_MOCK_ENTRY } from './value.js';
import { WEBRTC_MOCK_ENTRY } from './webrtc.js';
import { WORKER_MOCK_ENTRY } from './worker.js';

export * from './ble.js';
export * from './blossom.js';
export * from './capture.js';
export * from './catalog.js';
export * from './class.js';
export * from './common.js';
export * from './config.js';
export * from './connect.js';
export * from './count.js';
export * from './cvm.js';
export * from './display.js';
export * from './dm.js';
export * from './fs.js';
export * from './gamepad.js';
export * from './git.js';
export * from './hashtree.js';
export * from './identity.js';
export * from './inc.js';
export * from './intent.js';
export * from './keys.js';
export * from './link.js';
export * from './lists.js';
export * from './llm.js';
export * from './location.js';
export * from './media.js';
export * from './mesh.js';
export * from './motion.js';
export * from './navigation.js';
export * from './notify.js';
export * from './nzb.js';
export * from './outbox.js';
export * from './pow.js';
export * from './relay.js';
export * from './resource.js';
export * from './serial.js';
export * from './shell.js';
export * from './soulseek.js';
export * from './storage.js';
export * from './system.js';
export * from './theme.js';
export * from './torrent.js';
export * from './upload.js';
export * from './value.js';
export * from './webrtc.js';
export * from './worker.js';
export * from './nostr-store.js';
export * from './torrent-fixtures.js';

/** Unsorted registry rows; `registry.ts` sorts them by domain. */
export const DOMAIN_ENTRIES: readonly MockDomainEntry[] = Object.freeze([
  BLE_MOCK_ENTRY,
  BLOSSOM_MOCK_ENTRY,
  CAPTURE_MOCK_ENTRY,
  CATALOG_MOCK_ENTRY,
  CLASS_MOCK_ENTRY,
  CLASS_1_MOCK_ENTRY,
  CLASS_2_MOCK_ENTRY,
  COMMON_MOCK_ENTRY,
  CONFIG_MOCK_ENTRY,
  CONNECT_MOCK_ENTRY,
  COUNT_MOCK_ENTRY,
  CVM_MOCK_ENTRY,
  DISPLAY_MOCK_ENTRY,
  DM_MOCK_ENTRY,
  FS_MOCK_ENTRY,
  GAMEPAD_MOCK_ENTRY,
  GIT_MOCK_ENTRY,
  HASHTREE_MOCK_ENTRY,
  IDENTITY_MOCK_ENTRY,
  INC_MOCK_ENTRY,
  INTENT_MOCK_ENTRY,
  KEYS_MOCK_ENTRY,
  LINK_MOCK_ENTRY,
  LISTS_MOCK_ENTRY,
  LLM_MOCK_ENTRY,
  LOCATION_MOCK_ENTRY,
  MEDIA_MOCK_ENTRY,
  MESH_MOCK_ENTRY,
  MOTION_MOCK_ENTRY,
  NAVIGATION_MOCK_ENTRY,
  NOTIFY_MOCK_ENTRY,
  NZB_MOCK_ENTRY,
  OUTBOX_MOCK_ENTRY,
  POW_MOCK_ENTRY,
  RELAY_MOCK_ENTRY,
  RESOURCE_MOCK_ENTRY,
  SERIAL_MOCK_ENTRY,
  SHELL_MOCK_ENTRY,
  SOULSEEK_MOCK_ENTRY,
  STORAGE_MOCK_ENTRY,
  SYSTEM_MOCK_ENTRY,
  THEME_MOCK_ENTRY,
  TORRENT_MOCK_ENTRY,
  UPLOAD_MOCK_ENTRY,
  VALUE_MOCK_ENTRY,
  WEBRTC_MOCK_ENTRY,
  WORKER_MOCK_ENTRY,
]);
