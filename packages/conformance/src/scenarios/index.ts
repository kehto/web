/**
 * scenarios/index.ts — The ordered scenario catalog every run executes.
 */
import type { Scenario } from '../scenario.js';
import { NIP5D_LOAD_SCENARIO } from './nip5d-load.js';
import { NIP5D_WIRE_SCENARIO } from './nip5d-wire.js';
import { SHELL_SCENARIO } from './shell.js';
import { DOMAINS_SCENARIO } from './domains.js';

/** Every scenario, in run order. */
export const SCENARIOS: readonly Scenario[] = [NIP5D_LOAD_SCENARIO, NIP5D_WIRE_SCENARIO, SHELL_SCENARIO, DOMAINS_SCENARIO];
