import { BUILT_ENGINE_VERSION } from './kehto/versions.js';

/** Engine version reported in every run; injected from package.json at build time. */
export const ENGINE_VERSION: string = BUILT_ENGINE_VERSION;
