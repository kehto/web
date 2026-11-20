/**
 * kehto/domains/index.ts — Every full-profile backend module, in boot order.
 */
import { COUNT_BACKEND } from './count.js';
import { IDENTITY_BACKEND } from './identity.js';
import { THEME_BACKEND } from './theme.js';
import { LINK_BACKEND } from './link.js';
import { COMMON_BACKEND } from './common.js';
import { LISTS_BACKEND } from './lists.js';
import { CONFIG_BACKEND } from './config.js';
import { RESOURCE_BACKEND } from './resource.js';
import type { DomainBackendModule } from './types.js';

/** Backends the full profile installs. The minimal profile installs none. */
export const DOMAIN_BACKENDS: readonly DomainBackendModule[] = [
  IDENTITY_BACKEND,
  THEME_BACKEND,
  COUNT_BACKEND,
  LINK_BACKEND,
  COMMON_BACKEND,
  LISTS_BACKEND,
  CONFIG_BACKEND,
  RESOURCE_BACKEND,
];
