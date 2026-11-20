/**
 * kehto/versions.ts — Versions of the packages under test, fixed at build time.
 *
 * tsup replaces the two constants below from the workspace `package.json`
 * files (see `tsup.config.ts`). Running from source (unit tests) reports `dev`.
 */
declare const __KEHTO_CONFORMANCE_PACKAGES__: Readonly<Record<string, string>> | undefined;
declare const __KEHTO_CONFORMANCE_VERSION__: string | undefined;

/** `@kehto/*` and `@napplet/*` versions bundled into the first-party target. */
export const KEHTO_PACKAGE_VERSIONS: Readonly<Record<string, string>> = Object.freeze(
  typeof __KEHTO_CONFORMANCE_PACKAGES__ === 'undefined' ? { '@kehto/conformance': 'dev' } : __KEHTO_CONFORMANCE_PACKAGES__,
);

/** Version of `@kehto/conformance` itself. */
export const BUILT_ENGINE_VERSION: string = typeof __KEHTO_CONFORMANCE_VERSION__ === 'undefined' ? 'dev' : __KEHTO_CONFORMANCE_VERSION__;
